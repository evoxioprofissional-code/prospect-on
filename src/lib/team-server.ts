import { createAdminClient, hasAdmin } from "@/lib/supabase/admin";

// Dono do time do usuário: se ele é membro ativo de algum time, o dono é
// o team_id; senão, ele é o próprio dono (time solo).
export async function resolveTeamOwner(userId: string): Promise<string> {
  if (!hasAdmin()) return userId;
  const admin = createAdminClient();
  const { data } = await admin
    .from("team_members")
    .select("team_id")
    .eq("member_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return data?.team_id ?? userId;
}

// Vincula convites pendentes ao usuário que acabou de logar (por e-mail).
export async function linkInvites(email: string, userId: string): Promise<void> {
  if (!hasAdmin() || !email) return;
  const admin = createAdminClient();
  await admin
    .from("team_members")
    .update({ member_id: userId, status: "active" })
    .eq("email", email.toLowerCase())
    .is("member_id", null);
}

export interface TeamMember {
  id: string;
  email: string;
  role: string;
  status: string;
  member_id: string | null;
}

export async function listTeam(ownerId: string): Promise<TeamMember[]> {
  if (!hasAdmin()) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("team_members")
    .select("id, email, role, status, member_id")
    .eq("team_id", ownerId)
    .order("created_at", { ascending: true });
  return (data as TeamMember[]) ?? [];
}

// Assentos usados = dono (1) + membros convidados/ativos.
export async function seatsUsed(ownerId: string): Promise<number> {
  if (!hasAdmin()) return 1;
  const admin = createAdminClient();
  const { count } = await admin
    .from("team_members")
    .select("id", { count: "exact", head: true })
    .eq("team_id", ownerId);
  return 1 + (count ?? 0);
}
