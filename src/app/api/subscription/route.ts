import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSubState } from "@/lib/subscription-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }
  const s = await getSubState(user.id);
  return NextResponse.json({
    plan: s.plan,
    used: s.used === Infinity ? 0 : s.used,
    quota: s.quota === Infinity ? 999999 : s.quota,
    ai: s.ai,
    seats: s.seats,
    isOwner: s.isOwner,
    expired: !!s.expired,
    enforced: s.enforced,
  });
}
