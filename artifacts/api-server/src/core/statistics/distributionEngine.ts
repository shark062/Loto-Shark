// ============================================================
//  Distribution Engine — Análise de Distribuição Estatística
//  Avalia paridade, soma, quadrantes, primos, Fibonacci e
//  outros padrões de distribuição dos números de um jogo.
//  Compara com as médias históricas para pontuar.
// ============================================================

// ─── Tipos ────────────────────────────────────────────────────

export interface DistributionProfile {
  /** Total dos números */
  sum: number;
  /** Quantidade de pares */
  evenCount: number;
  /** Quantidade de ímpares */
  oddCount: number;
  /** Contagem por quadrante [Q1, Q2, Q3, Q4] */
  quadrantDist: [number, number, number, number];
  /** Quantidade de primos no jogo */
  primeCount: number;
  /** Quantidade de Fibonacci no jogo */
  fibonacciCount: number;
  /** Dígito raiz médio (soma dos dígitos) */
  avgDigitRoot: number;
  /** Amplitude: max - min */
  range: number;
  /** Média dos números */
  mean: number;
  /** Desvio padrão */
  stdDev: number;
}

export interface DistributionScore {
  /** Score geral de distribuição (0–100) */
  distributionScore: number;
  /** Score de paridade (0–100) */
  parityScore: number;
  /** Score de soma (0–100) */
  sumScore: number;
  /** Score de quadrantes (0–100) */
  quadrantScore: number;
  /** Score de diversidade especial (primos+fib) */
  specialScore: number;
  /** Perfil do jogo */
  profile: DistributionProfile;
  /** Comparação com histórico */
  vsHistorical: {
    sumDeviation:   number;
    evensDeviation: number;
    rangeDeviation: number;
  };
  /** Interpretação em português */
  interpretation: string;
}

export interface HistoricalDistributionStats {
  avgSum:          number;
  stdSum:          number;
  avgEvens:        number;
  stdEvens:        number;
  avgRange:        number;
  stdRange:        number;
  avgPrimes:       number;
  avgFibonacci:    number;
}

// ─── Constantes ───────────────────────────────────────────────

const PRIMES = new Set([
  2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47,
  53, 59, 61, 67, 71, 73, 79, 83, 89, 97,
]);

const FIBONACCI = new Set([
  1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89,
]);

// ─── Funções Auxiliares ───────────────────────────────────────

function digitRoot(n: number): number {
  if (n === 0) return 0;
  const r = n % 9;
  return r === 0 ? 9 : r;
}

function calcStd(arr: number[], avg: number): number {
  if (arr.length < 2) return 0;
  return Math.sqrt(arr.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / arr.length);
}

// ─── Análise de Perfil ────────────────────────────────────────

/**
 * Computa o perfil completo de distribuição de um jogo.
 */
export function computeDistributionProfile(
  numbers: number[],
  totalNumbers: number,
): DistributionProfile {
  if (numbers.length === 0) {
    return { sum: 0, evenCount: 0, oddCount: 0, quadrantDist: [0, 0, 0, 0], primeCount: 0, fibonacciCount: 0, avgDigitRoot: 5, range: 0, mean: 0, stdDev: 0 };
  }

  const sum = numbers.reduce((a, b) => a + b, 0);
  const evenCount = numbers.filter(n => n % 2 === 0).length;
  const oddCount  = numbers.length - evenCount;

  const qSize = Math.ceil(totalNumbers / 4);
  const quadrantDist: [number, number, number, number] = [0, 0, 0, 0];
  for (const n of numbers) {
    const q = Math.min(3, Math.floor((n - 1) / qSize));
    quadrantDist[q]++;
  }

  const primeCount     = numbers.filter(n => PRIMES.has(n)).length;
  const fibonacciCount = numbers.filter(n => FIBONACCI.has(n)).length;

  const digitRoots  = numbers.map(digitRoot);
  const avgDigitRoot = Math.round(digitRoots.reduce((a, b) => a + b, 0) / digitRoots.length);

  const sorted = [...numbers].sort((a, b) => a - b);
  const range = sorted[sorted.length - 1] - sorted[0];
  const mean  = sum / numbers.length;

  const stdDev = Math.round(calcStd(numbers, mean) * 10) / 10;

  return {
    sum, evenCount, oddCount, quadrantDist,
    primeCount, fibonacciCount, avgDigitRoot,
    range, mean: Math.round(mean * 10) / 10, stdDev,
  };
}

/**
 * Computa estatísticas históricas de distribuição a partir dos sorteios.
 */
export function computeHistoricalStats(
  draws: number[][],
  totalNumbers: number,
): HistoricalDistributionStats {
  if (draws.length === 0) {
    const mid = (totalNumbers + 1) / 2;
    return { avgSum: mid * 6, stdSum: 20, avgEvens: 3, stdEvens: 1, avgRange: totalNumbers * 0.7, stdRange: 10, avgPrimes: 2, avgFibonacci: 1 };
  }

  const profiles = draws.map(d => computeDistributionProfile(d, totalNumbers));

  const sums     = profiles.map(p => p.sum);
  const evens    = profiles.map(p => p.evenCount);
  const ranges   = profiles.map(p => p.range);
  const primes   = profiles.map(p => p.primeCount);
  const fibs     = profiles.map(p => p.fibonacciCount);

  const avgSum      = sums.reduce((a, b) => a + b, 0) / sums.length;
  const avgEvens    = evens.reduce((a, b) => a + b, 0) / evens.length;
  const avgRange    = ranges.reduce((a, b) => a + b, 0) / ranges.length;
  const avgPrimes   = primes.reduce((a, b) => a + b, 0) / primes.length;
  const avgFibonacci = fibs.reduce((a, b) => a + b, 0) / fibs.length;

  return {
    avgSum:      Math.round(avgSum),
    stdSum:      Math.round(calcStd(sums, avgSum)),
    avgEvens:    Math.round(avgEvens * 10) / 10,
    stdEvens:    Math.round(calcStd(evens, avgEvens) * 10) / 10,
    avgRange:    Math.round(avgRange),
    stdRange:    Math.round(calcStd(ranges, avgRange)),
    avgPrimes:   Math.round(avgPrimes * 10) / 10,
    avgFibonacci: Math.round(avgFibonacci * 10) / 10,
  };
}

// ─── Score de Distribuição ────────────────────────────────────

/**
 * Pontua a distribuição de um jogo em relação ao histórico.
 *
 * @param numbers    Números do jogo
 * @param historical Estatísticas históricas pré-computadas
 * @param totalNumbers Universo da modalidade
 */
export function scoreDistribution(
  numbers: number[],
  historical: HistoricalDistributionStats,
  totalNumbers: number,
): DistributionScore {
  const profile = computeDistributionProfile(numbers, totalNumbers);
  const n       = numbers.length;

  // Paridade
  const expectedEvens = historical.avgEvens;
  const evenDev = Math.abs(profile.evenCount - expectedEvens);
  const parityScore = Math.max(0, Math.round(100 - (evenDev / Math.max(expectedEvens, 1)) * 80));

  // Soma
  const sumDev = Math.abs(profile.sum - historical.avgSum);
  const sumZScore = historical.stdSum > 0 ? sumDev / historical.stdSum : 0;
  const sumScore = Math.max(0, Math.round(100 - sumZScore * 25));

  // Quadrantes
  const idealPerQuad = n / 4;
  const quadDev = profile.quadrantDist.reduce(
    (s, c) => s + Math.abs(c - idealPerQuad), 0
  ) / n;
  const quadrantScore = Math.max(0, Math.round(100 - quadDev * 80));

  // Especial (primos + fibonacci)
  const totalSpecial = profile.primeCount + profile.fibonacciCount;
  const expectedSpecial = historical.avgPrimes + historical.avgFibonacci;
  const specialDev = Math.abs(totalSpecial - expectedSpecial);
  const specialScore = Math.max(0, Math.round(100 - specialDev * 15));

  // Score final ponderado
  const distributionScore = Math.round(
    parityScore  * 0.30 +
    sumScore     * 0.35 +
    quadrantScore * 0.25 +
    specialScore * 0.10,
  );

  // Comparação com histórico
  const sumDeviation   = Math.round(((profile.sum - historical.avgSum) / Math.max(historical.avgSum, 1)) * 100);
  const evensDeviation = Math.round(profile.evenCount - historical.avgEvens);
  const rangeDeviation = Math.round(profile.range - historical.avgRange);

  let interpretation: string;
  if (distributionScore >= 75) {
    interpretation = "Distribuição excelente — alinhada com padrões históricos vencedores.";
  } else if (distributionScore >= 55) {
    interpretation = "Distribuição adequada — dentro dos parâmetros esperados.";
  } else if (distributionScore >= 35) {
    interpretation = "Distribuição irregular — alguns desvios dos padrões históricos.";
  } else {
    interpretation = "Distribuição atípica — pode ser populares ou impopular demais.";
  }

  return {
    distributionScore,
    parityScore,
    sumScore,
    quadrantScore,
    specialScore,
    profile,
    vsHistorical: { sumDeviation, evensDeviation, rangeDeviation },
    interpretation,
  };
}
