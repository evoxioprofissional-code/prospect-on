export type LeadStatus =
  | "novo"
  | "contatado"
  | "proposta"
  | "negociando"
  | "fechado"
  | "perdido";

export const STATUSES: { key: LeadStatus; label: string }[] = [
  { key: "novo", label: "Novo" },
  { key: "contatado", label: "Contatado" },
  { key: "proposta", label: "Proposta" },
  { key: "negociando", label: "Negociando" },
  { key: "fechado", label: "Fechado" },
  { key: "perdido", label: "Perdido" },
];

export interface Lead {
  id: string;
  user_id: string;
  team_id: string | null;
  name: string;
  niche: string | null;
  city: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  email: string | null;
  website: string | null;
  has_website: boolean;
  status: LeadStatus;
  value: number | null;
  notes: string | null;
  next_followup: string | null;
  created_at: string;
  updated_at: string;
}

export type LeadInput = Omit<
  Lead,
  "id" | "user_id" | "team_id" | "created_at" | "updated_at"
>;

export interface Interaction {
  id: string;
  lead_id: string;
  user_id: string;
  type: "nota" | "ligacao" | "whatsapp" | "email" | "reuniao";
  content: string | null;
  created_at: string;
}

// Lead sem site é o lead mais quente; site desatualizado é morno.
export function leadHeat(lead: Pick<Lead, "has_website" | "website">): {
  level: "quente" | "morno" | "frio";
  label: string;
} {
  if (!lead.has_website) return { level: "quente", label: "Sem site" };
  if (lead.website && !lead.website.startsWith("https"))
    return { level: "morno", label: "Site sem HTTPS" };
  return { level: "frio", label: "Já tem site" };
}
