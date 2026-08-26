import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasAdmin } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import { PLANS, isPlanId, type PlanId } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const today = () => new Date().toISOString().slice(0, 10);

// Plano "efetivo": aplica expiração de Pix e cancelamento (igual getSubState).
function effectivePlan(sub: {
  plan?: string;
  status?: string;
  provider?: string;
  current_period_end?: string | null;
} | undefined): PlanId {
  if (!sub || !isPlanId(sub.plan ?? "")) return "trial";
  let plan = sub.plan as PlanId;
  const expiredPix =
    sub.provider === "mercadopago_pix" &&
    !!sub.current_period_end &&
    sub.current_period_end < today();
  const expired = (expiredPix || sub.status === "canceled") && plan !== "trial";
  return expired ? "trial" : plan;
}

// Busca todas as linhas de uma tabela (o PostgREST limita a 1000 por query).
async function fetchAllRows(
  admin: ReturnType<typeof createAdminClient>,
  table: string,
  columns: string
): Promise<Record<string, unknown>[]> {
  const size = 1000;
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await admin
      .from(table)
      .select(columns)
      .range(from, from + size - 1);
    if (error || !data || data.length === 0) break;
    rows.push(...(data as unknown as Record<string, unknown>[]));
    if (data.length < size) break;
  }
  return rows;
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  if (!isAdminEmail(user.email))
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  if (!hasAdmin())
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_KEY ausente no servidor." },
      { status: 400 }
    );

  const admin = createAdminClient();

  const [subsRes, usersRes, sessionsRes] = await Promise.all([
    admin.from("prospect_subscriptions").select("*"),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("prospect_wa_sessions").select("owner_id,status,last_seen"),
  ]);

  // Tabelas grandes: pagina (o PostgREST corta em 1000 linhas por query).
  const leadRows = await fetchAllRows(admin, "leads", "team_id");
  const campaignRows = await fetchAllRows(
    admin,
    "prospect_campaigns",
    "team_id,sent,status"
  );

  // Agregações por time/dono.
  const leadsByTeam = new Map<string, number>();
  for (const r of leadRows) {
    const t = r.team_id as string | null;
    if (t) leadsByTeam.set(t, (leadsByTeam.get(t) ?? 0) + 1);
  }

  const activeByTeam = new Map<string, number>();
  let messagesSent = 0;
  for (const c of campaignRows) {
    messagesSent += (c.sent as number) ?? 0;
    if (c.status === "running") {
      const t = c.team_id as string;
      if (t) activeByTeam.set(t, (activeByTeam.get(t) ?? 0) + 1);
    }
  }

  const sessions = sessionsRes.data ?? [];
  const connectedOwners = new Set<string>();
  for (const s of sessions) {
    if (
      s.status === "conectado" &&
      s.last_seen &&
      Date.now() - new Date(s.last_seen).getTime() < 180_000
    ) {
      connectedOwners.add(s.owner_id as string);
    }
  }

  const subs = subsRes.data ?? [];
  const users = usersRes.data?.users ?? [];
  const subByUser = new Map(subs.map((s) => [s.user_id, s]));

  // Assinantes = todas as contas, mescladas com a assinatura (padrão trial).
  const subscribers = users
    .map((u) => {
      const s = subByUser.get(u.id);
      const plan = effectivePlan(s);
      return {
        email: u.email ?? "—",
        plan,
        rawPlan: s?.plan ?? "trial",
        status: s?.status ?? "active",
        provider: s?.provider ?? null,
        currentPeriodEnd: s?.current_period_end ?? null,
        searchesUsed: s?.searches_used ?? 0,
        leads: leadsByTeam.get(u.id) ?? 0,
        activeCampaigns: activeByTeam.get(u.id) ?? 0,
        whatsappConnected: connectedOwners.has(u.id),
        createdAt: u.created_at ?? null,
        lastSignInAt: u.last_sign_in_at ?? null,
      };
    })
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  // KPIs de faturamento
  const planCounts: Record<PlanId, number> = {
    trial: 0,
    essencial: 0,
    pro: 0,
    agencia: 0,
  };
  let mrr = 0;
  for (const s of subscribers) {
    planCounts[s.plan]++;
    mrr += PLANS[s.plan].price;
  }
  const totalUsers = subscribers.length;
  const payingCustomers = totalUsers - planCounts.trial;
  const conversion = totalUsers ? payingCustomers / totalUsers : 0;

  const revenueByPlan = (Object.keys(PLANS) as PlanId[])
    .filter((p) => p !== "trial")
    .map((p) => ({
      plan: p,
      name: PLANS[p].name,
      price: PLANS[p].price,
      count: planCounts[p],
      revenue: planCounts[p] * PLANS[p].price,
    }));

  let activeCampaigns = 0;
  for (const v of activeByTeam.values()) activeCampaigns += v;

  return NextResponse.json({
    kpis: {
      mrr,
      payingCustomers,
      totalUsers,
      conversion,
    },
    planCounts,
    revenueByPlan,
    usage: {
      leads: leadRows.length,
      messagesSent,
      activeCampaigns,
      connectedNumbers: connectedOwners.size,
    },
    subscribers,
  });
}
