"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSubscription } from "@/lib/useSubscription";

const LS_KEY = "prospect_nudge_collapsed";

// Aviso flutuante de upgrade — aparece só no plano grátis, para incentivar
// a migração para um plano pago.
export default function UpgradeNudge() {
  const { sub } = useSubscription();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(LS_KEY) === "1");
    } catch {}
  }, []);

  function setC(v: boolean) {
    setCollapsed(v);
    try {
      localStorage.setItem(LS_KEY, v ? "1" : "0");
    } catch {}
  }

  // Só no grátis; nunca na própria tela de planos.
  if (!sub || sub.plan !== "trial" || pathname?.startsWith("/planos")) return null;

  if (collapsed) {
    return (
      <button
        onClick={() => setC(false)}
        className="fixed bottom-4 right-4 z-30 h-10 px-4 rounded-full bg-brand text-white text-sm font-medium shadow-pop hover:bg-brand/90"
      >
        Fazer upgrade
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-30 w-[270px] max-w-[calc(100vw-2rem)] rounded-xl border border-brand/30 bg-paper shadow-pop p-4">
      <button
        onClick={() => setC(true)}
        aria-label="Minimizar"
        className="absolute top-2.5 right-3 text-muted hover:text-ink text-sm leading-none"
      >
        ✕
      </button>

      <p className="eyebrow text-brand">Plano grátis</p>
      <p className="text-sm font-medium mt-1 leading-snug">
        Você está no gratuito — 15 leads e 5 buscas por mês.
      </p>
      <p className="text-xs text-muted mt-1 leading-snug">
        Faça upgrade para prospectar sem limite e disparar mais em cada campanha.
      </p>

      <Link
        href="/planos"
        className="mt-3 inline-flex w-full items-center justify-center h-10 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90"
      >
        Ver planos pagos
      </Link>
    </div>
  );
}
