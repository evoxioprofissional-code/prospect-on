"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLeads } from "@/lib/useLeads";
import { STATUSES, type Lead, type LeadStatus } from "@/lib/types";
import { DEFAULT_TEMPLATES, resolveTemplate } from "@/lib/templates";
import {
  CAMPAIGN_STATUS_LABEL,
  DEFAULT_SETTINGS,
  type Campaign,
  type CampaignSettings,
  type WaSession,
} from "@/lib/campaigns";
import PageHeader from "@/components/PageHeader";

const LS_EMPRESA = "prospect_empresa_v1";
type Filter = "todos" | "sem_site" | LeadStatus;

export default function CampanhasPage() {
  const { leads, loading: leadsLoading } = useLeads();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [wa, setWa] = useState<WaSession | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/campaigns", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setCampaigns(data.campaigns ?? []);
        setWa(data.waSession ?? null);
      }
    } catch {
      /* silêncio: tenta de novo no próximo tick */
    }
    setLoaded(true);
  }, []);

  // Poll a cada 5s para atualizar progresso e o QR da conexão.
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-5xl mx-auto">
      <PageHeader
        eyebrow="Disparo automático"
        title="Campanhas"
        subtitle="Envie em sequência, sozinho, com intervalos que imitam uma pessoa."
      />

      <ConnectionCard wa={wa} loaded={loaded} onRefresh={refresh} />

      <NewCampaign
        leads={leads}
        leadsLoading={leadsLoading}
        onCreated={refresh}
      />

      <CampaignList
        campaigns={campaigns}
        loaded={loaded}
        onChange={refresh}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Conexão do WhatsApp                                                  */
/* ------------------------------------------------------------------ */
function ConnectionCard({
  wa,
  loaded,
  onRefresh,
}: {
  wa: WaSession | null;
  loaded: boolean;
  onRefresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = wa?.status ?? "desconectado";
  const qr = wa?.qr
    ? wa.qr.startsWith("data:")
      ? wa.qr
      : `data:image/png;base64,${wa.qr}`
    : null;

  const meta = {
    conectado: { dot: "bg-green-500", label: "WhatsApp conectado", tone: "text-green-700" },
    conectando: { dot: "bg-amber-500 animate-pulse", label: "Aguardando leitura do QR…", tone: "text-amber-700" },
    desconectado: { dot: "bg-line", label: "WhatsApp desconectado", tone: "text-muted" },
  }[status];

  async function call(action: "connect" | "disconnect") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/wa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Falha ao falar com o WhatsApp.");
    } catch {
      setError("Erro de conexão.");
    }
    setBusy(false);
    onRefresh();
  }

  return (
    <div className="bg-paper border border-line rounded-xl p-4 sm:p-5 mb-5">
      <div className="flex items-center gap-2.5">
        <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
        <span className={`text-sm font-medium ${meta.tone}`}>{meta.label}</span>
        {status === "conectado" && wa?.phone && (
          <span className="text-xs text-muted ml-1">· {wa.phone}</span>
        )}
        <div className="ml-auto flex gap-2">
          {status !== "conectado" && (
            <button
              onClick={() => call("connect")}
              disabled={busy}
              className="h-9 px-4 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 disabled:opacity-60"
            >
              {busy ? "…" : qr ? "Gerar novo QR" : "Conectar WhatsApp"}
            </button>
          )}
          {status === "conectado" && (
            <button
              onClick={() => call("disconnect")}
              disabled={busy}
              className="h-9 px-3 rounded-lg border border-line text-sm text-muted hover:text-brand hover:border-brand disabled:opacity-60"
            >
              Desconectar
            </button>
          )}
        </div>
      </div>

      {status !== "conectado" && qr && (
        <div className="mt-4 flex flex-col sm:flex-row items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt="QR de conexão do WhatsApp"
            className="h-44 w-44 rounded-lg border border-line bg-white p-1"
          />
          <ol className="text-sm text-muted space-y-1 list-decimal ml-4">
            <li>Abra o WhatsApp no celular do disparo.</li>
            <li>Toque em <b className="text-ink">Aparelhos conectados</b>.</li>
            <li>Aponte a câmera para este QR.</li>
          </ol>
        </div>
      )}

      {error && (
        <p className="text-sm text-brand bg-brand/10 border border-brand/30 rounded-lg px-3 py-2 mt-3">
          {error}
        </p>
      )}

      {status === "desconectado" && !qr && loaded && (
        <p className="text-xs text-muted mt-2 leading-relaxed">
          Conecte o número do disparo escaneando o QR. Se nada acontecer, o
          Evolution API pode estar fora do ar — confira a VPS
          (<code className="bg-soft px-1 rounded">deploy/README.md</code>).
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Nova campanha                                                        */
/* ------------------------------------------------------------------ */
function NewCampaign({
  leads,
  leadsLoading,
  onCreated,
}: {
  leads: Lead[];
  leadsLoading: boolean;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATES[0].id);
  const [body, setBody] = useState(DEFAULT_TEMPLATES[0].body);
  const [filter, setFilter] = useState<Filter>("sem_site");
  const [settings, setSettings] = useState<CampaignSettings>(DEFAULT_SETTINGS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useEffect(() => {
    const emp = localStorage.getItem(LS_EMPRESA);
    if (emp) setEmpresa(emp);
  }, []);

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

  function pickTemplate(id: string) {
    const t = DEFAULT_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setTemplateId(id);
    setBody(t.body);
  }

  const preview = fila[0]
    ? resolveTemplate(body, fila[0], empresa)
    : "Selecione um filtro com leads para ver a prévia.";

  async function submit() {
    setError(null);
    setOkMsg(null);
    if (!name.trim()) return setError("Dê um nome à campanha.");
    if (fila.length === 0) return setError("Nenhum lead com WhatsApp nesse filtro.");

    const messages = fila.map((l) => ({
      lead_id: l.id,
      name: l.name,
      phone: l.whatsapp!,
      body: resolveTemplate(body, l, empresa),
    }));

    setSubmitting(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          empresa: empresa.trim(),
          message_template: body,
          settings,
          messages,
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Falha ao criar campanha.");
      else {
        setOkMsg(`Campanha criada com ${messages.length} contato(s) na fila.`);
        setName("");
        setOpen(false);
        onCreated();
      }
    } catch {
      setError("Erro de conexão.");
    }
    setSubmitting(false);
  }

  if (!open) {
    return (
      <div className="mb-5">
        <button
          onClick={() => setOpen(true)}
          className="h-11 px-5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90"
        >
          + Nova campanha
        </button>
        {okMsg && <p className="text-sm text-green-700 mt-2">{okMsg}</p>}
      </div>
    );
  }

  return (
    <div className="bg-paper border border-line border-l-4 border-l-brand rounded-xl p-4 sm:p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <span className="eyebrow">Nova campanha</span>
        <button onClick={() => setOpen(false)} className="text-muted hover:text-ink text-sm">
          Cancelar
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <label className="block">
          <span className="eyebrow">Nome da campanha</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Sem site — Marabá"
            className="mt-1 w-full h-11 px-3 border border-line rounded-lg bg-paper outline-none focus:border-ink"
          />
        </label>
        <label className="block">
          <span className="eyebrow">Sua empresa</span>
          <input
            value={empresa}
            onChange={(e) => {
              setEmpresa(e.target.value);
              localStorage.setItem(LS_EMPRESA, e.target.value);
            }}
            placeholder="Ex.: Studio X Sites"
            className="mt-1 w-full h-11 px-3 border border-line rounded-lg bg-paper outline-none focus:border-ink"
          />
        </label>
      </div>

      {/* Modelo */}
      <span className="eyebrow">Modelo da mensagem</span>
      <div className="flex gap-2 overflow-x-auto pb-1 mt-1 -mx-1 px-1 mb-2">
        {DEFAULT_TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => pickTemplate(t.id)}
            className={`shrink-0 h-9 px-3 rounded-full text-sm border transition-colors ${
              templateId === t.id
                ? "bg-brand text-white border-brand"
                : "bg-paper text-muted border-line hover:border-ink hover:text-ink"
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        className="w-full px-3 py-2 border border-line rounded-lg bg-paper outline-none focus:border-ink resize-none text-sm"
      />
      <div className="flex flex-wrap items-center gap-1 mt-2 text-xs text-muted">
        {["{empresa}", "{nome}", "{cidade}", "{nicho}", "{gancho}"].map((v) => (
          <code key={v} className="bg-soft px-1.5 py-0.5 rounded">{v}</code>
        ))}
        <span className="ml-1">preenchem sozinhos por lead.</span>
      </div>

      {/* Prévia */}
      <div className="mt-3 rounded-lg bg-soft border border-line p-3">
        <span className="eyebrow">Prévia (1º da fila)</span>
        <p className="text-sm mt-1 leading-relaxed whitespace-pre-wrap">{preview}</p>
      </div>

      {/* Público */}
      <span className="eyebrow block mt-4">Quem vai receber</span>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 mt-1">
        <Chip active={filter === "sem_site"} onClick={() => setFilter("sem_site")} accent>
          🔥 Sem site
        </Chip>
        <Chip active={filter === "novo"} onClick={() => setFilter("novo")}>Novos</Chip>
        <Chip active={filter === "todos"} onClick={() => setFilter("todos")}>Todos</Chip>
        {STATUSES.filter((s) => s.key !== "novo").map((s) => (
          <Chip key={s.key} active={filter === s.key} onClick={() => setFilter(s.key)}>
            {s.label}
          </Chip>
        ))}
      </div>
      <p className="text-sm mt-2">
        {leadsLoading ? (
          <span className="text-muted">Carregando leads…</span>
        ) : (
          <span>
            <b className="tnum">{fila.length}</b> lead(s) com WhatsApp entram nesta campanha.
          </span>
        )}
      </p>

      {/* Regras de envio */}
      <button
        onClick={() => setShowAdvanced((v) => !v)}
        className="text-sm text-brand mt-4 hover:underline"
      >
        {showAdvanced ? "− Ocultar" : "+ Ajustar"} ritmo e segurança
      </button>
      {showAdvanced && (
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <Num label="Intervalo mínimo (s)" value={settings.min_delay_sec}
            onChange={(v) => setSettings((s) => ({ ...s, min_delay_sec: v }))} />
          <Num label="Intervalo máximo (s)" value={settings.max_delay_sec}
            onChange={(v) => setSettings((s) => ({ ...s, max_delay_sec: v }))} />
          <Num label="Limite por dia (0 = sem limite)" value={settings.daily_cap}
            onChange={(v) => setSettings((s) => ({ ...s, daily_cap: v }))} />
          <div className="grid grid-cols-2 gap-3">
            <Num label="Hora início" value={settings.window_start_hour}
              onChange={(v) => setSettings((s) => ({ ...s, window_start_hour: v }))} />
            <Num label="Hora fim" value={settings.window_end_hour}
              onChange={(v) => setSettings((s) => ({ ...s, window_end_hour: v }))} />
          </div>
          <Num label="Pausar a cada N envios (0 = nunca)" value={settings.batch_size}
            onChange={(v) => setSettings((s) => ({ ...s, batch_size: v }))} />
          <Num label="Duração da pausa (min)" value={settings.batch_pause_min}
            onChange={(v) => setSettings((s) => ({ ...s, batch_pause_min: v }))} />
        </div>
      )}

      {error && (
        <p className="text-sm text-brand bg-brand/10 border border-brand/30 rounded-lg px-3 py-2 mt-3">
          {error}
        </p>
      )}

      <div className="flex justify-end mt-4">
        <button
          onClick={submit}
          disabled={submitting}
          className="h-11 px-6 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 disabled:opacity-60"
        >
          {submitting ? "Criando…" : `Criar e começar a enviar`}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lista de campanhas                                                   */
/* ------------------------------------------------------------------ */
function CampaignList({
  campaigns,
  loaded,
  onChange,
}: {
  campaigns: Campaign[];
  loaded: boolean;
  onChange: () => void;
}) {
  if (!loaded) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl border border-line bg-soft animate-pulse" />
        ))}
      </div>
    );
  }
  if (campaigns.length === 0) {
    return (
      <div className="border border-dashed border-line rounded-xl p-10 text-center text-muted">
        Nenhuma campanha ainda. Crie a primeira acima.
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {campaigns.map((c) => (
        <CampaignRow key={c.id} c={c} onChange={onChange} />
      ))}
    </ul>
  );
}

function CampaignRow({ c, onChange }: { c: Campaign; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const done = c.sent + c.failed;
  const pct = c.total ? Math.round((done / c.total) * 100) : 0;
  const pending = Math.max(0, c.total - done);

  const badge = {
    running: "bg-green-100 text-green-700",
    paused: "bg-amber-100 text-amber-700",
    done: "bg-soft text-muted",
    canceled: "bg-soft text-muted",
  }[c.status];

  async function act(action: "pause" | "resume" | "cancel") {
    setBusy(true);
    await fetch("/api/campaigns", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, action }),
    });
    setBusy(false);
    onChange();
  }
  async function remove() {
    if (!confirm(`Apagar a campanha "${c.name}" e sua fila?`)) return;
    setBusy(true);
    await fetch(`/api/campaigns?id=${c.id}`, { method: "DELETE" });
    setBusy(false);
    onChange();
  }

  return (
    <li className="border border-line rounded-xl p-4 bg-paper">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="font-semibold truncate">{c.name}</p>
          <p className="text-xs text-muted">
            {c.min_delay_sec}–{c.max_delay_sec}s entre envios · {c.window_start_hour}h–{c.window_end_hour}h
            {c.daily_cap > 0 && ` · até ${c.daily_cap}/dia`}
          </p>
        </div>
        <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${badge}`}>
          {CAMPAIGN_STATUS_LABEL[c.status]}
        </span>
      </div>

      <div className="h-1.5 bg-soft rounded-full overflow-hidden mb-1.5">
        <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs text-muted tnum">
        <span>{c.sent} enviados · {pending} na fila{c.failed > 0 && ` · ${c.failed} falha(s)`}</span>
        <span>{pct}%</span>
      </div>

      <div className="flex gap-2 mt-3">
        {c.status === "running" && (
          <button onClick={() => act("pause")} disabled={busy}
            className="h-9 px-3 rounded-lg border border-line text-sm hover:border-ink disabled:opacity-60">
            Pausar
          </button>
        )}
        {c.status === "paused" && (
          <button onClick={() => act("resume")} disabled={busy}
            className="h-9 px-3 rounded-lg bg-brand text-white text-sm hover:bg-brand/90 disabled:opacity-60">
            Retomar
          </button>
        )}
        {(c.status === "running" || c.status === "paused") && (
          <button onClick={() => act("cancel")} disabled={busy}
            className="h-9 px-3 rounded-lg border border-line text-sm hover:border-ink disabled:opacity-60">
            Encerrar
          </button>
        )}
        <button onClick={remove} disabled={busy}
          className="h-9 px-3 rounded-lg border border-line text-sm text-muted hover:text-brand hover:border-brand disabled:opacity-60 ml-auto">
          Apagar
        </button>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Auxiliares                                                           */
/* ------------------------------------------------------------------ */
function Chip({
  children, active, onClick,
}: {
  children: React.ReactNode; active: boolean; onClick: () => void; accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 h-9 px-3 rounded-full text-sm border transition-colors ${
        active
          ? "bg-brand text-white border-brand"
          : "bg-paper text-muted border-line hover:border-ink hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Num({
  label, value, onChange,
}: {
  label: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.round(Number(e.target.value) || 0)))}
        className="mt-1 w-full h-11 px-3 border border-line rounded-lg bg-paper outline-none focus:border-ink tnum"
      />
    </label>
  );
}
