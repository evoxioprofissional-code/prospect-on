"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Lead } from "@/lib/types";
import { whatsappLink } from "@/lib/format";

type Result = { url: string | null; html: string };

export default function GenerateSiteModal({
  lead,
  onClose,
}: {
  lead: Lead;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);
  const started = useRef(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setCopied(false);
    try {
      const res = await fetch("/api/generate-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: lead.id,
          name: lead.name,
          niche: lead.niche,
          city: lead.city,
          whatsapp: lead.whatsapp,
          phone: lead.phone,
          has_website: lead.has_website,
          notes: lead.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Falha ao gerar o site.");
      } else {
        setResult({ url: data.url ?? null, html: data.html });
        if (data.detail) setError(data.error); // salvou parcialmente
      }
    } catch {
      setError("Erro de conexão ao gerar o site.");
    }
    setLoading(false);
  }, [lead]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    generate();
  }, [generate]);

  async function copy() {
    if (!result?.url) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  const waShare =
    result?.url && lead.whatsapp
      ? whatsappLink(
          lead.whatsapp,
          `Oi! Montei uma prévia de site pra ${lead.name}. Dá uma olhada: ${result.url}`
        )
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-3xl bg-paper h-full flex flex-col shadow-pop fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="border-b border-line px-6 py-4 flex items-center justify-between">
          <div>
            <p className="eyebrow">Site de demonstração</p>
            <h2 className="font-display text-xl font-bold mt-0.5">{lead.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 grid place-items-center rounded hover:bg-soft text-muted"
          >
            ✕
          </button>
        </div>

        {/* Link + ações */}
        {result?.url && (
          <div className="px-6 py-3 border-b border-line bg-soft/50 flex flex-wrap items-center gap-2">
            <input
              readOnly
              value={result.url}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 min-w-[180px] h-10 px-3 text-sm border border-line rounded bg-paper outline-none"
            />
            <button
              onClick={copy}
              className="h-10 px-4 rounded border border-line text-sm hover:border-ink whitespace-nowrap"
            >
              {copied ? "✓ Copiado" : "Copiar link"}
            </button>
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="h-10 px-4 rounded border border-line text-sm hover:border-ink whitespace-nowrap inline-flex items-center"
            >
              Abrir ↗
            </a>
            {waShare && (
              <a
                href={waShare}
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 px-4 rounded bg-green-600 hover:bg-green-700 text-white text-sm font-medium whitespace-nowrap inline-flex items-center gap-1.5"
              >
                Enviar no WhatsApp
              </a>
            )}
          </div>
        )}

        {/* Corpo */}
        <div className="flex-1 overflow-hidden bg-soft">
          {loading ? (
            <div className="h-full grid place-items-center text-center px-6">
              <div>
                <div className="mx-auto mb-4 h-10 w-10 rounded-full border-2 border-line border-t-brand animate-spin" />
                <p className="font-medium">Gerando o site com IA…</p>
                <p className="text-sm text-muted mt-1">
                  Montando um index sob medida para {lead.niche || "o negócio"}. Pode levar até ~30s.
                </p>
              </div>
            </div>
          ) : error && !result ? (
            <div className="h-full grid place-items-center text-center px-6">
              <div className="max-w-sm">
                <p className="text-brand bg-brand/10 border border-brand/30 rounded-lg px-4 py-3 text-sm">
                  {error}
                </p>
                <button
                  onClick={generate}
                  className="mt-4 h-10 px-5 rounded bg-brand hover:bg-brand-600 text-white text-sm font-medium"
                >
                  Tentar de novo
                </button>
              </div>
            </div>
          ) : result ? (
            <iframe
              title="Prévia do site"
              srcDoc={result.html}
              className="w-full h-full border-0 bg-white"
              sandbox="allow-scripts allow-popups allow-same-origin"
            />
          ) : null}
        </div>

        {/* Rodapé */}
        {result && (
          <div className="border-t border-line px-6 py-3 flex items-center gap-3">
            {error && (
              <span className="text-xs text-brand">{error}</span>
            )}
            <button
              onClick={generate}
              disabled={loading}
              className="ml-auto h-10 px-4 rounded border border-line text-sm hover:border-ink disabled:opacity-60"
            >
              ↻ Gerar outra versão
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
