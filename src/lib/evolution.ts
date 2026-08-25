// Cliente HTTP do Evolution API (server-only). Mesmo padrão da EvoxClinic:
// autentica pelo header `apikey`. Nunca exponha EVOLUTION_API_KEY no cliente.

const EVOLUTION_URL = (process.env.EVOLUTION_API_URL ?? "").replace(/\/$/, "");
const EVOLUTION_KEY = (process.env.EVOLUTION_API_KEY ?? "").trim();

export function hasEvolution(): boolean {
  return !!(EVOLUTION_URL && EVOLUTION_KEY);
}

export function evo(path: string, init?: RequestInit) {
  return fetch(`${EVOLUTION_URL}${path}`, {
    ...init,
    headers: {
      apikey: EVOLUTION_KEY,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

// Uma instância por dono/time. O worker e o app usam o mesmo nome.
export function instanceFor(ownerId: string): string {
  return `prospect_${ownerId}`;
}

// Traduz o estado do Evolution para o vocabulário do app.
export function mapState(state: string | undefined): "conectado" | "conectando" | "desconectado" {
  if (state === "open") return "conectado";
  if (state === "connecting") return "conectando";
  return "desconectado";
}
