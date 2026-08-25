import { NextResponse } from "next/server";
import { nicheToOverpass, nameStemPattern } from "@/lib/niche";
import { createClient } from "@/lib/supabase/server";
import { getSubState, consumeSearch } from "@/lib/subscription-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface DiscoveredLead {
  name: string;
  niche: string;
  city: string;
  phone: string;
  whatsapp: string;
  instagram: string;
  website: string;
  has_website: boolean;
  address: string;
  source: "osm" | "google";
}

export async function POST(req: Request) {
  let body: { source?: string; niche?: string; city?: string; limit?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const niche = (body.niche ?? "").trim();
  const city = (body.city ?? "").trim();
  const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 200);
  const source = body.source === "google" ? "google" : "osm";

  if (!niche || !city) {
    return NextResponse.json(
      { error: "Informe nicho e cidade." },
      { status: 400 }
    );
  }

  try {
    if (source === "google") {
      // Cota: só o Google conta (OSM é ilimitado).
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
      }
      const sub = await getSubState(user.id);
      if (sub.enforced && sub.used >= sub.quota) {
        return NextResponse.json(
          {
            error: `Você atingiu o limite de ${sub.quota} buscas do plano ${sub.plan} neste mês. Faça upgrade para continuar.`,
            code: "quota",
            plan: sub.plan,
            used: sub.used,
            quota: sub.quota,
          },
          { status: 402 }
        );
      }
      const res = await discoverGoogle(niche, city, limit);
      if (res.ok) await consumeSearch(user.id);
      return res;
    }
    return await discoverOSM(niche, city, limit);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro na busca";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ---------------------------------------------------------------------
// OpenStreetMap (Nominatim + Overpass) — grátis, sem chave
// ---------------------------------------------------------------------
async function discoverOSM(niche: string, city: string, limit: number) {
  // 1. Geocodifica a cidade -> bounding box
  const geoRes = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      city
    )}&format=json&limit=1&countrycodes=br`,
    { headers: { "User-Agent": "ProspectOn/1.0 (prospeccao de negocios)" } }
  );
  const geo = (await geoRes.json()) as Array<{ boundingbox: string[] }>;
  if (!geo.length) {
    return NextResponse.json(
      { error: `Cidade "${city}" não encontrada no OpenStreetMap.` },
      { status: 404 }
    );
  }
  // boundingbox = [south, north, west, east]
  const [south, north, west, east] = geo[0].boundingbox.map(Number);
  const bbox = `${south},${west},${north},${east}`;

  // 2. Monta a query Overpass a partir do nicho.
  // Sempre uni as tags específicas COM uma busca por nome (tolerante a acento),
  // para ampliar o alcance em cidades com poucos POIs bem tagueados.
  const { filters, fallback } = nicheToOverpass(niche);
  const tagClauses = filters.map((f) => {
    const [k, v] = f.split("=");
    const tag = v ? `["${k}"="${v}"]` : `["${k}"]`;
    return `nwr${tag}(${bbox});`;
  });
  const namePattern = nameStemPattern(fallback);
  const nameClause = namePattern
    ? `nwr["name"~"${namePattern}",i](${bbox});`
    : "";
  const clauses = [...tagClauses, nameClause].filter(Boolean).join("\n");

  const query = `[out:json][timeout:25];\n(\n${clauses}\n);\nout center tags ${limit * 3};`;

  const opRes = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": "ProspectOn/1.0 (prospeccao de negocios)",
    },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!opRes.ok) throw new Error("Overpass indisponível, tente de novo.");
  const data = (await opRes.json()) as {
    elements: Array<{ tags?: Record<string, string> }>;
  };

  const seen = new Set<string>();
  const results: DiscoveredLead[] = [];
  for (const el of data.elements) {
    const t = el.tags ?? {};
    const name = t.name?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const website = t.website || t["contact:website"] || "";
    const phone =
      t.phone || t["contact:phone"] || t["contact:mobile"] || "";
    const address = [t["addr:street"], t["addr:housenumber"], t["addr:suburb"]]
      .filter(Boolean)
      .join(", ");

    results.push({
      name,
      niche,
      city,
      phone,
      whatsapp: t["contact:whatsapp"] || phone,
      instagram: t["contact:instagram"] || "",
      website,
      has_website: !!website,
      address,
      source: "osm",
    });
    if (results.length >= limit) break;
  }

  return NextResponse.json({
    results,
    note:
      "Fonte: OpenStreetMap. A ausência de site aqui não é 100% garantida — vale confirmar.",
  });
}

// ---------------------------------------------------------------------
// Google Places API (v1) — precisa de GOOGLE_PLACES_API_KEY no ambiente
// ---------------------------------------------------------------------
async function discoverGoogle(niche: string, city: string, limit: number) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        error:
          "Google Places não configurado. Adicione GOOGLE_PLACES_API_KEY no .env.local para usar esta fonte.",
      },
      { status: 400 }
    );
  }

  // O Text Search (New) devolve 20 por página; para pegar mais é preciso
  // paginar com pageToken. O Google limita a ~60 resultados por busca (3 pág.).
  const want = Math.min(limit, 60);
  const results: DiscoveredLead[] = [];
  const seen = new Set<string>();
  let pageToken: string | undefined;

  for (let page = 0; page < 3 && results.length < want; page++) {
    const reqBody: Record<string, unknown> = {
      textQuery: `${niche} em ${city}`,
      pageSize: 20,
      languageCode: "pt-BR",
      regionCode: "BR",
    };
    if (pageToken) reqBody.pageToken = pageToken;

    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "nextPageToken,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri",
      },
      body: JSON.stringify(reqBody),
    });

    const data = (await res.json()) as {
      error?: { message?: string };
      nextPageToken?: string;
      places?: Array<{
        displayName?: { text?: string };
        formattedAddress?: string;
        nationalPhoneNumber?: string;
        websiteUri?: string;
      }>;
    };

    if (data.error) {
      if (results.length) break; // já pegou algo nas páginas anteriores
      throw new Error(data.error.message || "Erro no Google Places");
    }

    for (const p of data.places ?? []) {
      const name = p.displayName?.text || "Sem nome";
      const key2 = name.toLowerCase() + "|" + (p.formattedAddress || "");
      if (seen.has(key2)) continue;
      seen.add(key2);
      const phone = p.nationalPhoneNumber || "";
      results.push({
        name,
        niche,
        city,
        phone,
        whatsapp: phone,
        instagram: "",
        website: p.websiteUri || "",
        has_website: !!p.websiteUri,
        address: p.formattedAddress || "",
        source: "google" as const,
      });
      if (results.length >= want) break;
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
    // O token pode levar um instante para ficar válido: espera curta entre páginas.
    await new Promise((r) => setTimeout(r, 2000));
  }

  return NextResponse.json({
    results,
    note:
      results.length >= 60
        ? "O Google limita a ~60 resultados por busca. Para achar mais, refine por bairro ou busque cidade por cidade."
        : undefined,
  });
}
