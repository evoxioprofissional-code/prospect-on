"use client";

import { useMemo, useState } from "react";
import { useLeads } from "@/lib/useLeads";
import { STATUSES, leadHeat, type Lead, type LeadInput, type LeadStatus } from "@/lib/types";
import { brl, initials, whatsappLink } from "@/lib/format";
import LeadModal from "@/components/LeadModal";
import DiscoverModal from "@/components/DiscoverModal";
import PageHeader from "@/components/PageHeader";

type Filter = "todos" | "sem_site" | LeadStatus;

export default function LeadsPage() {
  const { leads, loading, create, createMany, update, remove } = useLeads();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [editing, setEditing] = useState<Lead | null | undefined>(undefined);
  const [discover, setDiscover] = useState(false);
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
    if (id) await update(id, input);
    else await create(input);
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Base de prospecção"
        title="Leads"
        subtitle={`${leads.length} negócio(s) na sua carteira.`}
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setDiscover(true)}
              className="border border-ink text-ink hover:bg-ink hover:text-white font-medium h-11 px-4 rounded transition-colors"
            >
              ⚡ Descobrir leads
            </button>
            <button
              onClick={() => setEditing(null)}
              className="bg-brand hover:bg-brand-600 text-white font-medium h-11 px-5 rounded"
            >
              + Novo lead
            </button>
          </div>
        }
      />

      {/* Barra de busca e filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">⌕</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, nicho, cidade, telefone…"
            className="w-full h-11 pl-9 pr-3 border border-line rounded bg-white outline-none focus:border-ink"
          />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap mb-5">
        <Chip active={filter === "todos"} onClick={() => setFilter("todos")}>
          Todos
        </Chip>
        <Chip active={filter === "sem_site"} onClick={() => setFilter("sem_site")} accent>
          🔥 Sem site
        </Chip>
        {STATUSES.map((s) => (
          <Chip key={s.key} active={filter === s.key} onClick={() => setFilter(s.key)}>
            {s.label}
          </Chip>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded border border-line bg-soft animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-line rounded p-10 text-center text-muted">
          Nenhum lead encontrado com esse filtro.
        </div>
      ) : (
        <div className="border border-line rounded overflow-hidden bg-paper">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-soft/60">
                <Th>Negócio</Th>
                <Th className="hidden md:table-cell">Contato</Th>
                <Th className="hidden lg:table-cell">Situação</Th>
                <Th>Etapa</Th>
                <Th className="text-right">Valor</Th>
                <Th className="w-10"></Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => {
                const heat = leadHeat(l);
                return (
                  <tr
                    key={l.id}
                    onClick={() => setEditing(l)}
                    className="border-b border-line last:border-0 hover:bg-soft/50 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="h-8 w-8 shrink-0 rounded bg-ink text-white grid place-items-center text-xs font-bold">
                          {initials(l.name)}
                        </span>
                        <div>
                          <p className="font-medium">{l.name}</p>
                          <p className="text-xs text-muted">
                            {[l.niche, l.city].filter(Boolean).join(" · ") || "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted">
                      {l.whatsapp || l.phone || l.email || "—"}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <HeatBadge level={heat.level} label={heat.label} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={l.status} />
                    </td>
                    <td className="px-4 py-3 text-right tnum">{brl(l.value)}</td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {l.whatsapp && (
                        <a
                          href={whatsappLink(l.whatsapp, `Olá! Falo com o ${l.name}?`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="WhatsApp"
                          className="text-green-600 hover:text-green-700"
                        >
                          ✆
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
          onImport={createMany}
        />
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

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`text-left px-4 py-3 eyebrow font-semibold ${className}`}>{children}</th>
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
    perdido: "bg-brand-50 text-brand-700",
  };
  return (
    <span className={`inline-block text-xs px-2 py-1 rounded ${tone[status]}`}>{label}</span>
  );
}

function HeatBadge({ level, label }: { level: "quente" | "morno" | "frio"; label: string }) {
  const tone =
    level === "quente"
      ? "bg-brand-50 text-brand-700"
      : level === "morno"
      ? "bg-amber-50 text-amber-700"
      : "bg-soft text-muted";
  const dot = level === "quente" ? "🔥" : level === "morno" ? "•" : "";
  return (
    <span className={`inline-block text-xs px-2 py-1 rounded ${tone}`}>
      {dot} {label}
    </span>
  );
}
