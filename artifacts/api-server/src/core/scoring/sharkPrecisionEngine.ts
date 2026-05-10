// ============================================================
//  Shark Precision Engine — Fase 4: Score Adaptativo
//  Substitui pesos fixos por um sistema de pesos dinâmicos
//  multiplicativos. NÃO remove o scoreCompleto existente.
//  É uma camada COMPLEMENTAR ao SharkEngine v2.
// ============================================================

import type { SharkContext } from "../sharkEngine";

// ─── Configuração de Pesos Adaptativos ───────────────────────

export interface AdaptiveWeights {
  /** Peso do histórico longo (frequência global) */
  historicalWeight: number;
  /** Peso do histórico recente (últimos 10-20 sorteios) */
  recentWeight: number;
  /** Peso da cobertura global do conjunto de jogos */
  coverageWeight: number;
  /** Peso do equilíbrio par/ímpar e soma */
  balanceWeight: number;
  /** Peso da penalização de jogos populares */
  antiPopularWeight: number;
  /** Peso da análise de ciclos */
  cycleWeight: number;
}

export const DEFAULT_WEIGHTS: AdaptiveWeights = {
  historicalWeight:  0.20,
  recentWeight:      0.30,
  coverageWeight:    0.15,
  balanceWeight:     0.15,
  antiPopularWeight: 0.10,
  cycleWeight:       0.10,
};

// Versão do motor de score
export const SCORE_ENGINE_VERSION = "precision-v1";

// ─── Componentes do Score ──────────────────────────────────────

/**
 * Componente histórico: normaliza frequência global por número.
 */
function historicalComponent(
  numbers: number[],
  frequencyMap: Record<number, number>,
  maxFreq: number,
): number {
  if (maxFreq === 0) return 0.5;
  const avg = numbers.reduce((s, n) => s + (frequencyMap[n] || 0), 0) / numbers.length;
  return Math.min(1, avg / maxFreq);
}

/**
 * Componente recente: normaliza frequência nos últimos N sorteios.
 */
function recentComponent(
  numbers: number[],
  recentFrequency: Record<number, number>,
  maxRecent: number,
): number {
  if (maxRecent === 0) return 0.5;
  const avg = numbers.reduce((s, n) => s + (recentFrequency[n] || 0), 0) / numbers.length;
  return Math.min(1, avg / maxRecent);
}

/**
 * Componente de equilíbrio: premia paridade e soma adequadas.
 */
function balanceComponent(
  numbers: number[],
  avgEvens: number,
  avgSum: number,
): number {
  const evens = numbers.filter(n => n % 2 === 0).length;
  const sum = numbers.reduce((a, b) => a + b, 0);

  const parityScore = Math.max(0, 1 - Math.abs(evens - avgEvens) / Math.max(avgEvens, 1));
  const sumDev = avgSum > 0 ? Math.abs(sum - avgSum) / avgSum : 0;
  const sumScore = Math.max(0, 1 - sumDev * 2);

  return (parityScore + sumScore) / 2;
}

/**
 * Componente de ciclos: premia números "na hora certa".
 */
function cycleComponent(
  numbers: number[],
  delayMap: Record<number, number>,
  theoreticalCycle: number,
): number {
  if (theoreticalCycle === 0) return 0.5;

  const scores = numbers.map(n => {
    const delay = delayMap[n] || 0;
    const ratio = delay / theoreticalCycle;
    if (ratio >= 0.8 && ratio <= 2.0) return 1.0;   // zona ótima
    if (ratio > 2.0) return 0.8;                      // overdue — ainda bom
    if (ratio < 0.3) return 0.2;                      // saturado — ruim
    return 0.5;                                        // neutro
  });

  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// ─── Score Final Adaptativo ────────────────────────────────────

export interface PrecisionScoreResult {
  finalScore: number;
  components: {
    historical: number;
    recent: number;
    coverage: number;
    balance: number;
    antiPopular: number;
    cycle: number;
  };
  weights: AdaptiveWeights;
  version: string;
}

/**
 * Calcula o score adaptativo multiplicativo de um jogo.
 *
 * finalScore = f(historicalWeight, recentWeight, coverageWeight,
 *               balanceWeight, antiPopularWeight, cycleWeight)
 *
 * Cada componente é normalizado em [0, 1].
 * O score final é uma média ponderada escalada para [0, 1000].
 */
export function computePrecisionScore(params: {
  numbers: number[];
  ctx: SharkContext;
  avgEvens: number;
  avgSum: number;
  coverageScoreRaw?: number;       // 0-100 da coverageEngine
  antiPopularScoreRaw?: number;    // 0-100 da antiPopularPatterns
  cycleScoreRaw?: number;          // -100 a 100 do cycleEngine
  weights?: Partial<AdaptiveWeights>;
}): PrecisionScoreResult {
  const {
    numbers,
    ctx,
    avgEvens,
    avgSum,
    coverageScoreRaw = 50,
    antiPopularScoreRaw = 100,
    cycleScoreRaw = 0,
    weights: wOverride = {},
  } = params;

  const weights: AdaptiveWeights = { ...DEFAULT_WEIGHTS, ...wOverride };

  // Normaliza pesos para soma = 1
  const totalW = Object.values(weights).reduce((a, b) => a + b, 0);
  const wNorm = Object.fromEntries(
    Object.entries(weights).map(([k, v]) => [k, v / totalW])
  ) as unknown as AdaptiveWeights;

  // Prepara dados de frequência
  const allFreqs = Object.values(ctx.frequency);
  const maxFreq = Math.max(...allFreqs, 1);
  const allRecent = Object.values(ctx.recentFrequency);
  const maxRecent = Math.max(...allRecent, 1);
  const theoreticalCycle = ctx.totalNumbers / ctx.minNumbers;

  // Calcula componentes normalizados
  const historical  = historicalComponent(numbers, ctx.frequency, maxFreq);
  const recent      = recentComponent(numbers, ctx.recentFrequency, maxRecent);
  const coverage    = Math.min(1, coverageScoreRaw / 100);
  const balance     = balanceComponent(numbers, avgEvens, avgSum);
  const antiPopular = Math.min(1, antiPopularScoreRaw / 100);
  const cycle       = Math.min(1, Math.max(0, (cycleScoreRaw + 100) / 200));

  const components = { historical, recent, coverage, balance, antiPopular, cycle };

  // Score final ponderado (0–1000)
  const finalNormalized =
    historical  * wNorm.historicalWeight  +
    recent      * wNorm.recentWeight      +
    coverage    * wNorm.coverageWeight    +
    balance     * wNorm.balanceWeight     +
    antiPopular * wNorm.antiPopularWeight +
    cycle       * wNorm.cycleWeight;

  const finalScore = Math.round(finalNormalized * 1000);

  return {
    finalScore,
    components,
    weights: wNorm,
    version: SCORE_ENGINE_VERSION,
  };
}

/**
 * Ajusta os pesos com base em resultados históricos reais.
 * Retorna um novo objeto de pesos adaptados.
 *
 * @param currentWeights  Pesos atuais
 * @param winRate         Taxa de acerto recente (0–1)
 * @param avgHits         Média de acertos por jogo
 * @param targetHits      Meta de acertos desejada
 */
export function adaptWeights(
  currentWeights: AdaptiveWeights,
  winRate: number,
  avgHits: number,
  targetHits: number,
): AdaptiveWeights {
  const factor = targetHits > 0 ? Math.min(1.5, Math.max(0.5, avgHits / targetHits)) : 1;

  // Se está abaixo da meta: aumenta peso do histórico recente
  // Se está acima: aumenta diversidade (cobertura + ciclos)
  const newWeights: AdaptiveWeights = { ...currentWeights };

  if (factor < 0.8) {
    newWeights.recentWeight     = Math.min(0.50, currentWeights.recentWeight     * 1.10);
    newWeights.historicalWeight = Math.min(0.35, currentWeights.historicalWeight * 1.05);
    newWeights.coverageWeight   = Math.max(0.05, currentWeights.coverageWeight   * 0.95);
  } else if (factor > 1.2) {
    newWeights.coverageWeight   = Math.min(0.30, currentWeights.coverageWeight   * 1.10);
    newWeights.cycleWeight      = Math.min(0.25, currentWeights.cycleWeight      * 1.10);
    newWeights.recentWeight     = Math.max(0.15, currentWeights.recentWeight     * 0.95);
  }

  // Normaliza pesos para soma = 1
  const total = Object.values(newWeights).reduce((a, b) => a + b, 0);
  return Object.fromEntries(
    Object.entries(newWeights).map(([k, v]) => [k, Math.round((v / total) * 1000) / 1000])
  ) as unknown as AdaptiveWeights;
}
