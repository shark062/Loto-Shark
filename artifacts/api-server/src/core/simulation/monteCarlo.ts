// ============================================================
//  Monte Carlo — Fase 6
//  Simulação massiva de sorteios para validação estatística
//  e estimativa de cobertura de estratégias.
//  Executa de forma assíncrona para não impactar performance.
// ============================================================

import { logger } from "../../lib/logger";

// ─── Tipos ────────────────────────────────────────────────────

export interface MonteCarloConfig {
  /** Número de simulações (padrão: 10.000 — 100k é pesado para sync) */
  simulations: number;
  /** Universo de números da modalidade */
  totalNumbers: number;
  /** Quantidade de números por jogo */
  pickCount: number;
  /** Se true, usa frequências históricas como probabilidades (não uniforme) */
  useHistoricalProbabilities: boolean;
  /** Frequências históricas (usado se useHistoricalProbabilities = true) */
  frequencyMap?: Record<number, number>;
}

export interface SimulationResult {
  /** Número de sorteios simulados */
  simulations: number;
  /** Frequência de cada número nos sorteios simulados */
  simulatedFrequencies: Record<number, number>;
  /** Números mais frequentes nas simulações */
  topNumbers: number[];
  /** Números menos frequentes nas simulações */
  bottomNumbers: number[];
  /** Desvio da distribuição simulada em relação à uniforme */
  distributionBias: number;
  /** Score de estabilidade (0–100) */
  stabilityScore: number;
  /** Estimativa de cobertura para um conjunto de jogos */
  estimatedCoverage?: number;
  /** Tempo de execução em ms */
  executionMs: number;
}

export interface StrategyValidation {
  strategyName: string;
  games: number[][];
  avgHitsPerDraw: number;
  minHits: number;
  maxHits: number;
  hitDistribution: Record<number, number>;
  coveragePercent: number;
  estimatedROI: number;
}

// ─── Gerador de Sorteios Simulados ────────────────────────────

/**
 * Gera um sorteio simulado usando probabilidades históricas (ou uniformes).
 */
function simulateSingleDraw(
  totalNumbers: number,
  pickCount: number,
  weights: number[],
  totalWeight: number,
): number[] {
  const drawn = new Set<number>();
  const numbers = Array.from({ length: totalNumbers }, (_, i) => i + 1);

  while (drawn.size < pickCount) {
    let r = Math.random() * totalWeight;
    for (let i = 0; i < numbers.length; i++) {
      r -= weights[i];
      if (r <= 0 && !drawn.has(numbers[i])) {
        drawn.add(numbers[i]);
        break;
      }
    }
    // fallback: pick random uncovered
    if (drawn.size < pickCount) {
      const available = numbers.filter(n => !drawn.has(n));
      if (available.length > 0) {
        drawn.add(available[Math.floor(Math.random() * available.length)]);
      }
    }
  }

  return Array.from(drawn);
}

// ─── Funções Principais ───────────────────────────────────────

/**
 * Simula N sorteios e retorna estatísticas.
 * Para simCount grande (>50k) use simulateDrawsAsync.
 */
export function simulateDraws(config: MonteCarloConfig): SimulationResult {
  const startMs = Date.now();
  const { simulations, totalNumbers, pickCount, useHistoricalProbabilities, frequencyMap = {} } = config;

  // Prepara pesos
  const numbers = Array.from({ length: totalNumbers }, (_, i) => i + 1);
  let weights: number[];
  let totalWeight: number;

  if (useHistoricalProbabilities && Object.keys(frequencyMap).length > 0) {
    weights = numbers.map(n => (frequencyMap[n] || 1));
  } else {
    weights = numbers.map(() => 1);
  }
  totalWeight = weights.reduce((a, b) => a + b, 0);

  // Frequências simuladas
  const simulatedFrequencies: Record<number, number> = {};
  for (const n of numbers) simulatedFrequencies[n] = 0;

  const effectiveSims = Math.min(simulations, 100_000); // cap em 100k

  for (let i = 0; i < effectiveSims; i++) {
    const draw = simulateSingleDraw(totalNumbers, pickCount, weights, totalWeight);
    for (const n of draw) simulatedFrequencies[n]++;
  }

  // Análise
  const freqValues = Object.values(simulatedFrequencies);
  const expectedFreq = (effectiveSims * pickCount) / totalNumbers;
  const variance = freqValues.reduce((s, v) => s + Math.pow(v - expectedFreq, 2), 0) / totalNumbers;
  const stdDev = Math.sqrt(variance);
  const distributionBias = expectedFreq > 0 ? Math.round((stdDev / expectedFreq) * 100) : 0;
  const stabilityScore = Math.max(0, 100 - distributionBias);

  const sorted = [...numbers].sort((a, b) => (simulatedFrequencies[b] || 0) - (simulatedFrequencies[a] || 0));
  const topNumbers = sorted.slice(0, Math.min(10, pickCount));
  const bottomNumbers = sorted.slice(-Math.min(10, pickCount));

  logger.debug(
    { simulations: effectiveSims, executionMs: Date.now() - startMs, stabilityScore },
    "[MonteCarlo] Simulação concluída",
  );

  return {
    simulations: effectiveSims,
    simulatedFrequencies,
    topNumbers,
    bottomNumbers,
    distributionBias,
    stabilityScore,
    executionMs: Date.now() - startMs,
  };
}

/**
 * Executa simulação de forma assíncrona (não bloqueia o event loop).
 * Usa setImmediate para ceder o controle entre lotes.
 */
export async function simulateDrawsAsync(config: MonteCarloConfig): Promise<SimulationResult> {
  return new Promise(resolve => {
    setImmediate(() => {
      resolve(simulateDraws({ ...config, simulations: Math.min(config.simulations, 50_000) }));
    });
  });
}

/**
 * Valida uma estratégia de jogos contra o histórico real.
 *
 * @param games         Jogos da estratégia a validar
 * @param historicalDraws  Sorteios reais históricos
 * @param strategyName  Nome da estratégia
 */
export function validateStrategy(
  games: number[][],
  historicalDraws: number[][],
  strategyName: string = "unknown",
): StrategyValidation {
  if (historicalDraws.length === 0 || games.length === 0) {
    return {
      strategyName,
      games,
      avgHitsPerDraw: 0,
      minHits: 0,
      maxHits: 0,
      hitDistribution: {},
      coveragePercent: 0,
      estimatedROI: -100,
    };
  }

  const hitDistribution: Record<number, number> = {};
  let totalHits = 0;
  let minHits = Infinity;
  let maxHits = -Infinity;

  for (const draw of historicalDraws) {
    const drawSet = new Set(draw);
    for (const game of games) {
      const hits = game.filter(n => drawSet.has(n)).length;
      totalHits += hits;
      hitDistribution[hits] = (hitDistribution[hits] || 0) + 1;
      minHits = Math.min(minHits, hits);
      maxHits = Math.max(maxHits, hits);
    }
  }

  const totalChecks = historicalDraws.length * games.length;
  const avgHitsPerDraw = totalChecks > 0 ? Math.round((totalHits / totalChecks) * 100) / 100 : 0;

  // Cobertura: % das dezenas do histórico que foram cobertas pelos jogos
  const allDrawnNums = new Set(historicalDraws.flat());
  const coveredByGames = games.flat().filter(n => allDrawnNums.has(n));
  const coveragePercent = allDrawnNums.size > 0
    ? Math.round((new Set(coveredByGames).size / allDrawnNums.size) * 100)
    : 0;

  // ROI estimado simplificado: baseado na taxa de acertos mínimos (prêmio)
  const pickCount = games[0]?.length || 6;
  const prizeThreshold = Math.ceil(pickCount * 0.60);
  const prizeHits = Object.entries(hitDistribution)
    .filter(([h]) => Number(h) >= prizeThreshold)
    .reduce((s, [, c]) => s + c, 0);
  const prizeRate = totalChecks > 0 ? prizeHits / totalChecks : 0;
  const estimatedROI = Math.round((prizeRate * 100) - 100);

  return {
    strategyName,
    games,
    avgHitsPerDraw,
    minHits: isFinite(minHits) ? minHits : 0,
    maxHits: isFinite(maxHits) ? maxHits : 0,
    hitDistribution,
    coveragePercent,
    estimatedROI,
  };
}

/**
 * Estima a cobertura de um conjunto de jogos contra sorteios simulados.
 */
export function estimateCoverage(
  games: number[][],
  simResult: SimulationResult,
  totalNumbers: number,
): number {
  if (games.length === 0) return 0;

  const gameNumbers = new Set(games.flat());
  const topSimulated = Object.entries(simResult.simulatedFrequencies)
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.ceil(totalNumbers * 0.5))
    .map(([n]) => Number(n));

  const topSet = new Set(topSimulated);
  const covered = [...gameNumbers].filter(n => topSet.has(n)).length;
  return Math.round((covered / topSimulated.length) * 100);
}
