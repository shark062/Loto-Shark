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
import { LOTTERIES, fetchHistoricalDraws, computeFrequencies, getHistoryConfig } from "./lib/lotteryData";
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
    hotNumbers: freqs.filter(f => f.temperature === 'hot').map(f => f.number),
    coldNumbers: freqs.filter(f => f.temperature === 'cold').map(f => f.number),
    warmNumbers: freqs.filter(f => f.temperature === 'warm').map(f => f.number),
    frequencyMap, avgSum, avgEvens,
  };
}

app.get("/api/meta-reasoning/analyze/:lotteryId", async (req: Request, res: Response) => {
  const { lotteryId } = req.params;
  const lottery = LOTTERIES.find(l => l.id === lotteryId);
  if (!lottery) return res.status(404).json({ message: "Loteria não encontrada" });
  try {
    const { optimal } = getHistoryConfig(lotteryId);
    const draws = await fetchHistoricalDraws(lotteryId, optimal).catch(() => [] as number[][]);
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
    const { optimal } = getHistoryConfig(lotteryId);
    const draws = await fetchHistoricalDraws(lotteryId, optimal).catch(() => [] as number[][]);
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

// ── YouTube Live Stream Proxy ──────────────────────────────────
app.get("/api/youtube/live", async (req: Request, res: Response) => {
  try {
    const response = await fetch("https://www.youtube.com/@canalcaixa/live", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
      redirect: "follow",
    });
    const finalUrl = response.url;
    const html = await response.text();

    // Verifica se é realmente uma transmissão ao vivo agora
    const liveMarkers = [
      '"isLiveNow":true',
      '"isLive":true',
      '"isLiveContent":true',
      '"isLiveBroadcast":true',
      'BADGE_STYLE_TYPE_LIVE_NOW',
      '"liveBroadcastDetails":{"isLiveNow":true',
    ];
    const isLive = liveMarkers.some(m => html.includes(m));

    // Se o YouTube redirecionou para /watch?v=... é live; se foi pra /channel ou home, não é
    const redirectedToWatch = /\/watch\?v=([a-zA-Z0-9_-]{11})/.exec(finalUrl);

    if (!isLive && !redirectedToWatch) {
      return res.status(404).json({ message: "Nenhuma transmissão ao vivo encontrada no momento" });
    }

    // Pega o videoId — preferencialmente da URL final, senão do HTML
    let videoId: string | null = redirectedToWatch?.[1] ?? null;
    if (!videoId) {
      const m = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
      videoId = m?.[1] ?? null;
    }

    if (!videoId) {
      return res.status(404).json({ message: "Nenhuma transmissão ao vivo encontrada no momento" });
    }

    return res.json({
      videoId,
      embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&rel=0`,
    });
  } catch (err: any) {
    return res.status(500).json({ message: "Erro ao buscar transmissão ao vivo", error: err.message });
  }
});

// ── Init (async — carrega providers do banco antes de servir) ──
(async () => {
  try {
    await initDefaultProviders();
  } catch (err: any) {
    logger.error({ err: err.message }, "Falha ao inicializar providers");
  }
})();

export default app;
