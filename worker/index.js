// =====================================================================
// ProspectOn — Worker de disparo automático (via Evolution API)
//
// Fica ligado 24/7 (serviço no Railway). NÃO segura a conexão do WhatsApp:
// quem faz isso é o Evolution API. O worker só lê a fila
// `prospect_campaign_messages` no Supabase e manda cada mensagem para o
// Evolution (POST /message/sendText/{instance}), respeitando as regras de
// cada campanha (intervalo aleatório, janela de horário, limite diário,
// pausa em lote).
//
// Usa a chave SECRETA do Supabase (ignora RLS) e a apikey do Evolution.
// =====================================================================

import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------- config
const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY || "").trim();
const EVOLUTION_URL = (process.env.EVOLUTION_API_URL || "").replace(/\/$/, "").trim();
const EVOLUTION_KEY = (process.env.EVOLUTION_API_KEY || "").trim();
const OWNER = (process.env.WORKER_OWNER_ID || "").trim(); // auth uid do dono do time
const POLL_MS = Number(process.env.POLL_MS || 15000);

const missing = [];
if (!SUPABASE_URL) missing.push("SUPABASE_URL");
if (!SERVICE_KEY) missing.push("SUPABASE_SERVICE_KEY");
if (!EVOLUTION_URL) missing.push("EVOLUTION_API_URL");
if (!EVOLUTION_KEY) missing.push("EVOLUTION_API_KEY");
if (!OWNER) missing.push("WORKER_OWNER_ID");
if (missing.length) {
  console.error("Faltam variáveis de ambiente:", missing.join(", "));
  process.exit(1);
}

const INSTANCE = `prospect_${OWNER}`;

const supa = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const log = (...a) => console.log(new Date().toISOString(), "-", ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => Math.floor(min + Math.random() * (max - min + 1));

const batchCount = new Map(); // campaignId -> envios desde a última pausa em lote

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

async function connectionState() {
  try {
    const st = await evo(`/instance/connectionState/${INSTANCE}`).then((r) => r.json());
    return st.instance?.state ?? st.state ?? "close";
  } catch {
    return "close";
  }
}

async function sendText(number, text) {
  const res = await evo(`/message/sendText/${INSTANCE}`, {
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
async function syncSession(status) {
  try {
    await supa.from("prospect_wa_sessions").upsert(
      {
        owner_id: OWNER,
        instance_name: INSTANCE,
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

async function nextJob() {
  const { data: camps, error } = await supa
    .from("prospect_campaigns")
    .select("*")
    .eq("status", "running")
    .eq("team_id", OWNER)
    .order("created_at", { ascending: true });
  if (error) {
    log("erro lendo campanhas:", error.message);
    return null;
  }

  const now = new Date();
  const hour = now.getHours();
  const today = now.toISOString().slice(0, 10);

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

async function handle({ campaign, message, today }) {
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
    await sendText(number, message.body);

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

// ------------------------------------------------------------- loop
async function loop() {
  for (;;) {
    try {
      const state = await connectionState();
      await syncSession(state === "open" ? "conectado" : state === "connecting" ? "conectando" : "desconectado");

      if (state !== "open") {
        await sleep(POLL_MS);
        continue;
      }

      const job = await nextJob();
      if (!job) {
        await sleep(POLL_MS);
        continue;
      }
      await handle(job);
    } catch (e) {
      log("erro no loop:", e.message);
      await sleep(POLL_MS);
    }
  }
}

log(`ProspectOn worker iniciando — instância ${INSTANCE}`);
loop();
