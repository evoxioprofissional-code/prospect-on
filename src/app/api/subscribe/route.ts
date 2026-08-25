import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PLANS, isPlanId } from "@/lib/plans";
import {
  createPreapproval,
  createPixPreference,
  hasMercadoPago,
} from "@/lib/mercadopago";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!hasMercadoPago()) {
    return NextResponse.json(
      { error: "Pagamento não configurado (MERCADOPAGO_ACCESS_TOKEN ausente)." },
      { status: 400 }
    );
  }

  let body: { plan?: string; method?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const plan = body.plan ?? "";
  const method = body.method === "pix" ? "pix" : "card";
  if (!isPlanId(plan) || plan === "trial") {
    return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    req.headers.get("origin") ||
    "https://www.prospecton.com.br";

  try {
    if (method === "pix") {
      const { init_point } = await createPixPreference({
        planName: PLANS[plan].name,
        amount: PLANS[plan].price,
        payerEmail: user.email,
        externalReference: `${user.id}:${plan}`,
        backUrl: `${origin}/planos`,
        notifyUrl: `${origin}/api/webhooks/mercadopago`,
      });
      return NextResponse.json({ init_point });
    }

    const { init_point } = await createPreapproval({
      planName: PLANS[plan].name,
      amount: PLANS[plan].price,
      payerEmail: user.email,
      externalReference: `${user.id}:${plan}`,
      backUrl: `${origin}/planos`,
    });
    return NextResponse.json({ init_point });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao iniciar assinatura";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
