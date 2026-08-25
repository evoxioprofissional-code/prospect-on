"use client";

import { useEffect, useMemo, useState } from "react";
import { useLeads } from "@/lib/useLeads";
import { createClient } from "@/lib/supabase/client";
import { STATUSES, type Lead, type LeadStatus } from "@/lib/types";
import { whatsappLink, initials } from "@/lib/format";
import { DEFAULT_TEMPLATES, resolveTemplate } from "@/lib/templates";
import PageHeader from "@/components/PageHeader";

const LS_KEY = "prospect_template_v1";
const LS_EMPRESA = "prospect_empresa_v1";

type Filter = "todos" | "sem_site" | LeadStatus;

export default function DisparoPage() {
  const { leads, loading, update } = useLeads();
  const supabase = createClient();

  const [empresa, setEmpresa] = useState("");
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATES[0].id);
  const [body, setBody] = useState(DEFAULT_TEMPLATES[0].body);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState<Set<string>>(new Set());
  const [aiError, setAiError] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("novo");

  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      try {
        const { id, body } = JSON.parse(raw);
        if (body) setBody(body);
        if (id) setTemplateId(id);
      } catch {}
    }
    const emp = localStorage.getItem(LS_EMPRESA);
    if (emp) setEmpresa(emp);
  }, []);

  function persist(id: string, b: string) {
    localStorage.setItem(LS_KEY, JSON.stringify({ id, body: b }));
  }

  function pickTemplate(id: string) {
    const t = DEFAULT_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setTemplateId(id);
    setBody(t.body);
    setOverrides({});
    persist(id, t.body);
  }

  const withWhats = useMemo(() => leads.filter((l) => !!l.whatsapp), [leads]);

  const fila = useMemo(
    () =>
      withWhats.filter((l) => {
        if (filter === "sem_site") return !l.has_website;
        if (filter !== "todos") return l.status === filter;
        return true;
      }),
    [withWhats, filter]
  );

  const semWhats = leads.length - withWhats.length;
  const enviados = fila.filter((l) => sent.has(l.id)).length;
  const progress = fila.length ? Math.round((enviados / fila.length) * 100) : 0;

  function messageFor(lead: Lead): string {
    return overrides[lead.id] ?? resolveTemplate(body, lead, empresa);
  }

  async function gerarIA(lead: Lead) {
    setAiError(null);
    setAiLoading((s) => new Set(s).add(lead.id));
    try {
      const res = await fetch("/api/generate-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: lead.name,
          niche: lead.niche,
          city: lead.city,
          has_website: lead.has_website,
        }),
      });
      const data = await res.json();
      if (!res.ok) setAiError(data.error || "Falha ao gerar.");
      else setOverrides((o) => ({ ...o, [lead.id]: data.message }));
    } catch {
      setAiError("Erro de conexão com a IA.");
    }
    setAiLoading((s) => {
      const n = new Set(s);
      n.delete(lead.id);
      return n;
    });
  }

  async function enviar(lead: Lead) {
    const msg = messageFor(lead);
    window.open(whatsappLink(lead.whatsapp!, msg), "_blank", "noopener");
    setSent((s) => new Set(s).add(lead.id));
    if (lead.status === "novo") await update(lead.id, { status: "contatado" });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("interactions").insert({
        lead_id: lead.id,
        user_id: user.id,
        team_id: lead.team_id ?? user.id,
        type: "whatsapp",
        content: msg,
      });
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-5xl mx-auto">
      <PageHeader
        eyebrow="Abordagem em fila"
        title="Central de Disparo"
        subtitle="Mensagem personalizada por lead, enviada em 1 toque no WhatsApp."
      />

      {/* Configuração da mensagem */}
      <div className="bg-paper border border-line border-l-4 border-l-brand rounded-xl p-4 sm:p-5 mb-5">
        <label className="block mb-4">
          <span className="eyebrow">Sua empresa</span>
          <input
            value={empresa}
            onChange={(e) => {
              setEmpresa(e.target.value);
              localStorage.setItem(LS_EMPRESA, e.target.value);
            }}
            placeholder="Ex.: Studio X Sites"
            className="mt-1 w-full h-11 px-3 border border-line rounded-lg bg-white outline-none focus:border-ink"
          />
        </label>

        <span className="eyebrow">Modelo</span>
        <div className="flex gap-2 overflow-x-auto pb-1 mt-1 -mx-1 px-1 mb-3">
          {DEFAULT_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => pickTemplate(t.id)}
              className={`shrink-0 h-9 px-3 rounded-full text-sm border transition-colors ${
                templateId === t.id
                  ? "bg-brand text-white border-brand"
                  : "bg-white text-muted border-line hover:border-ink hover:text-ink"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setOverrides({});
            persist(templateId, e.target.value);
          }}
          rows={3}
          className="w-full px-3 py-2 border border-line rounded-lg bg-white outline-none focus:border-ink resize-none text-sm"
        />
        <div className="flex flex-wrap items-center gap-1 mt-2 text-xs text-muted">
          {["{empresa}", "{nome}", "{cidade}", "{nicho}", "{gancho}"].map((v) => (
            <code key={v} className="bg-soft px-1.5 py-0.5 rounded">
              {v}
            </code>
          ))}
          <span className="ml-1">preenchem sozinhos.</span>
        </div>
        {aiError && (
          <p className="text-sm text-brand-700 bg-brand-50 border border-brand/30 rounded-lg px-3 py-2 mt-3">
            {aiError}
          </p>
        )}
      </div>

      {/* Progresso */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="text-muted">Fila de disparo</span>
          <span className="tnum font-medium">
            {enviados}<span className="text-muted">/{fila.length} enviados</span>
          </span>
        </div>
        <div className="h-1.5 bg-soft rounded-full overflow-hidden">
          <div
            className="h-full bg-brand rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 mb-4">
        <Chip active={filter === "novo"} onClick={() => setFilter("novo")}>
          Novos
        </Chip>
        <Chip active={filter === "sem_site"} onClick={() => setFilter("sem_site")} accent>
          🔥 Sem site
        </Chip>
        <Chip active={filter === "todos"} onClick={() => setFilter("todos")}>
          Todos
        </Chip>
        {STATUSES.filter((s) => s.key !== "novo").map((s) => (
          <Chip key={s.key} active={filter === s.key} onClick={() => setFilter(s.key)}>
            {s.label}
          </Chip>
        ))}
      </div>

      {semWhats > 0 && (
        <p className="text-xs text-muted mb-4">
          {semWhats} lead(s) sem WhatsApp ficaram de fora — use o Google Places na
          descoberta pra trazer telefone.
        </p>
      )}

      {/* Fila */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 rounded-xl border border-line bg-soft animate-pulse" />
          ))}
        </div>
      ) : fila.length === 0 ? (
        <div className="border border-dashed border-line rounded-xl p-10 text-center text-muted">
          Nenhum lead com WhatsApp nesse filtro.
        </div>
      ) : (
        <ul className="space-y-3">
          {fila.map((lead) => {
            const isSent = sent.has(lead.id);
            const isAi = aiLoading.has(lead.id);
            return (
              <li
                key={lead.id}
                className={`border rounded-xl p-4 transition-colors ${
                  isSent
                    ? "border-green-200 bg-green-50/50"
                    : !lead.has_website
                    ? "border-line border-l-4 border-l-brand bg-paper"
                    : "border-line bg-paper"
                }`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <span className="h-9 w-9 shrink-0 rounded-lg bg-ink text-white grid place-items-center text-xs font-bold">
                    {initials(lead.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate leading-tight">
                      {lead.name}
                      {!lead.has_website && <span className="ml-1.5" title="Sem site">🔥</span>}
                    </p>
                    <p className="text-xs text-muted truncate">
                      {[lead.niche, lead.city].filter(Boolean).join(" · ") || "—"} · {lead.whatsapp}
                    </p>
                  </div>
                  {isSent && (
                    <span className="shrink-0 inline-flex items-center gap-1 text-xs text-green-700 font-medium bg-green-100 px-2 py-1 rounded-full">
                      ✓ Enviado
                    </span>
                  )}
                </div>

                <textarea
                  value={messageFor(lead)}
                  onChange={(e) =>
                    setOverrides((o) => ({ ...o, [lead.id]: e.target.value }))
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-line rounded-lg bg-white outline-none focus:border-ink resize-none text-sm leading-relaxed"
                />

                <div className="flex flex-col sm:flex-row gap-2 mt-3">
                  <button
                    onClick={() => gerarIA(lead)}
                    disabled={isAi}
                    className="h-10 px-3 rounded-lg border border-line text-sm hover:border-ink disabled:opacity-60 order-2 sm:order-1"
                  >
                    {isAi ? "Gerando…" : "✨ Gerar com IA"}
                  </button>
                  <button
                    onClick={() => enviar(lead)}
                    className="flex-1 sm:flex-none sm:ml-auto h-10 px-5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium inline-flex items-center justify-center gap-2 order-1 sm:order-2"
                  >
                    <IconWhats /> {isSent ? "Enviar de novo" : "Enviar no WhatsApp"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
  accent,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 h-9 px-3 rounded-full text-sm border transition-colors ${
        active
          ? "bg-brand text-white border-brand"
          : "bg-white text-muted border-line hover:border-ink hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function IconWhats() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-1-.3-1.6-.6-2.9-1.3-4.8-4.2-4.9-4.4-.1-.2-1.2-1.5-1.2-2.9s.7-2 1-2.3c.2-.3.5-.4.7-.4h.5c.2 0 .4 0 .6.5.2.5.7 1.8.8 1.9.1.1.1.3 0 .5-.3.6-.6.8-.8 1-.2.2-.3.3-.1.6.2.3.9 1.4 1.9 2.3 1.3 1.1 2.3 1.4 2.6 1.6.3.1.4.1.6-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1.2.1 1.5.7 1.7.9.2.1.4.2.4.3.1.1.1.6-.1 1.1Z" />
    </svg>
  );
}
