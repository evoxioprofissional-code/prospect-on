"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLeads } from "@/lib/useLeads";
import { STATUSES, leadHeat, type LeadInput } from "@/lib/types";
import { brl, relativeDate } from "@/lib/format";
import LeadModal from "@/components/LeadModal";
import PageHeader from "@/components/PageHeader";

export default function DashboardPage() {
  const { leads, loading, create } = useLeads();
  const [modal, setModal] = useState(false);

  const stats = useMemo(() => {
    const total = leads.length;
    const semSite = leads.filter((l) => !l.has_website).length;
    const fechados = leads.filter((l) => l.status === "fechado");
    const emAberto = leads.filter(
      (l) => l.status !== "fechado" && l.status !== "perdido"
    );
    const pipeline = emAberto.reduce((s, l) => s + (l.value ?? 0), 0);
    const receita = fechados.reduce((s, l) => s + (l.value ?? 0), 0);
    const conv = total ? Math.round((fechados.length / total) * 100) : 0;
    return { total, semSite, pipeline, receita, conv, fechados: fechados.length };
  }, [leads]);

  const porStatus = useMemo(
    () =>
      STATUSES.map((s) => ({
        ...s,
        count: leads.filter((l) => l.status === s.key).length,
      })),
    [leads]
  );

  const followups = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return leads
      .filter((l) => l.next_followup && l.next_followup <= today && l.status !== "fechado" && l.status !== "perdido")
      .sort((a, b) => (a.next_followup! < b.next_followup! ? -1 : 1));
  }, [leads]);

  const quentes = useMemo(
    () =>
      leads
        .filter((l) => !l.has_website && l.status !== "fechado" && l.status !== "perdido")
        .slice(0, 6),
    [leads]
  );

  async function handleSave(input: LeadInput) {
    await create(input);
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Visão geral"
        title="Painel"
        subtitle="Onde sua prospecção está agora."
        action={
          <button
            onClick={() => setModal(true)}
            className="bg-brand hover:bg-brand-600 text-white font-medium h-11 px-5 rounded"
          >
            + Novo lead
          </button>
        }
      />

      {loading ? (
        <Loading />
      ) : leads.length === 0 ? (
        <EmptyState onNew={() => setModal(true)} />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Kpi label="Leads totais" value={String(stats.total)} />
            <Kpi label="Sem site (quentes)" value={String(stats.semSite)} accent />
            <Kpi label="No pipeline" value={brl(stats.pipeline)} />
            <Kpi label="Receita fechada" value={brl(stats.receita)} />
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Funil resumido */}
            <div className="lg:col-span-2 bg-paper border border-line rounded p-6">
              <div className="flex items-center justify-between mb-5">
                <p className="eyebrow">Distribuição no funil</p>
                <Link href="/funil" className="text-sm text-brand hover:underline">
                  Ver funil →
                </Link>
              </div>
              <div className="space-y-3">
                {porStatus.map((s) => {
                  const pct = stats.total ? (s.count / stats.total) * 100 : 0;
                  return (
                    <div key={s.key} className="flex items-center gap-3">
                      <span className="w-24 text-sm text-muted">{s.label}</span>
                      <div className="flex-1 h-2 bg-soft rounded overflow-hidden">
                        <div
                          className="h-full bg-brand rounded"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-sm tnum font-medium">
                        {s.count}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 pt-4 border-t border-line flex gap-8">
                <MiniStat label="Conversão" value={`${stats.conv}%`} />
                <MiniStat label="Negócios fechados" value={String(stats.fechados)} />
              </div>
            </div>

            {/* Follow-ups atrasados */}
            <div className="bg-paper border border-line rounded p-6">
              <p className="eyebrow mb-4">Follow-ups em atraso</p>
              {followups.length === 0 ? (
                <p className="text-sm text-muted">Nada em atraso. 🎯</p>
              ) : (
                <ul className="space-y-3">
                  {followups.slice(0, 6).map((l) => (
                    <li key={l.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{l.name}</p>
                        <p className="text-xs text-muted">
                          {l.niche || "—"}
                        </p>
                      </div>
                      <span className="text-xs text-brand tnum">
                        {relativeDate(l.next_followup!)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Leads quentes */}
          {quentes.length > 0 && (
            <div className="mt-6 bg-paper border border-line rounded p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="eyebrow">🔥 Leads quentes — sem site</p>
                <Link href="/leads" className="text-sm text-brand hover:underline">
                  Todos os leads →
                </Link>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {quentes.map((l) => (
                  <div key={l.id} className="border border-line rounded p-3">
                    <p className="font-medium text-sm">{l.name}</p>
                    <p className="text-xs text-muted">
                      {[l.niche, l.city].filter(Boolean).join(" · ") || "—"}
                    </p>
                    <span className="inline-block mt-2 text-[11px] px-2 py-0.5 rounded bg-brand-50 text-brand-700">
                      {leadHeat(l).label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {modal && (
        <LeadModal
          lead={null}
          onClose={() => setModal(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded border p-5 ${accent ? "border-brand/30 bg-brand-50" : "border-line bg-paper"}`}>
      <p className="eyebrow">{label}</p>
      <p className={`font-display text-3xl font-bold mt-2 tnum ${accent ? "text-brand" : "text-ink"}`}>
        {value}
      </p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="font-display text-xl font-bold tnum mt-1">{value}</p>
    </div>
  );
}

function Loading() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-28 rounded border border-line bg-soft animate-pulse" />
      ))}
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="border border-dashed border-line rounded p-12 text-center bg-paper">
      <div className="brand-rule w-16 mx-auto mb-6" />
      <h3 className="font-display text-2xl font-bold">Comece sua prospecção</h3>
      <p className="text-muted mt-2 max-w-md mx-auto">
        Cadastre o primeiro negócio que você quer abordar. Dica: comece pelos que
        não têm site — são os mais fáceis de fechar.
      </p>
      <button
        onClick={onNew}
        className="mt-6 bg-brand hover:bg-brand-600 text-white font-medium h-11 px-6 rounded"
      >
        + Cadastrar primeiro lead
      </button>
    </div>
  );
}
