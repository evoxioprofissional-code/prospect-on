"use client";

import { useEffect, useMemo, useState } from "react";
import { useLeads } from "@/lib/useLeads";
import { createClient } from "@/lib/supabase/client";
import { STATUSES, type Lead, type LeadStatus } from "@/lib/types";
import { whatsappLink } from "@/lib/format";
import { DEFAULT_TEMPLATES, resolveTemplate } from "@/lib/templates";
import PageHeader from "@/components/PageHeader";

const LS_KEY = "prospect_template_v1";
const LS_EMPRESA = "prospect_empresa_v1";

type Filter = "todos" | "sem_site" | LeadStatus;

export default function DisparoPage() {
  const { leads, loading, update } = useLeads();
  const supabase = createClient();

  const [filter, setFilter] = useState<Filter>("novo");
  const [empresa, setEmpresa] = useState("");
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATES[0].id);
  const [body, setBody] = useState(DEFAULT_TEMPLATES[0].body);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState<Set<string>>(new Set());
  const [aiError, setAiError] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());

  // Carrega template + nome da empresa salvos
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
    setOverrides({}); // volta a derivar do template novo
    persist(id, t.body);
  }

  // Só dá pra disparar quem tem WhatsApp
  const withWhats = useMemo(
    () => leads.filter((l) => !!l.whatsapp),
    [leads]
  );

  const fila = useMemo(() => {
    return withWhats.filter((l) => {
      if (filter === "sem_site") return !l.has_website;
      if (filter !== "todos") return l.status === filter;
      return true;
    });
  }, [withWhats, filter]);

  const semWhats = leads.length - withWhats.length;
  const enviados = fila.filter((l) => sent.has(l.id)).length;

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

    // marca como Contatado (se ainda for Novo) e registra no histórico
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
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      <PageHeader
        eyebrow="Abordagem em fila"
        title="Central de Disparo"
        subtitle="Mensagem personalizada por lead, enviada em 1 toque no WhatsApp."
      />

      {/* Editor de template */}
      <div className="bg-paper border border-line rounded-lg p-5 mb-6">
        {/* Nome da empresa (preenche {empresa} em todos os modelos) */}
        <label className="block mb-4">
          <span className="eyebrow">Sua empresa</span>
          <input
            value={empresa}
            onChange={(e) => {
              setEmpresa(e.target.value);
              localStorage.setItem(LS_EMPRESA, e.target.value);
            }}
            placeholder="Ex.: Studio X Sites"
            className="mt-1 w-full h-11 px-3 border border-line rounded bg-white outline-none focus:border-ink"
          />
          <span className="text-xs text-muted mt-1 block">
            Preenchido uma vez — entra automático em todas as mensagens.
          </span>
        </label>

        <div className="flex flex-wrap gap-2 mb-4">
          {DEFAULT_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => pickTemplate(t.id)}
              className={`h-9 px-3 rounded-full text-sm border transition-colors ${
                templateId === t.id
                  ? "bg-ink text-white border-ink"
                  : "bg-white text-muted border-line hover:border-ink hover:text-ink"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="eyebrow">Modelo da mensagem</span>
          <textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setOverrides({});
              persist(templateId, e.target.value);
            }}
            rows={3}
            className="mt-1 w-full px-3 py-2 border border-line rounded bg-white outline-none focus:border-ink resize-none text-sm"
          />
        </label>
        <p className="text-xs text-muted mt-2">
          Variáveis:{" "}
          {["{empresa}", "{nome}", "{cidade}", "{nicho}", "{gancho}"].map((v) => (
            <code key={v} className="bg-soft px-1.5 py-0.5 rounded mr-1">
              {v}
            </code>
          ))}
          — <b>{"{gancho}"}</b> muda sozinho conforme o lead ter site ou não.
        </p>
        {aiError && (
          <p className="text-sm text-brand-700 bg-brand-50 border border-brand/30 rounded px-3 py-2 mt-3">
            {aiError}
          </p>
        )}
      </div>

      {/* Filtros + progresso */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
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
        <span className="ml-auto text-sm text-muted tnum">
          {enviados}/{fila.length} enviados
        </span>
      </div>

      {semWhats > 0 && (
        <p className="text-xs text-muted mb-4">
          {semWhats} lead(s) sem WhatsApp ficaram de fora — use o Google Places na
          descoberta pra trazer telefone.
        </p>
      )}

      {/* Fila */}
      {loading ? (
        <div className="text-muted">Carregando fila…</div>
      ) : fila.length === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-12 text-center text-muted">
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
                className={`border rounded-lg p-4 bg-paper ${
                  isSent ? "border-green-200 bg-green-50/40" : "border-line"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">
                      {lead.name}
                      {!lead.has_website && <span className="ml-2" title="Sem site">🔥</span>}
                    </p>
                    <p className="text-xs text-muted truncate">
                      {[lead.niche, lead.city].filter(Boolean).join(" · ") || "—"} · {lead.whatsapp}
                    </p>
                  </div>
                  {isSent && (
                    <span className="shrink-0 text-xs text-green-700 font-medium">✓ Enviado</span>
                  )}
                </div>

                <textarea
                  value={messageFor(lead)}
                  onChange={(e) =>
                    setOverrides((o) => ({ ...o, [lead.id]: e.target.value }))
                  }
                  rows={2}
                  className="w-full px-3 py-2 border border-line rounded bg-white outline-none focus:border-ink resize-none text-sm"
                />

                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => gerarIA(lead)}
                    disabled={isAi}
                    className="h-9 px-3 rounded border border-line text-sm hover:border-ink disabled:opacity-60"
                    title="Gerar mensagem com IA"
                  >
                    {isAi ? "Gerando…" : "✨ Gerar com IA"}
                  </button>
                  <button
                    onClick={() => enviar(lead)}
                    className="h-9 px-4 rounded bg-green-600 hover:bg-green-700 text-white text-sm font-medium ml-auto"
                  >
                    Enviar no WhatsApp
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
      className={`h-9 px-3 rounded-full text-sm border transition-colors ${
        active
          ? accent
            ? "bg-brand text-white border-brand"
            : "bg-ink text-white border-ink"
          : "bg-white text-muted border-line hover:border-ink hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
