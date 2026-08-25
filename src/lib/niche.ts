// Mapeia um nicho digitado em português para tags do OpenStreetMap.
// Retorna uma lista de filtros "key"="value" usados na query Overpass.
// Se não houver match, cai no fallback por nome.

const MAP: Record<string, string[]> = {
  restaurante: ['amenity=restaurant'],
  lanchonete: ['amenity=fast_food'],
  pizzaria: ['amenity=restaurant', 'cuisine=pizza'],
  hamburgueria: ['amenity=fast_food', 'cuisine=burger'],
  cafe: ['amenity=cafe'],
  cafeteria: ['amenity=cafe'],
  bar: ['amenity=bar', 'amenity=pub'],
  padaria: ['shop=bakery'],
  acougue: ['shop=butcher'],
  mercado: ['shop=supermarket', 'shop=convenience'],
  farmacia: ['amenity=pharmacy'],
  clinica: ['amenity=clinic', 'healthcare=clinic'],
  dentista: ['amenity=dentist', 'healthcare=dentist'],
  medico: ['amenity=doctors', 'healthcare=doctor'],
  veterinario: ['amenity=veterinary'],
  petshop: ['shop=pet'],
  academia: ['leisure=fitness_centre', 'leisure=sports_centre'],
  salao: ['shop=hairdresser', 'shop=beauty'],
  barbearia: ['shop=hairdresser'],
  cabeleireiro: ['shop=hairdresser'],
  estetica: ['shop=beauty', 'shop=cosmetics'],
  manicure: ['shop=beauty'],
  advogado: ['office=lawyer'],
  contador: ['office=accountant'],
  imobiliaria: ['office=estate_agent'],
  oficina: ['shop=car_repair'],
  autopecas: ['shop=car_parts'],
  hotel: ['tourism=hotel'],
  pousada: ['tourism=guest_house'],
  escola: ['amenity=school'],
  loja: ['shop'],
  roupas: ['shop=clothes'],
  otica: ['shop=optician'],
  floricultura: ['shop=florist'],
  joalheria: ['shop=jewelry'],
  sorveteria: ['amenity=ice_cream'],
};

// Normaliza: sem acento, minúsculo, singular simples.
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

export function nicheToOverpass(niche: string): {
  filters: string[];
  fallback: string;
} {
  const n = norm(niche);
  // tenta match direto e por palavra
  for (const key of Object.keys(MAP)) {
    if (n.includes(key)) return { filters: MAP[key], fallback: niche };
  }
  // singular grosseiro (remove "s" final)
  const singular = n.replace(/s$/, "");
  for (const key of Object.keys(MAP)) {
    if (singular.includes(key)) return { filters: MAP[key], fallback: niche };
  }
  return { filters: [], fallback: niche };
}
