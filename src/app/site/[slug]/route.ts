import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOT_FOUND = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Site não encontrado</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#0b0b0c;color:#eee;text-align:center;padding:24px}
h1{font-size:20px;margin:0 0 8px}p{color:#999;margin:0}</style></head>
<body><div><h1>Prévia indisponível</h1><p>Este site de demonstração não existe mais ou foi despublicado.</p></div></body></html>`;

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const supabase = createClient();
  const { data } = await supabase
    .from("prospect_sites")
    .select("html, published")
    .eq("slug", params.slug)
    .eq("published", true)
    .maybeSingle();

  if (!data?.html) {
    return new Response(NOT_FOUND, {
      status: 404,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  // Contagem de views: best-effort, só se a chave secreta estiver configurada.
  if (hasAdmin()) {
    try {
      const admin = createAdminClient();
      await admin.rpc("increment_site_view", { p_slug: params.slug });
    } catch {
      // ignora — a RPC é opcional (ver sites.sql). Sem ela, não conta views.
    }
  }

  return new Response(data.html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // deixa o navegador do cliente cachear a prévia por alguns minutos
      "cache-control": "public, max-age=300",
    },
  });
}
