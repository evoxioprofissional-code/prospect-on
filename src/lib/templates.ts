import type { Lead } from "@/lib/types";

export interface Template {
  id: string;
  name: string;
  body: string;
}

// Modelos padrão. Variáveis: {nome} {cidade} {nicho} {gancho}
// {gancho} se ajusta sozinho conforme o lead ter site ou não.
export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: "direto",
    name: "Direto e curto",
    body:
      "Olá! Aqui é da [SUA EMPRESA]. Falo com o responsável pela {nome}? {gancho} Posso te mandar uns exemplos?",
  },
  {
    id: "consultivo",
    name: "Consultivo",
    body:
      "Oi! Tudo bem? Estava pesquisando {nicho} em {cidade} e encontrei a {nome}. {gancho} Faz sentido a gente conversar 5 minutos sobre isso?",
  },
  {
    id: "prova-social",
    name: "Prova social",
    body:
      "Olá! Ajudo negócios de {nicho} a atrair mais clientes pela internet. Vi a {nome} e {gancho} Quer ver um site que fiz pra um cliente parecido?",
  },
];

export function ganchoFor(lead: Pick<Lead, "has_website" | "website">): string {
  if (!lead.has_website)
    return "vi que vocês ainda não têm um site e queria mostrar como ele pode trazer mais clientes.";
  if (lead.website && !lead.website.startsWith("https"))
    return "vi que o site de vocês pode estar desatualizado e queria mostrar como modernizá-lo traz mais clientes.";
  return "queria mostrar como um site mais forte pode trazer mais clientes pra vocês.";
}

export function resolveTemplate(body: string, lead: Lead): string {
  return body
    .split("{nome}").join(lead.name)
    .split("{cidade}").join(lead.city || "sua cidade")
    .split("{nicho}").join(lead.niche || "seu segmento")
    .split("{gancho}").join(ganchoFor(lead));
}
