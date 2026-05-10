// ============================================================
//  Temporal Validator — Prevenção de Data Leakage
//  TODAS as análises devem usar apenas concursos ANTERIORES
//  ao concurso-alvo. Nunca usar dados futuros.
// ============================================================

import { logger } from "../../lib/logger";

// ─── Tipos ────────────────────────────────────────────────────

export interface TemporalConfig {
  /** Número do concurso-alvo (para o qual estamos gerando jogos). */
  targetContest: number;
  /** Número máximo de sorteios usados no treinamento. */
  maxDraws: number;
  /** Se true, loga avisos ao detectar violações. */
  logViolations?: boolean;
}

export interface ValidatedDraws {
  draws: number[][];
  cutoffContest: number;
  drawsUsed: number;
  wasFiltered: boolean;
}

// ─── Funções Principais ───────────────────────────────────────

/**
 * Filtra sorteios para garantir consistência temporal.
 * Apenas usa sorteios ANTERIORES ao concurso-alvo.
 *
 * @param draws   Array de sorteios (mais recente primeiro)
 * @param contestNumbers  Array de números de concurso correspondentes
 * @param targetContest   Concurso-alvo (excluído e tudo após ele)
 * @param maxDraws        Limite máximo de sorteios a usar
 */
export function filterDrawsUpTo(
  draws: number[][],
  contestNumbers: number[],
  targetContest: number,
  maxDraws: number,
): ValidatedDraws {
  const cutoff = targetContest - 1;
  let filtered = draws;
  let wasFiltered = false;

  if (contestNumbers.length > 0) {
    const valid: number[][] = [];
    for (let i = 0; i < draws.length && i < contestNumbers.length; i++) {
      if (contestNumbers[i] <= cutoff) {
        valid.push(draws[i]);
      } else {
        wasFiltered = true;
      }
    }
    filtered = valid;
  }

  const limited = filtered.slice(0, maxDraws);

  return {
    draws: limited,
    cutoffContest: cutoff,
    drawsUsed: limited.length,
    wasFiltered,
  };
}

/**
 * Valida se a análise está respeitando o limite temporal.
 * Retorna true se válida, false se há data leakage.
 */
export function validateTemporalIntegrity(
  analysisContestRange: { min: number; max: number },
  targetContest: number,
  context: string = "analysis",
): boolean {
  if (analysisContestRange.max >= targetContest) {
    logger.warn(
      { analysisContestRange, targetContest, context },
      "[TemporalValidator] Data leakage detectado: análise usa concursos >= alvo",
    );
    return false;
  }
  return true;
}

/**
 * Calcula o número do próximo concurso baseado no último conhecido.
 * Fallback seguro: sempre targetContest = latestKnown + 1.
 */
export function computeTargetContest(latestKnownContest: number): number {
  return latestKnownContest + 1;
}

/**
 * Treina modelo com cutoff temporal explícito.
 * Garante que nunca usa dados do concurso-alvo em diante.
 *
 * @param draws          Todos os sorteios disponíveis (mais recente primeiro)
 * @param maxContest     Limite superior — apenas usa sorteios <= maxContest
 * @param drawCount      Quantos sorteios usar no máximo
 */
export function prepareTrainingData(
  draws: number[][],
  contestNumbers: number[],
  maxContest: number,
  drawCount: number,
): number[][] {
  const { draws: filtered, wasFiltered } = filterDrawsUpTo(
    draws,
    contestNumbers,
    maxContest + 1, // target = maxContest + 1, então usa <= maxContest
    drawCount,
  );

  if (wasFiltered) {
    logger.info(
      { maxContest, drawCount, used: filtered.length },
      "[TemporalValidator] Sorteios futuros removidos do treinamento",
    );
  }

  return filtered;
}
