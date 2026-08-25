"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/dashboard", label: "Painel", icon: IconGrid },
  { href: "/leads", label: "Leads", icon: IconList },
  { href: "/funil", label: "Funil", icon: IconColumns },
];

export default function Shell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr] bg-soft">
      {/* Sidebar */}
      <aside
        className={`${
          open ? "block" : "hidden"
        } lg:block fixed lg:static inset-0 z-40 lg:z-auto bg-ink text-paper lg:min-h-screen`}
      >
        <div className="flex flex-col h-full p-4">
          <div className="flex items-center justify-between px-2 py-2">
            <div className="flex items-center gap-2">
              <span className="inline-block h-5 w-5 bg-brand rounded-sm" />
              <span className="font-display font-bold text-lg tracking-tight">
                Prospect<span className="text-brand">On</span>
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="lg:hidden text-white/60 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="brand-rule w-10 ml-2 mt-3 mb-6" />

          <nav className="flex-1 space-y-1">
            {NAV.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-3 h-10 rounded text-sm transition-colors ${
                    active
                      ? "bg-white/10 text-white"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-white/10 pt-4 mt-4">
            <div className="px-3 text-xs text-white/50 truncate mb-2" title={email}>
              {email}
            </div>
            <button
              onClick={logout}
              className="w-full text-left px-3 h-10 rounded text-sm text-white/60 hover:text-white hover:bg-white/5 flex items-center gap-3"
            >
              <IconLogout />
              Sair
            </button>
          </div>
        </div>
      </aside>

      {/* Conteúdo */}
      <div className="flex flex-col min-h-screen">
        <header className="lg:hidden flex items-center justify-between px-4 h-14 bg-ink text-paper">
          <div className="flex items-center gap-2">
            <span className="inline-block h-4 w-4 bg-brand rounded-sm" />
            <span className="font-display font-bold tracking-tight">
              Prospect<span className="text-brand">On</span>
            </span>
          </div>
          <button onClick={() => setOpen(true)} className="text-white/80">
            ☰
          </button>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

/* Ícones (SVG inline, traço fino — sem lib) */
function IconGrid() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
function IconList() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="3.5" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="3.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="3.5" cy="18" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconColumns() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="3" width="5" height="18" rx="1" />
      <rect x="10" y="3" width="5" height="12" rx="1" />
      <rect x="17" y="3" width="4" height="16" rx="1" />
    </svg>
  );
}
function IconLogout() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
