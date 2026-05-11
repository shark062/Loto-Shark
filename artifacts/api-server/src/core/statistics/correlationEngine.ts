// ============================================================
//  Correlation Engine — Análise de Correlação entre Dezenas
//  Constrói uma matriz de co-ocorrência histórica entre pares
//  de números. Identifica pares fortes (saem juntos) e fracos
//  (raramente juntos). Usa isso para pontuar e filtrar jogos.
// ============================================================

// ─── Tipos ────────────────────────────────────────────────────

export interface PairStats {
  numA:          number;
  numB:          number;
  coOccurrences: number;
  frequency:     number;   // 0–1 (fração dos sorteios em que saíram juntos)
  expected:      number;   // frequência esperada por independência
  liftScore:     number;   // frequência / expected (>1 = correlação positiva)
  strength:      "forte" | "moderada" | "fraca" | "negativa";
}

export interface CorrelationMatrix {
  /** Mapa esparso: numA_numB → PairStats */
  pairs:          Record<string, PairStats>;
  /** Pares mais correlacionados positivamente */
  topPositive:    PairStats[];
  /** Pares mais correlacionados negativamente */
  topNegative:    PairStats[];
  /** Número de sorteios analisados */
  drawsAnalyzed:  number;
  /** Lift médio dos pares */
  avgLift:        number;
}

export interface GameCorrelationScore {
  /** Score de correlação do jogo (0–100) */
  correlationScore: number;
  /** Pares fortes presentes no jogo */
  strongPairsFound: PairStats[];
  /** Soma dos lifts dos pares presentes */
  totalLift: number;
  /** Número de pares analisados */
  pairsAnalyzed: number;
  /** Interpretação */
  interpretation: string;
}

// ─── Construção da Matriz de Correlação ───────────────────────

const pairKey = (a: number, b: number): string =>
  a < b ? `${a}_${b}` : `${b}_${a}`;

/**
 * Constrói a matriz de co-ocorrência a partir dos sorteios históricos.
 *
 * @param draws         Histórico de sorteios (mais recente primeiro)
 * @param totalNumbers  Universo da modalidade
 * @param topN          Quantos pares destacar no topo
 */
export function buildCorrelationMatrix(
  draws: number[][],
  totalNumbers: number,
  topN: number = 20,
): CorrelationMatrix {
  if (draws.length === 0) {
    return { pairs: {}, topPositive: [], topNegative: [], drawsAnalyzed: 0, avgLift: 1 };
  }

  const coOccMap: Record<string, number> = {};
  const freqMap:  Record<number, number> = {};

  for (const draw of draws) {
    for (const n of draw) freqMap[n] = (freqMap[n] || 0) + 1;

    for (let i = 0; i < draw.length; i++) {
      for (let j = i + 1; j < draw.length; j++) {
        const key = pairKey(draw[i], draw[j]);
        coOccMap[key] = (coOccMap[key] || 0) + 1;
      }
    }
  }

  const N = draws.length;
  const pairs: Record<string, PairStats> = {};
  let liftSum = 0;
  let pairCount = 0;

  for (const [key, coOcc] of Object.entries(coOccMap)) {
    const [a, b] = key.split("_").map(Number);
    const freqA = (freqMap[a] || 0) / N;
    const freqB = (freqMap[b] || 0) / N;
    const freqAB = coOcc / N;
    const expected = freqA * freqB;
    const lift = expected > 0 ? freqAB / expected : 1;

    let strength: PairStats["strength"];
    if (lift > 1.5) strength = "forte";
    else if (lift > 1.1) strength = "moderada";
    else if (lift >= 0.9) strength = "fraca";
    else strength = "negativa";

    pairs[key] = { numA: a, numB: b, coOccurrences: coOcc, frequency: freqAB, expected, liftScore: lift, strength };
    liftSum += lift;
    pairCount++;
  }

  const allPairs = Object.values(pairs);
  const topPositive = allPairs
    .filter(p => p.liftScore > 1)
    .sort((a, b) => b.liftScore - a.liftScore)
    .slice(0, topN);
  const topNegative = allPairs
    .filter(p => p.liftScore < 1)
    .sort((a, b) => a.liftScore - b.liftScore)
    .slice(0, topN);

  return {
    pairs,
    topPositive,
    topNegative,
    drawsAnalyzed: N,
    avgLift: pairCount > 0 ? Math.round((liftSum / pairCount) * 100) / 100 : 1,
  };
}

// ─── Score de Correlação por Jogo ─────────────────────────────

/**
 * Avalia o score de correlação de um jogo em relação à matriz histórica.
 * Premia pares com lift alto (co-ocorrência acima do esperado).
 *
 * @param numbers   Números do jogo
 * @param matrix    Matriz de correlação pré-computada
 * @param strategy  "positive" = premia correlação alta; "negative" = premia descorrelação
 */
export function scoreGameCorrelation(
  numbers: number[],
  matrix: CorrelationMatrix,
  strategy: "positive" | "balanced" = "balanced",
): GameCorrelationScore {
  if (numbers.length < 2 || matrix.drawsAnalyzed === 0) {
    return {
      correlationScore: 50,
      strongPairsFound: [],
      totalLift: 0,
      pairsAnalyzed: 0,
      interpretation: "Dados insuficientes para análise de correlação.",
    };
  }

  let totalLift = 0;
  let pairsAnalyzed = 0;
  const strongPairsFound: PairStats[] = [];

  for (let i = 0; i < numbers.length; i++) {
    for (let j = i + 1; j < numbers.length; j++) {
      const key = pairKey(numbers[i], numbers[j]);
      const pair = matrix.pairs[key];
      if (!pair) {
        totalLift += 1; // neutro para pares sem dados
        pairsAnalyzed++;
        continue;
      }

      totalLift += pair.liftScore;
      pairsAnalyzed++;
      if (pair.strength === "forte") strongPairsFound.push(pair);
    }
  }

  const avgLift = pairsAnalyzed > 0 ? totalLift / pairsAnalyzed : 1;

  let correlationScore: number;
  let interpretation: string;

  if (strategy === "positive") {
    correlationScore = Math.min(100, Math.round((avgLift - 0.5) * 100));
    interpretation = avgLift > 1.3
      ? "Pares altamente correlacionados — maior coerência histórica."
      : avgLift > 1
      ? "Correlação moderada — boa coerência com padrões históricos."
      : "Baixa correlação entre os números escolhidos.";
  } else {
    // balanced: premia leve correlação positiva mas penaliza extremos
    const optimalLift = 1.2;
    const deviation = Math.abs(avgLift - optimalLift);
    correlationScore = Math.max(0, Math.round(100 - deviation * 60));
    interpretation = correlationScore >= 70
      ? "Distribuição de correlação equilibrada — boa diversidade interna."
      : correlationScore >= 40
      ? "Correlação moderada com histórico — aceitável."
      : "Correlação desequilibrada — muitos pares raros ou supercomuns.";
  }

  correlationScore = Math.max(0, Math.min(100, correlationScore));

  return {
    correlationScore,
    strongPairsFound: strongPairsFound.slice(0, 5),
    totalLift: Math.round(totalLift * 100) / 100,
    pairsAnalyzed,
    interpretation,
  };
}

/**
 * Retorna os pares mais fortes que um número específico forma historicamente.
 */
export function getStrongestPairs(
  number: number,
  matrix: CorrelationMatrix,
  topN: number = 5,
): PairStats[] {
  return Object.values(matrix.pairs)
    .filter(p => p.numA === number || p.numB === number)
    .sort((a, b) => b.liftScore - a.liftScore)
    .slice(0, topN);
}
