"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";

interface Member {
  id: string;
  email: string;
  role: string;
  status: string;
  member_id: string | null;
}
interface TeamData {
  isOwner: boolean;
  plan: string;
  seatsTotal: number;
  seatsUsed: number;
  canInvite: boolean;
  members: Member[];
}

export default function EquipePage() {
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: "err" | "ok"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/team", { cache: "no-store" });
    setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function convidar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const j = await res.json();
    if (!res.ok) setMsg({ t: "err", text: j.error || "Falha ao convidar." });
    else {
      setMsg({ t: "ok", text: "Convite enviado! O membro entra ao logar com esse e-mail." });
      setEmail("");
      load();
    }
    setBusy(false);
  }

  async function remover(id: string) {
    if (!confirm("Remover este membro da equipe?")) return;
    await fetch(`/api/team?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-3xl mx-auto">
      <PageHeader
        eyebrow="Colaboração"
        title="Equipe"
        subtitle="Convide pessoas para compartilhar os mesmos leads e funil."
      />

      {loading ? (
        <div className="h-40 rounded-lg border border-line bg-soft animate-pulse" />
      ) : !data ? (
        <p className="text-muted">Não foi possível carregar a equipe.</p>
      ) : !data.isOwner ? (
        <div className="bg-paper border border-line rounded-lg p-6">
          <p className="text-sm">
            Você faz parte de uma equipe e compartilha os leads dela. Só o dono da
            conta gerencia os membros.
          </p>
        </div>
      ) : (
        <>
          {/* Assentos */}
          <div className="bg-paper border border-line rounded-lg p-6 mb-6 flex items-center justify-between">
            <div>
              <p className="eyebrow">Usuários</p>
              <p className="font-display text-2xl font-bold tnum mt-1">
                {data.seatsUsed}
                <span className="text-muted text-lg"> / {data.seatsTotal}</span>
              </p>
            </div>
            <span className="text-xs text-muted">
              Plano {data.plan}
            </span>
          </div>

          {data.seatsTotal <= 1 ? (
            <div className="border border-dashed border-line rounded-lg p-8 text-center">
              <p className="text-muted mb-4">
                Equipe (multiusuário) está disponível no plano <b>Agência</b>.
              </p>
              <Link
                href="/planos"
                className="inline-flex bg-brand hover:bg-brand-600 text-white font-medium h-11 px-6 rounded items-center"
              >
                Ver plano Agência
              </Link>
            </div>
          ) : (
            <>
              {/* Convidar */}
              <form onSubmit={convidar} className="flex gap-2 mb-6">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@do-membro.com"
                  disabled={!data.canInvite}
                  className="flex-1 h-11 px-3 border border-line rounded bg-white outline-none focus:border-ink disabled:bg-soft"
                />
                <button
                  disabled={!data.canInvite || busy}
                  className="bg-brand hover:bg-brand-600 text-white font-medium h-11 px-5 rounded disabled:opacity-60"
                >
                  {busy ? "Enviando…" : "Convidar"}
                </button>
              </form>
              {!data.canInvite && data.seatsUsed >= data.seatsTotal && (
                <p className="text-sm text-muted -mt-4 mb-6">
                  Limite de {data.seatsTotal} usuários atingido.
                </p>
              )}
              {msg && (
                <p
                  className={`text-sm rounded border px-3 py-2 mb-6 ${
                    msg.t === "err"
                      ? "border-brand/30 bg-brand-50 text-brand-700"
                      : "border-green-200 bg-green-50 text-green-700"
                  }`}
                >
                  {msg.text}
                </p>
              )}

              {/* Lista */}
              <div className="bg-paper border border-line rounded-lg divide-y divide-line">
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium text-sm">Você (dono)</p>
                  </div>
                  <span className="text-xs text-muted">dono</span>
                </div>
                {data.members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{m.email}</p>
                      <p className="text-xs text-muted">
                        {m.status === "active" ? "ativo" : "convite pendente"}
                      </p>
                    </div>
                    <button
                      onClick={() => remover(m.id)}
                      className="text-sm text-brand hover:text-brand-700"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
