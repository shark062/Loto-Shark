import { Router } from "express";
import { runEnsemble, callWithFallback } from "../lib/aiEnsemble";
import { listProviders } from "../lib/aiProviders";
import { LOTTERIES, fetchHistoricalDraws, computeFrequencies, generateSmartNumbers } from "../lib/lotteryData";
import type { LotteryContext, DrawData } from "../lib/aiEnsemble";

const router = Router();

function buildContext(lotteryId: string, lottery: any, draws: number[][]): LotteryContext {
  const freqs = computeFrequencies(lottery.totalNumbers, draws);
  const sorted = [...freqs].sort((a, b) => b.frequency - a.frequency);

  const hotCut  = Math.floor(sorted.length * 0.25);
  const coldCut = Math.floor(sorted.length * 0.75);

  const hotNumbers  = sorted.slice(0, hotCut).map(f => f.number);
  const coldNumbers = sorted.slice(coldCut).map(f => f.number);
  const warmNumbers = sorted.slice(hotCut, coldCut).map(f => f.number);

  const frequencyMap: Record<number, number> = {};
  for (const f of freqs) frequencyMap[f.number] = f.frequency;

  const avgSum = draws.length > 0
    ? draws.reduce((s, d) => s + d.reduce((a, b) => a + b, 0), 0) / draws.length
    : (lottery.totalNumbers + 1) * lottery.minNumbers / 2;

  const avgEvens = draws.length > 0
    ? draws.reduce((s, d) => s + d.filter((n: number) => n % 2 === 0).length, 0) / draws.length
    : lottery.minNumbers / 2;

  const drawData: DrawData[] = draws.map((d, i) => ({ contestNumber: i + 1, numbers: d }));

  return {
    lotteryId,
    lotteryName: lottery.displayName,
    totalNumbers: lottery.totalNumbers,
    minNumbers: lottery.minNumbers,
    draws: drawData,
    hotNumbers,
    coldNumbers,
    warmNumbers,
    frequencyMap,
    avgSum,
    avgEvens,
  };
}

// GET /api/prediction/generate/:lotteryId — Full ensemble prediction
router.get("/generate/:lotteryId", async (req, res) => {
  const { lotteryId } = req.params;
  const lottery = LOTTERIES.find(l => l.id === lotteryId);
  if (!lottery) return res.status(404).json({ message: "Loteria não encontrada" });

  try {
    const draws = await fetchHistoricalDraws(lotteryId, 20).catch(() => [] as number[][]);
    const ctx = buildContext(lotteryId, lottery, draws);
    const { stats } = listProviders();

    if (stats.active === 0) {
      // Statistical fallback
      const freqs = computeFrequencies(lottery.totalNumbers, draws);
      const primary = generateSmartNumbers(freqs, lottery.minNumbers, "mixed", lottery.totalNumbers);
      return res.json({
        lotteryId,
        lotteryName: lottery.displayName,
        primaryPrediction: primary,
        confidence: 0.55,
        reasoning: `Previsão estatística baseada em ${draws.length} sorteios reais (IAs indisponíveis).`,
        alternatives: [],
        ensemble: null,
        drawsAnalyzed: draws.length,
        hotNumbers: ctx.hotNumbers.slice(0, 5),
        coldNumbers: ctx.coldNumbers.slice(0, 5),
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
    const draws = await fetchHistoricalDraws(lotteryId, 20).catch(() => [] as number[][]);
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

    // Combine consensus + alternatives
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
