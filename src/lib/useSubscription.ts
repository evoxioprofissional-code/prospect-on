"use client";

import { useCallback, useEffect, useState } from "react";
import { PLANS, isPlanId, type PlanId } from "@/lib/plans";

export interface Subscription {
  plan: PlanId;
  used: number;
  quota: number;
  ai: boolean;
  seats: number;
  isOwner: boolean;
  expired: boolean;
}

export function useSubscription() {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/subscription", { cache: "no-store" });
      const data = await res.json();
      const plan: PlanId = isPlanId(data.plan) ? data.plan : "trial";
      setSub({
        plan,
        used: data.used ?? 0,
        quota: data.quota ?? PLANS[plan].searchQuota,
        ai: !!data.ai,
        seats: data.seats ?? PLANS[plan].seats,
        isOwner: data.isOwner !== false,
        expired: !!data.expired,
      });
    } catch {
      setSub({
        plan: "trial",
        used: 0,
        quota: PLANS.trial.searchQuota,
        ai: false,
        seats: 1,
        isOwner: true,
        expired: false,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { sub, loading, reload: load };
}
