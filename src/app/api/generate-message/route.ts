import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Modelo padrão. Para reduzir custo nesta tarefa simples, dá para trocar por
// "claude-haiku-4-5" (bem mais barato). Deixe o usuário decidir.
const MODEL = "claude-opus-5";

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        error:
          "IA não configurada. Adicione ANTHROPIC_API_KEY no .env.local (e na Vercel) para gerar mensagens com IA.",
      },
      { status: 400 }
    );
  }

  let body: {
    name?: string;
    niche?: string;
    city?: string;
    has_website?: boolean;
    tone?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const { name, niche, city, has_website, tone } = body;
  if (!name) {
    return NextResponse.json({ error: "Nome do lead é obrigatório." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: key });

  const situacao = has_website
    ? "O negócio já tem um site (possivelmente antigo ou fraco)."
    : "O negócio NÃO tem site — esse é o principal gancho.";

  const system =
    "Você é um especialista brasileiro em prospecção que vende criação de sites para pequenos negócios. " +
    "Escreva UMA mensagem curta de primeira abordagem por WhatsApp, em português do Brasil, tom " +
    (tone || "amigável e profissional") +
    ". Regras: no máximo 3 frases; nada de jargão; soe humano, não robô; " +
    "termine com uma pergunta leve que convide a responder; não invente dados que não recebeu; " +
    "não use colchetes nem placeholders; responda SOMENTE com o texto da mensagem, sem aspas nem explicações.";

  const user = `Negócio: ${name}
Segmento: ${niche || "não informado"}
Cidade: ${city || "não informada"}
Situação: ${situacao}`;

  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      output_config: { effort: "low" },
      system,
      messages: [{ role: "user", content: user }],
    });

    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    if (!text) {
      return NextResponse.json({ error: "A IA não retornou texto." }, { status: 502 });
    }
    return NextResponse.json({ message: text });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "Chave da Anthropic inválida." }, { status: 401 });
    }
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Limite de uso atingido, tente em instantes." }, { status: 429 });
    }
    const msg = e instanceof Error ? e.message : "Erro ao gerar mensagem";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
