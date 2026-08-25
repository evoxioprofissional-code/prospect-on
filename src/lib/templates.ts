import type { Lead } from "@/lib/types";

export interface Template {
  id: string;
  name: string;
  body: string;
}

// Modelos de 1ª abordagem por WhatsApp. Tom humano, curto e específico —
// nada de "vendo sites, quer comprar?". O ângulo que converte é o do Google:
// "procurei vocês e não achei" (o lead sente que perde cliente pro concorrente).
// Variáveis: {empresa} {nome}(negócio) {cidade} {nicho} {gancho}
// {gancho} se ajusta sozinho conforme o lead ter site ou não.
export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: "google",
    name: "Não aparece no Google",
    body:
      "Oi, tudo bem? Vi a {nome} aqui em {cidade} e fui procurar vocês no Google — {gancho}. Hoje o cliente pesquisa antes de decidir, e quem não aparece acaba indo pro concorrente. Trabalho com isso; posso te mandar um exemplo rápido do que dá pra fazer?",
  },
  {
    id: "pessoal",
    name: "Pessoal e leve",
    body:
      "Opa! Aqui é da {empresa}. Passei pela {nome} e curti o trabalho de vocês. Cês têm site próprio ou tá só no Instagram? Pergunto porque {gancho} e queria te mostrar uma ideia rápida, sem compromisso nenhum.",
  },
  {
    id: "concorrente",
    name: "Direto ao ponto",
    body:
      "Oi! Quando alguém busca “{nicho} em {cidade}” no Google, quem aparece leva o cliente. Olhei a {nome} e {gancho} — dá pra resolver rápido com um site simples e bonito. Quer que eu te mostre como ficaria?",
  },
];

export function ganchoFor(lead: Pick<Lead, "has_website" | "website">): string {
  if (!lead.has_website) return "vi que vocês ainda não têm um site";
  if (lead.website && !lead.website.startsWith("https"))
    return "vi que o site de vocês tá meio desatualizado";
  return "achei o site de vocês, mas dá pra deixar bem mais forte";
}

export function resolveTemplate(
  body: string,
  lead: Lead,
  empresa?: string
): string {
  return body
    .split("{empresa}").join(empresa?.trim() || "nossa empresa")
    .split("{nome}").join(lead.name)
    .split("{cidade}").join(lead.city || "sua cidade")
    .split("{nicho}").join(lead.niche || "seu segmento")
    .split("{gancho}").join(ganchoFor(lead));
}
