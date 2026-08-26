export type PlanId = "trial" | "essencial" | "pro" | "agencia";

export interface Plan {
  id: PlanId;
  name: string;
  price: number; // R$/mês
  searchQuota: number; // buscas Google por mês
  leadCap: number; // máximo de leads na carteira (Infinity = sem teto)
  ai: boolean; // IA no disparo
  seats: number;
  highlight?: boolean;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  trial: {
    id: "trial",
    name: "Trial",
    price: 0,
    searchQuota: 5,
    leadCap: 15,
    ai: false,
    seats: 1,
    features: [
      "5 buscas no Google",
      "Funil, leads e disparo",
    ],
  },
  essencial: {
    id: "essencial",
    name: "Essencial",
    price: 97,
    searchQuota: 100,
    leadCap: Infinity,
    ai: false,
    seats: 1,
    features: [
      "100 buscas Google/mês (~2.000 leads)",
      "Funil, disparo e histórico",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 197,
    searchQuota: 300,
    leadCap: Infinity,
    ai: true,
    seats: 1,
    highlight: true,
    features: [
      "Tudo do Essencial",
      "300 buscas Google/mês (~6.000 leads)",
      "IA no disparo (mensagens únicas)",
    ],
  },
  agencia: {
    id: "agencia",
    name: "Agência",
    price: 397,
    searchQuota: 1000,
    leadCap: Infinity,
    ai: true,
    seats: 3,
    features: [
      "Tudo do Pro",
      "1.000 buscas Google/mês (~20.000 leads)",
      "Até 3 usuários",
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ["trial", "essencial", "pro", "agencia"];

export function isPlanId(v: string): v is PlanId {
  return v === "trial" || v === "essencial" || v === "pro" || v === "agencia";
}
