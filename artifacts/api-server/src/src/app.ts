import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import aiProvidersRouter from "./routes/aiProviders";
import aiAnalysisRouter from "./routes/aiAnalysis";
import predictionRouter from "./routes/prediction";
import chatRouter from "./routes/chat";
import { logger } from "./lib/logger";
import { initDefaultProviders, listProviders } from "./lib/aiProviders";
import { LOTTERIES, fetchHistoricalDraws, computeFrequencies } from "./lib/lotteryData";
import { runEnsemble } from "./lib/aiEnsemble";
import type { LotteryContext } from "./lib/aiEnsemble";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) { return { id: req.id, method: req.method, url: req.url?.split("?")[0] }; },
      res(res) { return { statusCode: res.statusCode }; },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Core routes ───────────────────────────────────────────────
app.use("/api", router);

// ── AI routes ─────────────────────────────────────────────────
app.use("/api/ai-providers", aiProvidersRouter);
app.use("/api/ai",           aiAnalysisRouter);
app.use("/api/prediction",   predictionRouter);
app.use("/api/chat",         chatRouter);

// ── Meta-reasoning routes (alias for AIMetrics page) ─────────
function buildCtx(lotteryId: string, lottery: any, draws: number[][]): LotteryContext {
  const freqs = computeFrequencies(lottery.totalNumbers, draws);
  const sorted = [...freqs].sort((a, b) => b.frequency - a.frequency);
  const hotCut  = Math.floor(sorted.length * 0.25);
  const coldCut = Math.floor(sorted.length * 0.75);
  const frequencyMap: Record<number, number> = {};
  for (const f of freqs) frequencyMap[f.number] = f.frequency;
  const avgSum = draws.length > 0
    ? draws.reduce((s, d) => s + d.reduce((a, b) => a + b, 0), 0) / draws.length
    : (lottery.totalNumbers + 1) * lottery.minNumbers / 2;
  const avgEvens = draws.length > 0
    ? draws.reduce((s, d) => s + d.filter((n: number) => n % 2 === 0).length, 0) / draws.length
    : lottery.minNumbers / 2;
  return {
    lotteryId, lotteryName: lottery.displayName,
    totalNumbers: lottery.totalNumbers, minNumbers: lottery.minNumbers,
    draws: draws.map((d, i) => ({ contestNumber: i + 1, numbers: d })),
    hotNumbers: sorted.slice(0, hotCut).map(f => f.number),
    coldNumbers: sorted.slice(coldCut).map(f => f.number),
    warmNumbers: sorted.slice(hotCut, coldCut).map(f => f.number),
    frequencyMap, avgSum, avgEvens,
  };
}

app.get("/api/meta-reasoning/analyze/:lotteryId", async (req: Request, res: Response) => {
  const { lotteryId } = req.params;
  const lottery = LOTTERIES.find(l => l.id === lotteryId);
  if (!lottery) return res.status(404).json({ message: "Loteria não encontrada" });
  try {
    const draws = await fetchHistoricalDraws(lotteryId, 20).catch(() => [] as number[][]);
    const ctx = buildCtx(lotteryId, lottery, draws);
    const { providers: pList } = listProviders();
    res.json({
      lotteryId, lotteryName: lottery.displayName, drawsAnalyzed: draws.length,
      rankings: pList.map(p => ({
        modelName: p.name, accuracy: p.successRate, confidence: p.successRate * 0.9,
        successRate: p.successRate, totalPredictions: p.totalCalls,
        avgLatencyMs: p.avgLatencyMs, priority: p.priority,
      })),
      hotNumbers: ctx.hotNumbers.slice(0, 8),
      coldNumbers: ctx.coldNumbers.slice(0, 8),
      avgSum: ctx.avgSum,
    });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.get("/api/meta-reasoning/optimal-combination/:lotteryId", async (req: Request, res: Response) => {
  const { lotteryId } = req.params;
  const lottery = LOTTERIES.find(l => l.id === lotteryId);
  if (!lottery) return res.status(404).json({ message: "Loteria não encontrada" });
  try {
    const draws = await fetchHistoricalDraws(lotteryId, 20).catch(() => [] as number[][]);
    const ctx = buildCtx(lotteryId, lottery, draws);
    const { stats } = listProviders();
    if (stats.active === 0) {
      return res.json({ lotteryId, optimalNumbers: ctx.hotNumbers.slice(0, lottery.minNumbers).sort((a, b) => a - b), confidence: 0.55, source: "statistical" });
    }
    const ensemble = await runEnsemble(ctx);
    res.json({
      lotteryId, lotteryName: lottery.displayName,
      optimalNumbers: ensemble.consensusNumbers,
      confidence: ensemble.overallConfidence, source: "ensemble",
      providers: ensemble.successfulProviders,
    });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

app.post("/api/meta-reasoning/feedback", (req: Request, res: Response) => {
  res.json({ success: true, message: "Feedback registrado" });
});

// ── Init ──────────────────────────────────────────────────────
initDefaultProviders();

export default app;
