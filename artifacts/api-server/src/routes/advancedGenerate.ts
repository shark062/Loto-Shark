// ============================================================
//  Advanced Generate Route — /api/v2/generate
//  Usa o Master Pipeline completo com todos os 15 módulos.
//  Backward compatible: não altera /api/games/generate.
// ============================================================

import { Router, type Request, type Response } from "express";
import {
  LOTTERIES,
  fetchHistoricalDraws,
  computeFrequencies,
  computeTopPairs,
  getHistoryConfig,
  getLatestContest,
} from "../lib/lotteryData";
import { buildSharkAnalysisContext } from "../lib/aiEnsemble";
import { runMasterPipeline } from "../core/pipeline/masterPipeline";
import { getAuditStats, getRecentAuditEvents } from "../lib/auditLogger";
import { getCacheInfo } from "../lib/statisticsCache";
import { getLearningState, generateLearningReport } from "../core/learning/sharkAutoLearning";
import { runBacktest, getPrizeConfig } from "../core/backtest/sharkBacktest";
import { simulateDrawsAsync } from "../core/simulation/monteCarlo";
import { db, userGamesTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

// Pesos por estratégia (mesmo mapeamento do routes/index.ts para consistência)
const STRATEGY_PESOS: Record<string, { frequencia: number; atraso: number; repeticao: number }> = {
  hot:   { frequencia: 0.70, atraso: 0.15, repeticao: 0.15 },
  cold:  { frequencia: 0.15, atraso: 0.70, repeticao: 0.15 },
  mixed: { frequencia: 0.50, atraso: 0.30, repeticao: 0.20 },
  ai:    { frequencia: 0.40, atraso: 0.40, repeticao: 0.20 },
  shark: { frequencia: 0.50, atraso: 0.30, repeticao: 0.20 },
};

// ─── POST /api/v2/generate ────────────────────────────────────

router.post("/generate", async (req: Request, res: Response) => {
  const {
    lotteryId   = "megasena",
    numbersCount,
    gamesCount   = 1,
    strategy     = "mixed",
    pesos: pesosReq,
    runBacktestFlag = false,
  } = req.body;

  const lottery = LOTTERIES.find(l => l.id === lotteryId) || LOTTERIES[0];
  const pickCount = Math.min(
    Math.max(numbersCount || lottery.minNumbers, lottery.minNumbers),
    lottery.totalNumbers,
  );
  const count = Math.min(Math.max(gamesCount, 1), 50);

  try {
    const { optimal } = getHistoryConfig(lotteryId);
    const draws = await fetchHistoricalDraws(lotteryId, optimal);

    if (draws.length < 5) {
      return res.status(503).json({
        message: `Sorteios insuficientes para ${lottery.displayName}. Aguarde e tente novamente.`,
      });
    }

    const latestContest = getLatestContest(lotteryId);

    // Estatísticas base
    const freqs = computeFrequencies(lottery.totalNumbers, draws);
    const hotNumbers  = freqs.filter(f => f.temperature === "hot").map(f => f.number);
    const coldNumbers = freqs.filter(f => f.temperature === "cold").map(f => f.number);
    const warmNumbers = freqs.filter(f => f.temperature === "warm").map(f => f.number);

    const frequencyMap: Record<number, number> = {};
    for (const f of freqs) frequencyMap[f.number] = f.frequency;

    const delayMap: Record<number, number> = {};
    for (let n = 1; n <= lottery.totalNumbers; n++) {
      const idx = draws.findIndex(d => d.includes(n));
      delayMap[n] = idx === -1 ? draws.length : idx;
    }

    const avgSum   = draws.reduce((s, d) => s + d.reduce((a, b) => a + b, 0), 0) / draws.length;
    const avgEvens = draws.reduce((s, d) => s + d.filter(n => n % 2 === 0).length, 0) / draws.length;

    const pesosEstrategia = STRATEGY_PESOS[strategy] || STRATEGY_PESOS.mixed;
    const pesos = (strategy === "shark" && pesosReq && typeof pesosReq === "object")
      ? {
          frequencia: Math.max(0.05, Math.min(0.90, Number(pesosReq.frequencia) || pesosEstrategia.frequencia)),
          atraso:     Math.max(0.05, Math.min(0.90, Number(pesosReq.atraso)     || pesosEstrategia.atraso)),
          repeticao:  Math.max(0.05, Math.min(0.90, Number(pesosReq.repeticao)  || pesosEstrategia.repeticao)),
        }
      : pesosEstrategia;

    // Constrói contexto Shark (inclui overdueNumbers, topPairs, etc.)
    const baseCtx = {
      lotteryId,
      lotteryName:  lottery.displayName,
      totalNumbers: lottery.totalNumbers,
      minNumbers:   pickCount,
      draws:        draws.map((d, i) => ({ contestNumber: i + 1, numbers: d })),
      hotNumbers,
      coldNumbers,
      warmNumbers,
      frequencyMap,
      avgSum,
      avgEvens,
    };
    const sharkCtx = buildSharkAnalysisContext(baseCtx, draws);

    // Executa o pipeline
    const pipelineResult = await runMasterPipeline({
      lotteryId,
      lotteryName:  lottery.displayName,
      totalNumbers: lottery.totalNumbers,
      minNumbers:   lottery.minNumbers,
      pickCount,
      gamesCount:   count,
      strategy,
      pesos,
      draws,
      latestContest,
      frequencyMap,
      delayMap,
      avgSum,
      avgEvens,
      hotNumbers,
      coldNumbers,
      warmNumbers,
      sharkCtx: sharkCtx as any,
    });

    if (pipelineResult.games.length === 0) {
      return res.status(503).json({ message: "Pipeline não conseguiu gerar jogos. Tente novamente." });
    }

    // Salva os jogos no banco (igual ao /api/games/generate, com contestNumber correto)
    const insertValues = pipelineResult.games.map(g => ({
      lotteryId,
      selectedNumbers: g.numbers,
      strategy,
      confidence: String(g.confidence),
      reasoning:  g.reasoning,
      dataSource: `${draws.length} sorteios reais da Caixa Econômica Federal — Pipeline v2`,
      sharkScore: String(g.sharkScore),
      sharkOrigem: g.sharkOrigem,
      sharkContexto: {
        estrategia:      strategy,
        pesosUsados:     pesos,
        hot:             hotNumbers.slice(0, 12),
        warm:            warmNumbers.slice(0, 10),
        cold:            coldNumbers.slice(0, 10),
        precisionScore:  g.precisionScore,
        precisionComponents: g.precisionComponents,
        riskMetrics:     g.riskMetrics,
        cycleScore:      g.cycleScore,
        popularPatterns: g.popularPatterns,
        diversityScore:  pipelineResult.metrics.diversityScore,
        coverageScore:   pipelineResult.metrics.coverageScore,
        snapshotId:      pipelineResult.snapshotId,
        generationHash:  pipelineResult.generationHash,
        pipelineVersion: "v2",
        filterStats:     pipelineResult.metrics.filterStats,
        sorteiosAnalisados: draws.length,
        backtest:        pipelineResult.backtest || null,
      },
      matches:       0,
      prizeWon:      "0",
      contestNumber: pipelineResult.targetContest,
      status:        "pending",
      hits:          0,
    }));

    const inserted = await db.insert(userGamesTable).values(insertValues).returning();

    const responseGames = inserted.map((g, idx) => ({
      id:             g.id,
      lotteryId:      g.lotteryId,
      selectedNumbers: g.selectedNumbers as number[],
      numbers:        g.selectedNumbers as number[],
      strategy:       g.strategy,
      confidence:     g.confidence ? Number(g.confidence) : undefined,
      reasoning:      g.reasoning,
      dataSource:     g.dataSource,
      sharkScore:     g.sharkScore ? Number(g.sharkScore) : undefined,
      sharkOrigem:    g.sharkOrigem,
      sharkContexto:  g.sharkContexto,
      contestNumber:  g.contestNumber,
      status:         g.status,
      hits:           g.hits,
      createdAt:      g.createdAt.toISOString(),
      // V2 enrichment
      precisionScore: pipelineResult.games[idx]?.precisionScore,
      precisionComponents: pipelineResult.games[idx]?.precisionComponents,
      riskMetrics:    pipelineResult.games[idx]?.riskMetrics,
      cycleScore:     pipelineResult.games[idx]?.cycleScore,
      popularPatterns: pipelineResult.games[idx]?.popularPatterns,
    }));

    res.json({
      games: responseGames,
      pipeline: {
        version:        "v2",
        targetContest:  pipelineResult.targetContest,
        snapshotId:     pipelineResult.snapshotId,
        generationHash: pipelineResult.generationHash,
        executionMs:    pipelineResult.executionMs,
        metrics:        pipelineResult.metrics,
        backtest:       pipelineResult.backtest,
      },
    });
  } catch (err: any) {
    logger.error({ err: err.message, lotteryId }, "[v2/generate] Erro no pipeline");
    res.status(500).json({ message: "Erro no pipeline de geração.", error: err?.message });
  }
});

// ─── POST /api/v2/backtest ────────────────────────────────────

router.post("/backtest", async (req: Request, res: Response) => {
  const {
    lotteryId = "megasena",
    games     = [],
    trainRatio = 0.70,
  } = req.body;

  if (!Array.isArray(games) || games.length === 0) {
    return res.status(400).json({ message: 'Envie o campo "games" com array de jogos (arrays de números).' });
  }

  try {
    const { optimal } = getHistoryConfig(lotteryId);
    const draws = await fetchHistoricalDraws(lotteryId, optimal);

    if (draws.length < 10) {
      return res.status(503).json({ message: "Histórico insuficiente para backtest." });
    }

    const lottery = LOTTERIES.find(l => l.id === lotteryId) || LOTTERIES[0];
    const splitIdx = Math.floor(draws.length * (1 - Math.max(0.1, Math.min(0.9, trainRatio))));
    const testDraws = draws.slice(0, Math.max(1, splitIdx));
    const prizeConfig = getPrizeConfig(lotteryId);

    const { runBacktest } = await import("../core/backtest/sharkBacktest");
    const result = runBacktest({
      games:      games.map((g: any) => Array.isArray(g) ? g : g.numbers || []),
      testDraws,
      pickCount:  lottery.minNumbers,
      prizeConfig,
      strategyName: "custom",
    });

    res.json({
      lotteryId,
      trainRatio,
      drawsTrained: draws.length - testDraws.length,
      ...result,
    });
  } catch (err: any) {
    res.status(500).json({ message: "Erro no backtest.", error: err?.message });
  }
});

// ─── POST /api/v2/monte-carlo ─────────────────────────────────

router.post("/monte-carlo", async (req: Request, res: Response) => {
  const {
    lotteryId   = "megasena",
    simulations = 10000,
    useHistorical = true,
  } = req.body;

  const lottery = LOTTERIES.find(l => l.id === lotteryId);
  if (!lottery) return res.status(404).json({ message: "Loteria não encontrada." });

  try {
    const { optimal } = getHistoryConfig(lotteryId);
    const draws = await fetchHistoricalDraws(lotteryId, Math.min(optimal, 100));

    const freqMap: Record<number, number> = {};
    if (useHistorical && draws.length > 0) {
      const freqs = computeFrequencies(lottery.totalNumbers, draws);
      for (const f of freqs) freqMap[f.number] = f.frequency;
    }

    const result = await simulateDrawsAsync({
      simulations: Math.min(simulations, 50000),
      totalNumbers: lottery.totalNumbers,
      pickCount: lottery.minNumbers,
      useHistoricalProbabilities: useHistorical && draws.length > 0,
      frequencyMap: freqMap,
    });

    res.json({ lotteryId, ...result });
  } catch (err: any) {
    res.status(500).json({ message: "Erro na simulação Monte Carlo.", error: err?.message });
  }
});

// ─── GET /api/v2/learning/:lotteryId ─────────────────────────

router.get("/learning/:lotteryId", (req: Request, res: Response): void => {
  const { lotteryId } = req.params;
  const lottery = LOTTERIES.find(l => l.id === lotteryId);
  if (!lottery) { res.status(404).json({ message: "Loteria não encontrada." }); return; }

  const state  = getLearningState(lotteryId);
  const report = generateLearningReport(lotteryId, lottery.minNumbers);
  res.json({ state, report });
});

// ─── GET /api/v2/audit ────────────────────────────────────────

router.get("/audit", (req: Request, res: Response): void => {
  const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const limit = Math.min(parseInt((limitRaw as string) || "50") || 50, 200);
  const typeRaw = Array.isArray(req.query.type) ? req.query.type[0] : req.query.type;
  const type = typeRaw as string | undefined;

  let events;
  if (type) {
    const { filterAuditEvents } = require("../lib/auditLogger");
    events = filterAuditEvents(type, limit);
  } else {
    events = getRecentAuditEvents(limit);
  }

  res.json({
    events,
    stats: getAuditStats(),
    cacheInfo: getCacheInfo(),
  });
});

// ─── GET /api/v2/risk/:lotteryId ─────────────────────────────

router.get("/risk/:lotteryId", async (req: Request, res: Response): Promise<void> => {
  const { lotteryId } = req.params;
  const lottery = LOTTERIES.find(l => l.id === lotteryId);
  if (!lottery) { res.status(404).json({ message: "Loteria não encontrada." }); return; }

  try {
    const { optimal } = getHistoryConfig(lotteryId);
    const draws = await fetchHistoricalDraws(lotteryId, optimal);
    if (draws.length < 5) { res.status(503).json({ message: "Histórico insuficiente." }); return; }

    const { computeRiskMetrics } = await import("../core/risk/riskEngine");
    const freqs = computeFrequencies(lottery.totalNumbers, draws);
    const frequencyMap: Record<number, number> = {};
    for (const f of freqs) frequencyMap[f.number] = f.frequency;
    const avgSum   = draws.reduce((s, d) => s + d.reduce((a, b) => a + b, 0), 0) / draws.length;
    const avgEvens = draws.reduce((s, d) => s + d.filter(n => n % 2 === 0).length, 0) / draws.length;

    // Calcula risco de um jogo aleatório representativo (centróide do espaço)
    const sampleGame = Array.from({ length: lottery.minNumbers }, (_, i) => i + 1);
    const risk = computeRiskMetrics(sampleGame, lottery.totalNumbers, avgSum, avgEvens, frequencyMap);

    res.json({
      lotteryId,
      lotteryName: lottery.displayName,
      drawsAnalyzed: draws.length,
      avgSum: Math.round(avgSum * 10) / 10,
      avgEvens: Math.round(avgEvens * 10) / 10,
      riskProfile: risk,
      frequencyTop10: freqs.slice(0, 10).map(f => ({ number: f.number, frequency: f.frequency, temperature: f.temperature })),
    });
  } catch (err: any) {
    res.status(500).json({ message: "Erro ao calcular métricas de risco.", error: err?.message });
  }
});

// ─── GET /api/v2/coverage/:lotteryId ─────────────────────────

router.get("/coverage/:lotteryId", async (req: Request, res: Response): Promise<void> => {
  const { lotteryId } = req.params;
  const topN = Math.min(parseInt((req.query.top as string) || "20") || 20, 60);
  const lottery = LOTTERIES.find(l => l.id === lotteryId);
  if (!lottery) { res.status(404).json({ message: "Loteria não encontrada." }); return; }

  try {
    const { optimal } = getHistoryConfig(lotteryId);
    const draws = await fetchHistoricalDraws(lotteryId, optimal);
    if (draws.length < 5) { res.status(503).json({ message: "Histórico insuficiente." }); return; }

    const { analyzeCoverage, computeGlobalCoverageScore } = await import("../core/optimization/coverageEngine");
    const recentDraws = draws.slice(0, topN);
    const coverageStats = analyzeCoverage(recentDraws, lottery.totalNumbers);
    const globalScore   = computeGlobalCoverageScore(recentDraws, lottery.totalNumbers);

    res.json({
      lotteryId,
      lotteryName:     lottery.displayName,
      analyzedDraws:   recentDraws.length,
      totalDraws:      draws.length,
      coverageScore:   coverageStats.coverageScore,
      globalScore,
      distinctNumbers: coverageStats.distinctNumbers,
      universePercent: coverageStats.universePercent,
      overRepresented: coverageStats.overRepresented.slice(0, 15),
      uncovered:       coverageStats.uncovered.slice(0, 15),
      frequency:       coverageStats.frequency,
    });
  } catch (err: any) {
    res.status(500).json({ message: "Erro ao calcular cobertura.", error: err?.message });
  }
});

// ─── GET /api/v2/system-status ────────────────────────────────

router.get("/system-status", async (req: Request, res: Response) => {
  try {
    const auditStats = getAuditStats();
    const cacheInfo  = getCacheInfo();

    // Conta jogos no banco
    const allGames = await db.select({ id: userGamesTable.id }).from(userGamesTable);
    const totalGames = allGames.length;

    res.json({
      pipeline: {
        version: "v2",
        modules: [
          "contestGeneration", "contestSnapshot", "temporalValidator",
          "similarityEngine", "coverageEngine", "antiPopularPatterns",
          "cycleEngine", "riskEngine", "sharkPrecisionEngine",
          "sharkBacktest", "sharkAutoLearning", "monteCarlo",
          "masterPipeline", "auditLogger", "statisticsCache",
        ],
        status: "operational",
      },
      audit:  auditStats,
      cache:  cacheInfo,
      db: { totalGames },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ message: "Erro ao buscar status.", error: err?.message });
  }
});

export default router;
