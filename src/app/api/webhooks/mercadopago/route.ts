import { NextResponse } from "next/server";
import { getPreapproval } from "@/lib/mercadopago";
import { createAdminClient, hasAdmin } from "@/lib/supabase/admin";
import { isPlanId } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mercado Pago notifica aqui quando a assinatura muda de estado.
// NÃO confiamos no corpo: pegamos o id e reconsultamos a API do MP.
export async function POST(req: Request) {
  const url = new URL(req.url);
  let type = url.searchParams.get("type") || url.searchParams.get("topic") || "";
  let id = url.searchParams.get("id") || url.searchParams.get("data.id") || "";

  try {
    const body = await req.json();
    type = body?.type || body?.action || type;
    id = body?.data?.id || id;
  } catch {
    // notificação pode vir sem corpo JSON
  }

  // Só tratamos eventos de assinatura (preapproval)
  if (!/preapproval/i.test(type) || !id) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (!hasAdmin()) {
    // sem chave secreta não dá pra ativar plano — peça retry
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_KEY ausente" },
      { status: 500 }
    );
  }

  try {
    const pre = await getPreapproval(id);
    const [userId, plan] = (pre.external_reference || "").split(":");
    if (!userId || !isPlanId(plan)) {
      return NextResponse.json({ ok: true, ignored: "ref inválida" });
    }

    const admin = createAdminClient();

    if (pre.status === "authorized") {
      const end = new Date();
      end.setMonth(end.getMonth() + 1);
      await admin.from("subscriptions").upsert(
        {
          user_id: userId,
          plan,
          status: "active",
          current_period_end: end.toISOString().slice(0, 10),
          provider: "mercadopago",
          provider_subscription_id: id,
        },
        { onConflict: "user_id" }
      );
    } else if (pre.status === "cancelled" || pre.status === "paused") {
      await admin
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("user_id", userId);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// MP às vezes valida o endpoint com GET
export async function GET() {
  return NextResponse.json({ ok: true });
}
