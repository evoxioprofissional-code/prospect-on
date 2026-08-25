"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ t: "err" | "ok"; text: string } | null>(
    null
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMsg({ t: "err", text: traduzErro(error.message) });
      } else {
        setMsg({
          t: "ok",
          text: "Conta criada. Se pedir confirmação, veja seu e-mail — senão já pode entrar.",
        });
        setMode("login");
      }
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setMsg({ t: "err", text: traduzErro(error.message) });
      setLoading(false);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
      {/* Painel de marca */}
      <aside className="relative hidden lg:flex flex-col justify-between bg-panel text-white p-12 overflow-hidden">
        <div
          aria-hidden
          className="absolute -right-24 -top-24 h-96 w-96 rotate-12 bg-brand"
          style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%)" }}
        />
        <div className="relative">
          <Wordmark />
        </div>

        <div className="relative max-w-md">
          <div className="brand-rule w-24 mb-8" />
          <h1 className="font-display text-4xl leading-[1.05] font-bold">
            Todo negócio sem site
            <br />é uma venda esperando
            <br />
            <span className="text-brand">por você.</span>
          </h1>
          <p className="mt-6 text-white/70 leading-relaxed">
            Cadastre, qualifique e acompanhe cada prospecto num funil visual.
            Foque nos leads quentes e transforme rua em receita.
          </p>
        </div>

        <div className="relative grid grid-cols-3 gap-6 text-white/80">
          <Stat n="6" l="etapas do funil" />
          <Stat n="1" l="clique pro WhatsApp" />
          <Stat n="100%" l="dos seus dados" />
        </div>
      </aside>

      {/* Formulário */}
      <main className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm fade-up">
          <div className="lg:hidden mb-10">
            <Wordmark dark />
          </div>

          <p className="eyebrow">
            {mode === "login" ? "Acesso" : "Nova conta"}
          </p>
          <h2 className="font-display text-3xl font-bold mt-1 mb-8">
            {mode === "login" ? "Entrar no painel" : "Criar sua conta"}
          </h2>

          <form onSubmit={submit} className="space-y-4">
            <Field
              label="E-mail"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="voce@email.com"
              autoComplete="email"
            />
            <Field
              label="Senha"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />

            {msg && (
              <p
                className={`text-sm rounded border px-3 py-2 ${
                  msg.t === "err"
                    ? "border-brand/30 bg-brand/10 text-brand"
                    : "border-green-200 bg-green-50 text-green-700"
                }`}
              >
                {msg.text}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand hover:bg-brand-600 text-white font-medium h-11 rounded transition-colors disabled:opacity-60"
            >
              {loading
                ? "Aguarde…"
                : mode === "login"
                ? "Entrar"
                : "Criar conta"}
            </button>
          </form>

          <p className="mt-6 text-sm text-muted">
            {mode === "login" ? "Ainda não tem conta?" : "Já tem conta?"}{" "}
            <button
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setMsg(null);
              }}
              className="text-brand font-medium hover:underline"
            >
              {mode === "login" ? "Criar agora" : "Entrar"}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <input
        type={type}
        required
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full h-11 px-3 border border-line rounded bg-paper outline-none focus:border-ink focus:ring-2 focus:ring-brand/20 transition"
      />
    </label>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div>
      <div className="font-display text-2xl font-bold tnum">{n}</div>
      <div className="text-xs text-white/60 mt-1">{l}</div>
    </div>
  );
}

function Wordmark({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`font-display font-bold text-lg tracking-tight ${
          dark ? "text-ink" : "text-white"
        }`}
      >
        Prospect<span className="text-brand">On</span>
      </span>
    </div>
  );
}

function traduzErro(msg: string) {
  if (/Invalid login credentials/i.test(msg))
    return "E-mail ou senha incorretos.";
  if (/already registered/i.test(msg)) return "Este e-mail já tem conta.";
  if (/at least 6/i.test(msg)) return "A senha precisa de ao menos 6 caracteres.";
  return msg;
}
