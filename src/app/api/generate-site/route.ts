import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getSubState } from "@/lib/subscription-server";
import { SUPABASE_URL } from "@/lib/supabase/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// O site é PEÇA DE VENDA (tem que impressionar o cliente), então priorizamos
// qualidade com custo baixo: Sonnet 5 (US$2/US$10 por 1M) ≈ R$0,30 por site —
// bem melhor que o Haiku em design e copy.
//   • Mais barato possível: "claude-haiku-4-5" (~R$0,15, mais simples/"cara de IA").
//   • Topo de qualidade:    "claude-opus-5"  (~R$1, o melhor visual).
const MODEL = "claude-sonnet-5";

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
    "Você é diretor de arte e copywriter sênior. Cria sites institucionais de UMA PÁGINA para pequenos negócios no Brasil, com aparência de trabalho profissional feito por humano — NUNCA cara de template de IA. Gere UM único arquivo HTML completo e autossuficiente, em português do Brasil.\n\n" +
    "USE OS DADOS DO NEGÓCIO (obrigatório — o site é sob medida, não genérico):\n" +
    "- O NOME do negócio aparece na marca do topo, no <title>, no hero e no rodapé.\n" +
    "- TODO o texto é específico para o SEGMENTO e a CIDADE informados. Cite a cidade/região com naturalidade.\n" +
    "- As seções e serviços são os TÍPICOS do segmento, escritos por quem conhece o ramo. Ex.: restaurante → pratos/cardápio/reservas; clínica → especialidades/agendamento; barbearia → cortes/barba/agenda; loja → produtos/entrega; academia → modalidades/planos. Adapte ao segmento recebido.\n\n" +
    "PROIBIDO (é isso que dá 'cara de IA'):\n" +
    "- ZERO emojis. Para ícones, use SVG inline simples (line icons), não emoji.\n" +
    "- Nada de clichê genérico: 'bem-vindo ao nosso site', 'soluções inovadoras', 'transformando sonhos em realidade', 'excelência e qualidade', 'líder de mercado', 'o número 1', 'sua satisfação é nossa prioridade'.\n" +
    "- NÃO invente fatos: sem endereço, CNPJ, telefone extra, preços exatos, ano de fundação, prêmios, números de clientes ou depoimentos com nomes reais. Depoimento (se houver) curto e claramente ilustrativo, sem nome de pessoa real.\n" +
    "- Nada de lorem ipsum nem texto de preenchimento sem sentido.\n\n" +
    "DESIGN (profissional, não 'arco-íris de IA'):\n" +
    "- Paleta enxuta: 1 cor principal + neutros (fundo claro, texto escuro de leitura). Sem gradientes coloridos espalhados por tudo.\n" +
    "- Boa tipografia via Google Fonts (uma fonte de título + uma de texto). Bastante espaçamento/white space.\n" +
    "- Estrutura real: header fixo com o nome do negócio + navegação âncora; hero com headline ESPECÍFICA desse negócio (não genérica) + botão de contato; seção de serviços (3 a 6, específicos do segmento, cada um com título e 1-2 frases reais); uma seção sobre/diferenciais coerente; seção de contato/CTA; rodapé com o nome do negócio.\n" +
    "- Botão flutuante de WhatsApp fixo no canto inferior direito.\n" +
    "- Responsivo, mobile-first.\n\n" +
    "TÉCNICO:\n" +
    "- Responda SOMENTE com o HTML, começando em <!DOCTYPE html>. Sem crases, sem markdown, sem explicação.\n" +
    "- Todo o CSS inline em <style> no <head>. Sem JS externo. Sem imagens externas (use CSS/SVG/cores). Google Fonts é permitido.\n" +
    "- No rodapé, de forma discreta, deixe claro que é uma prévia/demonstração.";

  const cta = waHref
    ? `Todos os botões de contato/CTA e o botão flutuante do WhatsApp apontam para: ${waHref} (abrir em nova aba).`
    : `Não há WhatsApp informado; os botões de contato rolam para a seção de contato (âncora #contato).`;

  const userMsg = `Crie o site institucional de uma página deste negócio, com copy específica do segmento e da cidade:

Negócio: ${name}
Segmento: ${niche || "(não informado — deduza um segmento plausível pelo nome do negócio)"}
Cidade/Região: ${city || "(não informada)"}
${notes ? `Contexto do vendedor: ${notes}\n` : ""}${cta}

Objetivo: impressionar o dono a ponto de ele querer contratar a criação do site. Capriche no visual e na coerência do texto — cada seção precisa fazer sentido para esse negócio específico.`;

  // Chaves "identity-linked" da Anthropic exigem informar o workspace via
  // header anthropic-workspace-id. Se ANTHROPIC_WORKSPACE_ID estiver setado,
  // enviamos; senão, funciona normal com chaves comuns de workspace.
  const workspaceId = (process.env.ANTHROPIC_WORKSPACE_ID || "").trim();
  const client = new Anthropic({
    apiKey: key,
    ...(workspaceId
      ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } }
      : {}),
  });

  let html = "";
  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "disabled" }, // sem "pensamento" = custo previsível
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
