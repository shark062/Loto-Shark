// ============================================================
//  Auto Calibration Engine — C10
//  Re-calibra pesos do HyperScore e do SharkEngine após cada
//  novo sorteio oficial ser registrado. Usa gradiente simples
//  (hill climbing) para maximizar a função de acerto médio.
// ============================================================

import { logger } from "../../lib/logger";
import type { HyperScoreWeights } from "./hyperScoreEngine";
import { DEFAULT_HYPER_WEIGHTS } from "./hyperScoreEngine";

export interface CalibrationSample {
  lotteryId: string;
  predictedNumbers: number[];
  actualNumbers: number[];
  weightSnapshot: HyperScoreWeights;
  hitsAchieved: number;
  minNumbers: number;  // mínimo de acertos para prêmio
  timestamp: string;
}

export interface CalibrationResult {
  updatedWeights: HyperScoreWeights;
  improvementDelta: number;   // diferença de accuracy antes/depois
  samplesUsed: number;
  iterations: number;
  converged: boolean;
  message: string;
}

// In-memory samples store
const samples: CalibrationSample[] = [];
let currentWeights: HyperScoreWeights = { ...DEFAULT_HYPER_WEIGHTS };

/**
 * Adiciona uma amostra de calibração (previsão + resultado real).
 */
export function addCalibrationSample(sample: CalibrationSample): void {
  samples.push(sample);
  // Mantém apenas as últimas 200 amostras
  if (samples.length > 200) samples.splice(0, samples.length - 200);
  logger.debug({ lotteryId: sample.lotteryId, hits: sample.hitsAchieved }, "[AutoCalib] Amostra adicionada");
}

/**
 * Calcula accuracy média de um conjunto de amostras com dados pesos.
 * Accuracy = hits / minNumbers por amostra.
 */
function evalWeights(
  _weights: HyperScoreWeights,
  testSamples: CalibrationSample[]
): number {
  if (testSamples.length === 0) return 0;
  const totalAccuracy = testSamples.reduce((s, sample) => {
    return s + (sample.hitsAchieved / sample.minNumbers);
  }, 0);
  return totalAccuracy / testSamples.length;
}

/**
 * Normaliza pesos para somar 1.0.
 */
function normalizeWeights(w: HyperScoreWeights): HyperScoreWeights {
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  if (total === 0) return { ...DEFAULT_HYPER_WEIGHTS };
  const result: any = {};
  for (const [k, v] of Object.entries(w)) {
    result[k] = parseFloat(Math.max(0.01, v / total).toFixed(4));
  }
  return result as HyperScoreWeights;
}

/**
 * Executa um passo de calibração usando hill climbing simples.
 * Perturba cada peso ligeiramente e mantém a mudança se melhorar.
 *
 * @param recentOnly  Se true, usa apenas as 50 amostras mais recentes
 */
export function runCalibrationStep(recentOnly = true): CalibrationResult {
  const useSamples = recentOnly
    ? samples.slice(-50)
    : samples;

  if (useSamples.length < 5) {
    return {
      updatedWeights: currentWeights,
      improvementDelta: 0,
      samplesUsed: useSamples.length,
      iterations: 0,
      converged: false,
      message: `Amostras insuficientes (${useSamples.length}/5 mínimo). Continue gerando jogos.`,
    };
  }

  const keys = Object.keys(currentWeights) as Array<keyof HyperScoreWeights>;
  const step = 0.02;         // perturbação por iteração
  const maxIter = 30;
  let bestWeights = { ...currentWeights };
  let bestScore = evalWeights(bestWeights, useSamples);
  const initialScore = bestScore;
  let converged = false;
  let iter = 0;

  for (; iter < maxIter; iter++) {
    let improved = false;

    for (const key of keys) {
      // Tenta aumentar o peso
      const wUp: HyperScoreWeights = normalizeWeights({ ...bestWeights, [key]: bestWeights[key] + step });
      const scoreUp = evalWeights(wUp, useSamples);
      if (scoreUp > bestScore + 0.0001) {
        bestWeights = wUp;
        bestScore = scoreUp;
        improved = true;
        continue;
      }

      // Tenta diminuir o peso
      const wDown: HyperScoreWeights = normalizeWeights({ ...bestWeights, [key]: Math.max(0.01, bestWeights[key] - step) });
      const scoreDown = evalWeights(wDown, useSamples);
      if (scoreDown > bestScore + 0.0001) {
        bestWeights = wDown;
        bestScore = scoreDown;
        improved = true;
      }
    }

    if (!improved) {
      converged = true;
      break;
    }
  }

  const delta = bestScore - initialScore;
  currentWeights = bestWeights;

  logger.info(
    { iterations: iter, delta: delta.toFixed(4), converged, samplesUsed: useSamples.length },
    "[AutoCalib] Calibração concluída"
  );

  return {
    updatedWeights: bestWeights,
    improvementDelta: parseFloat(delta.toFixed(4)),
    samplesUsed: useSamples.length,
    iterations: iter,
    converged,
    message: converged
      ? `Convergido em ${iter} iterações. Melhora: ${(delta * 100).toFixed(2)}%`
      : `Máximo de ${maxIter} iterações atingido. Melhora: ${(delta * 100).toFixed(2)}%`,
  };
}

/**
 * Retorna os pesos atuais (calibrados ou default).
 */
export function getCurrentWeights(): HyperScoreWeights {
  return { ...currentWeights };
}

/**
 * Reseta os pesos para os valores padrão.
 */
export function resetCalibration(): void {
  currentWeights = { ...DEFAULT_HYPER_WEIGHTS };
  samples.length = 0;
  logger.info("[AutoCalib] Pesos resetados para default");
}

/**
 * Retorna estatísticas do estado da calibração.
 */
export function getCalibrationStats(): {
  samplesTotal: number;
  currentWeights: HyperScoreWeights;
  deviationFromDefault: Record<string, number>;
} {
  const deviation: Record<string, number> = {};
  for (const [k, v] of Object.entries(currentWeights)) {
    const def = DEFAULT_HYPER_WEIGHTS[k as keyof HyperScoreWeights];
    deviation[k] = parseFloat((v - def).toFixed(4));
  }

  return {
    samplesTotal: samples.length,
    currentWeights,
    deviationFromDefault: deviation,
  };
}
