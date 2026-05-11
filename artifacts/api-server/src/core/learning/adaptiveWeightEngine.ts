// ============================================================
//  Adaptive Weight Engine — Aprendizado de Pesos por Feedback
//  Versão evoluída do sharkAutoLearning com:
//  - Aprendizado bayesiano simplificado
//  - Decay temporal (pesos antigos perdem força)
//  - Aprendizado por modalidade E por estratégia
//  - Persistência de estado entre sessões (em memória + exportável)
// ============================================================

import { logger } from "../../lib/logger";

// ─── Tipos ────────────────────────────────────────────────────

export interface WeightVector {
  hyperScore:       number;
  precision:        number;
  entropy:          number;
  correlation:      number;
  distribution:     number;
  risk:             number;
  cycle:            number;
  temporal:         number;
  roi:              number;
  popular:          number;
}

export interface AdaptiveWeightState {
  modality:         string;
  strategy:         string;
  weights:          WeightVector;
  priorWeights:     WeightVector;
  /** Quantas gerações foram usadas para ajustar estes pesos */
  sampleCount:      number;
  /** Taxa de acerto média observada */
  observedWinRate:  number;
  /** Média de acertos */
  observedAvgHits:  number;
  /** Taxa de aprendizado atual */
  learningRate:     number;
  /** Data do último ajuste */
  lastUpdated:      string;
  /** Versão do estado */
  version:          number;
}

export interface LearningSignal {
  /** Acertos do jogo (0 a pickCount) */
  hits:        number;
  /** Quantidade de números por jogo */
  pickCount:   number;
  /** Estratégia usada */
  strategy:    string;
  /** Scores usados na geração */
  usedScores:  Partial<WeightVector>;
}

// ─── Pesos Prior (distribuição uniforme normalizada) ──────────

export const PRIOR_WEIGHTS: WeightVector = {
  hyperScore:    0.20,
  precision:     0.18,
  entropy:       0.10,
  correlation:   0.08,
  distribution:  0.10,
  risk:          0.12,
  cycle:         0.08,
  temporal:      0.06,
  roi:           0.04,
  popular:       0.04,
};

// ─── Estado Global (em memória) ───────────────────────────────

const stateStore = new Map<string, AdaptiveWeightState>();

function stateKey(modality: string, strategy: string): string {
  return `${modality}:${strategy}`;
}

function normalizeWeights(w: WeightVector): WeightVector {
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  if (total === 0) return { ...PRIOR_WEIGHTS };
  return Object.fromEntries(
    Object.entries(w).map(([k, v]) => [k, Math.round((v / total) * 10000) / 10000]),
  ) as unknown as WeightVector;
}

// ─── Inicialização de Estado ──────────────────────────────────

function initState(modality: string, strategy: string): AdaptiveWeightState {
  return {
    modality,
    strategy,
    weights:         { ...PRIOR_WEIGHTS },
    priorWeights:    { ...PRIOR_WEIGHTS },
    sampleCount:     0,
    observedWinRate: 0,
    observedAvgHits: 0,
    learningRate:    0.05,
    lastUpdated:     new Date().toISOString(),
    version:         1,
  };
}

export function getWeightState(modality: string, strategy: string): AdaptiveWeightState {
  const key = stateKey(modality, strategy);
  if (!stateStore.has(key)) {
    stateStore.set(key, initState(modality, strategy));
  }
  return stateStore.get(key)!;
}

// ─── Aprendizado Bayesiano Simplificado ──────────────────────

/**
 * Atualiza os pesos com base em um sinal de aprendizado.
 *
 * Regra: Se um score contribuiu para um resultado bom (acerto >= threshold),
 * seu peso aumenta proporcionalmente. Se contribuiu para resultado ruim, diminui.
 *
 * Usa decay temporal para que sinais antigos percam influência.
 */
export function learnFromSignal(
  modality:    string,
  strategy:    string,
  signal:      LearningSignal,
  pickCount:   number = 6,
): AdaptiveWeightState {
  const state = getWeightState(modality, strategy);
  const key   = stateKey(modality, strategy);

  // Resultado: bom se acertos >= 50% do pick count
  const threshold = Math.ceil(pickCount * 0.50);
  const isGood    = signal.hits >= threshold;
  const quality   = signal.hits / Math.max(pickCount, 1);

  // Taxa de aprendizado com decay: diminui à medida que acumula amostras
  const lr = Math.max(0.005, state.learningRate / (1 + state.sampleCount * 0.01));

  const newWeights = { ...state.weights };

  for (const [engine, score] of Object.entries(signal.usedScores)) {
    if (!(engine in newWeights)) continue;
    const normalizedScore = Math.min(1, Math.max(0, (score ?? 0) / 100));
    const k = engine as keyof WeightVector;

    if (isGood) {
      // Reforça peso dos engines que pontuaram alto neste bom resultado
      newWeights[k] = Math.min(0.50, newWeights[k] + lr * normalizedScore * quality);
    } else {
      // Reduz peso dos engines que pontuaram alto mas não foram efetivos
      newWeights[k] = Math.max(0.01, newWeights[k] - lr * normalizedScore * (1 - quality) * 0.5);
    }
  }

  // Puxada em direção ao prior (regularização)
  const priorPull = 0.02;
  for (const k of Object.keys(newWeights) as Array<keyof WeightVector>) {
    newWeights[k] = newWeights[k] * (1 - priorPull) + state.priorWeights[k] * priorPull;
  }

  // Atualiza médias observadas (EMA)
  const alpha = 0.10;
  const newWinRate  = state.observedWinRate  * (1 - alpha) + (isGood ? 1 : 0) * alpha;
  const newAvgHits  = state.observedAvgHits  * (1 - alpha) + signal.hits        * alpha;

  const updated: AdaptiveWeightState = {
    ...state,
    weights:         normalizeWeights(newWeights),
    sampleCount:     state.sampleCount + 1,
    observedWinRate: Math.round(newWinRate * 10000) / 10000,
    observedAvgHits: Math.round(newAvgHits * 100) / 100,
    learningRate:    lr,
    lastUpdated:     new Date().toISOString(),
    version:         state.version + 1,
  };

  stateStore.set(key, updated);

  logger.debug(
    { modality, strategy, hits: signal.hits, isGood, sampleCount: updated.sampleCount },
    "[AdaptiveWeight] Pesos atualizados",
  );

  return updated;
}

/**
 * Aprende com um lote de sinais históricos.
 */
export function learnFromBatch(
  modality:  string,
  strategy:  string,
  signals:   LearningSignal[],
  pickCount: number = 6,
): AdaptiveWeightState {
  let state = getWeightState(modality, strategy);
  for (const signal of signals) {
    state = learnFromSignal(modality, strategy, signal, pickCount);
  }
  return state;
}

/**
 * Retorna os pesos atuais para uso no pipeline.
 */
export function getAdaptedWeights(
  modality:  string,
  strategy:  string,
): WeightVector {
  return getWeightState(modality, strategy).weights;
}

/**
 * Exporta todos os estados como JSON (para persistência em DB).
 */
export function exportAllStates(): Record<string, AdaptiveWeightState> {
  const result: Record<string, AdaptiveWeightState> = {};
  for (const [key, state] of stateStore.entries()) {
    result[key] = state;
  }
  return result;
}

/**
 * Importa estados previamente exportados.
 */
export function importStates(states: Record<string, AdaptiveWeightState>): void {
  for (const [key, state] of Object.entries(states)) {
    stateStore.set(key, state);
  }
  logger.info({ count: Object.keys(states).length }, "[AdaptiveWeight] Estados importados");
}

/**
 * Reseta os pesos de uma modalidade/estratégia para o prior.
 */
export function resetWeights(modality: string, strategy: string): void {
  const key = stateKey(modality, strategy);
  stateStore.set(key, initState(modality, strategy));
  logger.info({ modality, strategy }, "[AdaptiveWeight] Pesos resetados para prior");
}
