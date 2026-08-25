// Tipos e defaults do disparo automático (compartilhados pela UI e API).

export type CampaignStatus = "running" | "paused" | "done" | "canceled";

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  running: "Enviando",
  paused: "Pausada",
  done: "Concluída",
  canceled: "Cancelada",
};

// Regras de segurança contra ban do número.
export interface CampaignSettings {
  min_delay_sec: number;
  max_delay_sec: number;
  daily_cap: number; // 0 = sem limite
  window_start_hour: number;
  window_end_hour: number;
  batch_size: number; // 0 = sem pausa em lote
  batch_pause_min: number;
}

export const DEFAULT_SETTINGS: CampaignSettings = {
  min_delay_sec: 40,
  max_delay_sec: 120,
  daily_cap: 50,
  window_start_hour: 9,
  window_end_hour: 18,
  batch_size: 20,
  batch_pause_min: 15,
};

export interface Campaign extends CampaignSettings {
  id: string;
  user_id: string;
  team_id: string;
  name: string;
  empresa: string | null;
  status: CampaignStatus;
  sent_today: number;
  sent_today_date: string | null;
  total: number;
  sent: number;
  failed: number;
  created_at: string;
  updated_at: string;
}

export type WaStatus = "desconectado" | "conectando" | "conectado";

export interface WaSession {
  instance_name: string | null;
  status: WaStatus;
  qr: string | null;
  pairing_code: string | null;
  phone: string | null;
  last_seen: string | null;
  updated_at: string;
}

// Uma mensagem já resolvida, pronta para virar linha na fila.
export interface QueuedMessage {
  lead_id: string;
  name: string;
  phone: string;
  body: string;
}
