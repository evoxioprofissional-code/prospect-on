"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useLeads } from "@/lib/useLeads";
import { STATUSES, leadHeat, type Lead, type LeadInput, type LeadStatus } from "@/lib/types";
import { brl } from "@/lib/format";
import LeadModal from "@/components/LeadModal";
import PageHeader from "@/components/PageHeader";

export default function FunilPage() {
  const { leads, loading, create, update, moveStatus, remove } = useLeads();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Lead | null | undefined>(undefined);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const byStatus = useMemo(() => {
    const map: Record<LeadStatus, Lead[]> = {
      novo: [], contatado: [], proposta: [], negociando: [], fechado: [], perdido: [],
    };
    for (const l of leads) map[l.status]?.push(l);
    return map;
  }, [leads]);

  const active = leads.find((l) => l.id === activeId) || null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const leadId = String(active.id);
    const newStatus = String(over.id) as LeadStatus;
    const lead = leads.find((l) => l.id === leadId);
    if (lead && lead.status !== newStatus) moveStatus(leadId, newStatus);
  }

  async function handleSave(input: LeadInput, id?: string) {
    if (id) await update(id, input);
    else await create(input);
  }

  return (
    <div className="p-6 lg:p-10">
      <PageHeader
        eyebrow="Pipeline visual"
        title="Funil"
        subtitle="Arraste os cards entre as etapas."
        action={
          <button
            onClick={() => setEditing(null)}
            className="bg-brand hover:bg-brand-600 text-white font-medium h-11 px-5 rounded"
          >
            + Novo lead
          </button>
        }
      />

      {loading ? (
        <div className="text-muted">Carregando funil…</div>
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STATUSES.map((s) => (
              <Column
                key={s.key}
                status={s.key}
                label={s.label}
                leads={byStatus[s.key]}
                onOpen={setEditing}
              />
            ))}
          </div>

          <DragOverlay>
            {active ? <Card lead={active} dragging /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {editing !== undefined && (
        <LeadModal
          lead={editing}
          onClose={() => setEditing(undefined)}
          onSave={handleSave}
          onDelete={remove}
        />
      )}
    </div>
  );
}

function Column({
  status,
  label,
  leads,
  onOpen,
}: {
  status: LeadStatus;
  label: string;
  leads: Lead[];
  onOpen: (l: Lead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const total = leads.reduce((s, l) => s + (l.value ?? 0), 0);

  return (
    <div className="w-72 shrink-0">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-brand" />
          <span className="font-medium text-sm">{label}</span>
          <span className="text-xs text-muted tnum">{leads.length}</span>
        </div>
        <span className="text-xs text-muted tnum">{brl(total)}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`min-h-[60vh] rounded p-2 space-y-2 transition-colors ${
          isOver ? "bg-brand-50 ring-1 ring-brand/30" : "bg-soft"
        }`}
      >
        {leads.map((l) => (
          <DraggableCard key={l.id} lead={l} onOpen={onOpen} />
        ))}
        {leads.length === 0 && (
          <div className="text-center text-xs text-muted py-8 border border-dashed border-line rounded">
            Solte aqui
          </div>
        )}
      </div>
    </div>
  );
}

function DraggableCard({ lead, onOpen }: { lead: Lead; onOpen: (l: Lead) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
        opacity: isDragging ? 0.4 : 1,
      }}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(lead)}
    >
      <Card lead={lead} />
    </div>
  );
}

function Card({ lead, dragging }: { lead: Lead; dragging?: boolean }) {
  const heat = leadHeat(lead);
  return (
    <div
      className={`bg-paper border rounded p-3 cursor-grab active:cursor-grabbing ${
        dragging ? "border-brand shadow-pop" : "border-line shadow-card"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-sm leading-tight">{lead.name}</p>
        {!lead.has_website && <span title="Sem site">🔥</span>}
      </div>
      <p className="text-xs text-muted mt-1">
        {[lead.niche, lead.city].filter(Boolean).join(" · ") || "—"}
      </p>
      <div className="flex items-center justify-between mt-3">
        <span className="text-[11px] px-1.5 py-0.5 rounded bg-soft text-muted">
          {heat.label}
        </span>
        {!!lead.value && (
          <span className="text-xs font-medium tnum">{brl(lead.value)}</span>
        )}
      </div>
    </div>
  );
}
