"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_TEMPLATES } from "@/lib/templates";

export interface MessageTemplate {
  id: string;
  name: string;
  body: string;
}

// Modelos de mensagem persistidos por time. Na primeira vez, semeia os
// modelos padrão no banco para que fiquem editáveis.
export function useTemplates() {
  const supabase = createClient();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const seeding = useRef(false);

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

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    let { data } = await supabase
      .from("prospect_templates")
      .select("id,name,body")
      .order("created_at", { ascending: true });

    if ((!data || data.length === 0) && !seeding.current) {
      seeding.current = true;
      const teamId = await resolveTeam(user.id);
      const rows = DEFAULT_TEMPLATES.map((t) => ({
        user_id: user.id,
        team_id: teamId,
        name: t.name,
        body: t.body,
      }));
      const ins = await supabase
        .from("prospect_templates")
        .insert(rows)
        .select("id,name,body");
      data = ins.data ?? [];
      seeding.current = false;
    }

    setTemplates((data as MessageTemplate[]) ?? []);
    setLoading(false);
  }, [supabase, resolveTeam]);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(
    async (name: string, body: string): Promise<MessageTemplate | null> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const teamId = await resolveTeam(user.id);
      const { data } = await supabase
        .from("prospect_templates")
        .insert({ user_id: user.id, team_id: teamId, name, body })
        .select("id,name,body")
        .single();
      if (data) setTemplates((prev) => [...prev, data as MessageTemplate]);
      return (data as MessageTemplate) ?? null;
    },
    [supabase, resolveTeam]
  );

  const update = useCallback(
    async (id: string, patch: Partial<Pick<MessageTemplate, "name" | "body">>) => {
      setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      await supabase.from("prospect_templates").update(patch).eq("id", id);
    },
    [supabase]
  );

  const remove = useCallback(
    async (id: string) => {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      await supabase.from("prospect_templates").delete().eq("id", id);
    },
    [supabase]
  );

  return { templates, loading, load, create, update, remove };
}
