"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Interaction, Lead, LeadInput } from "@/lib/types";
import { STATUSES } from "@/lib/types";
import { whatsappLink } from "@/lib/format";

const EMPTY: LeadInput = {
  name: "",
  niche: "",
  city: "",
  phone: "",
  whatsapp: "",
  instagram: "",
  email: "",
  website: "",
  has_website: false,
  status: "novo",
  value: 0,
  notes: "",
  next_followup: null,
};

export default function LeadModal({
  lead,
  onClose,
  onSave,
  onDelete,
}: {
  lead: Lead | null; // null = novo
  onClose: () => void;
  onSave: (input: LeadInput, id?: string) => Promise<void>;
  onDelete?: (id: string) => void;
}) {
  const editing = !!lead;
  const [form, setForm] = useState<LeadInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (lead) {
      const { id, user_id, team_id, created_at, updated_at, ...rest } = lead;
      setForm(rest);
    } else {
      setForm(EMPTY);
    }
  }, [lead]);

  function set<K extends keyof LeadInput>(k: K, v: LeadInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave(form, lead?.id);
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-ink/40" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-paper h-full overflow-y-auto shadow-pop fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-paper border-b border-line px-6 py-4 flex items-center justify-between z-10">
          <div>
            <p className="eyebrow">{editing ? "Editar lead" : "Novo lead"}</p>
            <h2 className="font-display text-xl font-bold mt-0.5">
              {form.name || "Sem nome"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 grid place-items-center rounded hover:bg-soft text-muted"
          >
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-5">
          <Input label="Nome do negócio *" value={form.name} onChange={(v) => set("name", v)} required />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nicho" value={form.niche ?? ""} onChange={(v) => set("niche", v)} placeholder="Restaurante, clínica…" />
            <Input label="Cidade" value={form.city ?? ""} onChange={(v) => set("city", v)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Telefone" value={form.phone ?? ""} onChange={(v) => set("phone", v)} />
            <Input label="WhatsApp" value={form.whatsapp ?? ""} onChange={(v) => set("whatsapp", v)} placeholder="(11) 90000-0000" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Instagram" value={form.instagram ?? ""} onChange={(v) => set("instagram", v)} placeholder="@perfil" />
            <Input label="E-mail" type="email" value={form.email ?? ""} onChange={(v) => set("email", v)} />
          </div>

          <div className="rounded border border-line p-4 bg-soft/60">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.has_website}
                onChange={(e) => set("has_website", e.target.checked)}
                className="h-4 w-4 accent-brand"
              />
              <span className="text-sm font-medium">Este negócio já tem site</span>
            </label>
            {form.has_website && (
              <div className="mt-3">
                <Input label="URL do site" value={form.website ?? ""} onChange={(v) => set("website", v)} placeholder="https://…" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="eyebrow">Etapa</span>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value as LeadInput["status"])}
                className="mt-1 w-full h-11 px-3 border border-line rounded bg-white outline-none focus:border-ink"
              >
                {STATUSES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Valor potencial (R$)"
              type="number"
              value={String(form.value ?? 0)}
              onChange={(v) => set("value", Number(v) || 0)}
            />
          </div>

          <label className="block">
            <span className="eyebrow">Próximo follow-up</span>
            <input
              type="date"
              value={form.next_followup ?? ""}
              onChange={(e) => set("next_followup", e.target.value || null)}
              className="mt-1 w-full h-11 px-3 border border-line rounded bg-white outline-none focus:border-ink"
            />
          </label>

          <label className="block">
            <span className="eyebrow">Anotações</span>
            <textarea
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              className="mt-1 w-full px-3 py-2 border border-line rounded bg-white outline-none focus:border-ink resize-none"
            />
          </label>

          {form.whatsapp && (
            <a
              href={whatsappLink(
                form.whatsapp,
                `Olá! Falo com o ${form.name}? Vi que vocês ${
                  form.has_website ? "têm presença online" : "ainda não têm site"
                } e queria mostrar como um site profissional pode trazer mais clientes.`
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-green-700 border border-green-200 bg-green-50 rounded px-3 h-10 hover:bg-green-100"
            >
              <IconWhats /> Abrir conversa no WhatsApp
            </a>
          )}

          <div className="flex items-center gap-3 pt-2 border-t border-line">
            <button
              type="submit"
              disabled={saving}
              className="bg-brand hover:bg-brand-600 text-white font-medium h-11 px-6 rounded disabled:opacity-60"
            >
              {saving ? "Salvando…" : editing ? "Salvar alterações" : "Cadastrar lead"}
            </button>
            <button type="button" onClick={onClose} className="text-muted hover:text-ink h-11 px-4">
              Cancelar
            </button>
            {editing && onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Excluir este lead?")) {
                    onDelete(lead!.id);
                    onClose();
                  }
                }}
                className="ml-auto text-brand hover:text-brand-700 text-sm"
              >
                Excluir
              </button>
            )}
          </div>
        </form>

        {editing && <InteractionLog leadId={lead!.id} teamId={lead!.team_id} />}
      </div>
    </div>
  );
}

function InteractionLog({
  leadId,
  teamId,
}: {
  leadId: string;
  teamId: string | null;
}) {
  const supabase = createClient();
  const [items, setItems] = useState<Interaction[]>([]);
  const [type, setType] = useState<Interaction["type"]>("nota");
  const [content, setContent] = useState("");

  useEffect(() => {
    supabase
      .from("interactions")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setItems((data as Interaction[]) ?? []));
  }, [leadId, supabase]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("interactions")
      .insert({
        lead_id: leadId,
        user_id: user.id,
        team_id: teamId ?? user.id,
        type,
        content,
      })
      .select("*")
      .single();
    if (data) {
      setItems((prev) => [data as Interaction, ...prev]);
      setContent("");
    }
  }

  const TYPES: Interaction["type"][] = ["nota", "ligacao", "whatsapp", "email", "reuniao"];

  return (
    <div className="border-t border-line px-6 py-6 bg-soft/40">
      <p className="eyebrow mb-3">Histórico de contato</p>
      <form onSubmit={add} className="flex gap-2 mb-4">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as Interaction["type"])}
          className="h-10 px-2 border border-line rounded bg-white text-sm"
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Registrar interação…"
          className="flex-1 h-10 px-3 border border-line rounded bg-white text-sm outline-none focus:border-ink"
        />
        <button className="h-10 px-4 bg-ink text-white rounded text-sm">Add</button>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma interação registrada ainda.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => (
            <li key={it.id} className="flex gap-3 text-sm">
              <span className="mt-1 h-2 w-2 rounded-full bg-brand shrink-0" />
              <div>
                <span className="eyebrow">{it.type}</span>
                <p className="text-ink">{it.content}</p>
                <span className="text-xs text-muted">
                  {new Date(it.created_at).toLocaleString("pt-BR")}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full h-11 px-3 border border-line rounded bg-white outline-none focus:border-ink"
      />
    </label>
  );
}

function IconWhats() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-1-.3-1.6-.6-2.9-1.3-4.8-4.2-4.9-4.4-.1-.2-1.2-1.5-1.2-2.9s.7-2 1-2.3c.2-.3.5-.4.7-.4h.5c.2 0 .4 0 .6.5.2.5.7 1.8.8 1.9.1.1.1.3 0 .5-.3.6-.6.8-.8 1-.2.2-.3.3-.1.6.2.3.9 1.4 1.9 2.3 1.3 1.1 2.3 1.4 2.6 1.6.3.1.4.1.6-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1.2.1 1.5.7 1.7.9.2.1.4.2.4.3.1.1.1.6-.1 1.1Z" />
    </svg>
  );
}
