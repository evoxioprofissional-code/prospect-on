import { NextResponse } from "next/server";
import { nicheToOverpass } from "@/lib/niche";

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
  const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 50);
  const source = body.source === "google" ? "google" : "osm";

  if (!niche || !city) {
    return NextResponse.json(
      { error: "Informe nicho e cidade." },
      { status: 400 }
    );
  }

  try {
    if (source === "google") {
      return await discoverGoogle(niche, city, limit);
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

  // 2. Monta a query Overpass a partir do nicho
  const { filters, fallback } = nicheToOverpass(niche);
  const clauses =
    filters.length > 0
      ? filters
          .map((f) => {
            const [k, v] = f.split("=");
            const tag = v ? `["${k}"="${v}"]` : `["${k}"]`;
            return `nwr${tag}(${bbox});`;
          })
          .join("\n")
      : `nwr["name"~"${escapeOverpass(fallback)}",i](${bbox});`;

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

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri",
    },
    body: JSON.stringify({
      textQuery: `${niche} em ${city}`,
      maxResultCount: Math.min(limit, 20),
      languageCode: "pt-BR",
      regionCode: "BR",
    }),
  });

  const data = (await res.json()) as {
    error?: { message?: string };
    places?: Array<{
      displayName?: { text?: string };
      formattedAddress?: string;
      nationalPhoneNumber?: string;
      websiteUri?: string;
    }>;
  };

  if (data.error) {
    throw new Error(data.error.message || "Erro no Google Places");
  }

  const results: DiscoveredLead[] = (data.places ?? []).map((p) => {
    const phone = p.nationalPhoneNumber || "";
    return {
      name: p.displayName?.text || "Sem nome",
      niche,
      city,
      phone,
      whatsapp: phone,
      instagram: "",
      website: p.websiteUri || "",
      has_website: !!p.websiteUri,
      address: p.formattedAddress || "",
      source: "google" as const,
    };
  });

  return NextResponse.json({ results });
}

function escapeOverpass(s: string): string {
  return s.replace(/["\\]/g, "\\$&");
}
