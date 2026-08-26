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

  const [subsRes, usersRes, leadsCountRes, campaignsRes, sessionsRes] =
    await Promise.all([
      admin.from("prospect_subscriptions").select("*"),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      admin.from("leads").select("id", { count: "exact", head: true }),
      admin.from("prospect_campaigns").select("sent,status"),
      admin.from("prospect_wa_sessions").select("status,last_seen"),
    ]);

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

  // Uso agregado
  const campaigns = campaignsRes.data ?? [];
  const messagesSent = campaigns.reduce((acc, c) => acc + (c.sent ?? 0), 0);
  const activeCampaigns = campaigns.filter((c) => c.status === "running").length;
  const sessions = sessionsRes.data ?? [];
  const connectedNumbers = sessions.filter(
    (s) =>
      s.status === "conectado" &&
      s.last_seen &&
      Date.now() - new Date(s.last_seen).getTime() < 180_000
  ).length;

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
      leads: leadsCountRes.count ?? 0,
      messagesSent,
      activeCampaigns,
      connectedNumbers,
    },
    subscribers,
  });
}
