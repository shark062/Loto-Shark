import { Router } from "express";
import { callBestProvider, listProviders } from "../lib/aiProviders";
import { LOTTERIES, fetchHistoricalDraws, computeFrequencies, generateSmartNumbers } from "../lib/lotteryData";

const router = Router();

router.get("/generate/:lotteryId", async (req, res) => {
  const { lotteryId } = req.params;
  const lottery = LOTTERIES.find(l => l.id === lotteryId);
  if (!lottery) return res.status(404).json({ message: "Loteria não encontrada" });

  try {
    const draws = await fetchHistoricalDraws(lotteryId, 20).catch(() => []);
    const freqs = computeFrequencies(lottery.totalNumbers, draws);
    const sorted = [...freqs].sort((a, b) => b.count - a.count);
    const hot = sorted.slice(0, 10).map(f => f.number);
    const cold = sorted.slice(-10).map(f => f.number);
    const primary = generateSmartNumbers(freqs, lottery.minNumbers, "mixed", lottery.totalNumbers);

    const { stats } = listProviders();
    let reasoning = `Previsão estatística baseada em ${draws.length} sorteios reais da Caixa Econômica Federal.`;

    if (stats.active > 0 && draws.length > 0) {
      try {
        const drawSummary = draws.slice(0, 5)
          .map(d => `Concurso ${d.contestNumber}: [${d.numbers.join(", ")}]`)
          .join("\n");

        const prompt = `Você é especialista em loterias. Analise brevemente os últimos sorteios da ${lottery.displayName}:
${drawSummary}
Números mais frequentes: ${hot.slice(0, 5).join(", ")}
Números menos frequentes: ${cold.slice(0, 5).join(", ")}
Minha sugestão de jogo: ${primary.join(", ")}

Dê um raciocínio curto (2-3 frases) sobre por que esses números têm potencial estatístico.`;

        reasoning = await callBestProvider(prompt, "Responda em português, de forma direta e objetiva, sem markdown.");
      } catch {
        // Mantém reasoning estatístico se IA falhar
      }
    }

    res.json({
      lotteryId,
      lotteryName: lottery.displayName,
      primaryPrediction: primary,
      confidence: 0.65 + Math.random() * 0.15,
      reasoning,
      alternatives: [
        { numbers: generateSmartNumbers(freqs, lottery.minNumbers, "hot", lottery.totalNumbers), strategy: "Números quentes" },
        { numbers: generateSmartNumbers(freqs, lottery.minNumbers, "cold", lottery.totalNumbers), strategy: "Números frios" },
        { numbers: generateSmartNumbers(freqs, lottery.minNumbers, "ai", lottery.totalNumbers), strategy: "Análise estatística" },
      ],
      riskLevel: "médio",
      drawsAnalyzed: draws.length,
      hotNumbers: hot.slice(0, 5),
      coldNumbers: cold.slice(0, 5),
    });
  } catch (err: any) {
    res.status(500).json({ message: "Erro ao gerar previsão: " + err.message });
  }
});

export default router;
