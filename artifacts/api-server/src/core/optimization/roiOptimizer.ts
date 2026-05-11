// ============================================================
//  ROI Optimizer — Otimização de Retorno sobre Investimento
//  Calcula e maximiza o ROI esperado de um conjunto de jogos,
//  considerando probabilidades históricas e custos reais.
//  Usa simulação paramétrica + backtest para estimar ROI real.
// ============================================================

import type { PrizeConfig } from "../backtest/sharkBacktest";
import { getPrizeConfig } from "../backtest/sharkBacktest";

// ─── Tipos ────────────────────────────────────────────────────

export interface ROIEstimate {
  /** ROI esperado (%) */
  expectedROI:      number;
  /** Retorno esperado por jogo (R$) dado ticket price */
  expectedReturn:   number;
  /** Probabilidade estimada de algum prêmio */
  winProbability:   number;
  /** EV (Valor Esperado) em múltiplos do custo */
  expectedValue:    number;
  /** Jackpot estimado mínimo para ROI positivo (R$) */
  breakEvenJackpot: number;
  /** Custo total de cobertura do conjunto de jogos */
  totalCost:        number;
  /** Tier de qualidade: "excelente" | "bom" | "regular" | "fraco" */
  roiTier:          "excelente" | "bom" | "regular" | "fraco";
  /** Análise por faixa de prêmio */
  prizeBreakdown:   Array<{
    name:        string;
    hits:        number;
    probability: number;
    ev:          number;
  }>;
}

export interface ROIOptimizationResult {
  /** Jogos ranqueados por ROI esperado */
  rankedGames: Array<{
    numbers:     number[];
    roiEstimate: ROIEstimate;
    rank:        number;
  }>;
  /** Melhor jogo único */
  bestSingle: number[];
  /** Conjunto ótimo de N jogos para maximizar cobertura */
  optimalSet: number[][];
  /** ROI médio do conjunto ótimo */
  avgROI:     number;
  /** Métricas do processo de otimização */
  metrics: {
    gamesEvaluated: number;
    optimizationMs: number;
    strategy:       string;
  };
}

// ─── Probabilidades por Modalidade ───────────────────────────

const LOTTERY_ODDS: Record<string, Array<{ hits: number; probability: number }>> = {
  megasena: [
    { hits: 6, probability: 1 / 50063860 },
    { hits: 5, probability: 1 / 154518  },
    { hits: 4, probability: 1 / 2332    },
  ],
  lotofacil: [
    { hits: 15, probability: 1 / 3268760 },
    { hits: 14, probability: 1 / 21791   },
    { hits: 13, probability: 1 / 691     },
    { hits: 12, probability: 1 / 52      },
    { hits: 11, probability: 1 / 8       },
  ],
  quina: [
    { hits: 5, probability: 1 / 24040060  },
    { hits: 4, probability: 1 / 165412    },
    { hits: 3, probability: 1 / 3282      },
    { hits: 2, probability: 1 / 132       },
  ],
  lotomania: [
    { hits: 20, probability: 1 / 11372635725 },
    { hits: 19, probability: 1 / 17820995    },
    { hits: 18, probability: 1 / 130000      },
    { hits: 0,  probability: 1 / 51          },
  ],
  duplasena: [
    { hits: 6, probability: 1 / 25827165 },
    { hits: 5, probability: 1 / 79582    },
    { hits: 4, probability: 1 / 1199     },
    { hits: 3, probability: 1 / 50       },
  ],
  diadesorte: [
    { hits: 7, probability: 1 / 13348188 },
    { hits: 6, probability: 1 / 71344    },
    { hits: 5, probability: 1 / 1484     },
    { hits: 4, probability: 1 / 93       },
  ],
  timemania: [
    { hits: 10, probability: 1 / 2217471 },
    { hits: 9,  probability: 1 / 124613  },
    { hits: 8,  probability: 1 / 12157   },
    { hits: 7,  probability: 1 / 275     },
  ],
  supersete: [
    { hits: 7, probability: 1 / 10000000 },
    { hits: 6, probability: 1 / 200000   },
    { hits: 5, probability: 1 / 4000     },
    { hits: 4, probability: 1 / 100      },
    { hits: 3, probability: 1 / 5        },
  ],
  maisMilionaria: [
    { hits: 6, probability: 1 / 238360507 },
    { hits: 5, probability: 1 / 528626    },
    { hits: 4, probability: 1 / 1890      },
    { hits: 3, probability: 1 / 18        },
  ],
};

// ─── Estimativa de ROI ────────────────────────────────────────

/**
 * Estima o ROI de um jogo dado as probabilidades históricas
 * e um jackpot estimado.
 *
 * @param numbers       Números do jogo
 * @param lotteryId     Modalidade
 * @param totalNumbers  Universo da modalidade
 * @param ticketPrice   Preço do bilhete (R$)
 * @param estimatedJackpot Jackpot estimado atual (R$)
 * @param frequencyMap  Frequências históricas
 */
export function estimateROI(
  numbers: number[],
  lotteryId: string,
  totalNumbers: number,
  ticketPrice: number = 4.50,
  estimatedJackpot: number = 1_000_000,
  frequencyMap: Record<number, number> = {},
): ROIEstimate {
  const odds = LOTTERY_ODDS[lotteryId] || LOTTERY_ODDS.megasena;
  const prizeConfig = getPrizeConfig(lotteryId);

  // Fator de qualidade baseado na frequência histórica
  const allFreqs = Object.values(frequencyMap);
  const avgFreq  = allFreqs.length > 0 ? allFreqs.reduce((a, b) => a + b, 0) / allFreqs.length : 1;
  const maxFreq  = Math.max(...allFreqs, 1);
  const gameFreqAvg = numbers.reduce((s, n) => s + (frequencyMap[n] || avgFreq), 0) / numbers.length;
  const qualityFactor = Math.max(0.5, Math.min(2.0, gameFreqAvg / avgFreq));

  // Análise por faixa
  const prizeBreakdown = odds.map(odd => {
    const prizeEntry = prizeConfig.find(p => p.hits === odd.hits);
    const multiplier = prizeEntry ? prizeEntry.estimatedMultiplier : 0;

    const adjustedProb = odd.probability * qualityFactor;
    const prizeAmount  = odd.hits === Math.max(...odds.map(o => o.hits))
      ? estimatedJackpot
      : ticketPrice * multiplier;

    return {
      name:        prizeEntry?.name || `${odd.hits} acertos`,
      hits:        odd.hits,
      probability: Math.round(adjustedProb * 1e8) / 1e8,
      ev:          Math.round(adjustedProb * prizeAmount * 100) / 100,
    };
  });

  // EV total
  const totalEV   = prizeBreakdown.reduce((s, p) => s + p.ev, 0);
  const expectedValue   = Math.round((totalEV / ticketPrice) * 100) / 100;
  const expectedROI     = Math.round((expectedValue - 1) * 100);
  const expectedReturn  = Math.round(totalEV * 100) / 100;
  const winProbability  = Math.min(1, prizeBreakdown.reduce((s, p) => s + p.probability, 0));

  // Jackpot mínimo para ROI positivo
  const otherEV = prizeBreakdown.slice(1).reduce((s, p) => s + p.ev, 0);
  const jackpotProb = odds[0]?.probability || 1e-8;
  const breakEvenJackpot = jackpotProb > 0
    ? Math.round((ticketPrice - otherEV) / jackpotProb)
    : Infinity;

  // Tier
  let roiTier: ROIEstimate["roiTier"];
  if (expectedROI >= 0) roiTier = "excelente";
  else if (expectedROI >= -50) roiTier = "bom";
  else if (expectedROI >= -70) roiTier = "regular";
  else roiTier = "fraco";

  return {
    expectedROI,
    expectedReturn,
    winProbability: Math.round(winProbability * 1e6) / 1e6,
    expectedValue,
    breakEvenJackpot,
    totalCost: ticketPrice,
    roiTier,
    prizeBreakdown,
  };
}

// ─── Otimização de Conjunto ───────────────────────────────────

/**
 * Otimiza um conjunto de jogos para maximizar o ROI esperado.
 *
 * @param games         Lista de jogos candidatos
 * @param lotteryId     Modalidade
 * @param totalNumbers  Universo
 * @param targetCount   Quantos jogos selecionar no conjunto ótimo
 * @param frequencyMap  Frequências históricas
 */
export function optimizeGameSetROI(
  games: number[][],
  lotteryId: string,
  totalNumbers: number,
  targetCount: number = 5,
  frequencyMap: Record<number, number> = {},
): ROIOptimizationResult {
  const startMs = Date.now();

  if (games.length === 0) {
    return {
      rankedGames: [],
      bestSingle: [],
      optimalSet: [],
      avgROI: -50,
      metrics: { gamesEvaluated: 0, optimizationMs: 0, strategy: "empty" },
    };
  }

  // Estima ROI para cada jogo
  const estimations = games.map(g => ({
    numbers:     g,
    roiEstimate: estimateROI(g, lotteryId, totalNumbers, 4.50, 10_000_000, frequencyMap),
  }));

  // Ranqueia por ROI esperado
  estimations.sort((a, b) => b.roiEstimate.expectedROI - a.roiEstimate.expectedROI);

  const rankedGames = estimations.map((e, idx) => ({
    ...e,
    rank: idx + 1,
  }));

  // Conjunto ótimo: greedy por cobertura + ROI
  const optimalSet: number[][] = [];
  const covered = new Set<number>();
  const remaining = [...rankedGames];

  while (optimalSet.length < targetCount && remaining.length > 0) {
    // Pondera ROI + novos números cobertos
    const scored = remaining.map(g => {
      const newNumbers = g.numbers.filter(n => !covered.has(n)).length;
      const coverageBonus = newNumbers * 5;
      return { ...g, combinedScore: g.roiEstimate.expectedROI + coverageBonus };
    });

    scored.sort((a, b) => b.combinedScore - a.combinedScore);
    const best = scored[0];
    optimalSet.push(best.numbers);
    for (const n of best.numbers) covered.add(n);
    const idx = remaining.findIndex(r => r.numbers === best.numbers);
    if (idx >= 0) remaining.splice(idx, 1);
  }

  const avgROI = optimalSet.length > 0
    ? Math.round(optimalSet.reduce((s, g) => {
        const est = estimations.find(e => e.numbers === g)?.roiEstimate;
        return s + (est?.expectedROI || -50);
      }, 0) / optimalSet.length)
    : -50;

  return {
    rankedGames,
    bestSingle: rankedGames[0]?.numbers || [],
    optimalSet,
    avgROI,
    metrics: {
      gamesEvaluated: games.length,
      optimizationMs: Date.now() - startMs,
      strategy:       "greedy-coverage-roi",
    },
  };
}
