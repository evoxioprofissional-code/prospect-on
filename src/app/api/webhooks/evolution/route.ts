import { NextResponse } from "next/server";
import { createAdminClient, hasAdmin } from "@/lib/supabase/admin";
import { mapState } from "@/lib/evolution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Evolution chama esta rota nos eventos da instância. Autentica por ?secret=.
// Para o disparo só interessa CONNECTION_UPDATE (manter o status do número).
export async function POST(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (!process.env.WA_WEBHOOK_SECRET || secret !== process.env.WA_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  // Sempre responde 200 para o Evolution não reenviar em loop.
  if (!hasAdmin()) return NextResponse.json({ ok: true });

  try {
    const payload = await req.json();
    const event: string = payload.event ?? "";
    const instance: string = payload.instance ?? "";

    if (event === "connection.update" && instance.startsWith("prospect_")) {
      const ownerId = instance.slice("prospect_".length);
      const state = payload.data?.state ?? payload.data?.connection;
      const status = mapState(state);
      const phone =
        String(payload.data?.wuid ?? payload.sender ?? "").split("@")[0] || null;

      await createAdminClient()
        .from("prospect_wa_sessions")
        .upsert(
          {
            owner_id: ownerId,
            instance_name: instance,
            status,
            last_seen: new Date().toISOString(),
            ...(status === "conectado" ? { qr: null, pairing_code: null } : {}),
            ...(status === "conectado" && phone ? { phone } : {}),
          },
          { onConflict: "owner_id" }
        );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
