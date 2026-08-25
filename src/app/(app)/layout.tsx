import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { linkInvites } from "@/lib/team-server";
import Shell from "@/components/Shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Vincula convites pendentes deste e-mail à conta (aceite automático).
  try {
    if (user.email) await linkInvites(user.email, user.id);
  } catch {
    // sem chave secreta ou tabela ainda não migrada — segue normal
  }

  return <Shell email={user.email ?? ""}>{children}</Shell>;
}
