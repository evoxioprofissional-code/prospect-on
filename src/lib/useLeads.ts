"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Lead, LeadInput, LeadStatus } from "@/lib/types";

export function useLeads() {
  const supabase = createClient();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setLeads((data as Lead[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  // Descobre o "time" do usuário: se ele é membro ativo de algum time,
  // usa o team_id do dono; senão, o próprio id (time solo).
  const resolveTeam = useCallback(
    async (userId: string) => {
      const { data } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("member_id", userId)
        .eq("status", "active")
        .maybeSingle();
      return data?.team_id ?? userId;
    },
    [supabase]
  );

  const create = useCallback(
    async (input: LeadInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { error: "Sessão expirada" };
      const teamId = await resolveTeam(user.id);
      const { data, error } = await supabase
        .from("leads")
        .insert({ ...input, user_id: user.id, team_id: teamId })
        .select("*")
        .single();
      if (error) return { error: error.message };
      setLeads((prev) => [data as Lead, ...prev]);
      return { data: data as Lead };
    },
    [supabase, resolveTeam]
  );

  const createMany = useCallback(
    async (inputs: LeadInput[]) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { error: "Sessão expirada", count: 0 };
      const teamId = await resolveTeam(user.id);
      const rows = inputs.map((i) => ({
        ...i,
        user_id: user.id,
        team_id: teamId,
      }));
      const { data, error } = await supabase
        .from("leads")
        .insert(rows)
        .select("*");
      if (error) return { error: error.message, count: 0 };
      setLeads((prev) => [...((data as Lead[]) ?? []), ...prev]);
      return { count: (data as Lead[])?.length ?? 0 };
    },
    [supabase, resolveTeam]
  );

  const update = useCallback(
    async (id: string, patch: Partial<LeadInput>) => {
      // otimista
      setLeads((prev) =>
        prev.map((l) => (l.id === id ? { ...l, ...patch } : l))
      );
      const { error } = await supabase
        .from("leads")
        .update(patch)
        .eq("id", id);
      if (error) {
        load();
        return { error: error.message };
      }
      return {};
    },
    [supabase, load]
  );

  const moveStatus = useCallback(
    (id: string, status: LeadStatus) => update(id, { status }),
    [update]
  );

  const remove = useCallback(
    async (id: string) => {
      setLeads((prev) => prev.filter((l) => l.id !== id));
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) load();
    },
    [supabase, load]
  );

  return {
    leads,
    loading,
    error,
    load,
    create,
    createMany,
    update,
    moveStatus,
    remove,
  };
}
