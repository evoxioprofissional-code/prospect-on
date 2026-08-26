"use client";

import { useEffect, useMemo, useState } from "react";
import { brl } from "@/lib/format";

type PlanId = "trial" | "essencial" | "pro" | "agencia";

interface Subscriber {
  email: string;
  plan: PlanId;
  rawPlan: string;
  status: string;
  provider: string | null;
  currentPeriodEnd: string | null;
  searchesUsed: number;
  leads: number;
  activeCampaigns: number;
  whatsappConnected: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
}

interface Overview {
  kpis: { mrr: number; payingCustomers: number; totalUsers: number; conversion: number };
  planCounts: Record<PlanId, number>;
  revenueByPlan: { plan: PlanId; name: string; price: number; count: number; revenue: number }[];
  usage: { leads: number; messagesSent: number; activeCampaigns: number; connectedNumbers: number };
  subscribers: Subscriber[];
}

const PLAN_LABEL: Record<PlanId, string> = {
  trial: "Grátis",
  essencial: "Essencial",
  pro: "Pro",
  agencia: "Agência",
};

const PLAN_BADGE: Record<PlanId, string> = {
  trial: "bg-soft text-muted",
  essencial: "bg-blue-100 text-blue-700",
  pro: "bg-brand/15 text-brand",
  agencia: "bg-panel text-white",
};

function providerLabel(p: string | null): string {
  if (p === "mercadopago_pix") return "Pix";
  if (p === "mercadopago") return "Cartão";
  if (p === "manual_vitalicio") return "Manual";
  return "—";
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function GerenciarPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [planFilter, setPlanFilter] = useState<"todos" | PlanId>("todos");

  useEffect(() => {
    fetch("/api/admin/overview", { cache: "no-store" })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => (ok ? setData(d) : setError(d.error || "Falha ao carregar.")))
      .catch(() => setError("Erro de conexão."));
  }, []);

  const subscribers = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    return data.subscribers.filter((s) => {
      if (planFilter !== "todos" && s.plan !== planFilter) return false;
      if (term && !s.email.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [data, q, planFilter]);

  if (error) {
    return (
      <div className="border border-line bg-paper rounded-xl p-8 text-center">
        <p className="text-sm text-brand">{error}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-line bg-paper animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-xl border border-line bg-paper animate-pulse" />
      </div>
    );
  }

  const maxRevenue = Math.max(1, ...data.revenueByPlan.map((r) => r.revenue));

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Painel do dono</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Gerenciar</h1>
      </div>

      {/* KPIs de faturamento */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Faturamento mensal" value={brl(data.kpis.mrr)} accent />
        <Kpi label="Clientes pagantes" value={String(data.kpis.payingCustomers)} />
        <Kpi label="Total de contas" value={String(data.kpis.totalUsers)} />
        <Kpi
          label="Conversão"
          value={`${(data.kpis.conversion * 100).toFixed(1)}%`}
        />
      </div>

      {/* Receita por plano */}
      <div className="bg-paper border border-line rounded-xl p-4 sm:p-5">
        <span className="eyebrow">Receita por plano</span>
        <div className="mt-3 space-y-3">
          {data.revenueByPlan.map((r) => (
            <div key={r.plan}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-medium">
                  {r.name}{" "}
                  <span className="text-muted font-normal">
                    · {r.count} cliente(s) · {brl(r.price)}/mês
                  </span>
                </span>
                <span className="tnum font-semibold">{brl(r.revenue)}</span>
              </div>
              <div className="h-2 bg-soft rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand rounded-full transition-all"
                  style={{ width: `${(r.revenue / maxRevenue) * 100}%` }}
                />
              </div>
            </div>
          ))}
          {data.revenueByPlan.every((r) => r.count === 0) && (
            <p className="text-sm text-muted">Nenhum cliente pagante ainda.</p>
          )}
        </div>
      </div>

      {/* Uso da plataforma */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Leads na base" value={data.usage.leads.toLocaleString("pt-BR")} small />
        <Kpi label="Mensagens enviadas" value={data.usage.messagesSent.toLocaleString("pt-BR")} small />
        <Kpi label="Campanhas ativas" value={String(data.usage.activeCampaigns)} small />
        <Kpi label="Números conectados" value={String(data.usage.connectedNumbers)} small />
      </div>

      {/* Assinantes */}
      <div className="bg-paper border border-line rounded-xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-line flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <span className="eyebrow">Assinantes</span>
            <p className="text-sm text-muted">{subscribers.length} conta(s)</p>
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar e-mail…"
            className="h-10 px-3 border border-line rounded-lg bg-paper outline-none focus:border-ink text-sm w-full sm:w-56"
          />
          <div className="flex gap-1 overflow-x-auto">
            {(["todos", "trial", "essencial", "pro", "agencia"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPlanFilter(p)}
                className={`shrink-0 h-9 px-3 rounded-full text-xs border transition-colors ${
                  planFilter === p
                    ? "bg-brand text-white border-brand"
                    : "bg-paper text-muted border-line hover:border-ink hover:text-ink"
                }`}
              >
                {p === "todos" ? "Todos" : PLAN_LABEL[p]}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted border-b border-line">
                <th className="px-4 py-2.5 font-medium">E-mail</th>
                <th className="px-4 py-2.5 font-medium">Plano</th>
                <th className="px-4 py-2.5 font-medium tnum">Leads</th>
                <th className="px-4 py-2.5 font-medium tnum">Camp. ativas</th>
                <th className="px-4 py-2.5 font-medium">WhatsApp</th>
                <th className="px-4 py-2.5 font-medium">Origem</th>
                <th className="px-4 py-2.5 font-medium">Validade</th>
                <th className="px-4 py-2.5 font-medium tnum">Buscas</th>
                <th className="px-4 py-2.5 font-medium">Entrou</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((s, i) => (
                <tr key={s.email + i} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-2.5 max-w-[220px] truncate" title={s.email}>
                    {s.email}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${PLAN_BADGE[s.plan]}`}>
                      {PLAN_LABEL[s.plan]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 tnum">{s.leads.toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-2.5 tnum text-muted">{s.activeCampaigns}</td>
                  <td className="px-4 py-2.5">
                    {s.whatsappConnected ? (
                      <span className="inline-flex items-center gap-1.5 text-green-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        Conectado
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted">{providerLabel(s.provider)}</td>
                  <td className="px-4 py-2.5 text-muted">{fmtDate(s.currentPeriodEnd)}</td>
                  <td className="px-4 py-2.5 tnum text-muted">{s.searchesUsed}</td>
                  <td className="px-4 py-2.5 text-muted">{fmtDate(s.createdAt)}</td>
                </tr>
              ))}
              {subscribers.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted">
                    Nenhuma conta nesse filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  accent,
  small,
}: {
  label: string;
  value: string;
  accent?: boolean;
  small?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        accent ? "border-brand/30 bg-brand/5" : "border-line bg-paper"
      }`}
    >
      <p className="eyebrow">{label}</p>
      <p
        className={`font-display font-bold tracking-tight mt-1 tnum ${
          small ? "text-xl" : "text-2xl"
        } ${accent ? "text-brand" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
