import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasAdmin } from "@/lib/supabase/admin";
import { getSubState } from "@/lib/subscription-server";
import { listTeam, seatsUsed } from "@/lib/team-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function currentUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Lista membros + situação de assentos
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

  const sub = await getSubState(user.id);
  const members = sub.isOwner ? await listTeam(sub.ownerId) : [];
  const used = await seatsUsed(sub.ownerId);

  return NextResponse.json({
    isOwner: sub.isOwner,
    plan: sub.plan,
    seatsTotal: sub.seats,
    seatsUsed: used,
    canInvite: sub.isOwner && sub.seats > 1 && used < sub.seats,
    members,
  });
}

// Convida um membro por e-mail
export async function POST(req: Request) {
  if (!hasAdmin()) {
    return NextResponse.json(
      { error: "Recurso indisponível (SUPABASE_SERVICE_KEY ausente)." },
      { status: 400 }
    );
  }
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  }

  const sub = await getSubState(user.id);
  if (!sub.isOwner) {
    return NextResponse.json({ error: "Só o dono da conta pode convidar." }, { status: 403 });
  }
  if (sub.seats <= 1) {
    return NextResponse.json(
      { error: "Equipe está disponível no plano Agência." },
      { status: 402 }
    );
  }
  if (email === user.email?.toLowerCase()) {
    return NextResponse.json({ error: "Você já faz parte da equipe." }, { status: 400 });
  }
  const used = await seatsUsed(sub.ownerId);
  if (used >= sub.seats) {
    return NextResponse.json(
      { error: `Limite de ${sub.seats} usuários atingido.` },
      { status: 402 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.from("team_members").insert({
    team_id: sub.ownerId,
    email,
    role: "member",
    status: "invited",
  });
  if (error) {
    const msg = /duplicate|unique/i.test(error.message)
      ? "Esse e-mail já foi convidado."
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

// Remove um membro (por id)
export async function DELETE(req: Request) {
  if (!hasAdmin()) {
    return NextResponse.json({ error: "Indisponível." }, { status: 400 });
  }
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });

  const sub = await getSubState(user.id);
  if (!sub.isOwner) {
    return NextResponse.json({ error: "Só o dono pode remover." }, { status: 403 });
  }

  const admin = createAdminClient();
  await admin
    .from("team_members")
    .delete()
    .eq("id", id)
    .eq("team_id", sub.ownerId);
  return NextResponse.json({ ok: true });
}
