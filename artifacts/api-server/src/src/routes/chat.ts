import { Router } from "express";
import { callWithFallback } from "../lib/aiEnsemble";
import { listProviders } from "../lib/aiProviders";
import { LOTTERIES, fetchHistoricalDraws, computeFrequencies, generateSmartNumbers } from "../lib/lotteryData";

const router = Router();

const SYSTEM_PROMPT = `Você é o Shark Assistant, especialista em loterias brasileiras da plataforma LotoShark.

Você tem acesso a dados reais da Caixa Econômica Federal e usa múltiplas IAs em paralelo para análise.

Suas capacidades:
- Analisar frequência de números em sorteios históricos reais
- Gerar jogos inteligentes usando estratégias (quentes, frios, mistos, IA)
- Explicar probabilidades e estatísticas de loterias
- Recomendar estratégias de jogo responsável

Loterias suportadas: Mega-Sena, Lotofácil, Quina, Lotomania, Dupla Sena, Timemania, Dia de Sorte, Super Sete.

Responda SEMPRE em português. Seja direto, informativo e use dados reais quando disponíveis.
Use emojis moderadamente para tornar as respostas mais visuais.
IMPORTANTE: Sempre lembre que loterias são jogos de azar e não há garantia de ganho.`;

const LEK_PROMPT = `Você é o Lek do Black, versão agressiva do assistente de loterias.
Fala na linguagem da quebrada, com gírias e energia. Mas ainda dá conselhos reais e úteis.
Exemplos: "mano", "brabo", "na moral", "pode crer", "tá ligado", "bora", "mito".
Responda em português com gírias. Seja energético mas informativo.`;

function detectPersona(message: string): "normal" | "lek_do_black" {
  const triggers = ["mano", "mlk", "véi", "cara", "brother", "bro", "irmão", "parceiro", "brabo", "na moral", "tá ligado", "kkkk", "rsrs", "vlw", "obg mano"];
  const lower = message.toLowerCase();
  return triggers.some(t => lower.includes(t)) ? "lek_do_black" : "normal";
}

async function handleLotteryCommand(message: string): Promise<{ handled: boolean; response?: any }> {
  const lower = message.toLowerCase();

  // Detect lottery game in message
  const lotteryMap: Record<string, string> = {
    "mega": "megasena", "mega-sena": "megasena", "megasena": "megasena",
    "lotofácil": "lotofacil", "lotofacil": "lotofacil", "lotofacil": "lotofacil",
    "quina": "quina",
    "lotomania": "lotomania",
    "dupla sena": "duplasena", "dupla": "duplasena",
    "timemania": "timemania",
    "dia de sorte": "diadesorte", "sorte": "diadesorte",
    "super sete": "supersete", "super7": "supersete",
  };

  let detectedLotteryId: string | null = null;
  for (const [key, id] of Object.entries(lotteryMap)) {
    if (lower.includes(key)) { detectedLotteryId = id; break; }
  }

  // Generate games command
  const genMatch = lower.match(/(\d+)?\s*jog[oa]s?\s*(?:para|p\/|de)?\s*/);
  const wantsGen = lower.includes("ger") || lower.includes("jogo") || lower.includes("número") || lower.includes("suggest");

  if (wantsGen && detectedLotteryId) {
    const lottery = LOTTERIES.find(l => l.id === detectedLotteryId);
    if (!lottery) return { handled: false };
    const count = genMatch ? Math.min(parseInt(genMatch[1]) || 1, 5) : 1;
    const draws = await fetchHistoricalDraws(detectedLotteryId, 20).catch(() => [] as number[][]);
    const freqs = computeFrequencies(lottery.totalNumbers, draws);
    const games = Array.from({ length: count }, () =>
      generateSmartNumbers(freqs, lottery.minNumbers, "mixed", lottery.totalNumbers)
    );
    return {
      handled: true,
      response: {
        type: "games",
        lottery: lottery.displayName,
        lotteryId: detectedLotteryId,
        games,
        strategy: "Misturado (quentes + frios + estatístico)",
        drawsUsed: draws.length,
      },
    };
  }

  // Heatmap command
  if ((lower.includes("mapa") || lower.includes("calor") || lower.includes("heat") || lower.includes("frequência") || lower.includes("frequencia")) && detectedLotteryId) {
    const lottery = LOTTERIES.find(l => l.id === detectedLotteryId);
    if (!lottery) return { handled: false };
    const draws = await fetchHistoricalDraws(detectedLotteryId, 20).catch(() => [] as number[][]);
    const frequencies = computeFrequencies(lottery.totalNumbers, draws);
    return {
      handled: true,
      response: {
        type: "heatmap",
        lottery: lottery.displayName,
        lotteryId: detectedLotteryId,
        maxNumbers: lottery.totalNumbers,
        frequencies,
        stats: {
          hot: frequencies.filter(f => f.temperature === "hot").length,
          warm: frequencies.filter(f => f.temperature === "warm").length,
          cold: frequencies.filter(f => f.temperature === "cold").length,
        },
        totalDraws: draws.length,
      },
    };
  }

  // Analysis command
  if ((lower.includes("analise") || lower.includes("análise") || lower.includes("analisa") || lower.includes("ver")) && detectedLotteryId) {
    const lottery = LOTTERIES.find(l => l.id === detectedLotteryId);
    if (!lottery) return { handled: false };
    const draws = await fetchHistoricalDraws(detectedLotteryId, 20).catch(() => [] as number[][]);
    const frequencies = computeFrequencies(lottery.totalNumbers, draws);
    const sorted = [...frequencies].sort((a, b) => b.frequency - a.frequency);
    return {
      handled: true,
      response: {
        type: "analysis",
        lottery: lottery.displayName,
        lotteryId: detectedLotteryId,
        mostFrequent: sorted.slice(0, 10),
        leastFrequent: [...sorted].reverse().slice(0, 10),
        sequences: [],
        totalAnalyzed: draws.length,
      },
    };
  }

  return { handled: false };
}

// POST /api/chat
router.post("/", async (req, res) => {
  const { message, userId, context } = req.body;
  if (!message) return res.status(400).json({ message: "message é obrigatório" });

  const persona = detectPersona(message);
  const systemPrompt = persona === "lek_do_black" ? LEK_PROMPT : SYSTEM_PROMPT;

  try {
    // Try to handle as a structured command first
    const cmdResult = await handleLotteryCommand(message);
    if (cmdResult.handled && cmdResult.response) {
      const cmdType = cmdResult.response.type;
      let replyText = "";
      if (cmdType === "games") {
        replyText = `🎲 **Jogos gerados para ${cmdResult.response.lottery}** (${cmdResult.response.drawsUsed} sorteios analisados):\n\n` +
          cmdResult.response.games.map((g: number[], i: number) => `**Jogo ${i + 1}:** ${g.join(" - ")}`).join("\n") +
          `\n\n*Estratégia: ${cmdResult.response.strategy}*\n⚠️ Loterias são jogos de azar. Jogue com responsabilidade.`;
      } else if (cmdType === "heatmap") {
        replyText = `🔥 **Mapa de Calor - ${cmdResult.response.lottery}**\n\nAnalisados: ${cmdResult.response.totalDraws} sorteios\n- 🔴 Quentes: ${cmdResult.response.stats.hot} números\n- 🟡 Mornos: ${cmdResult.response.stats.warm} números\n- 🔵 Frios: ${cmdResult.response.stats.cold} números`;
      } else {
        replyText = `📊 **Análise - ${cmdResult.response.lottery}**\n\nSorteios analisados: ${cmdResult.response.totalAnalyzed}`;
      }

      return res.json({
        reply: replyText,
        visualizations: [cmdResult.response],
        suggestions: getSuggestions(cmdResult.response.lotteryId),
        persona,
        provider: "sistema",
      });
    }

    // Use AI for free-form conversation
    const { stats } = listProviders();
    if (stats.active === 0) {
      return res.json({
        reply: "⚠️ Nenhuma IA disponível no momento. Configure suas chaves de API na página de Provedores.",
        visualizations: [],
        suggestions: ["Gerar jogos mega-sena", "Mapa de calor lotofácil", "Analisar quina"],
        persona: "normal",
        provider: "sistema",
      });
    }

    const { text, provider } = await callWithFallback(message, systemPrompt);

    // Extract suggestions from response
    const suggestions = getSuggestionsFromText(text);

    res.json({
      reply: text,
      visualizations: [],
      suggestions,
      persona,
      provider,
    });
  } catch (err: any) {
    res.status(500).json({
      reply: "❌ Erro ao processar sua mensagem. Tente novamente em instantes.",
      visualizations: [],
      suggestions: ["Gerar jogos mega-sena", "Ver predições"],
      persona: "normal",
      provider: "erro",
    });
  }
});

function getSuggestions(lotteryId?: string): string[] {
  const base = [
    "Gerar 3 jogos para mega-sena",
    "Mostrar mapa de calor da lotofácil",
    "Ver predições do ensemble",
    "Analisar quina",
  ];
  if (lotteryId) {
    const lottery = LOTTERIES.find(l => l.id === lotteryId);
    if (lottery) {
      return [
        `Gerar mais jogos para ${lottery.displayName}`,
        `Mapa de calor da ${lottery.displayName}`,
        "Gerar jogos para mega-sena",
        "Ver análise completa",
      ];
    }
  }
  return base;
}

function getSuggestionsFromText(text: string): string[] {
  const defaults = [
    "Gerar jogos para mega-sena",
    "Mapa de calor da lotofácil",
    "Análise da quina",
    "Ver predições",
  ];
  return defaults;
}

export default router;
