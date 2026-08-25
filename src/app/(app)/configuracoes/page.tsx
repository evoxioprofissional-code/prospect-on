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
          <div className="grid grid-cols-3 gap-2 max-w-sm">
            <ThemeButton label="Claro" active={theme === "light"} onClick={() => pickTheme("light")} icon="☀️" />
            <ThemeButton label="Escuro" active={theme === "dark"} onClick={() => pickTheme("dark")} icon="🌙" />
            <ThemeButton label="Sistema" active={theme === "system"} onClick={() => pickTheme("system")} icon="🖥️" />
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
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 h-20 rounded-lg border transition-colors ${
        active
          ? "border-brand bg-brand-50 text-brand-700"
          : "border-line hover:border-ink text-ink"
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </button>
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
