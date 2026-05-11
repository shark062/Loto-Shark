// ============================================================
//  HyperScore Engine — Motor de Pontuação Multiplicativo
//  Combina todos os scores parciais em um score final
//  usando produto ponderado (multiplicativo) em vez de soma.
//  Isso garante que nenhum fator ruim seja "compensado" por
//  outro bom — todos os componentes precisam ser minimamente
//  aceitáveis para o score ser alto.
// ============================================================

import { logger } from "../../lib/logger";

// ─── Tipos ────────────────────────────────────────────────────

export interface HyperScoreInput {
  precisionScore:    number;   // 0–1000 (SharkPrecisionEngine)
  entropyScore:      number;   // 0–100 (EntropyEngine)
  correlationScore:  number;   // 0–100 (CorrelationEngine)
  distributionScore: number;   // 0–100 (DistributionEngine)
  riskComposite:     number;   // 0–100 (RiskEngine.compositeScore)
  cycleScore:        number;   // -100 a 100 (CycleEngine)
  popularPenalty:    number;   // 0 = sem penalidade (negativo = penalizado)
  coverageBonus:     number;   // 0–100
  temporalScore:     number;   // 0–100 (TemporalTrendEngine)
  roiEstimate:       number;   // -∞ a ∞ (normalizado 0–100)
}

export interface HyperScoreWeights {
  precision:    number;
  entropy:      number;
  correlation:  number;
  distribution: number;
  risk:         number;
  cycle:        number;
  popular:      number;
  coverage:     number;
  temporal:     number;
  roi:          number;
}

export interface HyperScoreResult {
  hyperScore:    number;   // 0–1000 score final
  normalized:    number;   // 0–1
  grade:         "S" | "A" | "B" | "C" | "D";
  components:    Record<string, number>;
  weakestFactor: string;
  confidence:    number;
  version:       string;
}

// ─── Pesos Padrão ─────────────────────────────────────────────

export const DEFAULT_HYPER_WEIGHTS: HyperScoreWeights = {
  precision:    0.22,
  entropy:      0.10,
  correlation:  0.08,
  distribution: 0.10,
  risk:         0.15,
  cycle:        0.10,
  popular:      0.08,
  coverage:     0.07,
  temporal:     0.05,
  roi:          0.05,
};

// ─── Normalização de Componentes ──────────────────────────────

function normalizePrecision(score: number): number {
  return Math.min(1, Math.max(0, score / 1000));
}

function normalizeEntropy(score: number): number {
  return Math.min(1, Math.max(0, score / 100));
}

function normalizeCycle(score: number): number {
  return Math.min(1, Math.max(0, (score + 100) / 200));
}

function normalizePopular(penalty: number): number {
  if (penalty >= 0) return 1;
  return Math.min(1, Math.max(0, 1 + penalty / 100));
}

function normalizeRoi(roi: number): number {
  if (roi >= 100) return 1;
  if (roi <= -100) return 0;
  return (roi + 100) / 200;
}

// ─── HyperScore Multiplicativo ────────────────────────────────

/**
 * Calcula o HyperScore multiplicativo.
 *
 * Fórmula: HyperScore = 1000 × ∏(compᵢ^wᵢ)
 * onde cada componente está normalizado em [0,1].
 *
 * Isso penaliza severamente qualquer fator ruim (próximo de 0),
 * garantindo que o score seja alto apenas quando TODOS os fatores
 * são bons.
 */
export function computeHyperScore(
  input: HyperScoreInput,
  weights: HyperScoreWeights = DEFAULT_HYPER_WEIGHTS,
): HyperScoreResult {
  const components: Record<string, number> = {
    precision:    normalizePrecision(input.precisionScore),
    entropy:      normalizeEntropy(input.entropyScore),
    correlation:  normalizeEntropy(input.correlationScore),
    distribution: normalizeEntropy(input.distributionScore),
    risk:         normalizeEntropy(input.riskComposite),
    cycle:        normalizeCycle(input.cycleScore),
    popular:      normalizePopular(input.popularPenalty),
    coverage:     normalizeEntropy(input.coverageBonus),
    temporal:     normalizeEntropy(input.temporalScore),
    roi:          normalizeRoi(input.roiEstimate),
  };

  // Normaliza pesos
  const totalW = Object.values(weights).reduce((a, b) => a + b, 0);

  // Produto ponderado geométrico
  let logSum = 0;
  for (const [key, norm] of Object.entries(components)) {
    const w = (weights[key as keyof HyperScoreWeights] || 0) / totalW;
    const safeNorm = Math.max(0.001, norm);
    logSum += w * Math.log(safeNorm);
  }

  const product = Math.exp(logSum);
  const hyperScore = Math.round(product * 1000);

  // Identifica o fator mais fraco
  const weakest = Object.entries(components).sort((a, b) => a[1] - b[1])[0];
  const weakestFactor = weakest?.[0] || "unknown";

  // Grade
  let grade: HyperScoreResult["grade"];
  if (hyperScore >= 800) grade = "S";
  else if (hyperScore >= 650) grade = "A";
  else if (hyperScore >= 500) grade = "B";
  else if (hyperScore >= 350) grade = "C";
  else grade = "D";

  const confidence = Math.min(0.99, 0.50 + product * 0.49);

  logger.debug(
    { hyperScore, grade, weakestFactor },
    "[HyperScore] Score calculado",
  );

  return {
    hyperScore,
    normalized: Math.round(product * 1000) / 1000,
    grade,
    components,
    weakestFactor,
    confidence,
    version: "hyperscore-v1",
  };
}

/**
 * Calcula HyperScore para múltiplos jogos e retorna ranqueados.
 */
export function rankGamesByHyperScore(
  games: Array<{ numbers: number[]; input: HyperScoreInput }>,
  weights?: HyperScoreWeights,
): Array<{ numbers: number[]; result: HyperScoreResult }> {
  const scored = games.map(g => ({
    numbers: g.numbers,
    result: computeHyperScore(g.input, weights),
  }));

  scored.sort((a, b) => b.result.hyperScore - a.result.hyperScore);
  return scored;
}
