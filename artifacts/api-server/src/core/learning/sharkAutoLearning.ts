// ============================================================
//  Shark Auto-Learning — Fase 9
//  Aprende automaticamente com os resultados dos jogos
//  históricos para ajustar pesos e estratégias.
//  Sem IA externa — apenas estatística adaptativa.
// ============================================================

import { logger } from "../../lib/logger";
import { adaptWeights, DEFAULT_WEIGHTS } from "../scoring/sharkPrecisionEngine";
import type { AdaptiveWeights } from "../scoring/sharkPrecisionEngine";

// ─── Tipos ────────────────────────────────────────────────────

export interface GameOutcome {
  numbers: number[];
  hits: number;
  strategy: string;
  contestNumber: number;
  createdAt: string;
}

export interface LearningState {
  modality: string;
  weights: AdaptiveWeights;
  totalGamesEvaluated: number;
  avgHits: number;
  winRate: number;
  strategyCounts: Record<string, number>;
  bestStrategy: string;
  lastUpdated: string;
  iteration: number;
}

export interface StrategyPerformance {
  strategy: string;
  totalGames: number;
  avgHits: number;
  winRate: number;
  trend: "improving" | "stable" | "declining";
  score: number;
}

export interface LearningReport {
  modality: string;
  iteration: number;
  weights: AdaptiveWeights;
  bestStrategy: string;
  strategyPerformance: StrategyPerformance[];
  recommendation: string;
  confidence: number;
}

// ─── Estado Global de Aprendizado ────────────────────────────
// Persiste enquanto o servidor estiver rodando

const learningStates = new Map<string, LearningState>();

function initState(modality: string): LearningState {
  return {
    modality,
    weights: { ...DEFAULT_WEIGHTS },
    totalGamesEvaluated: 0,
    avgHits: 0,
    winRate: 0,
    strategyCounts: {},
    bestStrategy: "mixed",
    lastUpdated: new Date().toISOString(),
    iteration: 0,
  };
}

// ─── Funções de Aprendizado ────────────────────────────────────

/**
 * Retorna o estado de aprendizado para uma modalidade.
 * Cria estado inicial se não existir.
 */
export function getLearningState(modality: string): LearningState {
  if (!learningStates.has(modality)) {
    learningStates.set(modality, initState(modality));
  }
  return learningStates.get(modality)!;
}

/**
 * Aprende com um conjunto de outcomes históricos.
 * Atualiza pesos e identifica a melhor estratégia.
 *
 * @param modality       Modalidade de loteria
 * @param outcomes       Outcomes de jogos salvos
 * @param minNumbers     Quantidade de números por jogo
 * @param totalNumbers   Universo da modalidade
 */
export function learnFromOutcomes(
  modality: string,
  outcomes: GameOutcome[],
  minNumbers: number,
  totalNumbers: number,
): LearningState {
  const state = getLearningState(modality);

  if (outcomes.length === 0) return state;

  // Agrupa por estratégia
  const byStrategy: Record<string, GameOutcome[]> = {};
  for (const o of outcomes) {
    const s = o.strategy || "unknown";
    if (!byStrategy[s]) byStrategy[s] = [];
    byStrategy[s].push(o);
  }

  // Calcula performance por estratégia
  const strategyScores: Record<string, number> = {};
  for (const [strategy, games] of Object.entries(byStrategy)) {
    const avgH = games.reduce((s, g) => s + g.hits, 0) / games.length;
    const wins = games.filter(g => g.hits >= Math.ceil(minNumbers * 0.50)).length;
    const winR = games.length > 0 ? wins / games.length : 0;

    // Score simples: 60% avgHits normalizado + 40% winRate
    const normalizedHits = minNumbers > 0 ? avgH / minNumbers : 0;
    strategyScores[strategy] = Math.round((normalizedHits * 0.60 + winR * 0.40) * 100);

    state.strategyCounts[strategy] = (state.strategyCounts[strategy] || 0) + games.length;
  }

  // Melhor estratégia
  const bestEntry = Object.entries(strategyScores).sort((a, b) => b[1] - a[1])[0];
  const bestStrategy = bestEntry ? bestEntry[0] : "mixed";

  // Atualiza médias globais
  const allHits = outcomes.map(o => o.hits);
  const newAvgHits = allHits.reduce((a, b) => a + b, 0) / allHits.length;
  const winThreshold = Math.ceil(minNumbers * 0.50);
  const newWinRate = outcomes.filter(o => o.hits >= winThreshold).length / outcomes.length;

  // Atualiza pesos via adaptWeights
  const targetHits = Math.ceil(minNumbers * 0.55);
  const newWeights = adaptWeights(state.weights, newWinRate, newAvgHits, targetHits);

  state.weights = newWeights;
  state.avgHits = Math.round(newAvgHits * 100) / 100;
  state.winRate = Math.round(newWinRate * 10000) / 100;
  state.bestStrategy = bestStrategy;
  state.totalGamesEvaluated += outcomes.length;
  state.lastUpdated = new Date().toISOString();
  state.iteration++;

  learningStates.set(modality, state);

  logger.info(
    { modality, iteration: state.iteration, bestStrategy, avgHits: state.avgHits, winRate: state.winRate },
    "[AutoLearning] Estado atualizado",
  );

  return state;
}

/**
 * Gera um relatório de aprendizado para uma modalidade.
 */
export function generateLearningReport(
  modality: string,
  minNumbers: number,
): LearningReport {
  const state = getLearningState(modality);

  const strategyPerformance: StrategyPerformance[] = Object.entries(state.strategyCounts).map(
    ([strategy, count]) => ({
      strategy,
      totalGames: count,
      avgHits: state.avgHits,
      winRate: state.winRate,
      trend: count > 10 ? "stable" : ("improving" as const),
      score: strategy === state.bestStrategy ? 100 : 50,
    }),
  );

  const targetHits = Math.ceil(minNumbers * 0.55);
  const confidence = Math.min(100, Math.round(
    (state.totalGamesEvaluated / Math.max(10, state.totalGamesEvaluated)) * 100
  ));

  const recommendation =
    state.totalGamesEvaluated < 5
      ? `Dados insuficientes. Jogue com estratégia "${state.bestStrategy}" e aguarde mais resultados.`
      : `Estratégia recomendada: "${state.bestStrategy}" (avgHits=${state.avgHits.toFixed(1)}, winRate=${state.winRate.toFixed(1)}%). ` +
        (state.avgHits >= targetHits
          ? "Sistema otimizado — continue com a estratégia atual."
          : `Aumente amostragem para refinar pesos (alvo: ${targetHits} acertos médios).`);

  return {
    modality,
    iteration: state.iteration,
    weights: state.weights,
    bestStrategy: state.bestStrategy,
    strategyPerformance,
    recommendation,
    confidence,
  };
}

/**
 * Obtém pesos adaptativos para geração de jogos.
 * Retorna pesos aprendidos se disponíveis, senão padrão.
 */
export function getAdaptiveWeights(modality: string): AdaptiveWeights {
  const state = getLearningState(modality);
  return state.weights;
}

// Re-exporta DEFAULT_WEIGHTS para uso externo
export { DEFAULT_WEIGHTS };
