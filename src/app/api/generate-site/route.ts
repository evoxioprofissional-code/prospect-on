import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getSubState } from "@/lib/subscription-server";
import { SUPABASE_URL } from "@/lib/supabase/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Página inteira = mais tokens que uma mensagem. Opus dá o melhor visual;
// para baratear, troque por "claude-haiku-4-5" (bem mais barato, um pouco
// mais simples). max_tokens alto porque é um HTML completo.
const MODEL = "claude-opus-5";

// Gate de plano: hoje o gerador de site segue o mesmo recurso de IA (Pro+).
// Para liberar no Essencial, é só trocar a checagem `!sub.ai` abaixo.
function slug(): string {
  return randomBytes(6).toString("base64url"); // ~8 chars, URL-safe
}

function waNumber(raw?: string | null): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        error:
          "IA não configurada. Adicione ANTHROPIC_API_KEY no .env.local (e na Vercel) para gerar sites.",
      },
      { status: 400 }
    );
  }

  let body: {
    lead_id?: string;
    name?: string;
    niche?: string;
    city?: string;
    whatsapp?: string;
    phone?: string;
    has_website?: boolean;
    notes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const { lead_id, name, niche, city, whatsapp, phone, notes } = body;
  if (!name) {
    return NextResponse.json({ error: "Nome do negócio é obrigatório." }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }

  const sub = await getSubState(authUser.id);
  if (sub.enforced && !sub.ai) {
    return NextResponse.json(
      {
        error: "A geração de site está disponível no plano Pro. Faça upgrade para usar.",
        code: "plan",
        plan: sub.plan,
      },
      { status: 402 }
    );
  }

  const wa = waNumber(whatsapp || phone);
  const waHref = wa ? `https://wa.me/${wa}` : "";

  const system =
    "Você é um web designer brasileiro que cria landing pages de alta conversão para pequenos negócios. " +
    "Gere UM único arquivo HTML COMPLETO e autossuficiente (um site institucional de uma página) em português do Brasil. " +
    "REGRAS OBRIGATÓRIAS:\n" +
    "- Responda SOMENTE com o código HTML, começando em <!DOCTYPE html>. Nada de explicação, nada de crases/markdown.\n" +
    "- Tudo inline: <style> no <head>. Sem arquivos externos, exceto Google Fonts (link para fonts.googleapis.com é permitido).\n" +
    "- Nada de imagens externas (sem URLs de fotos). Use gradientes, cores, ícones em SVG inline ou emojis como recurso visual.\n" +
    "- Design moderno, bonito e responsivo (mobile-first): hero com título forte, seção de serviços, diferenciais, sobre, depoimentos genéricos (sem inventar nomes reais de pessoas), e um bloco de contato/CTA.\n" +
    "- Botão flutuante de WhatsApp fixo no canto inferior direito.\n" +
    "- NÃO invente fatos específicos falsos: nada de endereço exato, CNPJ, preços fixos, prêmios ou avaliações com nomes reais. Copy persuasiva porém genérica e honesta (é uma demonstração).\n" +
    "- Tom profissional e caloroso, adequado ao segmento.";

  const cta = waHref
    ? `Todos os botões de contato/CTA e o botão flutuante devem apontar para: ${waHref} (abrir em nova aba).`
    : `Não há número de WhatsApp; os botões de contato devem rolar para a seção de contato (âncora #contato).`;

  const userMsg = `Crie o site de demonstração para este negócio:
Nome: ${name}
Segmento: ${niche || "não informado"}
Cidade/Região: ${city || "não informada"}
${notes ? `Observações do vendedor: ${notes}\n` : ""}${cta}
Objetivo: impressionar o dono do negócio para ele contratar a criação do site. Deixe claro (no rodapé, discreto) que é uma prévia/demonstração.`;

  const client = new Anthropic({ apiKey: key });

  let html = "";
  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      output_config: { effort: "medium" },
      system,
      messages: [{ role: "user", content: userMsg }],
    });
    html = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "Chave da Anthropic inválida." }, { status: 401 });
    }
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Limite de uso atingido, tente em instantes." }, { status: 429 });
    }
    const msg = e instanceof Error ? e.message : "Erro ao gerar o site";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Tira cercas de markdown se o modelo teimar em usar.
  html = html.replace(/^```(?:html)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  if (!html.toLowerCase().includes("<html")) {
    return NextResponse.json({ error: "A IA não retornou um HTML válido." }, { status: 502 });
  }

  // Salva com a sessão do usuário (RLS: user_id = auth.uid()).
  const s = slug();
  const { data: row, error: dbErr } = await supabase
    .from("prospect_sites")
    .insert({
      user_id: authUser.id,
      team_id: authUser.id,
      lead_id: lead_id ?? null,
      slug: s,
      business: name,
      niche: niche ?? null,
      city: city ?? null,
      html,
      published: true,
    })
    .select("slug")
    .single();

  if (dbErr || !row) {
    return NextResponse.json(
      {
        error:
          "Site gerado, mas falhou ao salvar. Rode supabase/sites.sql no Supabase e tente de novo.",
        detail: dbErr?.message,
        html, // devolve mesmo assim para o preview não se perder
      },
      { status: 200 }
    );
  }

  const origin =
    (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "") ||
    new URL(req.url).origin ||
    SUPABASE_URL;
  const url = `${origin}/site/${row.slug}`;

  return NextResponse.json({ slug: row.slug, url, html });
}
