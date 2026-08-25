"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PLANS, isPlanId, type PlanId } from "@/lib/plans";

export interface Subscription {
  plan: PlanId;
  used: number;
  quota: number;
  status: string;
  currentPeriodEnd: string | null;
  expired: boolean;
  provider: string | null;
}

export function useSubscription() {
  const supabase = createClient();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .maybeSingle();

    const storedPlan: PlanId = data && isPlanId(data.plan) ? data.plan : "trial";
    const todayISO = new Date().toISOString().slice(0, 10);
    const expired =
      (data?.provider === "mercadopago_pix" &&
        !!data?.current_period_end &&
        data.current_period_end < todayISO) ||
      data?.status === "canceled";
    const plan: PlanId = expired ? "trial" : storedPlan;

    setSub({
      plan,
      used: data?.searches_used ?? 0,
      quota: PLANS[plan].searchQuota,
      status: data?.status ?? "active",
      currentPeriodEnd: data?.current_period_end ?? null,
      expired: expired && storedPlan !== "trial",
      provider: data?.provider ?? null,
    });
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  return { sub, loading, reload: load };
}
