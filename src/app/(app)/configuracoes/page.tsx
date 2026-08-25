"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getTheme, setTheme, type ThemeMode } from "@/lib/theme";
import PageHeader from "@/components/PageHeader";

export default function ConfiguracoesPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [theme, setThemeState] = useState<ThemeMode>("system");

  const [savingNome, setSavingNome] = useState(false);
  const [nomeMsg, setNomeMsg] = useState<string | null>(null);

  const [novaSenha, setNovaSenha] = useState("");
  const [savingSenha, setSavingSenha] = useState(false);
  const [senhaMsg, setSenhaMsg] = useState<{ t: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    setThemeState(getTheme());
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setEmail(user.email ?? "");
        setNome((user.user_metadata?.full_name as string) ?? "");
      }
    });
  }, [supabase]);

  function pickTheme(m: ThemeMode) {
    setTheme(m);
    setThemeState(m);
  }

  async function salvarNome(e: React.FormEvent) {
    e.preventDefault();
    setSavingNome(true);
    setNomeMsg(null);
    const { error } = await supabase.auth.updateUser({ data: { full_name: nome } });
    setNomeMsg(error ? "Erro ao salvar." : "Nome salvo!");
    setSavingNome(false);
  }

  async function trocarSenha(e: React.FormEvent) {
    e.preventDefault();
    if (novaSenha.length < 6) {
      setSenhaMsg({ t: "err", text: "A senha precisa de ao menos 6 caracteres." });
      return;
    }
    setSavingSenha(true);
    setSenhaMsg(null);
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    if (error) setSenhaMsg({ t: "err", text: error.message });
    else {
      setSenhaMsg({ t: "ok", text: "Senha alterada com sucesso." });
      setNovaSenha("");
    }
    setSavingSenha(false);
  }

  async function sair() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-3xl mx-auto">
      <PageHeader eyebrow="Conta" title="Configurações" subtitle="Perfil, aparência e conta." />

      <div className="space-y-6">
        {/* Aparência */}
        <Section title="Aparência" desc="Escolha o modo de cor do aplicativo.">
          <div className="grid grid-cols-3 gap-3 max-w-md">
            <ThemeButton label="Claro" mode="light" active={theme === "light"} onClick={() => pickTheme("light")} />
            <ThemeButton label="Escuro" mode="dark" active={theme === "dark"} onClick={() => pickTheme("dark")} />
            <ThemeButton label="Sistema" mode="system" active={theme === "system"} onClick={() => pickTheme("system")} />
          </div>
        </Section>

        {/* Perfil */}
        <Section title="Perfil" desc="Como você aparece no app.">
          <form onSubmit={salvarNome} className="space-y-4">
            <Field label="Nome" value={nome} onChange={setNome} placeholder="Seu nome" />
            <label className="block">
              <span className="eyebrow">E-mail</span>
              <input
                value={email}
                disabled
                className="mt-1 w-full h-11 px-3 border border-line rounded-lg bg-soft text-muted outline-none"
              />
              <span className="text-xs text-muted mt-1 block">
                Para trocar o e-mail, fale com o suporte.
              </span>
            </label>
            <div className="flex items-center gap-3">
              <button
                disabled={savingNome}
                className="bg-brand hover:bg-brand-600 text-white font-medium h-11 px-5 rounded-lg disabled:opacity-60"
              >
                {savingNome ? "Salvando…" : "Salvar nome"}
              </button>
              {nomeMsg && <span className="text-sm text-muted">{nomeMsg}</span>}
            </div>
          </form>
        </Section>

        {/* Senha */}
        <Section title="Senha" desc="Defina uma nova senha de acesso.">
          <form onSubmit={trocarSenha} className="space-y-4">
            <Field
              label="Nova senha"
              type="password"
              value={novaSenha}
              onChange={setNovaSenha}
              placeholder="••••••••"
            />
            {senhaMsg && (
              <p
                className={`text-sm rounded-lg border px-3 py-2 ${
                  senhaMsg.t === "err"
                    ? "border-brand/30 bg-brand-50 text-brand-700"
                    : "border-green-200 bg-green-50 text-green-700"
                }`}
              >
                {senhaMsg.text}
              </p>
            )}
            <button
              disabled={savingSenha}
              className="border border-ink text-ink hover:bg-brand hover:text-white hover:border-brand font-medium h-11 px-5 rounded-lg transition-colors disabled:opacity-60"
            >
              {savingSenha ? "Alterando…" : "Alterar senha"}
            </button>
          </form>
        </Section>

        {/* Conta */}
        <Section title="Conta" desc="Plano e sessão.">
          <div className="flex flex-wrap gap-3">
            <Link
              href="/planos"
              className="border border-line hover:border-ink text-ink font-medium h-11 px-5 rounded-lg inline-flex items-center transition-colors"
            >
              Ver planos
            </Link>
            <button
              onClick={sair}
              className="border border-brand/30 text-brand-700 hover:bg-brand-50 font-medium h-11 px-5 rounded-lg transition-colors"
            >
              Sair da conta
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-paper border border-line rounded-xl p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {desc && <p className="text-sm text-muted mt-0.5 mb-4">{desc}</p>}
      {children}
    </div>
  );
}

function ThemeButton({
  label,
  active,
  onClick,
  mode,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  mode: ThemeMode;
}) {
  const Icon = mode === "light" ? IconSun : mode === "dark" ? IconMoon : IconMonitor;
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center gap-2 h-24 rounded-xl border-2 transition-colors ${
        active
          ? "border-brand bg-brand/10 text-brand"
          : "border-line text-ink hover:border-ink/40"
      }`}
    >
      {active && (
        <span className="absolute top-2 right-2 h-4 w-4 rounded-full bg-brand text-white grid place-items-center">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      )}
      <Icon />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

function IconSun() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
function IconMoon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}
function IconMonitor() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full h-11 px-3 border border-line rounded-lg bg-paper outline-none focus:border-ink"
      />
    </label>
  );
}
