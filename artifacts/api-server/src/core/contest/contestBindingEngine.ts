// ============================================================
//  Contest Binding Engine — Loto-Shark SharkCore v3
//  Responsável por vincular jogos gerados ao concurso CORRETO.
//  REGRA: todo jogo gerado aponta para o PRÓXIMO concurso
//  ainda não sorteado — nunca para o último já sorteado.
// ============================================================

import { logger } from "../../lib/logger";

export interface ContestBinding {
  lotteryId: string;
  targetContestNumber: number;
  estimatedDrawDate: string | null;
  status: "aguardando_sorteio" | "sorteado" | "conferido";
  bindingTimestamp: string;
  bindingHash: string;
}

// Intervalos típicos entre concursos (em dias) por modalidade
const DRAW_INTERVAL_DAYS: Record<string, number> = {
  megasena:       4,
  lotofacil:      2,
  quina:          2,
  lotomania:      4,
  duplasena:      4,
  timemania:      7,
  diadesorte:     4,
  supersete:      2,
  maisMilionaria: 4,
};

/**
 * Resolve o próximo concurso alvo para geração de jogos.
 * Retorna latestContest + 1 (o próximo ainda não sorteado).
 */
export function resolveNextContest(lotteryId: string, latestDrawnContest: number): number {
  if (latestDrawnContest <= 0) {
    logger.warn({ lotteryId }, "[ContestBinding] latestDrawnContest inválido — usando 1 como fallback");
    return 1;
  }
  return latestDrawnContest + 1;
}

/**
 * Estima a data do próximo sorteio com base no intervalo da modalidade.
 */
export function estimateNextDrawDate(lotteryId: string): string | null {
  try {
    const intervalDays = DRAW_INTERVAL_DAYS[lotteryId] ?? 4;
    const now = new Date();
    now.setDate(now.getDate() + intervalDays);
    return now.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

/**
 * Gera um hash determinístico para o binding do concurso.
 * Garante rastreabilidade de qual geração foi para qual concurso.
 */
export function generateBindingHash(
  lotteryId: string,
  targetContest: number,
  timestamp: string
): string {
  const raw = `${lotteryId}:${targetContest}:${timestamp}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).padStart(8, "0");
}

/**
 * Cria o objeto de vinculação completo para um jogo gerado.
 * Este objeto deve ser persistido junto com o jogo.
 */
export function createContestBinding(
  lotteryId: string,
  latestDrawnContest: number
): ContestBinding {
  const targetContestNumber = resolveNextContest(lotteryId, latestDrawnContest);
  const estimatedDrawDate   = estimateNextDrawDate(lotteryId);
  const bindingTimestamp    = new Date().toISOString();
  const bindingHash         = generateBindingHash(lotteryId, targetContestNumber, bindingTimestamp);

  logger.info({
    lotteryId,
    latestDrawnContest,
    targetContestNumber,
    estimatedDrawDate,
    bindingHash,
  }, "[ContestBinding] Vínculo criado");

  return {
    lotteryId,
    targetContestNumber,
    estimatedDrawDate,
    status: "aguardando_sorteio",
    bindingTimestamp,
    bindingHash,
  };
}
