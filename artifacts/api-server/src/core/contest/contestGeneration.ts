// ============================================================
//  Contest Generation — Fase 1: Consistência Temporal
//  Vincula cada geração de jogos ao concurso-alvo.
//  Armazena snapshot completo para rastreabilidade total.
// ============================================================

export const ALGORITHM_VERSION = "2.1.0";
export const AI_VERSION = "ensemble-v1";

// ─── Interfaces ───────────────────────────────────────────────

export interface GeneratedGame {
  numbers: number[];
  strategy: string;
  sharkScore: number;
  sharkOrigem: string;
  confidence: number;
  reasoning: string;
}

export interface StatisticsSnapshot {
  drawsAnalyzed: number;
  hotNumbers: number[];
  coldNumbers: number[];
  warmNumbers: number[];
  avgSum: number;
  avgEvens: number;
  topPairs: Array<{ pair: [number, number]; count: number }>;
  frequencyMap: Record<number, number>;
  delayMap: Record<number, number>;
}

export interface FiltersSnapshot {
  strategy: string;
  pesos: { frequencia: number; atraso: number; repeticao: number };
  minDistance: number;
  antiPopularEnabled: boolean;
  temporalCutoff: number | null;
}

export interface ContestGeneration {
  id: string;
  modality: string;
  contestNumber: number;
  contestDate: string;
  generatedAt: string;
  algorithmVersion: string;
  aiVersion: string;
  generationHash: string;
  games: GeneratedGame[];
  statisticsSnapshot: StatisticsSnapshot;
  filtersSnapshot: FiltersSnapshot;
}

// ─── Utilitários ──────────────────────────────────────────────

/**
 * Gera um UUID v4 simples sem dependências externas.
 */
export function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Hash determinístico leve baseado no conteúdo dos jogos.
 * Não usa crypto para evitar dependências de plataforma.
 */
export function generateGameHash(
  modality: string,
  contestNumber: number,
  games: GeneratedGame[],
  filtersSnapshot: FiltersSnapshot,
): string {
  const payload = JSON.stringify({
    modality,
    contestNumber,
    games: games.map(g => g.numbers.sort((a, b) => a - b)),
    strategy: filtersSnapshot.strategy,
  });

  let hash = 5381;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) + hash) ^ payload.charCodeAt(i);
    hash = hash & hash;
  }

  const h = Math.abs(hash).toString(16).toUpperCase().padStart(8, "0");
  return `SHK-${h}-${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Estima a data do próximo concurso baseado na modalidade.
 * Retorna ISO string da data estimada.
 */
export function estimateContestDate(
  modality: string,
  referenceDate: Date = new Date(),
): string {
  const drawDays: Record<string, number[]> = {
    megasena:   [2, 4, 6], // Ter, Qui, Sáb
    lotofacil:  [1, 2, 3, 4, 5, 6], // Seg a Sáb
    quina:      [1, 2, 3, 4, 5, 6],
    lotomania:  [1, 3, 5], // Seg, Qua, Sex
    duplasena:  [2, 4, 6],
    timemania:  [2, 4, 6],
    diadesorte: [2, 4, 6],
    supersete:  [2, 4, 6],
  };

  const days = drawDays[modality] || [3]; // default: quarta
  const today = new Date(referenceDate);
  const currentDay = today.getDay();

  let daysAhead = 1;
  for (let i = 1; i <= 7; i++) {
    const nextDay = (currentDay + i) % 7;
    if (days.includes(nextDay)) {
      daysAhead = i;
      break;
    }
  }

  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysAhead);
  nextDate.setHours(21, 0, 0, 0);
  return nextDate.toISOString();
}

/**
 * Constrói o objeto ContestGeneration completo.
 */
export function buildContestGeneration(params: {
  modality: string;
  contestNumber: number;
  games: GeneratedGame[];
  statisticsSnapshot: StatisticsSnapshot;
  filtersSnapshot: FiltersSnapshot;
  aiVersion?: string;
}): ContestGeneration {
  const {
    modality,
    contestNumber,
    games,
    statisticsSnapshot,
    filtersSnapshot,
    aiVersion = AI_VERSION,
  } = params;

  const now = new Date();
  const hash = generateGameHash(modality, contestNumber, games, filtersSnapshot);

  return {
    id: generateUUID(),
    modality,
    contestNumber,
    contestDate: estimateContestDate(modality, now),
    generatedAt: now.toISOString(),
    algorithmVersion: ALGORITHM_VERSION,
    aiVersion,
    generationHash: hash,
    games,
    statisticsSnapshot,
    filtersSnapshot,
  };
}
