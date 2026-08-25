"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLeads } from "@/lib/useLeads";
import { type Lead, type LeadInput, type LeadStatus } from "@/lib/types";
import { brl, relativeDate } from "@/lib/format";
import LeadModal from "@/components/LeadModal";
import PageHeader from "@/components/PageHeader";

// Ordem do funil (perdido fica de fora — é vazamento, não etapa)
const FUNNEL: { key: LeadStatus; label: string }[] = [
  { key: "novo", label: "Novos" },
  { key: "contatado", label: "Contatados" },
  { key: "proposta", label: "Proposta" },
  { key: "negociando", label: "Negociando" },
  { key: "fechado", label: "Fechados" },
];

export default function DashboardPage() {
  const { leads, loading, create } = useLeads();
  const [modal, setModal] = useState(false);

  const d = useMemo(() => computeStats(leads), [leads]);

  async function handleSave(input: LeadInput) {
    await create(input);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Visão geral"
        title="Painel"
        subtitle="Sua prospecção em números."
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
        <SkeletonBoard />
      ) : leads.length === 0 ? (
        <EmptyState onNew={() => setModal(true)} />
      ) : (
        <div className="space-y-6">
          {/* Faixa de KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi label="Pipeline aberto" value={brl(d.pipeline)} hint={`${d.emAberto} em aberto`} />
            <Kpi label="Receita fechada" value={brl(d.receita)} hint={`${d.fechados} negócio(s)`} accentGood />
            <Kpi label="Leads quentes" value={String(d.quentes)} hint="sem site" accent />
            <Kpi label="Conversão" value={`${d.conv}%`} hint={`de ${d.total} leads`} />
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Funil visual */}
            <Card className="lg:col-span-2">
              <div className="flex items-center justify-between mb-5">
                <p className="eyebrow">Funil de vendas</p>
                <Link href="/funil" className="text-sm text-brand hover:underline">
                  Abrir funil →
                </Link>
              </div>
              <FunnelChart steps={d.funnel} />
              {d.perdidos > 0 && (
                <p className="text-xs text-muted mt-4">
                  <span className="inline-block h-2 w-2 rounded-full bg-ink/30 mr-1.5 align-middle" />
                  {d.perdidos} lead(s) marcados como perdidos (fora do funil).
                </p>
              )}
            </Card>

            {/* Ações de hoje */}
            <Card>
              <p className="eyebrow mb-4">Ações de hoje</p>
              <ActionsToday followups={d.followups} attack={d.attack} />
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Novos leads por dia */}
            <Card>
              <p className="eyebrow mb-1">Novos leads · 14 dias</p>
              <div className="flex items-end justify-between">
                <span className="font-display text-3xl font-bold tnum">{d.last14Total}</span>
                <Sparkline data={d.perDay} />
              </div>
              <p className="text-xs text-muted mt-2">
                {d.last7Total} nos últimos 7 dias
              </p>
            </Card>

            {/* Oportunidade: sem site */}
            <Card>
              <p className="eyebrow mb-4">Oportunidade sem site</p>
              <div className="flex items-center gap-5">
                <Donut percent={d.pctSemSite} />
                <div>
                  <p className="font-display text-2xl font-bold tnum text-brand">
                    {d.pctSemSite}%
                  </p>
                  <p className="text-sm text-muted">
                    {d.semSite} de {d.total} leads não têm site
                  </p>
                </div>
              </div>
            </Card>

            {/* Top nichos */}
            <Card>
              <p className="eyebrow mb-4">Top nichos</p>
              {d.topNichos.length === 0 ? (
                <p className="text-sm text-muted">Sem nicho preenchido ainda.</p>
              ) : (
                <div className="space-y-2.5">
                  {d.topNichos.map((n) => (
                    <div key={n.name} className="flex items-center gap-3">
                      <span className="w-24 text-sm truncate" title={n.name}>
                        {n.name}
                      </span>
                      <div className="flex-1 h-2 bg-soft rounded overflow-hidden">
                        <div className="h-full bg-ink rounded" style={{ width: `${n.pct}%` }} />
                      </div>
                      <span className="w-6 text-right text-sm tnum">{n.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {modal && (
        <LeadModal lead={null} onClose={() => setModal(false)} onSave={handleSave} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cálculo                                                             */
/* ------------------------------------------------------------------ */
function computeStats(leads: Lead[]) {
  const total = leads.length;
  const abertosArr = leads.filter((l) => l.status !== "fechado" && l.status !== "perdido");
  const fechadosArr = leads.filter((l) => l.status === "fechado");
  const perdidos = leads.filter((l) => l.status === "perdido").length;

  const pipeline = abertosArr.reduce((s, l) => s + (l.value ?? 0), 0);
  const receita = fechadosArr.reduce((s, l) => s + (l.value ?? 0), 0);
  const conv = total ? Math.round((fechadosArr.length / total) * 100) : 0;
  const semSite = leads.filter((l) => !l.has_website).length;
  const quentes = abertosArr.filter((l) => !l.has_website).length;
  const pctSemSite = total ? Math.round((semSite / total) * 100) : 0;

  // Funil cumulativo: "chegou até a etapa X ou além"
  const order: LeadStatus[] = ["novo", "contatado", "proposta", "negociando", "fechado"];
  const idxOf = (s: LeadStatus) => order.indexOf(s);
  const naoPerdidos = leads.filter((l) => l.status !== "perdido");
  const reached = order.map(
    (_, k) => naoPerdidos.filter((l) => idxOf(l.status) >= k).length
  );
  const maxReach = reached[0] || 1;
  const funnel = FUNNEL.map((s, k) => ({
    label: s.label,
    count: reached[k],
    widthPct: Math.max((reached[k] / maxReach) * 100, reached[k] > 0 ? 8 : 3),
    conv: k > 0 && reached[k - 1] > 0 ? Math.round((reached[k] / reached[k - 1]) * 100) : null,
  }));

  // Novos por dia (14 dias)
  const days = 14;
  const perDay: number[] = new Array(days).fill(0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const l of leads) {
    const created = new Date(l.created_at);
    created.setHours(0, 0, 0, 0);
    const diff = Math.round((today.getTime() - created.getTime()) / 86400000);
    if (diff >= 0 && diff < days) perDay[days - 1 - diff]++;
  }
  const last14Total = perDay.reduce((a, b) => a + b, 0);
  const last7Total = perDay.slice(-7).reduce((a, b) => a + b, 0);

  // Follow-ups atrasados
  const iso = today.toISOString().slice(0, 10);
  const followups = leads
    .filter(
      (l) =>
        l.next_followup &&
        l.next_followup <= iso &&
        l.status !== "fechado" &&
        l.status !== "perdido"
    )
    .sort((a, b) => (a.next_followup! < b.next_followup! ? -1 : 1))
    .slice(0, 5);

  // Atacar hoje: quentes (sem site) ainda "novos"
  const attack = abertosArr
    .filter((l) => !l.has_website && l.status === "novo")
    .slice(0, 5);

  // Top nichos
  const nicheMap = new Map<string, number>();
  for (const l of leads) {
    const n = (l.niche || "").trim();
    if (n) nicheMap.set(n, (nicheMap.get(n) || 0) + 1);
  }
  const maxNiche = Math.max(1, ...Array.from(nicheMap.values()));
  const topNichos = Array.from(nicheMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count, pct: (count / maxNiche) * 100 }));

  return {
    total,
    emAberto: abertosArr.length,
    fechados: fechadosArr.length,
    perdidos,
    pipeline,
    receita,
    conv,
    semSite,
    quentes,
    pctSemSite,
    funnel,
    perDay,
    last14Total,
    last7Total,
    followups,
    attack,
    topNichos,
  };
}

/* ------------------------------------------------------------------ */
/* Componentes visuais                                                */
/* ------------------------------------------------------------------ */
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-paper border border-line rounded-lg p-6 ${className}`}>{children}</div>
  );
}

function Kpi({
  label,
  value,
  hint,
  accent,
  accentGood,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  accentGood?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-5 ${
        accent ? "border-brand/30 bg-brand/10" : "border-line bg-paper"
      }`}
    >
      <p className="eyebrow">{label}</p>
      <p
        className={`font-display text-2xl lg:text-[28px] font-bold mt-2 tnum ${
          accent ? "text-brand" : accentGood ? "text-green-700" : "text-ink"
        }`}
      >
        {value}
      </p>
      {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
    </div>
  );
}

function FunnelChart({
  steps,
}: {
  steps: { label: string; count: number; widthPct: number; conv: number | null }[];
}) {
  return (
    <div className="space-y-2">
      {steps.map((s, i) => {
        // gradiente ink -> brand conforme desce o funil
        const t = steps.length > 1 ? i / (steps.length - 1) : 0;
        const bg = `linear-gradient(90deg, ${mix("#141416", "#E11D2A", t)}, ${mix(
          "#141416",
          "#E11D2A",
          Math.min(t + 0.15, 1)
        )})`;
        return (
          <div key={s.label}>
            {s.conv !== null && (
              <div className="flex justify-center">
                <span className="text-[11px] text-muted tnum -my-0.5">↓ {s.conv}%</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-sm text-muted">{s.label}</span>
              <div className="flex-1 h-9 flex items-center">
                <div
                  className="h-full rounded flex items-center px-3 text-white text-sm font-medium tnum transition-all"
                  style={{ width: `${s.widthPct}%`, background: bg, minWidth: 44 }}
                >
                  {s.count}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActionsToday({ followups, attack }: { followups: Lead[]; attack: Lead[] }) {
  const nada = followups.length === 0 && attack.length === 0;
  if (nada)
    return (
      <p className="text-sm text-muted">
        Tudo em dia. 🎯 Descubra novos leads ou avance os do funil.
      </p>
    );
  return (
    <div className="space-y-5">
      {followups.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-brand-700 mb-2">
            ⏰ Follow-up atrasado
          </p>
          <ul className="space-y-2">
            {followups.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2">
                <span className="text-sm truncate">{l.name}</span>
                <span className="text-xs text-brand tnum shrink-0">
                  {relativeDate(l.next_followup!)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {attack.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-ink mb-2">🔥 Atacar (sem site)</p>
          <ul className="space-y-2">
            {attack.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2">
                <span className="text-sm truncate">{l.name}</span>
                <span className="text-xs text-muted shrink-0">{l.city || "—"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Link
        href="/disparo"
        className="inline-flex items-center justify-center w-full h-10 rounded bg-brand hover:bg-brand-600 text-white text-sm font-medium"
      >
        Ir para a Central de Disparo →
      </Link>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const w = 160;
  const h = 48;
  const max = Math.max(1, ...data);
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const pts = data.map((v, i) => [i * step, h - (v / max) * (h - 6) - 3]);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E11D2A" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#E11D2A" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark)" />
      <path d={line} fill="none" stroke="#E11D2A" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.length > 0 && (
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill="#E11D2A" />
      )}
    </svg>
  );
}

function Donut({ percent }: { percent: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const filled = (percent / 100) * c;
  return (
    <svg width="88" height="88" viewBox="0 0 88 88">
      <circle cx="44" cy="44" r={r} fill="none" stroke="#F0EFEF" strokeWidth="10" />
      <circle
        cx="44"
        cy="44"
        r={r}
        fill="none"
        stroke="#E11D2A"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${c}`}
        transform="rotate(-90 44 44)"
      />
      <text x="44" y="48" textAnchor="middle" className="fill-ink font-bold" fontSize="16">
        {percent}%
      </text>
    </svg>
  );
}

/* Mistura duas cores hex por fator t (0..1) */
function mix(a: string, b: string, t: number): string {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const m = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${m[0]}, ${m[1]}, ${m[2]})`;
}

function SkeletonBoard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg border border-line bg-soft animate-pulse" />
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-72 rounded-lg border border-line bg-soft animate-pulse" />
        <div className="h-72 rounded-lg border border-line bg-soft animate-pulse" />
      </div>
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="border border-dashed border-line rounded-lg p-12 text-center bg-paper">
      <div className="brand-rule w-16 mx-auto mb-6" />
      <h3 className="font-display text-2xl font-bold">Comece sua prospecção</h3>
      <p className="text-muted mt-2 max-w-md mx-auto">
        Cadastre o primeiro negócio ou use a descoberta automática. Dica: comece
        pelos que não têm site — são os mais fáceis de fechar.
      </p>
      <div className="flex gap-3 justify-center mt-6">
        <Link
          href="/leads"
          className="border border-ink text-ink hover:bg-brand hover:text-white hover:border-brand font-medium h-11 px-5 rounded transition-colors inline-flex items-center"
        >
          ⚡ Descobrir leads
        </Link>
        <button
          onClick={onNew}
          className="bg-brand hover:bg-brand-600 text-white font-medium h-11 px-6 rounded"
        >
          + Cadastrar lead
        </button>
      </div>
    </div>
  );
}
