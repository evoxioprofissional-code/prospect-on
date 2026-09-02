// =====================================================================
// Presets de campanha (disparo automático via Baileys)
//
// ⚠️ LEIA: nenhum preset torna o ban IMPOSSÍVEL num número não-oficial.
// O WhatsApp bane por PADRÃO de comportamento (volume, texto idêntico,
// número novo, denúncias), não só por velocidade. Estes valores deixam o
// risco baixo imitando um humano lento — mas o risco nunca é zero.
// Para volume sem risco de ban, o caminho é a API OFICIAL (WhatsApp Cloud
// API da Meta), com número verificado e templates aprovados.
//
// Boas práticas que valem MAIS que qualquer número aqui:
//  - Use um CHIP DEDICADO (nunca o número pessoal) e WhatsApp Business.
//  - Faça AQUECIMENTO: não dispare o teto no primeiro dia (ver `warmup`).
//  - Varie o texto (spintax) — texto idêntico em massa é o maior gatilho.
//  - Não mande link no 1º contato; mande só depois que a pessoa responde.
// =====================================================================

export interface CampaignPreset {
  id: string;
  name: string;
  description: string;
  /** Teto rígido de mensagens por dia por número. Ao bater, para até amanhã. */
  dailyCap: number;
  /** Intervalo ALEATÓRIO entre mensagens (segundos). Nunca use valor fixo. */
  minDelaySec: number;
  maxDelaySec: number;
  /** A cada `batchSize` envios, pausa entre `batchPauseMinSec`–`batchPauseMaxSec`. */
  batchSize: number;
  batchPauseMinSec: number;
  batchPauseMaxSec: number;
  /** Janela de envio (hora local). Fora dela, o worker dorme. */
  windowStart: string; // "HH:MM"
  windowEnd: string; // "HH:MM"
  timezone: string;
  /** Dias da semana em que dispara (0=domingo … 6=sábado). */
  daysOfWeek: number[];
  /**
   * Aquecimento: teto de cada dia desde o início da campanha.
   * Ex.: [40,70,100,140,200] = 40 no 1º dia, 70 no 2º … 200 do 5º em diante.
   * O worker usa min(warmup[dia], dailyCap).
   */
  warmup: number[];
  /** Varia saudação/ordem/emoji por lead. Obrigatório em volume. */
  spintax: boolean;
  /** Não incluir link/URL na primeira mensagem. */
  noLinkOnFirstContact: boolean;
  /** Simula "digitando…" antes de enviar (presença + tempo por caractere). */
  simulateTyping: boolean;
  typingMsPerChar: number;
  typingMaxMs: number;
  /** Paradas automáticas de segurança. */
  autoStopOnDisconnect: boolean;
  autoStopAfterConsecutiveErrors: number;
  autoStopAfterBlocks: number;
}

// ---------------------------------------------------------------------
// PRESET PEDIDO: "Rodar o dia todo · 200/dia · muito lento"
//
// Espalha ~200 mensagens ao longo de ~16h (07h–23h), bem devagar.
// Conta de padeiro (ver estimateThroughput):
//   delay médio ~200s + pausa de lote a cada 12 msgs (~15min)
//   ≈ 15–16h de trabalho → cabe na janela; na prática entrega ~180–200/dia.
// É deliberadamente lento: se não fechar 200 num dia, melhor (mais seguro).
// ---------------------------------------------------------------------
export const PRESET_LENTO_200: CampaignPreset = {
  id: "lento_200",
  name: "Dia todo · 200/dia (muito lento)",
  description:
    "Espalha até 200 mensagens ao longo de 07h–23h, com intervalos de 2–5 min " +
    "e pausas longas a cada 12 envios. O mais devagar que ainda fecha 200/dia.",
  dailyCap: 200,
  minDelaySec: 120, // 2 min
  maxDelaySec: 280, // ~4,7 min (aleatório a cada msg)
  batchSize: 12,
  batchPauseMinSec: 900, // 15 min
  batchPauseMaxSec: 1200, // 20 min
  windowStart: "07:00",
  windowEnd: "23:00",
  timezone: "America/Sao_Paulo",
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // todos os dias ("o dia todo, todo dia")
  warmup: [40, 70, 110, 150, 200], // só chega em 200 no 5º dia
  spintax: true,
  noLinkOnFirstContact: true,
  simulateTyping: true,
  typingMsPerChar: 55,
  typingMaxMs: 8000,
  autoStopOnDisconnect: true,
  autoStopAfterConsecutiveErrors: 3,
  autoStopAfterBlocks: 2,
};

// ---------------------------------------------------------------------
// PRESET conservador (menor volume, risco mais baixo ainda).
// Bom pra chip novo ou quem prioriza segurança sobre quantidade.
// ---------------------------------------------------------------------
export const PRESET_SEGURO: CampaignPreset = {
  id: "seguro",
  name: "Modo Seguro (40/dia)",
  description:
    "Volume baixo em horário comercial. Risco de ban bem menor — ideal pra " +
    "número novo ou pra rodar sem sustos.",
  dailyCap: 40,
  minDelaySec: 90,
  maxDelaySec: 300,
  batchSize: 10,
  batchPauseMinSec: 600,
  batchPauseMaxSec: 1200,
  windowStart: "09:00",
  windowEnd: "18:00",
  timezone: "America/Sao_Paulo",
  daysOfWeek: [1, 2, 3, 4, 5], // seg–sex
  warmup: [15, 25, 35, 40],
  spintax: true,
  noLinkOnFirstContact: true,
  simulateTyping: true,
  typingMsPerChar: 55,
  typingMaxMs: 8000,
  autoStopOnDisconnect: true,
  autoStopAfterConsecutiveErrors: 3,
  autoStopAfterBlocks: 2,
};

export const CAMPAIGN_PRESETS: CampaignPreset[] = [PRESET_LENTO_200, PRESET_SEGURO];
export const DEFAULT_PRESET = PRESET_LENTO_200;

/**
 * Estima quantas horas o preset leva pra mandar `n` mensagens e se cabe na
 * janela diária. Serve pra validar/mostrar na tela de campanha.
 */
export function estimateThroughput(p: CampaignPreset, n: number) {
  const avgDelay = (p.minDelaySec + p.maxDelaySec) / 2;
  const avgPause = (p.batchPauseMinSec + p.batchPauseMaxSec) / 2;
  const pauses = Math.max(0, Math.floor((n - 1) / p.batchSize));
  const seconds = n * avgDelay + pauses * avgPause;
  const [sh, sm] = p.windowStart.split(":").map(Number);
  const [eh, em] = p.windowEnd.split(":").map(Number);
  const windowSeconds = (eh * 60 + em - (sh * 60 + sm)) * 60;
  return {
    hours: +(seconds / 3600).toFixed(1),
    windowHours: +(windowSeconds / 3600).toFixed(1),
    fitsInWindow: seconds <= windowSeconds,
    // teto realista de msgs que a janela comporta com esse ritmo
    maxPerDay: Math.floor(windowSeconds / (avgDelay + avgPause / p.batchSize)),
  };
}
