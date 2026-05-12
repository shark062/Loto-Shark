// ============================================================
//  Sum Distribution Engine — Validação de Soma e Paridade
//  Valida um jogo contra a distribuição histórica de somas
//  e paridade (par/ímpar). Penaliza outliers.
//  Estatística: as somas de jogos reais seguem distribuição
//  aproximadamente normal, e a paridade tende ao equilíbrio.
// ============================================================

export interface SumDistributionResult {
  gameSum: number;
  historicalMean: number;
  historicalStd: number;
  zScore: number;         // desvios padrão da média
  sumScore: number;       // 0–100 (100 = exatamente na média)
  parityScore: number;    // 0–100 (100 = paridade perfeita)
  evenCount: number;
  oddCount: number;
  rangeScore: number;     // 0–100 (avalia se cobre faixas balanceadas)
  compositeScore: number; // 0–100 (média ponderada)
  verdict: "optimal" | "acceptable" | "poor";
}

/**
 * Calcula mean e desvio padrão de uma lista de números.
 */
function stats(values: number[]): { mean: number; std: number } {
  if (values.length === 0) return { mean: 0, std: 1 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  return { mean, std: Math.sqrt(variance) || 1 };
}

/**
 * Avalia a distribuição de soma e paridade de um jogo
 * em relação ao histórico de sorteios reais.
 *
 * @param gameNumbers  Os números do jogo a avaliar
 * @param draws        Histórico de sorteios (mais recente primeiro)
 * @param totalNumbers Universo de números da modalidade
 */
export function evaluateSumDistribution(
  gameNumbers: number[],
  draws: number[][],
  totalNumbers: number
): SumDistributionResult {
  // Calcula soma do jogo
  const gameSum = gameNumbers.reduce((a, b) => a + b, 0);
  const evenCount = gameNumbers.filter(n => n % 2 === 0).length;
  const oddCount = gameNumbers.length - evenCount;

  // Histórico de somas e paridades
  const historicalSums = draws.map(d => d.reduce((a, b) => a + b, 0));
  const { mean: histMean, std: histStd } = stats(historicalSums);

  // Z-score da soma
  const zScore = (gameSum - histMean) / histStd;

  // Sum score: penaliza afastamentos > 1.5 desvios padrão
  const absZ = Math.abs(zScore);
  const sumScore = absZ <= 0.5
    ? 100
    : absZ <= 1.0
    ? Math.round(100 - (absZ - 0.5) * 60)
    : absZ <= 2.0
    ? Math.round(70 - (absZ - 1.0) * 40)
    : Math.max(0, Math.round(30 - (absZ - 2.0) * 15));

  // Paridade histórica média
  const histEvens = draws.map(d => d.filter(n => n % 2 === 0).length);
  const { mean: meanEvens } = stats(histEvens);
  const parityDeviation = Math.abs(evenCount - meanEvens);
  const parityScore = Math.max(0, Math.round(100 - parityDeviation * 20));

  // Range score: avalia se cobre as 4 faixas do universo equitativamente
  // Ex: 1-25 e 26-totalNumbers; 1ª metade vs 2ª metade
  const half = Math.floor(totalNumbers / 2);
  const lowerCount = gameNumbers.filter(n => n <= half).length;
  const upperCount = gameNumbers.length - lowerCount;
  const idealHalf = gameNumbers.length / 2;
  const rangeDeviation = Math.abs(lowerCount - idealHalf) / idealHalf;
  const rangeScore = Math.max(0, Math.round(100 - rangeDeviation * 80));

  // Composite
  const compositeScore = Math.round(
    sumScore * 0.40 + parityScore * 0.30 + rangeScore * 0.30
  );

  const verdict: SumDistributionResult["verdict"] =
    compositeScore >= 70 ? "optimal" :
    compositeScore >= 45 ? "acceptable" :
    "poor";

  return {
    gameSum,
    historicalMean: parseFloat(histMean.toFixed(1)),
    historicalStd: parseFloat(histStd.toFixed(1)),
    zScore: parseFloat(zScore.toFixed(2)),
    sumScore,
    parityScore,
    evenCount,
    oddCount,
    rangeScore,
    compositeScore,
    verdict,
  };
}

/**
 * Filtra/ordena uma lista de jogos candidatos pela qualidade de distribuição.
 */
export function rankGamesByDistribution(
  games: number[][],
  draws: number[][],
  totalNumbers: number
): Array<{ game: number[]; result: SumDistributionResult }> {
  const scored = games.map(g => ({
    game: g,
    result: evaluateSumDistribution(g, draws, totalNumbers),
  }));
  scored.sort((a, b) => b.result.compositeScore - a.result.compositeScore);
  return scored;
}
