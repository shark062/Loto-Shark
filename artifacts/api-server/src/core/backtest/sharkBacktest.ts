// ============================================================
//  Shark Backtest Profissional — Fase 7
//  ROI, frequência de premiações, acertos por faixa,
//  drawdown, estabilidade e eficiência estatística.
//  Respeita consistência temporal (sem data leakage).
// ============================================================

import { logger } from "../../lib/logger";

// ─── Tipos ────────────────────────────────────────────────────

export interface PrizeConfig {
  hits: number;
  name: string;
  /** Multiplicador de retorno estimado (ex: 2.0 = dobra o apostado) */
  estimatedMultiplier: number;
}

export interface BacktestParams {
  /** Jogos a backtear */
  games: number[][];
  /** Histórico de sorteios (mais recente primeiro, do período de TESTE) */
  testDraws: number[][];
  /** Número de números por jogo */
  pickCount: number;
  /** Configuração de prêmios da modalidade */
  prizeConfig: PrizeConfig[];
  /** Custo de cada jogo (em unidades) */
  costPerGame?: number;
  /** Nome da estratégia */
  strategyName?: string;
}

export interface DrawResult {
  draw: number[];
  hits: number;
  prizeLevel: string;
  multiplier: number;
  profit: number; // positivo = ganho, negativo = perda
}

export interface BacktestResult {
  strategyName: string;
  gamesCount: number;
  drawsTested: number;
  totalCost: number;
  totalReturn: number;
  /** ROI: (retorno - custo) / custo * 100 */
  roi: number;
  /** Drawdown máximo (perda consecutiva máxima em unidades) */
  maxDrawdown: number;
  /** Taxa de jogos que premiaram */
  winRate: number;
  /** Distribuição de acertos */
  hitDistribution: Record<number, number>;
  /** Prêmios por faixa */
  prizeBreakdown: Record<string, number>;
  /** Acertos médios por sorteio */
  avgHitsPerDraw: number;
  /** Score de estabilidade (0–100) — baixo drawdown = estável */
  stabilityScore: number;
  /** Eficiência estatística (0–100) — quão próximo do esperado */
  statisticalEfficiency: number;
  /** Detalhamento por sorteio (limitado a 100 para performance) */
  drawResults: DrawResult[];
  /** Período analisado */
  periodDraws: number;
  /** Execução em ms */
  executionMs: number;
}

// ─── Configurações de Prêmio por Modalidade ──────────────────

const PRIZE_CONFIGS: Record<string, PrizeConfig[]> = {
  megasena: [
    { hits: 6, name: "Sena",   estimatedMultiplier: 50000 },
    { hits: 5, name: "Quina",  estimatedMultiplier: 2000  },
    { hits: 4, name: "Quadra", estimatedMultiplier: 30    },
  ],
  lotofacil: [
    { hits: 15, name: "15 pontos", estimatedMultiplier: 5000  },
    { hits: 14, name: "14 pontos", estimatedMultiplier: 200   },
    { hits: 13, name: "13 pontos", estimatedMultiplier: 30    },
    { hits: 12, name: "12 pontos", estimatedMultiplier: 6     },
    { hits: 11, name: "11 pontos", estimatedMultiplier: 2.5   },
  ],
  quina: [
    { hits: 5, name: "Quina",    estimatedMultiplier: 30000 },
    { hits: 4, name: "Quadra",   estimatedMultiplier: 1000  },
    { hits: 3, name: "Terno",    estimatedMultiplier: 40    },
    { hits: 2, name: "Duque",    estimatedMultiplier: 2     },
  ],
  lotomania: [
    { hits: 20, name: "20 acertos", estimatedMultiplier: 100000 },
    { hits: 19, name: "19 acertos", estimatedMultiplier: 2000   },
    { hits: 18, name: "18 acertos", estimatedMultiplier: 100    },
    { hits: 17, name: "17 acertos", estimatedMultiplier: 20     },
    { hits: 16, name: "16 acertos", estimatedMultiplier: 6      },
    { hits: 0,  name: "0 acertos",  estimatedMultiplier: 3      },
  ],
  duplasena:  [
    { hits: 6, name: "Sena",   estimatedMultiplier: 20000 },
    { hits: 5, name: "Quina",  estimatedMultiplier: 500   },
    { hits: 4, name: "Quadra", estimatedMultiplier: 20    },
    { hits: 3, name: "Terno",  estimatedMultiplier: 2.5   },
  ],
  diadesorte: [
    { hits: 7, name: "7 acertos", estimatedMultiplier: 10000 },
    { hits: 6, name: "6 acertos", estimatedMultiplier: 500   },
    { hits: 5, name: "5 acertos", estimatedMultiplier: 30    },
    { hits: 4, name: "4 acertos", estimatedMultiplier: 4     },
  ],
  timemania:  [
    { hits: 10, name: "10 acertos", estimatedMultiplier: 500000 },
    { hits: 9,  name: "9 acertos",  estimatedMultiplier: 3000   },
    { hits: 8,  name: "8 acertos",  estimatedMultiplier: 200    },
    { hits: 7,  name: "7 acertos",  estimatedMultiplier: 30     },
    { hits: 6,  name: "6 acertos",  estimatedMultiplier: 6      },
    { hits: 5,  name: "5 acertos",  estimatedMultiplier: 2      },
  ],
  supersete:  [
    { hits: 7, name: "7 acertos", estimatedMultiplier: 100000 },
    { hits: 6, name: "6 acertos", estimatedMultiplier: 3000   },
    { hits: 5, name: "5 acertos", estimatedMultiplier: 100    },
    { hits: 4, name: "4 acertos", estimatedMultiplier: 5      },
    { hits: 3, name: "3 acertos", estimatedMultiplier: 2      },
  ],
};

export function getPrizeConfig(lotteryId: string): PrizeConfig[] {
  return PRIZE_CONFIGS[lotteryId] || PRIZE_CONFIGS.megasena;
}

// ─── Backtest Principal ───────────────────────────────────────

/**
 * Executa backtest profissional de um conjunto de jogos.
 */
export function runBacktest(params: BacktestParams): BacktestResult {
  const startMs = Date.now();
  const {
    games,
    testDraws,
    pickCount,
    prizeConfig,
    costPerGame = 1,
    strategyName = "unknown",
  } = params;

  if (games.length === 0 || testDraws.length === 0) {
    return buildEmptyResult(strategyName, games.length, testDraws.length, Date.now() - startMs);
  }

  const hitDistribution: Record<number, number> = {};
  const prizeBreakdown: Record<string, number> = {};
  const drawResults: DrawResult[] = [];

  let totalReturn = 0;
  let totalCost = 0;
  let drawdown = 0;
  let maxDrawdown = 0;
  let totalHits = 0;
  let winCount = 0;

  for (let di = 0; di < testDraws.length; di++) {
    const draw = testDraws[di];
    const drawSet = new Set(draw);

    for (const game of games) {
      const hits = game.filter(n => drawSet.has(n)).length;
      totalHits += hits;
      hitDistribution[hits] = (hitDistribution[hits] || 0) + 1;

      // Encontra o maior prêmio que se aplica
      const prize = prizeConfig
        .filter(p => p.hits <= hits)
        .sort((a, b) => b.hits - a.hits)[0];

      const multiplier = prize ? prize.estimatedMultiplier : 0;
      const prizeName = prize ? prize.name : "Sem prêmio";
      const grossReturn = multiplier * costPerGame;
      const netProfit = grossReturn - costPerGame;

      totalReturn += grossReturn;
      totalCost   += costPerGame;

      if (grossReturn > costPerGame) {
        winCount++;
        prizeBreakdown[prizeName] = (prizeBreakdown[prizeName] || 0) + 1;
        drawdown = 0; // reset drawdown
      } else {
        drawdown += costPerGame - grossReturn;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }

      if (di < 100) { // limita detalhamento a 100 sorteios
        drawResults.push({ draw, hits, prizeLevel: prizeName, multiplier, profit: netProfit });
      }
    }
  }

  const totalChecks = testDraws.length * games.length;
  const roi = totalCost > 0 ? Math.round(((totalReturn - totalCost) / totalCost) * 10000) / 100 : 0;
  const winRate = totalChecks > 0 ? Math.round((winCount / totalChecks) * 10000) / 100 : 0;
  const avgHitsPerDraw = totalChecks > 0 ? Math.round((totalHits / totalChecks) * 100) / 100 : 0;

  // Estabilidade: inversamente proporcional ao drawdown normalizado
  const drawdownNorm = totalCost > 0 ? maxDrawdown / totalCost : 0;
  const stabilityScore = Math.max(0, Math.round((1 - Math.min(1, drawdownNorm)) * 100));

  // Eficiência estatística: quão próximo o hit rate está do esperado teoricamente
  const expectedHitRate = pickCount / (testDraws[0]?.length || pickCount);
  const actualHitRate = avgHitsPerDraw / pickCount;
  const efficiency = Math.round(Math.max(0, 100 - Math.abs(actualHitRate - expectedHitRate) * 500));

  logger.info(
    { strategyName, drawsTested: testDraws.length, roi, stabilityScore, executionMs: Date.now() - startMs },
    "[SharkBacktest] Backtest concluído",
  );

  return {
    strategyName,
    gamesCount: games.length,
    drawsTested: testDraws.length,
    totalCost,
    totalReturn,
    roi,
    maxDrawdown,
    winRate,
    hitDistribution,
    prizeBreakdown,
    avgHitsPerDraw,
    stabilityScore,
    statisticalEfficiency: efficiency,
    drawResults,
    periodDraws: testDraws.length,
    executionMs: Date.now() - startMs,
  };
}

function buildEmptyResult(
  strategyName: string,
  gamesCount: number,
  drawsTested: number,
  executionMs: number,
): BacktestResult {
  return {
    strategyName, gamesCount, drawsTested,
    totalCost: 0, totalReturn: 0, roi: 0,
    maxDrawdown: 0, winRate: 0, hitDistribution: {},
    prizeBreakdown: {}, avgHitsPerDraw: 0,
    stabilityScore: 0, statisticalEfficiency: 0,
    drawResults: [], periodDraws: drawsTested,
    executionMs,
  };
}

/**
 * Backtest histórico completo com suporte a janela temporal.
 * Usa os primeiros N% como treino, o restante como teste.
 *
 * @param games        Jogos a avaliar
 * @param allDraws     Todo o histórico disponível (mais recente primeiro)
 * @param lotteryId    Modalidade
 * @param trainRatio   Fração do histórico usado como treino (padrão 0.7)
 */
export function runHistoricalSimulation(
  games: number[][],
  allDraws: number[][],
  lotteryId: string,
  trainRatio: number = 0.7,
): BacktestResult {
  if (allDraws.length < 10) {
    return buildEmptyResult("historical", games.length, 0, 0);
  }

  // Histórico mais recente = início do array. Treino = mais antigos (final do array)
  const splitIdx = Math.floor(allDraws.length * (1 - trainRatio));
  const testDraws = allDraws.slice(0, Math.max(1, splitIdx)); // mais recentes = teste

  const prizeConfig = getPrizeConfig(lotteryId);
  const pickCount = games[0]?.length || 6;

  return runBacktest({
    games,
    testDraws,
    pickCount,
    prizeConfig,
    strategyName: `historical-${lotteryId}`,
  });
}
