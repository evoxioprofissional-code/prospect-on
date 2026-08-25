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

    const plan: PlanId = data && isPlanId(data.plan) ? data.plan : "trial";
    setSub({
      plan,
      used: data?.searches_used ?? 0,
      quota: PLANS[plan].searchQuota,
      status: data?.status ?? "active",
      currentPeriodEnd: data?.current_period_end ?? null,
    });
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  return { sub, loading, reload: load };
}
