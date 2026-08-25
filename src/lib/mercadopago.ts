// Helpers do Mercado Pago (server-side apenas).
// Usa a API de Assinaturas (preapproval): cobra o cliente todo mês e
// notifica via webhook.

const BASE = "https://api.mercadopago.com";

function token(): string {
  const t = (process.env.MERCADOPAGO_ACCESS_TOKEN ?? "")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
  return t;
}

export function hasMercadoPago(): boolean {
  return !!token();
}

interface CreatePreapprovalArgs {
  planName: string;
  amount: number;
  payerEmail: string;
  externalReference: string; // "userId:planId"
  backUrl: string;
}

export async function createPreapproval(args: CreatePreapprovalArgs): Promise<{
  id: string;
  init_point: string;
}> {
  const res = await fetch(`${BASE}/preapproval`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reason: `ProspectOn — plano ${args.planName}`,
      external_reference: args.externalReference,
      payer_email: args.payerEmail,
      back_url: args.backUrl,
      status: "pending",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: args.amount,
        currency_id: "BRL",
      },
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || "Falha ao criar assinatura no Mercado Pago");
  }
  return { id: data.id, init_point: data.init_point };
}

export async function getPreapproval(id: string): Promise<{
  status: string;
  external_reference: string;
  payer_email?: string;
}> {
  const res = await fetch(`${BASE}/preapproval/${id}`, {
    headers: { Authorization: `Bearer ${token()}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Falha ao consultar assinatura");
  return {
    status: data.status,
    external_reference: data.external_reference,
    payer_email: data.payer_email,
  };
}
