import { createAdminClient, hasAdmin } from "@/lib/supabase/admin";
import { resolveTeamOwner } from "@/lib/team-server";
import { PLANS, isPlanId, type PlanId } from "@/lib/plans";

export interface SubState {
  plan: PlanId;
  used: number;
  quota: number;
  ai: boolean;
  seats: number;
  ownerId: string;
  isOwner: boolean;
  expired?: boolean;
  enforced: boolean; // false = sem chave secreta (não medindo)
}

function sameMonth(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth()
  );
}

// Lê (e cria/reseta) a assinatura do usuário. Sem chave secreta configurada,
// roda em "fail-open": não mede nem bloqueia (útil durante o setup).
export async function getSubState(userId: string): Promise<SubState> {
  if (!hasAdmin()) {
    return {
      plan: "trial",
      used: 0,
      quota: Infinity,
      ai: true,
      seats: 1,
      ownerId: userId,
      isOwner: true,
      enforced: false,
    };
  }
  const admin = createAdminClient();

  // A assinatura pertence ao DONO do time; membros herdam o plano.
  const ownerId = await resolveTeamOwner(userId);

  let { data } = await admin
    .from("prospect_subscriptions")
    .select("*")
    .eq("user_id", ownerId)
    .maybeSingle();

  if (!data) {
    const ins = await admin
      .from("prospect_subscriptions")
      .insert({ user_id: ownerId })
      .select("*")
      .single();
    data = ins.data;
  } else if (!sameMonth(data.period_start)) {
    const upd = await admin
      .from("prospect_subscriptions")
      .update({
        searches_used: 0,
        period_start: new Date().toISOString().slice(0, 10),
      })
      .eq("user_id", ownerId)
      .select("*")
      .single();
    data = upd.data ?? data;
  }

  const storedPlan: PlanId =
    data && isPlanId(data.plan) ? data.plan : "trial";

  // Pix é avulso: se passou a validade de 30 dias, cai pro Trial.
  const todayISO = new Date().toISOString().slice(0, 10);
  const expiredPix =
    data?.provider === "mercadopago_pix" &&
    data?.current_period_end &&
    data.current_period_end < todayISO;
  const expired =
    (!!expiredPix || data?.status === "canceled") && storedPlan !== "trial";
  const plan: PlanId = expired ? "trial" : storedPlan;

  const p = PLANS[plan];
  return {
    plan,
    used: data?.searches_used ?? 0,
    quota: p.searchQuota,
    ai: p.ai,
    seats: p.seats,
    ownerId,
    isOwner: userId === ownerId,
    expired,
    enforced: true,
  };
}

export async function consumeSearch(userId: string): Promise<void> {
  if (!hasAdmin()) return;
  const admin = createAdminClient();
  const ownerId = await resolveTeamOwner(userId);
  const { data } = await admin
    .from("prospect_subscriptions")
    .select("searches_used")
    .eq("user_id", ownerId)
    .maybeSingle();
  const used = data?.searches_used ?? 0;
  await admin
    .from("prospect_subscriptions")
    .update({ searches_used: used + 1 })
    .eq("user_id", ownerId);
}
