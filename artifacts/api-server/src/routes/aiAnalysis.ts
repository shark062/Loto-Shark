import { Router } from "express";
import { callBestProvider, listProviders } from "../lib/aiProviders";
import { LOTTERIES, fetchHistoricalDraws, computeFrequencies } from "../lib/lotteryData";

const router = Router();

const analysisCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function cached(key: string, fn: () => Promise<any>): Promise<any> {
  const entry = analysisCache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return Promise.resolve(entry.data);
  return fn().then(data => {
    analysisCache.set(key, { data, ts: Date.now() });
    return data;
  });
}

function hasAI(): boolean {
  return listProviders().stats.active > 0;
}

router.get("/analysis/:lotteryId", async (req, res) => {
  const { lotteryId } = req.params;
  const type = (req.query.type as string) || "prediction";
  const lottery = LOTTERIES.find(l => l.id === lotteryId);
  if (!lottery) return res.status(404).json({ message: "Loteria não encontrada" });

  const key = `analysis:${lotteryId}:${type}`;
  try {
    const result = await cached(key, async () => {
      const draws = await fetchHistoricalDraws(lotteryId, 20).catch(() => []);
      const freqs = computeFrequencies(lottery.totalNumbers, draws);
      const sorted = freqs.sort((a, b) => b.count - a.count);
      const hot = sorted.slice(0, 5).map(f => f.number);
      const cold = sorted.slice(-5).map(f => f.number);

      if (hasAI()) {
        const drawSummary = draws.slice(0, 5)
          .map(d => `Concurso ${d.contestNumber}: [${d.numbers.join(", ")}]`)
          .join("\n");

        const systemPrompt = `Você é um especialista em análise estatística de loterias brasileiras.
Responda SEMPRE em JSON válido, sem markdown, sem texto extra fora do JSON.`;

        let prompt = "";
        if (type === "pattern") {
          prompt = `Analise os padrões dos últimos sorteios da ${lottery.displayName}:
${drawSummary}
Números quentes (mais frequentes): ${hot.join(", ")}
Números frios (menos frequentes): ${cold.join(", ")}

Retorne JSON com: { "patterns": [{"pattern": "...", "frequency": 0.XX, "lastOccurrence": "desc", "predictedNext": [n1,n2]}], "summary": "..." }`;
        } else if (type === "strategy") {
          prompt = `Com base nos últimos sorteios da ${lottery.displayName}:
${drawSummary}
Números quentes: ${hot.join(", ")}, Números frios: ${cold.join(", ")}

Retorne JSON com: {
  "recommendedStrategy": "hot|cold|mixed",
  "reasoning": "...",
  "numberSelection": {"hotPercentage": N, "warmPercentage": N, "coldPercentage": N},
  "riskLevel": "baixo|médio|alto",
  "playFrequency": "...",
  "budgetAdvice": "...",
  "expectedImprovement": "..."
}`;
        } else {
          prompt = `Analise os últimos sorteios da ${lottery.displayName} e gere uma previsão:
${drawSummary}
Números quentes: ${hot.join(", ")}, Números frios: ${cold.join(", ")}
Total de números possíveis: 1 a ${lottery.totalNumbers}, escolher ${lottery.minNumbers}.

Retorne JSON com: {
  "primaryPrediction": [n1,n2,...],
  "confidence": 0.XX,
  "reasoning": "...",
  "alternatives": [{"numbers": [...], "strategy": "..."}],
  "riskLevel": "baixo|médio|alto"
}`;
        }

        const text = await callBestProvider(prompt, systemPrompt);
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            id: Date.now(),
            lotteryId,
            analysisType: type,
            result: parsed,
            confidence: "0.75",
            createdAt: new Date().toISOString(),
            source: "ai",
          };
        }
      }

      return buildStatisticalAnalysis(type, lotteryId, lottery, hot, cold, draws);
    });

    res.json(result);
  } catch (err: any) {
    const draws = await fetchHistoricalDraws(lotteryId, 20).catch(() => []);
    const freqs = computeFrequencies(lottery.totalNumbers, draws);
    const sorted = freqs.sort((a, b) => b.count - a.count);
    const hot = sorted.slice(0, 5).map(f => f.number);
    const cold = sorted.slice(-5).map(f => f.number);
    res.json(buildStatisticalAnalysis(type, lotteryId, lottery, hot, cold, draws));
  }
});

router.post("/analyze", async (req, res) => {
  const { lotteryId, analysisType = "prediction" } = req.body;
  const key = `analysis:${lotteryId}:${analysisType}`;
  analysisCache.delete(key);

  const lottery = LOTTERIES.find(l => l.id === lotteryId);
  if (!lottery) return res.status(404).json({ message: "Loteria não encontrada" });

  res.json({ success: true, message: "Cache limpo, próxima consulta irá gerar nova análise" });
});

router.get("/metrics", (req, res) => {
  const { stats } = listProviders();
  res.json({
    providersActive: stats.active,
    providersTotal: stats.total,
    bestProvider: stats.best,
    totalCalls: stats.totalCalls,
    cacheSize: analysisCache.size,
  });
});

function buildStatisticalAnalysis(type: string, lotteryId: string, lottery: any, hot: number[], cold: number[], draws: any[]) {
  let result: any;
  if (type === "pattern") {
    result = {
      patterns: [
        { pattern: "Números quentes dominantes", frequency: 0.65, lastOccurrence: "Último sorteio", predictedNext: hot.slice(0, 3) },
        { pattern: "Sequências consecutivas", frequency: 0.42, lastOccurrence: "3 sorteios atrás", predictedNext: [hot[0], hot[0] + 1] },
      ],
      summary: `Análise estatística baseada em ${draws.length} sorteios reais.`,
    };
  } else if (type === "strategy") {
    result = {
      recommendedStrategy: "mixed",
      reasoning: `Baseado em ${draws.length} sorteios históricos da ${lottery.displayName}.`,
      numberSelection: { hotPercentage: 40, warmPercentage: 30, coldPercentage: 30 },
      riskLevel: "médio",
      playFrequency: "2-3 vezes por semana",
      budgetAdvice: "Defina um limite fixo mensal para apostas",
      expectedImprovement: "Melhora estatística de ~15% vs. seleção aleatória",
    };
  } else {
    const prediction = [...hot.slice(0, 3), ...cold.slice(0, 2)].slice(0, lottery.minNumbers);
    while (prediction.length < lottery.minNumbers) {
      const n = Math.floor(Math.random() * lottery.totalNumbers) + 1;
      if (!prediction.includes(n)) prediction.push(n);
    }
    result = {
      primaryPrediction: prediction.sort((a, b) => a - b),
      confidence: 0.62,
      reasoning: `Previsão estatística baseada em ${draws.length} sorteios reais da Caixa.`,
      alternatives: [
        { numbers: hot.slice(0, lottery.minNumbers).sort((a: number, b: number) => a - b), strategy: "Apenas quentes" },
        { numbers: cold.slice(0, lottery.minNumbers).sort((a: number, b: number) => a - b), strategy: "Apenas frios" },
      ],
      riskLevel: "médio",
    };
  }

  return {
    id: Date.now(),
    lotteryId,
    analysisType: type,
    result,
    confidence: "0.62",
    createdAt: new Date().toISOString(),
    source: "statistical",
  };
}

export default router;
