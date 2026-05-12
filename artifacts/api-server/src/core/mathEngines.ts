// ============================================================
//  Math Engines v2 — Refinamento Matemático Avançado
//  7 novos motores que complementam o pipeline existente
//  Todos são pure functions, sem efeitos colaterais
// ============================================================

// ─── Tipos compartilhados ─────────────────────────────────────

export interface FreqEntry {
  number: number;
  frequency: number;
  delay: number;
  temperature: "hot" | "warm" | "cold";
}

export interface MathEngineResult {
  score: number;
  details: Record<string, number>;
}

// ─── 1. Adaptive Entropy Rebalance ───────────────────────────
// Mede a entropia de Shannon da combinação e penaliza jogos
// com entropia muito baixa (padrões repetitivos) ou muito alta
// (dispersão aleatória sem estrutura).

export function adaptiveEntropyRebalance(
  numbers: number[],
  frequencyMap: Record<number, number>,
  totalNumbers: number,
): MathEngineResult {
  if (numbers.length === 0) return { score: 50, details: {} };

  const totalFreq = Object.values(frequencyMap).reduce((a, b) => a + b, 0) || 1;

  // Distribuição de probabilidade do jogo baseada em frequências históricas
  const probs = numbers.map(n => (frequencyMap[n] || 1) / totalFreq);
  const sum = probs.reduce((a, b) => a + b, 0);
  const normalised = probs.map(p => p / sum);

  // Entropia de Shannon
  const entropy = -normalised.reduce((acc, p) => {
    if (p <= 0) return acc;
    return acc + p * Math.log2(p);
  }, 0);

  const maxEntropy = Math.log2(numbers.length);
  const normEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0; // 0–1

  // Faixa ótima: entropia entre 0.55 e 0.88
  let score: number;
  if (normEntropy >= 0.55 && normEntropy <= 0.88) {
    // Faixa ideal — mapa linear para 80–100
    score = 80 + 20 * ((normEntropy - 0.55) / 0.33);
  } else if (normEntropy < 0.55) {
    // Baixa entropia (muito concentrado)
    score = 40 + 40 * (normEntropy / 0.55);
  } else {
    // Alta demais (puro ruído)
    score = 80 - 30 * ((normEntropy - 0.88) / 0.12);
  }

  score = Math.min(100, Math.max(0, score));

  // Bônus de diversidade de décimos
  const decades = new Set(numbers.map(n => Math.floor((n - 1) / 10)));
  const decadeBonus = Math.min(10, decades.size * 2);
  score = Math.min(100, score + decadeBonus);

  return {
    score,
    details: { normEntropy, decadeSpread: decades.size, rawEntropy: entropy },
  };
}

// ─── 2. Dynamic Pair Pressure ─────────────────────────────────
// Calcula a pressão cumulativa de pares: pares que co-ocorrem
// com frequência anormal geram pressão positiva (padrão forte)
// ou negativa (saturação). O score final reflete a qualidade
// estrutural do jogo como um conjunto coeso.

export function dynamicPairPressure(
  numbers: number[],
  draws: number[][],
  totalNumbers: number,
): MathEngineResult {
  if (numbers.length < 2 || draws.length < 5) {
    return { score: 50, details: { pairsAnalyzed: 0 } };
  }

  const recentWindow = Math.min(draws.length, 30);
  const recentDraws  = draws.slice(-recentWindow);

  // Construir mapa de coocorrência
  const pairCount: Record<string, number> = {};
  for (const draw of recentDraws) {
    const drawSet = draw.sort((a, b) => a - b);
    for (let i = 0; i < drawSet.length; i++) {
      for (let j = i + 1; j < drawSet.length; j++) {
        const key = `${drawSet[i]}-${drawSet[j]}`;
        pairCount[key] = (pairCount[key] || 0) + 1;
      }
    }
  }

  // Avaliar pares no jogo atual
  const sortedNums = [...numbers].sort((a, b) => a - b);
  let totalPressure = 0;
  let pairsAnalyzed = 0;

  for (let i = 0; i < sortedNums.length; i++) {
    for (let j = i + 1; j < sortedNums.length; j++) {
      const key = `${sortedNums[i]}-${sortedNums[j]}`;
      const freq = pairCount[key] || 0;
      // Frequência esperada: recentWindow * C(drawSize, 2) / C(total, 2)
      const avgDrawSize = recentDraws[0]?.length || 6;
      const expected = recentWindow * (avgDrawSize * (avgDrawSize - 1) / 2) /
        (totalNumbers * (totalNumbers - 1) / 2);
      const deviation = (freq - expected) / (expected + 0.1);
      totalPressure += deviation;
      pairsAnalyzed++;
    }
  }

  const avgPressure = pairsAnalyzed > 0 ? totalPressure / pairsAnalyzed : 0;

  // Normalizar: pressão positiva moderada é ideal
  let score: number;
  if (avgPressure >= 0 && avgPressure <= 1.5) {
    score = 60 + 35 * (avgPressure / 1.5);
  } else if (avgPressure > 1.5) {
    // Saturação: pares já muito explorados
    score = 95 - 30 * ((avgPressure - 1.5) / 2);
  } else {
    // Pressão negativa: pares pouco frequentes
    score = 60 + 30 * (avgPressure);
  }

  score = Math.min(100, Math.max(20, score));

  return { score, details: { avgPressure, pairsAnalyzed, recentWindow } };
}

// ─── 3. Smart Mutation Engine ─────────────────────────────────
// Gera mutações controladas num jogo base, retornando o melhor
// mutante. Aplica mutações pontuais trocando números pela média
// de temperatura/atraso, preservando a estrutura do jogo.

export function smartMutationEngine(
  numbers: number[],
  freqEntries: FreqEntry[],
  totalNumbers: number,
  mutationRate = 0.25,
  trials = 8,
): { mutated: number[]; improved: boolean; gain: number } {
  if (numbers.length === 0 || freqEntries.length === 0) {
    return { mutated: numbers, improved: false, gain: 0 };
  }

  const baseScore = scoreMutation(numbers, freqEntries);
  const sortedPool = [...freqEntries].sort((a, b) => {
    const aScore = a.frequency * 0.6 + (totalNumbers - a.delay) * 0.4;
    const bScore = b.frequency * 0.6 + (totalNumbers - b.delay) * 0.4;
    return bScore - aScore;
  });

  const candidates = sortedPool
    .filter(e => !numbers.includes(e.number))
    .slice(0, Math.min(20, sortedPool.length));

  if (candidates.length === 0) return { mutated: numbers, improved: false, gain: 0 };

  const mutationsToApply = Math.max(1, Math.round(numbers.length * mutationRate));
  let bestNumbers = [...numbers];
  let bestScore   = baseScore;

  for (let t = 0; t < trials; t++) {
    const mutated = [...numbers];
    // Escolher posições a mutar (preferência pelos índices com pior score)
    const sorted = [...numbers].map((n, idx) => ({
      idx,
      score: freqEntries.find(e => e.number === n)?.frequency ?? 0,
    })).sort((a, b) => a.score - b.score);

    for (let m = 0; m < mutationsToApply; m++) {
      const pos = sorted[m % sorted.length].idx;
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      if (!mutated.includes(pick.number)) {
        mutated[pos] = pick.number;
      }
    }

    const s = scoreMutation(mutated, freqEntries);
    if (s > bestScore) {
      bestScore   = s;
      bestNumbers = mutated;
    }
  }

  return {
    mutated:  bestNumbers.sort((a, b) => a - b),
    improved: bestScore > baseScore,
    gain:     bestScore - baseScore,
  };
}

function scoreMutation(numbers: number[], freqEntries: FreqEntry[]): number {
  let total = 0;
  for (const n of numbers) {
    const e = freqEntries.find(f => f.number === n);
    if (!e) continue;
    const tempBonus = e.temperature === 'hot' ? 3 : e.temperature === 'warm' ? 1 : 0;
    total += e.frequency + tempBonus;
  }
  return total / numbers.length;
}

// ─── 4. Weighted Trend Resonance ──────────────────────────────
// Compara as tendências recentes (últimos 5 sorteios) contra a
// tendência histórica e pontua o jogo pela ressonância entre os
// números escolhidos e os padrões emergentes.

export function weightedTrendResonance(
  numbers: number[],
  draws: number[][],
  totalNumbers: number,
): MathEngineResult {
  if (numbers.length === 0 || draws.length < 5) {
    return { score: 50, details: {} };
  }

  const recent   = draws.slice(-5);
  const baseline = draws.slice(-Math.min(draws.length, 30));

  // Frequência recente (pesos decrescentes: último sorteio vale mais)
  const recentFreq: Record<number, number> = {};
  recent.forEach((draw, i) => {
    const weight = (i + 1) / recent.length;
    draw.forEach(n => { recentFreq[n] = (recentFreq[n] || 0) + weight; });
  });

  // Frequência base
  const baseFreq: Record<number, number> = {};
  baseline.forEach(draw => {
    draw.forEach(n => { baseFreq[n] = (baseFreq[n] || 0) + 1; });
  });

  const maxRecent  = Math.max(...Object.values(recentFreq), 1);
  const maxBase    = Math.max(...Object.values(baseFreq), 1);

  let resonanceTotal = 0;
  let countInRecent  = 0;

  for (const n of numbers) {
    const rNorm = (recentFreq[n] || 0) / maxRecent;
    const bNorm = (baseFreq[n] || 0) / maxBase;
    // Ressonância: número emergente = alta freq recente e moderada histórica
    const resonance = rNorm * 0.65 + bNorm * 0.35;
    resonanceTotal += resonance;
    if (recentFreq[n] && recentFreq[n] > 0) countInRecent++;
  }

  const avgResonance = resonanceTotal / numbers.length;
  const recentCoverage = countInRecent / numbers.length;

  // Score: ressonância média + bônus de cobertura recente
  const score = Math.min(100, Math.max(0,
    avgResonance * 70 + recentCoverage * 30
  ));

  return {
    score,
    details: { avgResonance, recentCoverage, countInRecent },
  };
}

// ─── 5. Bayesian Reinforcement ────────────────────────────────
// Atualiza probabilidades usando Bayes, incorporando o histórico
// de sorteios como evidência para estimar P(número | sorteio).

export function bayesianReinforcement(
  numbers: number[],
  draws: number[][],
  totalNumbers: number,
): MathEngineResult {
  if (numbers.length === 0 || draws.length < 3) {
    return { score: 50, details: {} };
  }

  const prior = 1 / totalNumbers;
  const likelihood: Record<number, number> = {};

  // P(n aparece | dado o histórico)
  for (let n = 1; n <= totalNumbers; n++) {
    const timesAppeared = draws.filter(d => d.includes(n)).length;
    const likelihood_n = (timesAppeared + 1) / (draws.length + totalNumbers); // Laplace smoothing
    likelihood[n] = likelihood_n;
  }

  // Posterior ∝ prior × likelihood
  const posteriors = Object.fromEntries(
    Object.entries(likelihood).map(([k, v]) => [k, prior * v])
  );
  const posteriorSum = Object.values(posteriors).reduce((a, b) => a + b, 0);

  // Normalizar
  const normPosteriors: Record<number, number> = {};
  for (let n = 1; n <= totalNumbers; n++) {
    normPosteriors[n] = (posteriors[n] || 0) / posteriorSum;
  }

  // Score: média dos posteriors dos números escolhidos vs esperado
  const gameProb = numbers.reduce((acc, n) => acc + (normPosteriors[n] || 0), 0);
  const expectedProb = numbers.length / totalNumbers;
  const lift = gameProb / expectedProb;

  // Normalizar: lift 1.0 = 50, lift 1.5+ = 100, lift < 0.7 = 20
  const score = Math.min(100, Math.max(20,
    50 + (lift - 1.0) * 100
  ));

  return {
    score,
    details: { gameProb, expectedProb, lift },
  };
}

// ─── 6. Structural Dispersion Optimizer ───────────────────────
// Avalia a qualidade da dispersão estrutural do jogo:
// distribuição por décimos, paridade, soma relativa e
// coeficiente de variação.

export function structuralDispersionOptimizer(
  numbers: number[],
  totalNumbers: number,
): MathEngineResult {
  if (numbers.length === 0) return { score: 50, details: {} };

  const n = numbers.length;
  const sorted = [...numbers].sort((a, b) => a - b);

  // 1. Dispersão por décimos
  const decades: Record<number, number> = {};
  sorted.forEach(num => {
    const d = Math.floor((num - 1) / 10);
    decades[d] = (decades[d] || 0) + 1;
  });
  const numDecades   = Math.ceil(totalNumbers / 10);
  const usedDecades  = Object.keys(decades).length;
  const decadeScore  = usedDecades / numDecades;

  // 2. Paridade
  const evens  = sorted.filter(num => num % 2 === 0).length;
  const odds   = n - evens;
  const parityRatio = Math.min(evens, odds) / Math.max(evens, odds, 1);

  // 3. Soma relativa ao intervalo [minPossible, maxPossible]
  const minPossible = sorted.slice(0, n).reduce((a, b) => a + b, 0);
  const maxPossible = Array.from({ length: n }, (_, i) => totalNumbers - i)
    .reduce((a, b) => a + b, 0);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const sumRatio = (sum - minPossible) / (maxPossible - minPossible);

  // Ideal: soma relativa entre 35% e 65%
  const sumScore = sumRatio >= 0.35 && sumRatio <= 0.65
    ? 1.0
    : 1 - 2 * Math.abs(sumRatio - 0.50);

  // 4. Gaps entre números consecutivos
  const gaps = sorted.slice(1).map((v, i) => v - sorted[i]);
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const expectedGap = totalNumbers / n;
  const gapCV = Math.sqrt(
    gaps.reduce((acc, g) => acc + Math.pow(g - avgGap, 2), 0) / gaps.length
  ) / (avgGap || 1);

  // Baixo CV = uniforme (bom), alto CV = irregular
  const gapScore = Math.exp(-gapCV * 0.5);

  const score = Math.min(100, Math.max(0,
    (decadeScore * 30 + parityRatio * 25 + sumScore * 25 + gapScore * 20) * 100
  ));

  return {
    score,
    details: { decadeScore, parityRatio, sumRatio, gapCV, usedDecades },
  };
}

// ─── 7. Collective Coverage Optimizer ─────────────────────────
// Dado um conjunto de jogos, mede o quanto o conjunto cobre
// todo o espaço de números da modalidade e bonifica jogos que
// contribuem mais para cobertura nova (não redundante).

export function collectiveCoverageOptimizer(
  gameSet: number[][],
  totalNumbers: number,
): {
  coverageRatio: number;
  gameContributions: number[];
  redundancyPenalties: number[];
  overallScore: number;
} {
  if (gameSet.length === 0) {
    return { coverageRatio: 0, gameContributions: [], redundancyPenalties: [], overallScore: 0 };
  }

  const globalCovered = new Set<number>();
  const gameContributions: number[] = [];
  const redundancyPenalties: number[] = [];

  for (const game of gameSet) {
    const newNums = game.filter(n => !globalCovered.has(n));
    gameContributions.push(newNums.length / game.length);
    redundancyPenalties.push(1 - newNums.length / game.length);
    newNums.forEach(n => globalCovered.add(n));
  }

  const coverageRatio = globalCovered.size / totalNumbers;
  const avgContrib    = gameContributions.reduce((a, b) => a + b, 0) / gameContributions.length;
  const overallScore  = Math.min(100, (coverageRatio * 60 + avgContrib * 40) * 100);

  return { coverageRatio, gameContributions, redundancyPenalties, overallScore };
}

// ─── Composite Math Score ─────────────────────────────────────
// Combina todos os engines num score único (0–100)

export interface CompositeMathInput {
  numbers: number[];
  draws: number[][];
  freqEntries: FreqEntry[];
  frequencyMap: Record<number, number>;
  totalNumbers: number;
  allGames?: number[][];
}

export function computeCompositeMathScore(input: CompositeMathInput): {
  score: number;
  breakdown: Record<string, number>;
} {
  const { numbers, draws, freqEntries, frequencyMap, totalNumbers } = input;

  const entropy  = adaptiveEntropyRebalance(numbers, frequencyMap, totalNumbers);
  const pairs    = dynamicPairPressure(numbers, draws, totalNumbers);
  const trend    = weightedTrendResonance(numbers, draws, totalNumbers);
  const bayes    = bayesianReinforcement(numbers, draws, totalNumbers);
  const disperse = structuralDispersionOptimizer(numbers, totalNumbers);

  // Pesos de cada engine
  const weights = {
    entropy:    0.18,
    pairs:      0.20,
    trend:      0.22,
    bayes:      0.18,
    dispersion: 0.22,
  };

  const score =
    entropy.score  * weights.entropy  +
    pairs.score    * weights.pairs    +
    trend.score    * weights.trend    +
    bayes.score    * weights.bayes    +
    disperse.score * weights.dispersion;

  return {
    score: Math.min(100, Math.max(0, score)),
    breakdown: {
      adaptiveEntropy:       entropy.score,
      dynamicPairPressure:   pairs.score,
      weightedTrendResonance:trend.score,
      bayesianReinforcement: bayes.score,
      structuralDispersion:  disperse.score,
    },
  };
}
