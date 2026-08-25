// Mapeia um nicho digitado em português para tags do OpenStreetMap.
// Retorna filtros "key"="value" usados na query Overpass, mais um padrão de
// nome tolerante a acento para ampliar o alcance da busca.

const MAP: Record<string, string[]> = {
  restaurante: ["amenity=restaurant"],
  lanchonete: ["amenity=fast_food"],
  pizzaria: ["amenity=restaurant", "cuisine=pizza"],
  hamburgueria: ["amenity=fast_food", "cuisine=burger"],
  cafe: ["amenity=cafe"],
  cafeteria: ["amenity=cafe"],
  bar: ["amenity=bar", "amenity=pub"],
  padaria: ["shop=bakery"],
  acougue: ["shop=butcher"],
  mercado: ["shop=supermarket", "shop=convenience"],
  farmacia: ["amenity=pharmacy"],
  // Saúde — bem abrangente (clínica, posto, UBS, consultório etc.)
  clinica: [
    "amenity=clinic",
    "healthcare=clinic",
    "amenity=doctors",
    "healthcare=centre",
    "amenity=hospital",
  ],
  saude: ["amenity=clinic", "healthcare=centre", "amenity=hospital", "amenity=doctors"],
  posto: ["amenity=clinic", "healthcare=centre"],
  ubs: ["amenity=clinic", "healthcare=centre"],
  hospital: ["amenity=hospital"],
  laboratorio: ["healthcare=laboratory", "amenity=laboratory"],
  dentista: ["amenity=dentist", "healthcare=dentist"],
  consultorio: ["amenity=doctors", "healthcare=centre", "amenity=dentist"],
  medico: ["amenity=doctors", "healthcare=doctor"],
  veterinario: ["amenity=veterinary"],
  petshop: ["shop=pet"],
  academia: ["leisure=fitness_centre", "leisure=sports_centre"],
  salao: ["shop=hairdresser", "shop=beauty"],
  barbearia: ["shop=hairdresser"],
  cabeleireiro: ["shop=hairdresser"],
  estetica: ["shop=beauty", "shop=cosmetics"],
  manicure: ["shop=beauty"],
  advogado: ["office=lawyer"],
  contador: ["office=accountant"],
  imobiliaria: ["office=estate_agent"],
  oficina: ["shop=car_repair"],
  autopecas: ["shop=car_parts"],
  hotel: ["tourism=hotel"],
  pousada: ["tourism=guest_house"],
  escola: ["amenity=school"],
  loja: ["shop"],
  roupas: ["shop=clothes"],
  otica: ["shop=optician"],
  floricultura: ["shop=florist"],
  joalheria: ["shop=jewelry"],
  sorveteria: ["amenity=ice_cream"],
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

// Gera um regex Overpass que ignora acentos comuns do português.
// Ex.: "clinica" -> "cl[ií]n[ií]c[aáàâã]" (casa "Clínica", "Clinica"...).
export function nameStemPattern(term: string): string {
  const stem = norm(term).replace(/s$/, ""); // singular grosseiro, sem acento
  const groups: Record<string, string> = {
    a: "[aáàâã]",
    e: "[eéèê]",
    i: "[ií]",
    o: "[oóòôõ]",
    u: "[uú]",
    c: "[cç]",
  };
  return stem
    .split("")
    .map((ch) => groups[ch] ?? escapeRegexChar(ch))
    .join("");
}

function escapeRegexChar(ch: string): string {
  return /[a-z0-9]/i.test(ch) ? ch : `\\${ch}`;
}

export function nicheToOverpass(niche: string): {
  filters: string[];
  fallback: string;
} {
  const n = norm(niche);
  for (const key of Object.keys(MAP)) {
    if (n.includes(key)) return { filters: MAP[key], fallback: niche };
  }
  const singular = n.replace(/s$/, "");
  for (const key of Object.keys(MAP)) {
    if (singular.includes(key)) return { filters: MAP[key], fallback: niche };
  }
  return { filters: [], fallback: niche };
}
