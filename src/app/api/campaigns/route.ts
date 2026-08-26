import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSubState } from "@/lib/subscription-server";
import { PLANS } from "@/lib/plans";
import {
  DEFAULT_SETTINGS,
  type CampaignSettings,
  type QueuedMessage,
} from "@/lib/campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function currentUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Descobre o time do usuário (dono do time se for membro ativo; senão ele mesmo).
async function resolveTeam(userId: string): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("member_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return data?.team_id ?? userId;
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function sanitizeSettings(raw: Partial<CampaignSettings> = {}): CampaignSettings {
  const s = { ...DEFAULT_SETTINGS, ...raw };
  const min = clampInt(s.min_delay_sec, 5, 3600, DEFAULT_SETTINGS.min_delay_sec);
  const max = clampInt(s.max_delay_sec, min, 7200, Math.max(min, DEFAULT_SETTINGS.max_delay_sec));
  return {
    min_delay_sec: min,
    max_delay_sec: max,
    daily_cap: clampInt(s.daily_cap, 0, 100000, DEFAULT_SETTINGS.daily_cap),
    window_start_hour: clampInt(s.window_start_hour, 0, 23, DEFAULT_SETTINGS.window_start_hour),
    window_end_hour: clampInt(s.window_end_hour, 0, 24, DEFAULT_SETTINGS.window_end_hour),
    batch_size: clampInt(s.batch_size, 0, 100000, DEFAULT_SETTINGS.batch_size),
    batch_pause_min: clampInt(s.batch_pause_min, 0, 1440, DEFAULT_SETTINGS.batch_pause_min),
  };
}

// GET — lista campanhas do usuário + estado da conexão do WhatsApp.
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

  const supabase = createClient();
  const ownerId = await resolveTeam(user.id);

  const [{ data: campaigns }, { data: session }] = await Promise.all([
    supabase
      .from("prospect_campaigns")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("prospect_wa_sessions")
      .select("status, qr, phone, last_seen, updated_at")
      .eq("owner_id", ownerId)
      .maybeSingle(),
  ]);

  // Se ninguém (worker/webhook) tocou a sessão há mais de 3 min, trata como
  // desconectada — sinal de que o disparo não está rodando.
  let waSession = session ?? null;
  if (waSession?.last_seen && waSession.status === "conectado") {
    const stale = Date.now() - new Date(waSession.last_seen).getTime() > 180_000;
    if (stale) waSession = { ...waSession, status: "desconectado" };
  }

  return NextResponse.json({ campaigns: campaigns ?? [], waSession });
}

// POST — cria uma campanha e enfileira as mensagens (já resolvidas).
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

  let body: {
    name?: string;
    empresa?: string;
    message_template?: string;
    settings?: Partial<CampaignSettings>;
    messages?: QueuedMessage[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Dê um nome à campanha." }, { status: 400 });

  const messages = (body.messages ?? []).filter(
    (m) => m && m.phone && m.body
  );
  if (messages.length === 0) {
    return NextResponse.json(
      { error: "Nenhum lead com WhatsApp no filtro selecionado." },
      { status: 400 }
    );
  }
  if (messages.length > 5000) {
    return NextResponse.json(
      { error: "Máximo de 5.000 mensagens por campanha." },
      { status: 400 }
    );
  }

  const supabase = createClient();
  const teamId = await resolveTeam(user.id);
  const settings = sanitizeSettings(body.settings);

  // Teto de disparo por campanha conforme o plano (grátis = 10).
  const sub = await getSubState(user.id);
  const cap = PLANS[sub.plan].campaignCap;
  let queued = messages;
  let capped = false;
  if (sub.enforced && Number.isFinite(cap) && messages.length > cap) {
    queued = messages.slice(0, cap);
    capped = true;
  }

  const { data: campaign, error: campErr } = await supabase
    .from("prospect_campaigns")
    .insert({
      user_id: user.id,
      team_id: teamId,
      name,
      empresa: (body.empresa ?? "").trim() || null,
      message_template: body.message_template ?? null,
      status: "running",
      total: queued.length,
      ...settings,
    })
    .select("*")
    .single();

  if (campErr || !campaign) {
    const msg = /relation .* does not exist/i.test(campErr?.message ?? "")
      ? "Tabelas de campanha não existem — rode supabase/campaigns.sql no Supabase."
      : campErr?.message ?? "Falha ao criar campanha.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const rows = queued.map((m) => ({
    campaign_id: campaign.id,
    user_id: user.id,
    team_id: teamId,
    lead_id: m.lead_id ?? null,
    name: m.name ?? null,
    phone: m.phone,
    body: m.body,
    status: "pending" as const,
  }));

  // Insere em lotes para não estourar limite de payload.
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase
      .from("prospect_campaign_messages")
      .insert(rows.slice(i, i + CHUNK));
    if (error) {
      // Rollback: remove a campanha (as mensagens já inseridas caem em cascata).
      await supabase.from("prospect_campaigns").delete().eq("id", campaign.id);
      return NextResponse.json(
        { error: "Falha ao enfileirar mensagens: " + error.message },
        { status: 400 }
      );
    }
  }

  return NextResponse.json({
    campaign,
    note: capped
      ? `O plano ${sub.plan} envia até ${cap} mensagens por campanha. Enfileiramos as primeiras ${queued.length}; faça upgrade para enviar para todos.`
      : undefined,
  });
}

// PATCH — pausar / retomar / cancelar uma campanha.
export async function PATCH(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

  let body: { id?: string; action?: "pause" | "resume" | "cancel" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }
  const { id, action } = body;
  if (!id || !action) {
    return NextResponse.json({ error: "id e action são obrigatórios." }, { status: 400 });
  }

  const nextStatus =
    action === "pause" ? "paused" : action === "resume" ? "running" : "canceled";

  const supabase = createClient();
  const { error } = await supabase
    .from("prospect_campaigns")
    .update({ status: nextStatus })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// DELETE — apaga a campanha e sua fila (cascade).
export async function DELETE(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id ausente." }, { status: 400 });

  const supabase = createClient();
  const { error } = await supabase.from("prospect_campaigns").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
