// ============================================================
//  Entropy Engine — Análise de Dispersão e Entropia
//  Mede quão "aleatório" é um jogo em relação ao espaço
//  estatístico histórico. Jogos com alta entropia são menos
//  previsíveis e menos populares — desejável.
// ============================================================

// ─── Tipos ────────────────────────────────────────────────────

export interface EntropyAnalysis {
  /** Entropia de Shannon normalizada do jogo (0–100) */
  shannonEntropy: number;
  /** Entropia relativa ao espaço histórico (0–100) */
  relativeEntropy: number;
  /** Score de dispersão numérica (0–100) */
  dispersionScore: number;
  /** Coeficiente de variação dos números (0–100) */
  variationCoeff: number;
  /** Score final de entropia (0–100) */
  entropyScore: number;
  /** Classificação: "alta" | "média" | "baixa" */
  entropyLevel: "alta" | "média" | "baixa";
  /** Interpretação em português */
  interpretation: string;
}

export interface EntropyEngineConfig {
  /** Peso da entropia de Shannon */
  shannonWeight: number;
  /** Peso da dispersão */
  dispersionWeight: number;
  /** Peso da variação */
  variationWeight: number;
}

const DEFAULT_CONFIG: EntropyEngineConfig = {
  shannonWeight:    0.40,
  dispersionWeight: 0.35,
  variationWeight:  0.25,
};

// ─── Cálculos de Entropia ─────────────────────────────────────

/**
 * Entropia de Shannon de um jogo em relação à distribuição histórica.
 * H = -Σ p(x) * log2(p(x))
 * Normalizada para [0, 100] onde 100 = distribuição mais uniforme.
 */
function computeShannonEntropy(
  numbers: number[],
  frequencyMap: Record<number, number>,
  totalNumbers: number,
): number {
  const totalFreq = Object.values(frequencyMap).reduce((a, b) => a + b, 0);
  if (totalFreq === 0) return 50;

  let entropy = 0;
  for (const n of numbers) {
    const freq = frequencyMap[n] || 0;
    if (freq === 0) continue;
    const p = freq / totalFreq;
    entropy -= p * Math.log2(p);
  }

  const maxEntropy = Math.log2(totalNumbers);
  return maxEntropy > 0 ? Math.min(100, Math.round((entropy / maxEntropy) * 100)) : 50;
}

/**
 * Score de dispersão: mede quão bem distribuídos estão os números
 * ao longo do universo.
 */
function computeDispersionScore(numbers: number[], totalNumbers: number): number {
  if (numbers.length === 0) return 0;

  const sorted = [...numbers].sort((a, b) => a - b);
  const n = sorted.length;

  // Gaps entre números consecutivos
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(sorted[i] - sorted[i - 1]);
  }
  // Gap inicial e final
  gaps.unshift(sorted[0] - 1);
  gaps.push(totalNumbers - sorted[sorted.length - 1]);

  const expectedGap = totalNumbers / (n + 1);
  const gapMean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const gapVariance = gaps.reduce((s, g) => s + Math.pow(g - gapMean, 2), 0) / gaps.length;
  const gapStd = Math.sqrt(gapVariance);

  const uniformityScore = Math.max(0, 1 - gapStd / Math.max(expectedGap, 1));
  return Math.round(uniformityScore * 100);
}

/**
 * Coeficiente de variação dos números do jogo.
 * Baixo CV = números concentrados; Alto CV = mais dispersos.
 */
function computeVariationCoefficient(numbers: number[]): number {
  if (numbers.length === 0) return 0;

  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  if (mean === 0) return 0;

  const variance = numbers.reduce((s, n) => s + Math.pow(n - mean, 2), 0) / numbers.length;
  const std = Math.sqrt(variance);
  const cv = std / mean;

  return Math.min(100, Math.round(cv * 100));
}

// ─── Função Principal ─────────────────────────────────────────

/**
 * Analisa a entropia de um jogo.
 *
 * @param numbers       Números do jogo
 * @param frequencyMap  Mapa de frequências históricas
 * @param totalNumbers  Universo da modalidade
 * @param config        Configuração de pesos (opcional)
 */
export function analyzeEntropy(
  numbers: number[],
  frequencyMap: Record<number, number>,
  totalNumbers: number,
  config: EntropyEngineConfig = DEFAULT_CONFIG,
): EntropyAnalysis {
  const shannonEntropy  = computeShannonEntropy(numbers, frequencyMap, totalNumbers);
  const dispersionScore = computeDispersionScore(numbers, totalNumbers);
  const variationCoeff  = computeVariationCoefficient(numbers);

  // Entropia relativa: quão diferente da distribuição uniforme
  const uniformFreq = Object.keys(frequencyMap).length > 0
    ? Object.values(frequencyMap).reduce((a, b) => a + b, 0) / Object.keys(frequencyMap).length
    : 1;
  const maxDeviation = numbers.length > 0
    ? numbers.reduce((s, n) => s + Math.abs((frequencyMap[n] || 0) - uniformFreq), 0) / numbers.length / Math.max(uniformFreq, 1)
    : 0;
  const relativeEntropy = Math.round(Math.max(0, (1 - maxDeviation)) * 100);

  // Score final ponderado
  const totalW = config.shannonWeight + config.dispersionWeight + config.variationWeight;
  const entropyScore = Math.round(
    (shannonEntropy  * config.shannonWeight    +
     dispersionScore * config.dispersionWeight +
     variationCoeff  * config.variationWeight) / totalW,
  );

  let entropyLevel: EntropyAnalysis["entropyLevel"];
  let interpretation: string;

  if (entropyScore >= 65) {
    entropyLevel = "alta";
    interpretation = "Jogo com alta diversidade estatística — menos provável de ser escolhido por outros apostadores.";
  } else if (entropyScore >= 40) {
    entropyLevel = "média";
    interpretation = "Jogo com dispersão moderada — equilíbrio entre padrão e aleatoriedade.";
  } else {
    entropyLevel = "baixa";
    interpretation = "Jogo com concentração numérica — pode ser mais popular entre apostadores.";
  }

  return {
    shannonEntropy,
    relativeEntropy,
    dispersionScore,
    variationCoeff,
    entropyScore,
    entropyLevel,
    interpretation,
  };
}

/**
 * Calcula entropia de um conjunto de sorteios históricos.
 * Útil para entender o perfil de aleatoriedade da modalidade.
 */
export function analyzeHistoricalEntropy(
  draws: number[][],
  totalNumbers: number,
): { avgEntropy: number; entropyStd: number; profile: string } {
  if (draws.length === 0) return { avgEntropy: 50, entropyStd: 0, profile: "indeterminado" };

  const freqMap: Record<number, number> = {};
  for (const draw of draws) {
    for (const n of draw) freqMap[n] = (freqMap[n] || 0) + 1;
  }

  const entropies = draws.map(d => computeDispersionScore(d, totalNumbers));
  const avg = entropies.reduce((a, b) => a + b, 0) / entropies.length;
  const std = Math.sqrt(entropies.reduce((s, e) => s + Math.pow(e - avg, 2), 0) / entropies.length);

  let profile: string;
  if (avg >= 65) profile = "altamente aleatório";
  else if (avg >= 45) profile = "moderadamente aleatório";
  else profile = "concentrado em padrões";

  return {
    avgEntropy: Math.round(avg),
    entropyStd: Math.round(std),
    profile,
  };
}
