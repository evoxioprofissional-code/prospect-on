import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function GerenciarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-soft">
      <header className="bg-panel text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="font-display font-bold text-lg tracking-tight">
              Prospect<span className="text-brand">On</span>
            </span>
            <span className="text-[11px] uppercase tracking-wide text-white/60 border border-white/20 rounded px-2 py-0.5">
              Gerenciar
            </span>
          </div>
          <Link href="/dashboard" className="text-sm text-white/70 hover:text-white">
            Voltar ao app
          </Link>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">{children}</main>
    </div>
  );
}
