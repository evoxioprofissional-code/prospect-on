// =====================================================================
// ProspectOn — Worker de disparo automático (via Evolution API)
//
// MULTI-CONTA. Fica ligado 24/7 (serviço no Railway) e atende TODAS as
// contas: cada time/dono tem a própria instância no Evolution
// (prospect_<team_id>) com o próprio número de WhatsApp. O worker descobre
// as contas com campanha ativa e roda um processador independente para
// cada uma, em paralelo, respeitando as regras de cada campanha (intervalo
// aleatório, janela de horário, limite diário, pausa em lote).
//
// Ele NÃO segura a conexão do WhatsApp — quem faz isso é o Evolution.
// Usa a chave SECRETA do Supabase (ignora RLS) e a apikey do Evolution.
// =====================================================================

import { createClient } from "@supabase/supabase-js";
import ws from "ws";

// ---------------------------------------------------------------- config
const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY || "").trim();
const EVOLUTION_URL = (process.env.EVOLUTION_API_URL || "").replace(/\/$/, "").trim();
const EVOLUTION_KEY = (process.env.EVOLUTION_API_KEY || "").trim();
// Opcional: limita o worker a UM time (útil para testar). Vazio = todas as contas.
const ONLY_TEAM = (process.env.WORKER_OWNER_ID || "").trim();
const POLL_MS = Number(process.env.POLL_MS || 15000);
const SCAN_MS = Number(process.env.SCAN_MS || 10000);

const missing = [];
if (!SUPABASE_URL) missing.push("SUPABASE_URL");
if (!SERVICE_KEY) missing.push("SUPABASE_SERVICE_KEY");
if (!EVOLUTION_URL) missing.push("EVOLUTION_API_URL");
if (!EVOLUTION_KEY) missing.push("EVOLUTION_API_KEY");
if (missing.length) {
  console.error("Faltam variáveis de ambiente:", missing.join(", "));
  process.exit(1);
}

const supa = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  // Node < 22 não tem WebSocket nativo; o supabase-js exige um. Passamos o "ws".
  realtime: { transport: ws },
});

const log = (...a) => console.log(new Date().toISOString(), "-", ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => Math.floor(min + Math.random() * (max - min + 1));

const runners = new Map(); // teamId -> true (processador ativo)
const batchCount = new Map(); // campaignId -> envios desde a última pausa em lote

const instanceFor = (teamId) => `prospect_${teamId}`;

// ------------------------------------------------------------- evolution
function evo(path, init) {
  return fetch(`${EVOLUTION_URL}${path}`, {
    ...init,
    headers: {
      apikey: EVOLUTION_KEY,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

async function connectionState(instance) {
  try {
    const st = await evo(`/instance/connectionState/${instance}`).then((r) => r.json());
    return st.instance?.state ?? st.state ?? "close";
  } catch {
    return "close";
  }
}

async function sendText(instance, number, text) {
  const res = await evo(`/message/sendText/${instance}`, {
    method: "POST",
    body: JSON.stringify({ number, text }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data?.key?.id ?? null;
}

// ------------------------------------------------------------- sessão db
async function syncSession(teamId, status) {
  try {
    await supa.from("prospect_wa_sessions").upsert(
      {
        owner_id: teamId,
        instance_name: instanceFor(teamId),
        status,
        last_seen: new Date().toISOString(),
      },
      { onConflict: "owner_id" }
    );
  } catch {
    /* ignora */
  }
}

// ------------------------------------------------------------- fila
// Hora e data no fuso do Brasil (o Railway roda em UTC; a janela de horário
// e o "limite por dia" precisam seguir o horário local, não o do servidor).
const TZ = process.env.WORKER_TZ || "America/Sao_Paulo";
function brNow() {
  const d = new Date();
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(d)
  );
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d); // YYYY-MM-DD
  return { hour, date };
}

function withinWindow(hour, start, end) {
  if (start === end) return true;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

function normalizeBR(phone) {
  let d = String(phone || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (!d.startsWith("55") && (d.length === 10 || d.length === 11)) d = "55" + d;
  return d;
}

async function teamHasRunning(teamId) {
  const { count } = await supa
    .from("prospect_campaigns")
    .select("id", { count: "exact", head: true })
    .eq("status", "running")
    .eq("team_id", teamId);
  return (count || 0) > 0;
}

// Próxima mensagem elegível de UM time (respeita janela e limite diário).
async function nextJobForTeam(teamId) {
  const { data: camps, error } = await supa
    .from("prospect_campaigns")
    .select("*")
    .eq("status", "running")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true });
  if (error) {
    log("erro lendo campanhas:", error.message);
    return null;
  }

  const { hour, date: today } = brNow();

  for (const c of camps || []) {
    if (!withinWindow(hour, c.window_start_hour, c.window_end_hour)) continue;

    const sentToday = c.sent_today_date === today ? c.sent_today : 0;
    if (c.daily_cap > 0 && sentToday >= c.daily_cap) continue;

    const { data: msgs } = await supa
      .from("prospect_campaign_messages")
      .select("*")
      .eq("campaign_id", c.id)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1);

    if (msgs && msgs.length) return { campaign: c, message: msgs[0], today };

    await supa.from("prospect_campaigns").update({ status: "done" }).eq("id", c.id);
    log(`campanha "${c.name}" concluída.`);
  }
  return null;
}

async function failMessage(id, reason) {
  await supa
    .from("prospect_campaign_messages")
    .update({ status: "failed", error: String(reason).slice(0, 300) })
    .eq("id", id);
}

// Igual ao disparo manual: sobe o lead de "novo" para "contatado" (sem mexer
// em estágios mais avançados) e registra a interação, para o funil andar.
async function markLeadContacted(message) {
  if (!message.lead_id) return;
  try {
    await supa
      .from("leads")
      .update({ status: "contatado" })
      .eq("id", message.lead_id)
      .eq("status", "novo");
    await supa.from("interactions").insert({
      lead_id: message.lead_id,
      user_id: message.user_id,
      team_id: message.team_id,
      type: "whatsapp",
      content: message.body,
    });
  } catch (e) {
    log("erro ao atualizar lead:", e.message);
  }
}

async function handle({ campaign, message, today }, instance) {
  const number = normalizeBR(message.phone);
  if (number.length < 10) {
    await failMessage(message.id, "Número inválido");
    await supa
      .from("prospect_campaigns")
      .update({ failed: campaign.failed + 1 })
      .eq("id", campaign.id);
    return;
  }

  try {
    await sendText(instance, number, message.body);

    await supa
      .from("prospect_campaign_messages")
      .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
      .eq("id", message.id);

    const newSentToday = (campaign.sent_today_date === today ? campaign.sent_today : 0) + 1;
    await supa
      .from("prospect_campaigns")
      .update({
        sent: campaign.sent + 1,
        sent_today: newSentToday,
        sent_today_date: today,
      })
      .eq("id", campaign.id);

    await markLeadContacted(message);
    log(`enviado → ${message.phone}  [${campaign.name}]`);

    // Pausa em lote a cada N envios.
    let extra = 0;
    const n = (batchCount.get(campaign.id) || 0) + 1;
    batchCount.set(campaign.id, n);
    if (campaign.batch_size > 0 && n % campaign.batch_size === 0) {
      extra = campaign.batch_pause_min * 60_000;
      log(`pausa em lote de ${campaign.batch_pause_min} min após ${n} envios.`);
    }

    const base = rand(campaign.min_delay_sec, campaign.max_delay_sec) * 1000;
    await sleep(base + extra);
  } catch (e) {
    await failMessage(message.id, e.message || "erro no envio");
    await supa
      .from("prospect_campaigns")
      .update({ failed: campaign.failed + 1 })
      .eq("id", campaign.id);
    log("falha no envio:", e.message);
    await sleep(5000);
  }
}

// Processa a fila de UM time até acabar (ou o número desconectar de vez).
async function runTeam(teamId) {
  const instance = instanceFor(teamId);
  log(`processando conta ${teamId} (instância ${instance})`);
  try {
    for (;;) {
      const state = await connectionState(instance);
      await syncSession(
        teamId,
        state === "open" ? "conectado" : state === "connecting" ? "conectando" : "desconectado"
      );

      if (state !== "open") {
        // Número não está conectado: espera enquanto houver campanha ativa.
        if (!(await teamHasRunning(teamId))) break;
        await sleep(POLL_MS);
        continue;
      }

      const job = await nextJobForTeam(teamId);
      if (!job) break; // sem trabalho pendente → encerra o processador
      await handle(job, instance);
    }
  } finally {
    runners.delete(teamId);
  }
}

// Descobre contas com campanha ativa e garante um processador para cada.
async function ensureRunners() {
  let q = supa.from("prospect_campaigns").select("team_id").eq("status", "running");
  if (ONLY_TEAM) q = q.eq("team_id", ONLY_TEAM);
  const { data, error } = await q;
  if (error) {
    log("erro no scan de campanhas:", error.message);
    return;
  }
  const teams = [...new Set((data || []).map((r) => r.team_id))];
  for (const t of teams) {
    if (!runners.has(t)) {
      runners.set(t, true);
      runTeam(t).catch((e) => {
        log("runner falhou:", t, e.message);
        runners.delete(t);
      });
    }
  }
}

async function main() {
  log(
    `ProspectOn worker iniciando (multi-conta${ONLY_TEAM ? `, restrito a ${ONLY_TEAM}` : ""}).`
  );
  for (;;) {
    try {
      await ensureRunners();
    } catch (e) {
      log("erro no loop principal:", e.message);
    }
    await sleep(SCAN_MS);
  }
}

main();
