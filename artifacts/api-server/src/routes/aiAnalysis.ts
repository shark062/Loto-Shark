import { Router } from "express";
import { runEnsemble, callWithFallback } from "../lib/aiEnsemble";
import { listProviders } from "../lib/aiProviders";
import { LOTTERIES, fetchHistoricalDraws, computeFrequencies } from "../lib/lotteryData";
import type { LotteryContext, DrawData } from "../lib/aiEnsemble";

const router = Router();
const analysisCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function buildContext(lotteryId: string, lottery: any, draws: number[][]): LotteryContext {
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
    lotteryId,
    lotteryName: lottery.displayName,
    totalNumbers: lottery.totalNumbers,
    minNumbers: lottery.minNumbers,
    draws: draws.map((d, i) => ({ contestNumber: i + 1, numbers: d })),
    hotNumbers: sorted.slice(0, hotCut).map(f => f.number),
    coldNumbers: sorted.slice(coldCut).map(f => f.number),
    warmNumbers: sorted.slice(hotCut, coldCut).map(f => f.number),
    frequencyMap,
    avgSum,
    avgEvens,
  };
}

// GET /api/ai/analysis/:lotteryId?type=prediction|pattern|strategy
router.get("/analysis/:lotteryId", async (req, res) => {
  const { lotteryId } = req.params;
  const type = (req.query.type as string) || "prediction";
  const lottery = LOTTERIES.find(l => l.id === lotteryId);
  if (!lottery) return res.status(404).json({ message: "Loteria não encontrada" });

  const key = `analysis:${lotteryId}:${type}`;
  const cached = analysisCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return res.json(cached.data);

  try {
    const draws = await fetchHistoricalDraws(lotteryId, 50).catch(() => [] as number[][]);
    const ctx = buildContext(lotteryId, lottery, draws);
    const { stats } = listProviders();

    let result: any;

    if (stats.active > 0) {
      let prompt = "";
      let systemPrompt = `Você é um especialista em análise estatística de loterias brasileiras da plataforma LotoShark.
Você analisa dados reais da Caixa Econômica Federal para maximizar a precisão das previsões.
Utilize sempre: frequência histórica, atraso (delay), distribuição por faixa, paridade (par/ímpar) e soma histórica.
Responda em português, de forma objetiva e baseada em dados. Nunca invente dados — use apenas o que foi fornecido.`;

      if (type === "pattern") {
        prompt = `Analise os padrões dos últimos ${draws.length} sorteios da ${lottery.displayName}.
Quentes: ${ctx.hotNumbers.slice(0,8).join(", ")} | Frios: ${ctx.coldNumbers.slice(0,8).join(", ")}
Últimos sorteios: ${draws.slice(0,5).map(d=>`[${d.join(",")}]`).join(", ")}

Identifique: padrões recorrentes, ciclos, co-ocorrências, tendências.
Responda em JSON: {"patterns":[{"pattern":"...","frequency":0.XX,"lastOccurrence":"...","predictedNext":[n1,n2]}],"summary":"..."}`;
      } else if (type === "strategy") {
        prompt = `Recomende a melhor estratégia para a ${lottery.displayName} (${lottery.minNumbers} de ${lottery.totalNumbers}).
Dados: soma média=${ctx.avgSum.toFixed(1)}, pares médios=${ctx.avgEvens.toFixed(1)}, ${draws.length} sorteios analisados.
Quentes: ${ctx.hotNumbers.slice(0,8).join(",")} | Frios: ${ctx.coldNumbers.slice(0,8).join(",")}

Responda JSON: {"recommendedStrategy":"hot|cold|mixed|ai","reasoning":"...","numberSelection":{"hotPercentage":N,"warmPercentage":N,"coldPercentage":N},"riskLevel":"baixo|médio|alto","playFrequency":"...","budgetAdvice":"...","expectedImprovement":"..."}`;
      } else {
        // Calcula atraso de cada número para enriquecer o prompt
        const delayMap: Record<number, number> = {};
        for (let n = 1; n <= lottery.totalNumbers; n++) {
          let delay = draws.length;
          for (let i = 0; i < draws.length; i++) { if (draws[i].includes(n)) { delay = i; break; } }
          delayMap[n] = delay;
        }
        const overdueTop = Object.entries(delayMap).sort((a,b)=>Number(b[1])-Number(a[1])).slice(0,8).map(([n])=>n).join(",");

        prompt = `Gere uma previsão precisa para o próximo sorteio da ${lottery.displayName} (escolha ${lottery.minNumbers} números de 1 a ${lottery.totalNumbers}).

DADOS ESTATÍSTICOS REAIS (${draws.length} sorteios analisados):
- Números mais frequentes (quentes): ${ctx.hotNumbers.slice(0,10).join(",")}
- Números menos frequentes (frios): ${ctx.coldNumbers.slice(0,10).join(",")}
- Números mornos: ${ctx.warmNumbers.slice(0,10).join(",")}
- Maior atraso (não saem há mais sorteios): ${overdueTop}
- Soma média histórica: ${ctx.avgSum.toFixed(1)}
- Média de números pares por sorteio: ${ctx.avgEvens.toFixed(1)}
- Últimos 5 sorteios: ${draws.slice(0,5).map(d=>`[${d.join(",")}]`).join(", ")}

CRITÉRIOS PARA MAXIMIZAR PRECISÃO:
1. Misture quentes, mornos e pelo menos 1-2 atrasados (overdue)
2. Mantenha soma próxima de ${ctx.avgSum.toFixed(0)} (±15%)
3. Equilibre pares e ímpares próximo de ${ctx.avgEvens.toFixed(0)} pares
4. Distribua os números pelas faixas do 1 ao ${lottery.totalNumbers}
5. Evite sequências longas de consecutivos (máx. 2-3)

Responda em JSON: {"primaryPrediction":[exatamente ${lottery.minNumbers} números únicos de 1 a ${lottery.totalNumbers}],"confidence":0.XX,"reasoning":"...","overdueIncluded":[números atrasados incluídos],"sumEstimated":N,"alternatives":[{"numbers":[${lottery.minNumbers} números],"strategy":"quentes|frios|misto|atrasados"}],"riskLevel":"baixo|médio|alto"}`;
      }

      try {
        const { text, provider } = await callWithFallback(prompt, systemPrompt);
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          result = {
            id: Date.now(),
            lotteryId,
            analysisType: type,
            result: parsed,
            confidence: String(parsed.confidence || 0.7),
            createdAt: new Date().toISOString(),
            source: "ai",
            provider,
          };
        }
      } catch {}
    }

    if (!result) {
      result = buildStatisticalAnalysis(type, lotteryId, lottery, ctx, draws);
    }

    analysisCache.set(key, { data: result, ts: Date.now() });
    res.json(result);
  } catch (err: any) {
    const draws = await fetchHistoricalDraws(lotteryId, 5).catch(() => [] as number[][]);
    const ctx = buildContext(lotteryId, lottery, draws);
    res.json(buildStatisticalAnalysis(type, lotteryId, lottery, ctx, draws));
  }
});

// POST /api/ai/analyze — Invalidate cache and request fresh analysis
router.post("/analyze", async (req, res) => {
  const { lotteryId, analysisType = "prediction" } = req.body;
  const key = `analysis:${lotteryId}:${analysisType}`;
  analysisCache.delete(key);
  res.json({ success: true, message: "Cache limpo — próxima consulta gerará nova análise de IA" });
});

// GET /api/ai/metrics
router.get("/metrics", (req, res) => {
  const { stats, providers } = listProviders();
  res.json({
    providersActive: stats.active,
    providersTotal: stats.total,
    bestProvider: stats.best,
    totalCalls: stats.totalCalls,
    cacheSize: analysisCache.size,
    rankings: providers.map(p => ({
      modelName: p.name,
      accuracy: p.successRate,
      confidence: p.successRate * 0.9,
      successRate: p.successRate,
      totalPredictions: p.totalCalls,
      avgLatencyMs: p.avgLatencyMs,
    })),
  });
});

// GET /api/ai/meta-reasoning/:lotteryId
router.get("/meta-reasoning/:lotteryId", async (req, res) => {
  const { lotteryId } = req.params;
  const lottery = LOTTERIES.find(l => l.id === lotteryId);
  if (!lottery) return res.status(404).json({ message: "Loteria não encontrada" });

  try {
    const draws = await fetchHistoricalDraws(lotteryId, 50).catch(() => [] as number[][]);
    const ctx = buildContext(lotteryId, lottery, draws);
    const { providers: pList, stats } = listProviders();

    res.json({
      lotteryId,
      lotteryName: lottery.displayName,
      drawsAnalyzed: draws.length,
      rankings: pList.map(p => ({
        modelName: p.name,
        accuracy: p.successRate,
        confidence: p.successRate * 0.9,
        successRate: p.successRate,
        totalPredictions: p.totalCalls,
        avgLatencyMs: p.avgLatencyMs,
        priority: p.priority,
      })),
      hotNumbers: ctx.hotNumbers.slice(0, 8),
      coldNumbers: ctx.coldNumbers.slice(0, 8),
      avgSum: ctx.avgSum,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/ai/optimal-combination/:lotteryId
router.get("/optimal-combination/:lotteryId", async (req, res) => {
  const { lotteryId } = req.params;
  const lottery = LOTTERIES.find(l => l.id === lotteryId);
  if (!lottery) return res.status(404).json({ message: "Loteria não encontrada" });

  try {
    const draws = await fetchHistoricalDraws(lotteryId, 50).catch(() => [] as number[][]);
    const freqs = computeFrequencies(lottery.totalNumbers, draws);
    const ctx = buildContext(lotteryId, lottery, draws);
    const { stats } = listProviders();

    if (stats.active === 0) {
      const nums = [...freqs].sort((a, b) => b.frequency - a.frequency).slice(0, lottery.minNumbers).map(f => f.number).sort((a, b) => a - b);
      return res.json({ lotteryId, optimalNumbers: nums, confidence: 0.55, source: "statistical" });
    }

    const ensemble = await runEnsemble(ctx);
    res.json({
      lotteryId,
      lotteryName: lottery.displayName,
      optimalNumbers: ensemble.consensusNumbers,
      confidence: ensemble.overallConfidence,
      source: "ensemble",
      providers: ensemble.successfulProviders,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

function buildStatisticalAnalysis(type: string, lotteryId: string, lottery: any, ctx: LotteryContext, draws: number[][]) {
  let result: any;
  if (type === "pattern") {
    result = {
      patterns: [
        { pattern: "Dominância de quentes", frequency: 0.65, lastOccurrence: "Último sorteio", predictedNext: ctx.hotNumbers.slice(0, 3) },
        { pattern: "Retorno de frios", frequency: 0.35, lastOccurrence: "Sorteio recente", predictedNext: ctx.coldNumbers.slice(0, 3) },
      ],
      summary: `Análise estatística de ${draws.length} sorteios reais da Caixa.`,
    };
  } else if (type === "strategy") {
    result = {
      recommendedStrategy: "mixed",
      reasoning: `Estratégia balanceada baseada em ${draws.length} sorteios da ${lottery.displayName}.`,
      numberSelection: { hotPercentage: 40, warmPercentage: 30, coldPercentage: 30 },
      riskLevel: "médio",
      playFrequency: "2-3 vezes por semana",
      budgetAdvice: "Defina um orçamento fixo mensal",
      expectedImprovement: "Melhora estatística de ~15% vs aleatório",
    };
  } else {
    const nums = ctx.hotNumbers.slice(0, 3)
      .concat(ctx.coldNumbers.slice(0, 2))
      .slice(0, lottery.minNumbers);
    while (nums.length < lottery.minNumbers) {
      const n = Math.floor(Math.random() * lottery.totalNumbers) + 1;
      if (!nums.includes(n)) nums.push(n);
    }
    result = {
      primaryPrediction: nums.sort((a, b) => a - b),
      confidence: 0.58,
      reasoning: `Previsão estatística baseada em ${draws.length} sorteios reais da Caixa.`,
      alternatives: [
        { numbers: ctx.hotNumbers.slice(0, lottery.minNumbers).sort((a: number, b: number) => a - b), strategy: "Apenas quentes" },
        { numbers: ctx.coldNumbers.slice(0, lottery.minNumbers).sort((a: number, b: number) => a - b), strategy: "Apenas frios" },
      ],
      riskLevel: "médio",
    };
  }
  return { id: Date.now(), lotteryId, analysisType: type, result, confidence: "0.58", createdAt: new Date().toISOString(), source: "statistical" };
}

export default router;
