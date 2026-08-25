"use client";

import { useState } from "react";
import { useSubscription } from "@/lib/useSubscription";
import { PLANS, PLAN_ORDER, type PlanId } from "@/lib/plans";
import PageHeader from "@/components/PageHeader";

export default function PlanosPage() {
  const { sub, loading } = useSubscription();
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function assinar(plan: PlanId) {
    setErr(null);
    setBusy(plan);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok || !data.init_point) {
        setErr(data.error || "Não foi possível iniciar a assinatura.");
        setBusy(null);
        return;
      }
      window.location.href = data.init_point; // redireciona pro checkout do MP
    } catch {
      setErr("Erro de conexão.");
      setBusy(null);
    }
  }
  const current = sub?.plan ?? "trial";
  const used = sub?.used ?? 0;
  const quota = sub?.quota ?? PLANS.trial.searchQuota;
  const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Assinatura"
        title="Planos"
        subtitle="Descoberta no OpenStreetMap é ilimitada em todos os planos. As buscas no Google é que contam."
      />

      {/* Uso atual */}
      {!loading && (
        <div className="bg-paper border border-line rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="eyebrow">Plano atual</p>
              <p className="font-display text-2xl font-bold mt-1">
                {PLANS[current].name}
              </p>
            </div>
            <div className="text-right">
              <p className="eyebrow">Buscas Google no mês</p>
              <p className="font-display text-2xl font-bold tnum mt-1">
                {used}
                <span className="text-muted text-lg"> / {quota}</span>
              </p>
            </div>
          </div>
          <div className="h-2 bg-soft rounded overflow-hidden">
            <div
              className={`h-full rounded ${pct >= 100 ? "bg-brand" : "bg-ink"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {pct >= 100 && (
            <p className="text-sm text-brand-700 mt-2">
              Limite atingido. Faça upgrade para continuar buscando no Google.
            </p>
          )}
        </div>
      )}

      {err && (
        <p className="text-sm text-brand-700 bg-brand-50 border border-brand/30 rounded px-3 py-2 mb-4">
          {err}
        </p>
      )}

      {/* Grade de planos */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLAN_ORDER.map((id) => (
          <PlanCard
            key={id}
            id={id}
            current={current}
            busy={busy === id}
            onAssinar={() => assinar(id)}
          />
        ))}
      </div>

      <p className="text-xs text-muted mt-6">
        Pagamento processado pelo Mercado Pago (Pix e cartão). A assinatura é
        mensal e você pode cancelar quando quiser.
      </p>
    </div>
  );
}

function PlanCard({
  id,
  current,
  busy,
  onAssinar,
}: {
  id: PlanId;
  current: PlanId;
  busy: boolean;
  onAssinar: () => void;
}) {
  const p = PLANS[id];
  const isCurrent = id === current;
  return (
    <div
      className={`rounded-lg border p-5 flex flex-col ${
        p.highlight ? "border-brand ring-1 ring-brand/20" : "border-line"
      } bg-paper`}
    >
      {p.highlight && (
        <span className="self-start text-[11px] px-2 py-0.5 rounded-full bg-brand text-white mb-2">
          Mais popular
        </span>
      )}
      <p className="font-display text-lg font-bold">{p.name}</p>
      <p className="mt-1">
        <span className="font-display text-3xl font-bold tnum">
          {p.price === 0 ? "Grátis" : `R$ ${p.price}`}
        </span>
        {p.price > 0 && <span className="text-muted text-sm">/mês</span>}
      </p>

      <ul className="mt-4 space-y-2 flex-1">
        {p.features.map((f) => (
          <li key={f} className="flex gap-2 text-sm">
            <span className="text-brand shrink-0">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <button
        disabled={isCurrent || p.price === 0 || busy}
        onClick={onAssinar}
        className={`mt-5 h-11 rounded font-medium text-sm transition-colors ${
          isCurrent || p.price === 0
            ? "bg-soft text-muted cursor-default"
            : p.highlight
            ? "bg-brand hover:bg-brand-600 text-white disabled:opacity-60"
            : "border border-ink text-ink hover:bg-ink hover:text-white disabled:opacity-60"
        }`}
      >
        {isCurrent
          ? "Plano atual"
          : p.price === 0
          ? "—"
          : busy
          ? "Abrindo…"
          : "Assinar"}
      </button>
    </div>
  );
}
