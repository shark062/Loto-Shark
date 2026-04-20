import { Router } from "express";
import { runEnsemble, callWithFallback, buildSharkAnalysisContext } from "../lib/aiEnsemble";
import { listProviders } from "../lib/aiProviders";
import { LOTTERIES, fetchHistoricalDraws, computeFrequencies, generateSmartNumbers, getHistoryConfig, computeTopPairs } from "../lib/lotteryData";
import type { LotteryContext, DrawData, SharkAnalysisContext } from "../lib/aiEnsemble";

const router = Router();

function buildContext(lotteryId: string, lottery: any, draws: number[][]): SharkAnalysisContext {
  const freqs = computeFrequencies(lottery.totalNumbers, draws);
  const hotNumbers  = freqs.filter(f => f.temperature === 'hot').map(f => f.number);
  const coldNumbers = freqs.filter(f => f.temperature === 'cold').map(f => f.number);
  const warmNumbers = freqs.filter(f => f.temperature === 'warm').map(f => f.number);
  const frequencyMap: Record<number, number> = {};
  for (const f of freqs) frequencyMap[f.number] = f.frequency;
  const avgSum = draws.length > 0
    ? draws.reduce((s, d) => s + d.reduce((a, b) => a + b, 0), 0) / draws.length
    : (lottery.totalNumbers + 1) * lottery.minNumbers / 2;
  const avgEvens = draws.length > 0
    ? draws.reduce((s, d) => s + d.filter((n: number) => n % 2 === 0).length, 0) / draws.length
    : lottery.minNumbers / 2;
  const base = {
    lotteryId, lotteryName: lottery.displayName,
    totalNumbers: lottery.totalNumbers, minNumbers: lottery.minNumbers,
    draws: draws.map((d, i) => ({ contestNumber: i + 1, numbers: d })),
    hotNumbers, coldNumbers, warmNumbers, frequencyMap, avgSum, avgEvens,
  };
  return buildSharkAnalysisContext(base, draws);
}

// GET /api/prediction/generate/:lotteryId — Full ensemble prediction
router.get("/generate/:lotteryId", async (req, res) => {
  const { lotteryId } = req.params;
  const lottery = LOTTERIES.find(l => l.id === lotteryId);
  if (!lottery) return res.status(404).json({ message: "Loteria não encontrada" });

  try {
    const { optimal } = getHistoryConfig(lotteryId);
    const draws = await fetchHistoricalDraws(lotteryId, optimal).catch(() => [] as number[][]);
    const ctx = buildContext(lotteryId, lottery, draws);
    const { stats } = listProviders();

    if (stats.active === 0) {
      const freqs = computeFrequencies(lottery.totalNumbers, draws);
      const sc = ctx as SharkAnalysisContext;
      const primary = generateSmartNumbers(freqs, lottery.minNumbers, 'mixed', lottery.totalNumbers);
      const alternatives = [
        { numbers: generateSmartNumbers(freqs, lottery.minNumbers, 'hot', lottery.totalNumbers), source: 'Quentes', confidence: 0.60 },
        { numbers: generateSmartNumbers(freqs, lottery.minNumbers, 'cold', lottery.totalNumbers), source: 'Atrasados', confidence: 0.55 },
      ];
      return res.json({
        lotteryId,
        lotteryName: lottery.displayName,
        primaryPrediction: primary,
        confidence: 0.60,
        reasoning: `Previsão estatística: ${sc.hotNumbers.length} quentes, ${sc.coldNumbers.length} frios, ${sc.overdueNumbers.length} atrasados identificados em ${draws.length} sorteios (IAs indisponíveis).`,
        alternatives,
        ensemble: null,
        drawsAnalyzed: draws.length,
        hotNumbers: sc.hotNumbers.slice(0, 8),
        coldNumbers: sc.coldNumbers.slice(0, 8),
        overdueNumbers: sc.overdueNumbers.slice(0, 5),
        topPairs: sc.topPairs.slice(0, 5),
      });
    }

    const ensemble = await runEnsemble(ctx);

    res.json({
      lotteryId,
      lotteryName: lottery.displayName,
      primaryPrediction: ensemble.consensusNumbers,
      confidence: ensemble.overallConfidence,
      reasoning: ensemble.reasoning,
      alternatives: ensemble.alternativeGames,
      ensemble: {
        successfulProviders: ensemble.successfulProviders,
        totalProviders: ensemble.totalProviders,
        latencyMs: ensemble.latencyMs,
        providerDetails: ensemble.providerResults.map(r => ({
          provider: r.providerName,
          role: r.role,
          numbers: r.suggestedNumbers,
          confidence: r.confidence,
          latencyMs: r.latencyMs,
          success: r.success,
          reasoning: r.reasoning.slice(0, 200),
          error: r.error,
        })),
      },
      drawsAnalyzed: draws.length,
      hotNumbers: ctx.hotNumbers.slice(0, 8),
      coldNumbers: ctx.coldNumbers.slice(0, 8),
    });
  } catch (err: any) {
    res.status(500).json({ message: "Erro ao gerar previsão ensemble: " + err.message });
  }
});

// POST /api/prediction/ensemble — Multi-game ensemble
router.post("/ensemble", async (req, res) => {
  const { lotteryId = "megasena", gamesCount = 3 } = req.body;
  const lottery = LOTTERIES.find(l => l.id === lotteryId);
  if (!lottery) return res.status(404).json({ message: "Loteria não encontrada" });

  try {
    const { optimal } = getHistoryConfig(lotteryId);
    const draws = await fetchHistoricalDraws(lotteryId, optimal).catch(() => [] as number[][]);
    const ctx = buildContext(lotteryId, lottery, draws);
    const { stats } = listProviders();

    if (stats.active === 0) {
      const freqs = computeFrequencies(lottery.totalNumbers, draws);
      const games = Array.from({ length: Math.min(gamesCount, 10) }, () => ({
        numbers: generateSmartNumbers(freqs, lottery.minNumbers, "mixed", lottery.totalNumbers),
        source: "Estatístico",
        confidence: 0.55,
      }));
      return res.json({ lotteryId, games, ensemble: null });
    }

    const ensemble = await runEnsemble(ctx);

    const games = [
      { numbers: ensemble.consensusNumbers, source: "Consenso Ensemble", confidence: ensemble.overallConfidence },
      ...ensemble.alternativeGames,
    ].slice(0, Math.min(gamesCount, 10));

    res.json({
      lotteryId,
      lotteryName: lottery.displayName,
      games,
      ensemble: {
        successfulProviders: ensemble.successfulProviders,
        totalProviders: ensemble.totalProviders,
        latencyMs: ensemble.latencyMs,
      },
      drawsAnalyzed: draws.length,
    });
  } catch (err: any) {
    res.status(500).json({ message: "Erro no ensemble: " + err.message });
  }
});

export default router;
