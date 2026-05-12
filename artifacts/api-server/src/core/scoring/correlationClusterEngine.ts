// ============================================================
//  Correlation Cluster Engine — Motor de Correlação em Clusters
//  Identifica pares e trios de números que saem juntos com
//  frequência acima da esperada (co-ocorrência estatística).
//  Usa qui-quadrado para testar significância da correlação.
// ============================================================

export interface PairCorrelation {
  pair: [number, number];
  observed: number;    // co-ocorrências observadas
  expected: number;    // co-ocorrências esperadas por acaso
  ratio: number;       // observed/expected (>1 = correlação positiva)
  chiSquared: number;
  significant: boolean; // p < 0.05
  strength: "strong" | "moderate" | "weak";
}

export interface NumberCluster {
  numbers: number[];
  avgCorrelation: number;  // 0–1
  clusterScore: number;    // 0–100
  type: "synergy" | "neutral" | "anti";
}

export interface CorrelationClusterResult {
  topPairs: PairCorrelation[];       // Top 20 pares correlacionados positivamente
  antiPairs: PairCorrelation[];      // Top 10 pares que raramente saem juntos
  clusters: NumberCluster[];         // Clusters detectados
  gameCorrelationScore: number;      // Score de correlação de um jogo específico
}

/**
 * Calcula correlação entre pares de números nos sorteios históricos.
 * Usa o índice de co-ocorrência normalizado.
 */
export function computeCorrelationClusters(
  draws: number[][],
  totalNumbers: number,
  minNumbers: number,
  topK = 20
): CorrelationClusterResult {
  const N = draws.length;
  if (N < 10) {
    return { topPairs: [], antiPairs: [], clusters: [], gameCorrelationScore: 50 };
  }

  // Contagem de co-ocorrências
  const coOccurrence = new Map<string, number>();
  const singleCount = new Map<number, number>();

  for (const draw of draws) {
    for (const n of draw) {
      singleCount.set(n, (singleCount.get(n) || 0) + 1);
    }
    for (let i = 0; i < draw.length; i++) {
      for (let j = i + 1; j < draw.length; j++) {
        const key = `${Math.min(draw[i], draw[j])},${Math.max(draw[i], draw[j])}`;
        coOccurrence.set(key, (coOccurrence.get(key) || 0) + 1);
      }
    }
  }

  // Calcula pares significativos (entre os top 60% por frequência)
  const pairStats: PairCorrelation[] = [];
  const pFreq = minNumbers / totalNumbers; // prob individual

  for (const [key, obs] of coOccurrence.entries()) {
    const [a, b] = key.split(",").map(Number);
    const pA = (singleCount.get(a) || 0) / N;
    const pB = (singleCount.get(b) || 0) / N;
    const exp = pA * pB * N;
    const ratio = exp > 0 ? obs / exp : 1;

    // Qui-quadrado simplificado
    const chi = exp > 0 ? Math.pow(obs - exp, 2) / exp : 0;
    const significant = chi > 3.84; // p < 0.05 (1 df)

    let strength: PairCorrelation["strength"] = "weak";
    if (ratio > 1.3) strength = "strong";
    else if (ratio > 1.1) strength = "moderate";

    pairStats.push({
      pair: [a, b],
      observed: obs,
      expected: parseFloat(exp.toFixed(1)),
      ratio: parseFloat(ratio.toFixed(2)),
      chiSquared: parseFloat(chi.toFixed(2)),
      significant,
      strength,
    });
  }

  pairStats.sort((a, b) => b.ratio - a.ratio);
  const topPairs = pairStats.filter(p => p.ratio > 1).slice(0, topK);
  const antiPairs = pairStats.filter(p => p.ratio < 0.8).sort((a, b) => a.ratio - b.ratio).slice(0, 10);

  // Constrói clusters simples: agrupa números altamente correlacionados
  const clusters: NumberCluster[] = [];
  const used = new Set<number>();

  for (const p of topPairs.slice(0, 30)) {
    const [a, b] = p.pair;
    if (used.has(a) || used.has(b)) continue;
    const related = topPairs
      .filter(q => (q.pair[0] === a || q.pair[1] === a) && q.ratio > 1.1)
      .map(q => (q.pair[0] === a ? q.pair[1] : q.pair[0]))
      .slice(0, 3);

    const clusterNums = [a, b, ...related].slice(0, 5);
    clusterNums.forEach(n => used.add(n));

    const avgCorr = topPairs
      .filter(q => clusterNums.includes(q.pair[0]) && clusterNums.includes(q.pair[1]))
      .reduce((s, q) => s + q.ratio, 0) / Math.max(1, clusterNums.length);

    clusters.push({
      numbers: clusterNums.sort((a, b) => a - b),
      avgCorrelation: parseFloat(avgCorr.toFixed(2)),
      clusterScore: Math.min(100, Math.round(avgCorr * 50)),
      type: avgCorr > 1.1 ? "synergy" : "neutral",
    });
  }

  return {
    topPairs,
    antiPairs,
    clusters: clusters.slice(0, 8),
    gameCorrelationScore: 50,
  };
}

/**
 * Pontua um jogo específico com base nos clusters e correlações detectados.
 */
export function scoreGameByCorrelation(
  gameNumbers: number[],
  clusters: CorrelationClusterResult
): number {
  let score = 50;

  // Bônus por pares correlacionados presentes
  for (const p of clusters.topPairs.slice(0, 20)) {
    if (gameNumbers.includes(p.pair[0]) && gameNumbers.includes(p.pair[1])) {
      score += p.ratio > 1.3 ? 4 : 2;
    }
  }

  // Penalidade por pares anti-correlacionados presentes
  for (const p of clusters.antiPairs) {
    if (gameNumbers.includes(p.pair[0]) && gameNumbers.includes(p.pair[1])) {
      score -= 3;
    }
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}
