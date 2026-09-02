"use client";

import { useMemo, useState } from "react";
import { useLeads } from "@/lib/useLeads";
import { useSubscription } from "@/lib/useSubscription";
import { PLANS } from "@/lib/plans";
import { STATUSES, leadHeat, type Lead, type LeadInput, type LeadStatus } from "@/lib/types";
import { brl, initials, whatsappLink } from "@/lib/format";
import LeadModal from "@/components/LeadModal";
import DiscoverModal from "@/components/DiscoverModal";
import GenerateSiteModal from "@/components/GenerateSiteModal";
import PageHeader from "@/components/PageHeader";

type Filter = "todos" | "sem_site" | LeadStatus;

export default function LeadsPage() {
  const { leads, loading, create, createMany, update, remove } = useLeads();
  const { sub } = useSubscription();
  const [q, setQ] = useState("");

  // Teto de leads do plano (grátis = 15). Leads acima do teto já existentes
  // ficam; só bloqueia adicionar novos além do limite.
  const leadCap = sub ? PLANS[sub.plan].leadCap : Infinity;
  const remaining = Math.max(0, leadCap - leads.length);
  const atCap = remaining <= 0;
  const capLabel = Number.isFinite(leadCap) ? `${leads.length}/${leadCap}` : null;
  const [filter, setFilter] = useState<Filter>("todos");
  const [editing, setEditing] = useState<Lead | null | undefined>(undefined);
  const [discover, setDiscover] = useState(false);
  const [siteLead, setSiteLead] = useState<Lead | null>(null);
  // undefined = fechado, null = novo, Lead = editar

  const existingNames = useMemo(
    () => new Set(leads.map((l) => l.name.toLowerCase())),
    [leads]
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return leads.filter((l) => {
      if (filter === "sem_site" && l.has_website) return false;
      if (filter !== "todos" && filter !== "sem_site" && l.status !== filter)
        return false;
      if (!term) return true;
      return [l.name, l.niche, l.city, l.phone, l.whatsapp, l.email]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(term));
    });
  }, [leads, q, filter]);

  async function handleSave(input: LeadInput, id?: string) {
    if (id) {
      await update(id, input);
      return;
    }
    if (atCap) return;
    await create(input);
  }

  // Importação da descoberta respeitando o teto do plano.
  async function handleImport(
    newLeads: LeadInput[]
  ): Promise<{ count: number; error?: string }> {
    if (atCap) {
      return {
        count: 0,
        error: `Seu plano permite até ${leadCap} leads. Faça upgrade para adicionar mais.`,
      };
    }
    const toAdd = newLeads.slice(0, remaining);
    const res = await createMany(toAdd);
    if (!res.error && toAdd.length < newLeads.length) {
      return {
        count: res.count ?? 0,
        error: `Importados ${res.count ?? 0}. Você atingiu o limite de ${leadCap} leads do plano — faça upgrade para adicionar mais.`,
      };
    }
    return res;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto">
      <PageHeader
        eyebrow="Base de prospecção"
        title="Leads"
        subtitle={
          capLabel
            ? `${capLabel} leads — limite do plano grátis.`
            : `${leads.length} negócio(s) na sua carteira.`
        }
        action={
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => setDiscover(true)}
              className="flex-1 sm:flex-none border border-ink text-ink hover:bg-brand hover:text-white hover:border-brand font-medium h-11 px-4 rounded transition-colors whitespace-nowrap inline-flex items-center justify-center gap-1.5"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              Descobrir
            </button>
            <button
              onClick={() => setEditing(null)}
              disabled={atCap}
              title={atCap ? `Limite de ${leadCap} leads do plano grátis atingido.` : undefined}
              className="flex-1 sm:flex-none bg-brand hover:bg-brand-600 text-white font-medium h-11 px-5 rounded whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Novo lead
            </button>
          </div>
        }
      />

      {atCap && (
        <div className="mb-4 rounded-lg border border-brand/30 bg-brand/10 px-4 py-3 text-sm">
          Você atingiu o limite de {leadCap} leads do plano grátis.{" "}
          <a href="/planos" className="text-brand font-medium hover:underline">
            Fazer upgrade
          </a>{" "}
          para adicionar mais.
        </div>
      )}

      {/* Busca */}
      <div className="relative mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">⌕</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, nicho, cidade, telefone…"
          className="w-full h-11 pl-9 pr-3 border border-line rounded bg-paper outline-none focus:border-ink"
        />
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap mb-6">
        <Chip active={filter === "todos"} onClick={() => setFilter("todos")}>
          Todos
        </Chip>
        <Chip active={filter === "sem_site"} onClick={() => setFilter("sem_site")} accent>
          Sem site
        </Chip>
        {STATUSES.map((s) => (
          <Chip key={s.key} active={filter === s.key} onClick={() => setFilter(s.key)}>
            {s.label}
          </Chip>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-lg border border-line bg-soft animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-12 text-center text-muted">
          Nenhum lead encontrado com esse filtro.
        </div>
      ) : (
        <>
          <p className="text-sm text-muted mb-3 tnum">
            {filtered.length} resultado(s)
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((l) => (
              <LeadCard
                key={l.id}
                lead={l}
                onOpen={() => setEditing(l)}
                onGenerateSite={() => setSiteLead(l)}
              />
            ))}
          </div>
        </>
      )}

      {editing !== undefined && (
        <LeadModal
          lead={editing}
          onClose={() => setEditing(undefined)}
          onSave={handleSave}
          onDelete={remove}
        />
      )}

      {discover && (
        <DiscoverModal
          existingNames={existingNames}
          onClose={() => setDiscover(false)}
          onImport={handleImport}
        />
      )}

      {siteLead && (
        <GenerateSiteModal lead={siteLead} onClose={() => setSiteLead(null)} />
      )}
    </div>
  );
}

function LeadCard({
  lead,
  onOpen,
  onGenerateSite,
}: {
  lead: Lead;
  onOpen: () => void;
  onGenerateSite: () => void;
}) {
  const heat = leadHeat(lead);
  const contact = lead.whatsapp || lead.phone || lead.email;
  return (
    <div
      onClick={onOpen}
      className={`group flex flex-col border rounded-lg bg-paper p-4 cursor-pointer transition hover:shadow-card ${
        !lead.has_website
          ? "border-line border-l-4 border-l-brand hover:border-l-brand"
          : "border-line hover:border-ink/25"
      }`}
    >
      {/* Cabeçalho */}
      <div className="flex items-start gap-3">
        <span className="h-9 w-9 shrink-0 rounded bg-panel text-white grid place-items-center text-xs font-bold">
          {initials(lead.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight truncate" title={lead.name}>
            {lead.name}
          </p>
          <p className="text-xs text-muted truncate">
            {[lead.niche, lead.city].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        <HeatBadge level={heat.level} label={heat.label} />
      </div>

      {/* Contato */}
      <div className="mt-3 text-sm text-muted truncate">
        {contact ? (
          <span className="inline-flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-ink/40 shrink-0">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
            </svg>
            {contact}
          </span>
        ) : (
          <span className="text-ink/30">sem contato</span>
        )}
      </div>

      {/* Rodapé */}
      <div className="mt-3 pt-3 border-t border-line flex items-center justify-between gap-2">
        <StatusBadge status={lead.status} />
        <span className="tnum font-medium text-sm">{brl(lead.value)}</span>
      </div>

      {/* Ações rápidas */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onGenerateSite();
          }}
          className={`inline-flex items-center justify-center gap-1.5 h-9 rounded text-sm transition-colors ${
            !lead.has_website
              ? "bg-brand text-white hover:bg-brand-600"
              : "border border-line text-ink hover:border-ink"
          }`}
          title="Gerar um site de demonstração com IA para apresentar ao cliente"
        >
          ✨ Gerar site
        </button>
        {lead.whatsapp ? (
          <a
            href={whatsappLink(lead.whatsapp, `Olá! Falo com o ${lead.name}?`)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center gap-2 h-9 rounded border border-green-200 bg-green-50 text-green-700 text-sm hover:bg-green-100 transition-colors"
          >
            <IconWhats /> WhatsApp
          </a>
        ) : (
          <span className="inline-flex items-center justify-center h-9 rounded border border-dashed border-line text-xs text-muted">
            sem WhatsApp
          </span>
        )}
      </div>
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
          ? "bg-brand text-white border-brand"
          : "bg-paper text-muted border-line hover:border-ink hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: LeadStatus }) {
  const label = STATUSES.find((s) => s.key === status)?.label ?? status;
  const tone: Record<LeadStatus, string> = {
    novo: "bg-soft text-ink",
    contatado: "bg-blue-50 text-blue-700",
    proposta: "bg-amber-50 text-amber-700",
    negociando: "bg-purple-50 text-purple-700",
    fechado: "bg-green-50 text-green-700",
    perdido: "bg-brand/10 text-brand",
  };
  return (
    <span className={`inline-block text-xs px-2 py-1 rounded ${tone[status]}`}>{label}</span>
  );
}

function HeatBadge({ level, label }: { level: "quente" | "morno" | "frio"; label: string }) {
  const tone =
    level === "quente"
      ? "bg-brand/10 text-brand"
      : level === "morno"
      ? "bg-amber-50 text-amber-700"
      : "bg-soft text-muted";
  const dot = level === "frio" ? "" : "•";
  return (
    <span className={`shrink-0 inline-block text-[11px] px-2 py-1 rounded ${tone}`}>
      {dot} {label}
    </span>
  );
}

function IconWhats() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-1-.3-1.6-.6-2.9-1.3-4.8-4.2-4.9-4.4-.1-.2-1.2-1.5-1.2-2.9s.7-2 1-2.3c.2-.3.5-.4.7-.4h.5c.2 0 .4 0 .6.5.2.5.7 1.8.8 1.9.1.1.1.3 0 .5-.3.6-.6.8-.8 1-.2.2-.3.3-.1.6.2.3.9 1.4 1.9 2.3 1.3 1.1 2.3 1.4 2.6 1.6.3.1.4.1.6-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1.2.1 1.5.7 1.7.9.2.1.4.2.4.3.1.1.1.6-.1 1.1Z" />
    </svg>
  );
}
