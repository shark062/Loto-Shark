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

// ─── Pesos Refinados v2 ────────────────────────────────────
// Ajuste baseado em análise de desempenho:
// - Aumenta peso de distribuição (soma/paridade são fortes preditores)
// - Aumenta peso de correlação (pares co-ocorrentes são relevantes)
// - Aumenta temporal (ciclos recentes têm mais peso que histórico distante)
// - Reduz cycle (muito volátil, peso excessivo gerava false positives)
// - Reduz popular (penalidade de popularidade é mais fraca que imaginado)
export const DEFAULT_HYPER_WEIGHTS: HyperScoreWeights = {
  precision:    0.20,  // SharkPrecisionEngine — base sólida
  entropy:      0.10,  // Diversidade de números
  correlation:  0.12,  // Pares co-ocorrentes — subido de 0.08
  distribution: 0.14,  // Soma/paridade — subido de 0.10
  risk:         0.13,  // Composite de risco
  cycle:        0.08,  // Padrão cíclico — reduzido de 0.10
  popular:      0.06,  // Penalidade de popularidade — reduzido de 0.08
  coverage:     0.08,  // Cobertura do espaço de números
  temporal:     0.06,  // Tendência temporal — subido de 0.05
  roi:          0.03,  // ROI estimado — reduzido (muito incerto)
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

  // Bônus de convergência: se os 3 melhores componentes forem >= 0.75, aplica bônus
  const topComponents = Object.values(components).sort((a, b) => b - a).slice(0, 3);
  const convergenceBonus = topComponents.every(c => c >= 0.75) ? 0.04 : 0;
  const bonusedProduct = Math.min(1, product + convergenceBonus);
  const finalHyperScore = Math.round(bonusedProduct * 1000);

  // Reclassifica grade com produto bonificado
  let finalGrade: HyperScoreResult["grade"];
  if (finalHyperScore >= 820) finalGrade = "S";
  else if (finalHyperScore >= 670) finalGrade = "A";
  else if (finalHyperScore >= 510) finalGrade = "B";
  else if (finalHyperScore >= 360) finalGrade = "C";
  else finalGrade = "D";

  const confidence = Math.min(0.99, 0.50 + bonusedProduct * 0.49);

  logger.debug(
    { hyperScore: finalHyperScore, grade: finalGrade, weakestFactor, convergenceBonus },
    "[HyperScore v2] Score calculado",
  );

  return {
    hyperScore: finalHyperScore,
    normalized: Math.round(bonusedProduct * 1000) / 1000,
    grade: finalGrade,
    components,
    weakestFactor,
    confidence,
    version: "hyperscore-v2",
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
