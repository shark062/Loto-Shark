// ============================================================
//  Risk Engine — Fase 12
//  Calcula risco, estabilidade, variância, chance de divisão
//  e consistência estatística de um jogo ou conjunto de jogos.
// ============================================================

// ─── Tipos ────────────────────────────────────────────────────

export interface RiskMetrics {
  /** Risco geral: 0=muito baixo, 100=muito alto */
  riskScore: number;
  /** Estabilidade: quão consistente é o padrão do jogo (0–100) */
  stabilityScore: number;
  /** Variância normalizada da frequência dos números (0–100) */
  varianceScore: number;
  /** Estimativa de chance de divisão do prêmio (0–100%) */
  prizeDivisionRisk: number;
  /** Consistência histórica do padrão (0–100) */
  consistencyScore: number;
  /** Nível de risco: "baixo" | "médio" | "alto" | "muito_alto" */
  riskLevel: "baixo" | "médio" | "alto" | "muito_alto";
  /** Score composto final (0–100, maior = melhor) */
  compositeScore: number;
  /** Detalhamento dos componentes */
  breakdown: RiskBreakdown;
}

export interface RiskBreakdown {
  sumDeviation: number;        // Desvio da soma em relação à média histórica
  parityImbalance: number;     // Desequilíbrio par/ímpar
  sequenceRisk: number;        // Risco de sequências longas
  concentrationRisk: number;   // Concentração em faixa numérica
  popularityRisk: number;      // Risco de ser um jogo "popular"
}

// ─── Utilitários ──────────────────────────────────────────────

function calcMean(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function calcStd(arr: number[], avg: number): number {
  if (arr.length < 2) return 0;
  return Math.sqrt(arr.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / arr.length);
}

// ─── Cálculos de Risco ────────────────────────────────────────

/**
 * Risco de soma: quanto o jogo diverge da soma média histórica.
 */
function sumDeviationRisk(
  numbers: number[],
  historicalAvgSum: number,
): number {
  const sum = numbers.reduce((a, b) => a + b, 0);
  const deviation = Math.abs(sum - historicalAvgSum);
  const relDeviation = historicalAvgSum > 0 ? deviation / historicalAvgSum : 0;
  return Math.min(100, Math.round(relDeviation * 150));
}

/**
 * Risco de desequilíbrio par/ímpar.
 */
function parityRisk(numbers: number[], avgEvens: number): number {
  const evens = numbers.filter(n => n % 2 === 0).length;
  const deviation = Math.abs(evens - avgEvens);
  return Math.min(100, Math.round(deviation * 25));
}

/**
 * Risco de sequências longas.
 */
function sequenceRisk(numbers: number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b);
  let maxSeq = 1;
  let cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      cur++;
      maxSeq = Math.max(maxSeq, cur);
    } else cur = 1;
  }
  if (maxSeq <= 2) return 0;
  if (maxSeq === 3) return 15;
  if (maxSeq === 4) return 35;
  return Math.min(100, maxSeq * 15);
}

/**
 * Risco de concentração em faixa numérica.
 */
function concentrationRisk(numbers: number[], totalNumbers: number): number {
  const quadrantSize = Math.ceil(totalNumbers / 4);
  const counts = [0, 0, 0, 0];
  for (const n of numbers) {
    const q = Math.min(3, Math.floor((n - 1) / quadrantSize));
    counts[q]++;
  }
  const maxConc = Math.max(...counts) / numbers.length;
  if (maxConc > 0.75) return 70;
  if (maxConc > 0.60) return 40;
  if (maxConc > 0.50) return 20;
  return 0;
}

/**
 * Risco de popularidade baseado em padrões simples.
 */
function popularityRisk(numbers: number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b);
  let risk = 0;

  // Todos pares ou todos ímpares
  const allEven = sorted.every(n => n % 2 === 0);
  const allOdd = sorted.every(n => n % 2 !== 0);
  if (allEven || allOdd) risk += 30;

  // Múltiplos de 5 em excesso
  const multiplesOf5 = sorted.filter(n => n % 5 === 0).length;
  if (multiplesOf5 >= 3) risk += multiplesOf5 * 8;

  // Números abaixo de 31 em excesso (padrão datas de aniversário)
  const belowThirtyOne = sorted.filter(n => n <= 31).length;
  if (belowThirtyOne / sorted.length > 0.80) risk += 25;

  return Math.min(100, risk);
}

// ─── Função Principal ─────────────────────────────────────────

/**
 * Calcula todas as métricas de risco de um jogo.
 *
 * @param numbers        Números do jogo
 * @param totalNumbers   Universo da modalidade
 * @param historicalAvgSum  Soma média dos sorteios históricos
 * @param avgEvens          Média de pares por sorteio histórico
 * @param frequencyMap      Mapa de frequências históricas
 */
export function computeRiskMetrics(
  numbers: number[],
  totalNumbers: number,
  historicalAvgSum: number,
  avgEvens: number,
  frequencyMap: Record<number, number> = {},
): RiskMetrics {
  const breakdown: RiskBreakdown = {
    sumDeviation:      sumDeviationRisk(numbers, historicalAvgSum),
    parityImbalance:   parityRisk(numbers, avgEvens),
    sequenceRisk:      sequenceRisk(numbers),
    concentrationRisk: concentrationRisk(numbers, totalNumbers),
    popularityRisk:    popularityRisk(numbers),
  };

  // Score de risco geral (média ponderada dos componentes)
  const riskScore = Math.round(
    breakdown.sumDeviation      * 0.25 +
    breakdown.parityImbalance   * 0.15 +
    breakdown.sequenceRisk      * 0.20 +
    breakdown.concentrationRisk * 0.20 +
    breakdown.popularityRisk    * 0.20,
  );

  // Variância de frequências (heterogeneidade do jogo)
  const freqs = numbers.map(n => frequencyMap[n] || 0);
  const freqMean = calcMean(freqs);
  const freqStd = calcStd(freqs, freqMean);
  const maxFreq = Math.max(...Object.values(frequencyMap), 1);
  const varianceScore = Math.min(100, Math.round((freqStd / maxFreq) * 100));

  // Estabilidade: inverso do risco
  const stabilityScore = Math.max(0, 100 - riskScore);

  // Estimativa de divisão: combinação de risco + popularidade
  const prizeDivisionRisk = Math.min(100, Math.round(
    breakdown.popularityRisk * 0.50 +
    breakdown.sumDeviation   * 0.20 +
    breakdown.sequenceRisk   * 0.30,
  ));

  // Consistência: baseada em frequência dos números escolhidos
  const avgFreqRatio = freqMean / maxFreq;
  const consistencyScore = Math.round(avgFreqRatio * 100);

  // Nível de risco
  let riskLevel: RiskMetrics["riskLevel"];
  if (riskScore < 20) riskLevel = "baixo";
  else if (riskScore < 45) riskLevel = "médio";
  else if (riskScore < 70) riskLevel = "alto";
  else riskLevel = "muito_alto";

  // Score composto (maior = melhor): premia estabilidade e consistência
  const compositeScore = Math.round(
    stabilityScore   * 0.40 +
    consistencyScore * 0.30 +
    (100 - varianceScore) * 0.15 +
    (100 - prizeDivisionRisk) * 0.15,
  );

  return {
    riskScore,
    stabilityScore,
    varianceScore,
    prizeDivisionRisk,
    consistencyScore,
    riskLevel,
    compositeScore,
    breakdown,
  };
}

/**
 * Calcula o score de risco de forma simplificada (0–100, maior = melhor).
 * Wrapper conveniente para uso no pipeline.
 */
export function riskScore(
  numbers: number[],
  totalNumbers: number,
  avgSum: number,
  avgEvens: number,
  frequencyMap: Record<number, number>,
): number {
  return computeRiskMetrics(numbers, totalNumbers, avgSum, avgEvens, frequencyMap).compositeScore;
}
