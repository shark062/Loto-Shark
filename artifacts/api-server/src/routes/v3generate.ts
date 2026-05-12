// ============================================================
//  SharkCore v3 — Unified Entry Point
//  /api/v3/generate — Interface simplificada para o usuário
//  Usuário informa apenas: lotteryId, dezenas?, quantity?, budget?
//  Sistema decide: estratégia, pesos, pipeline config
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
import { db, userGamesTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { createContestBinding } from "../core/contest/contestBindingEngine";

const router = Router();

const LOTTERY_PRICES: Record<string, number> = {
  megasena: 5.00, lotofacil: 3.00, quina: 2.50, lotomania: 3.00,
  duplasena: 2.50, timemania: 3.50, diadesorte: 2.50, supersete: 2.50,
  maisMilionaria: 6.00,
};

// ─── POST /api/v3/generate ────────────────────────────────────
// Parâmetros simplificados — sistema decide estratégia e pesos
// Body: { lotteryId, dezenas?, quantity?, budget? }

router.post("/generate", async (req: Request, res: Response) => {
  const {
    lotteryId  = "megasena",
    dezenas,
    quantity,
    budget,
  } = req.body;

  const lottery = LOTTERIES.find(l => l.id === lotteryId) || LOTTERIES[0];

  // Dezenas: usa o mínimo se não especificado, clampado ao range da modalidade
  const pickCount = dezenas
    ? Math.min(Math.max(Number(dezenas), lottery.minNumbers), lottery.totalNumbers)
    : lottery.minNumbers;

  // Quantidade: se budget fornecido, calcula quantos jogos cabem
  let gamesCount = 1;
  if (budget && !isNaN(Number(budget))) {
    const pricePerGame = LOTTERY_PRICES[lotteryId] || 3.00;
    gamesCount = Math.max(1, Math.floor(Number(budget) / pricePerGame));
  } else if (quantity && !isNaN(Number(quantity))) {
    gamesCount = Math.max(1, Math.min(Number(quantity), 50));
  }

  // Estratégia: sempre usa pipeline completo (shark)
  const strategy = "shark";
  const pesos = { frequencia: 0.50, atraso: 0.30, repeticao: 0.20 };

  try {
    const { optimal } = getHistoryConfig(lotteryId);
    const draws = await fetchHistoricalDraws(lotteryId, optimal);

    if (draws.length < 3) {
      logger.warn({ lotteryId, drawsFound: draws.length }, "[v3/generate] Histórico limitado");
    }

    const latestContest = getLatestContest(lotteryId);
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

    const avgSum   = draws.length > 0
      ? draws.reduce((s, d) => s + d.reduce((a, b) => a + b, 0), 0) / draws.length
      : (lottery.totalNumbers + 1) * pickCount / 2;
    const avgEvens = draws.length > 0
      ? draws.reduce((s, d) => s + d.filter(n => n % 2 === 0).length, 0) / draws.length
      : pickCount / 2;

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

    // Resolve o próximo concurso alvo (latestContest + 1) via ContestBindingEngine
    const contestBinding = createContestBinding(lotteryId, latestContest);
    logger.info({ lotteryId, latestContest, targetContest: contestBinding.targetContestNumber }, "[v3/generate] Vínculo de concurso");

    const pipelineResult = await runMasterPipeline({
      lotteryId,
      lotteryName:  lottery.displayName,
      totalNumbers: lottery.totalNumbers,
      minNumbers:   lottery.minNumbers,
      pickCount,
      gamesCount,
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

    const insertValues = pipelineResult.games.map(g => ({
      lotteryId,
      selectedNumbers: g.numbers,
      strategy,
      confidence: String(g.confidence),
      reasoning:  g.reasoning,
      dataSource: `SharkCore v3 — ${draws.length} sorteios reais — Pipeline v3 (${pipelineResult.metrics.enginesActive} engines)`,
      sharkScore: String(g.sharkScore),
      sharkOrigem: g.sharkOrigem,
      sharkContexto: {
        estrategia:          strategy,
        pesosUsados:         pesos,
        hot:                 hotNumbers.slice(0, 12),
        warm:                warmNumbers.slice(0, 10),
        cold:                coldNumbers.slice(0, 10),
        precisionScore:      g.precisionScore,
        precisionComponents: g.precisionComponents,
        riskMetrics:         g.riskMetrics,
        cycleScore:          g.cycleScore,
        popularPatterns:     g.popularPatterns,
        hyperScore:          g.hyperScore,
        hyperGrade:          g.hyperGrade,
        entropyScore:        g.entropyScore,
        correlationScore:    g.correlationScore,
        distributionScore:   g.distributionScore,
        trendScore:          g.trendScore,
        roiEstimate:         g.roiEstimate,
        qualityScore:        g.qualityScore,
        qualityMedal:        g.qualityMedal,
        filterScore:         g.filterScore,
        diversityScore:      pipelineResult.metrics.diversityScore,
        coverageScore:       pipelineResult.metrics.coverageScore,
        snapshotId:          pipelineResult.snapshotId,
        generationHash:      pipelineResult.generationHash,
        pipelineVersion:     pipelineResult.pipelineVersion,
        filterStats:         pipelineResult.metrics.filterStats,
        enginesActive:       pipelineResult.metrics.enginesActive,
        sorteiosAnalisados:  draws.length,
        totalCandidatos:     pipelineResult.metrics.filterStats?.totalGenerated,
        totalValidados:      pipelineResult.metrics.filterStats?.passed,
        backtest:            pipelineResult.backtest || null,
        sharkCoreVersion:    "3.0",
        budgetUsed:          budget ? Number(budget) : null,
      },
      matches:       0,
      prizeWon:      "0",
      contestNumber: contestBinding.targetContestNumber,
      status:        "aguardando_sorteio",
      hits:          0,
    }));

    const inserted = await db.insert(userGamesTable).values(insertValues).returning();

    const responseGames = inserted.map((g, idx) => ({
      id:               g.id,
      lotteryId:        g.lotteryId,
      selectedNumbers:  g.selectedNumbers as number[],
      numbers:          g.selectedNumbers as number[],
      strategy:         g.strategy,
      confidence:       g.confidence ? Number(g.confidence) : undefined,
      reasoning:        g.reasoning,
      dataSource:       g.dataSource,
      sharkScore:       g.sharkScore ? Number(g.sharkScore) : undefined,
      sharkOrigem:      g.sharkOrigem,
      sharkContexto:    g.sharkContexto,
      contestNumber:    g.contestNumber,
      status:           g.status,
      hits:             g.hits,
      createdAt:        g.createdAt.toISOString(),
      hyperScore:          pipelineResult.games[idx]?.hyperScore,
      hyperGrade:          pipelineResult.games[idx]?.hyperGrade,
      qualityScore:        pipelineResult.games[idx]?.qualityScore,
      qualityMedal:        pipelineResult.games[idx]?.qualityMedal,
      precisionScore:      pipelineResult.games[idx]?.precisionScore,
      precisionComponents: pipelineResult.games[idx]?.precisionComponents,
      riskMetrics:         pipelineResult.games[idx]?.riskMetrics,
      cycleScore:          pipelineResult.games[idx]?.cycleScore,
      popularPatterns:     pipelineResult.games[idx]?.popularPatterns,
      entropyScore:        pipelineResult.games[idx]?.entropyScore,
      correlationScore:    pipelineResult.games[idx]?.correlationScore,
      distributionScore:   pipelineResult.games[idx]?.distributionScore,
      trendScore:          pipelineResult.games[idx]?.trendScore,
      roiEstimate:         pipelineResult.games[idx]?.roiEstimate,
      filterScore:         pipelineResult.games[idx]?.filterScore,
    }));

    res.json({
      games: responseGames,
      pipeline: {
        version:        pipelineResult.pipelineVersion,
        targetContest:  pipelineResult.targetContest,
        snapshotId:     pipelineResult.snapshotId,
        generationHash: pipelineResult.generationHash,
        executionMs:    pipelineResult.executionMs,
        metrics:        pipelineResult.metrics,
        backtest:       pipelineResult.backtest,
        qualityRanking: pipelineResult.qualityRanking,
        sorteiosAnalisados: draws.length,
        enginesActive:  pipelineResult.metrics.enginesActive,
        sharkCoreVersion: "3.0",
        input: {
          lotteryId,
          pickCount,
          gamesCount,
          budgetUsed: budget ? Number(budget) : null,
        },
      },
    });
  } catch (err: any) {
    logger.error({ err: err.message, lotteryId }, "[v3/generate] Erro no SharkCore");
    res.status(500).json({ message: "Erro no SharkCore.", error: err?.message });
  }
});

export default router;
