"use client";

import { useState } from "react";
import type { LeadInput } from "@/lib/types";

interface Discovered {
  name: string;
  niche: string;
  city: string;
  phone: string;
  whatsapp: string;
  instagram: string;
  website: string;
  has_website: boolean;
  address: string;
  source: "osm" | "google";
}

export default function DiscoverModal({
  existingNames,
  onClose,
  onImport,
}: {
  existingNames: Set<string>;
  onClose: () => void;
  onImport: (leads: LeadInput[]) => Promise<{ count: number; error?: string }>;
}) {
  const [source, setSource] = useState<"osm" | "google">("osm");
  const [niche, setNiche] = useState("");
  const [city, setCity] = useState("");
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [results, setResults] = useState<Discovered[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNote(null);
    setResults([]);
    setDone(null);

    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, niche, city, limit }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Falha na busca.");
      } else {
        const list = data.results as Discovered[];
        setResults(list);
        setNote(data.note ?? null);
        // pré-seleciona todos que ainda não existem na carteira
        const sel = new Set<number>();
        list.forEach((r, i) => {
          if (!existingNames.has(r.name.toLowerCase())) sel.add(i);
        });
        setSelected(sel);
        if (list.length === 0)
          setError("Nada encontrado. Tente outro nicho ou cidade.");
      }
    } catch {
      setError("Erro de conexão.");
    }
    setLoading(false);
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  async function importSelected() {
    setImporting(true);
    const leads: LeadInput[] = results
      .filter((_, i) => selected.has(i))
      .map((r) => ({
        name: r.name,
        niche: r.niche,
        city: r.city,
        phone: r.phone,
        whatsapp: r.whatsapp,
        instagram: r.instagram,
        email: "",
        website: r.website,
        has_website: r.has_website,
        status: "novo",
        value: 0,
        notes: [r.address && `Endereço: ${r.address}`, `Fonte: ${r.source === "osm" ? "OpenStreetMap" : "Google"}`]
          .filter(Boolean)
          .join(" · "),
        next_followup: null,
      }));

    const { count, error } = await onImport(leads);
    setImporting(false);
    if (error) setError(error);
    else setDone(`${count} lead(s) importado(s)!`);
  }

  const semSite = results.filter((r) => !r.has_website).length;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-paper h-full overflow-y-auto shadow-pop fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-paper border-b border-line px-6 py-4 flex items-center justify-between z-10">
          <div>
            <p className="eyebrow">Descobrir leads</p>
            <h2 className="font-display text-xl font-bold mt-0.5">
              Preenchimento automático
            </h2>
          </div>
          <button onClick={onClose} className="h-9 w-9 grid place-items-center rounded hover:bg-soft text-muted">
            ✕
          </button>
        </div>

        <form onSubmit={search} className="p-6 space-y-4 border-b border-line">
          {/* Fonte */}
          <div className="flex gap-2">
            <SourceTab active={source === "osm"} onClick={() => setSource("osm")} title="OpenStreetMap" sub="grátis" />
            <SourceTab active={source === "google"} onClick={() => setSource("google")} title="Google Places" sub="precisa de chave" />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="eyebrow">Nicho</span>
              <input
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                required
                placeholder="restaurantes, clínicas…"
                className="mt-1 w-full h-11 px-3 border border-line rounded outline-none focus:border-ink"
              />
            </label>
            <label className="block">
              <span className="eyebrow">Cidade</span>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
                placeholder="Curitiba, PR"
                className="mt-1 w-full h-11 px-3 border border-line rounded outline-none focus:border-ink"
              />
            </label>
          </div>

          <div className="flex items-end gap-4">
            <label className="block w-32">
              <span className="eyebrow">Quantidade</span>
              <input
                type="number"
                min={1}
                max={200}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="mt-1 w-full h-11 px-3 border border-line rounded outline-none focus:border-ink tnum"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="bg-brand hover:bg-brand-600 text-white font-medium h-11 px-6 rounded disabled:opacity-60"
            >
              {loading ? "Buscando…" : "Buscar"}
            </button>
          </div>

          {error && (
            <p className="text-sm rounded border border-brand/30 bg-brand/10 text-brand px-3 py-2">
              {error}
            </p>
          )}
        </form>

        {/* Resultados */}
        {results.length > 0 && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted">
                <span className="font-bold text-ink tnum">{results.length}</span> encontrados ·{" "}
                <span className="text-brand font-bold tnum">{semSite}</span> sem site 🔥
              </p>
              <button
                onClick={() =>
                  setSelected(
                    selected.size === results.length
                      ? new Set()
                      : new Set(results.map((_, i) => i))
                  )
                }
                className="text-sm text-brand hover:underline"
              >
                {selected.size === results.length ? "Limpar seleção" : "Selecionar todos"}
              </button>
            </div>

            {note && <p className="text-xs text-muted mb-4">{note}</p>}

            <ul className="space-y-2">
              {results.map((r, i) => {
                const exists = existingNames.has(r.name.toLowerCase());
                return (
                  <li
                    key={i}
                    className={`flex items-start gap-3 border rounded p-3 ${
                      selected.has(i) ? "border-brand/40 bg-brand/5" : "border-line"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(i)}
                      onChange={() => toggle(i)}
                      className="mt-1 h-4 w-4 accent-brand"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{r.name}</p>
                        {!r.has_website ? (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-brand/10 text-brand">🔥 sem site</span>
                        ) : (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-soft text-muted">tem site</span>
                        )}
                        {exists && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">já na carteira</span>
                        )}
                      </div>
                      <p className="text-xs text-muted truncate">{r.address || "sem endereço"}</p>
                      {(r.phone || r.website) && (
                        <p className="text-xs text-muted mt-0.5">
                          {r.phone} {r.website && `· ${r.website}`}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="sticky bottom-0 bg-paper pt-4 mt-4 border-t border-line flex items-center gap-3">
              <button
                onClick={importSelected}
                disabled={importing || selected.size === 0}
                className="bg-brand hover:bg-brand-600 text-white font-medium h-11 px-6 rounded disabled:opacity-50"
              >
                {importing ? "Importando…" : `Importar ${selected.size} selecionado(s)`}
              </button>
              {done && <span className="text-sm text-green-700">{done}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SourceTab({
  active,
  onClick,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded border px-4 py-3 text-left transition-colors ${
        active ? "border-brand bg-brand/10" : "border-line hover:border-ink"
      }`}
    >
      <div className="font-medium text-sm">{title}</div>
      <div className="text-xs text-muted">{sub}</div>
    </button>
  );
}
