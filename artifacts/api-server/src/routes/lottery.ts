import { Router } from "express";
import { LOTTERIES, fetchLatestDraw, fetchHistoricalDraws, computeFrequencies } from "../lib/lotteryData";

const router = Router();

function normalizeDrawData(data: any, lotteryId: string) {
  if (!data) return null;
  const numbers = data.dezenas?.map(Number) || data.listaDezenas?.map(Number) || data.numbers || [];
  return {
    id: data.numero || data.contestNumber || 1,
    lotteryId,
    contestNumber: data.numero || data.contestNumber || 1,
    drawnNumbers: numbers,
    drawDate: data.dataApuracao || data.data || data.drawDate || new Date().toISOString(),
    prizeAmount: data.valorArrecadado || data.premio || data.prizeAmount || 'R$ 0,00',
    nextContestNumber: (data.numero || 1) + 1,
    estimatedPrize: data.valorEstimadoProximoConcurso || 'R$ 0,00',
  };
}

function getNextDrawDate(drawDays: string[], drawTime: string) {
  const dayMap: Record<string, number> = {
    'domingo': 0, 'sunday': 0,
    'segunda': 1, 'segunda-feira': 1, 'seg': 1, 'monday': 1,
    'terça': 2, 'terca': 2, 'ter': 2, 'tuesday': 2,
    'quarta': 3, 'qua': 3, 'wednesday': 3,
    'quinta': 4, 'qui': 4, 'thursday': 4,
    'sexta': 5, 'sex': 5, 'friday': 5,
    'sábado': 6, 'sabado': 6, 'sáb': 6, 'saturday': 6,
  };

  // Horário de Brasília = UTC-3
  const BRAZIL_OFFSET_MS = 3 * 60 * 60 * 1000;
  const now = new Date();
  const brazilNow = new Date(now.getTime() - BRAZIL_OFFSET_MS);
  const today = brazilNow.getUTCDay();
  const [h, m] = drawTime.split(':').map(Number);

  const drawDayNumbers = drawDays.map(d => dayMap[d.toLowerCase()] ?? -1).filter(d => d >= 0);
  if (drawDayNumbers.length === 0) drawDayNumbers.push(3);

  const brazilH = brazilNow.getUTCHours();
  const brazilMin = brazilNow.getUTCMinutes();
  const minutesFromMidnight = brazilH * 60 + brazilMin;
  const drawMinutes = h * 60 + m;

  // Janela ao vivo: de 30 min antes até 90 min depois do horário do sorteio
  const LIVE_BEFORE_MIN = 30;
  const LIVE_AFTER_MIN = 90;

  if (drawDayNumbers.includes(today)) {
    // Antes do sorteio (ainda não chegou)
    if (minutesFromMidnight < drawMinutes) {
      const todayDraw = new Date(now);
      todayDraw.setUTCHours(h + 3, m, 0, 0);
      return todayDraw;
    }
    // Dentro da janela ao vivo (sorteio acontecendo ou recém terminado)
    if (minutesFromMidnight <= drawMinutes + LIVE_AFTER_MIN) {
      const todayDraw = new Date(now);
      todayDraw.setUTCHours(h + 3, m, 0, 0);
      return todayDraw;
    }
  }

  // Encontra o próximo dia de sorteio
  let daysUntilNext = 7;
  for (const dayNum of drawDayNumbers) {
    let diff = dayNum - today;
    if (diff <= 0) diff += 7;
    if (diff < daysUntilNext) daysUntilNext = diff;
  }

  const next = new Date(brazilNow);
  next.setUTCDate(brazilNow.getUTCDate() + daysUntilNext);
  next.setUTCHours(h + 3, m, 0, 0);

  return next;
}

function getIsLive(drawDays: string[], drawTime: string): boolean {
  const dayMap: Record<string, number> = {
    'domingo': 0, 'sunday': 0,
    'segunda': 1, 'segunda-feira': 1, 'seg': 1, 'monday': 1,
    'terça': 2, 'terca': 2, 'ter': 2, 'tuesday': 2,
    'quarta': 3, 'qua': 3, 'wednesday': 3,
    'quinta': 4, 'qui': 4, 'thursday': 4,
    'sexta': 5, 'sex': 5, 'friday': 5,
    'sábado': 6, 'sabado': 6, 'sáb': 6, 'saturday': 6,
  };
  const BRAZIL_OFFSET_MS = 3 * 60 * 60 * 1000;
  const now = new Date();
  const brazilNow = new Date(now.getTime() - BRAZIL_OFFSET_MS);
  const today = brazilNow.getUTCDay();
  const [h, m] = drawTime.split(':').map(Number);
  const drawDayNumbers = drawDays.map(d => dayMap[d.toLowerCase()] ?? -1).filter(d => d >= 0);
  if (!drawDayNumbers.includes(today)) return false;
  const minutesFromMidnight = brazilNow.getUTCHours() * 60 + brazilNow.getUTCMinutes();
  const drawMinutes = h * 60 + m;
  return minutesFromMidnight >= drawMinutes - 30 && minutesFromMidnight <= drawMinutes + 90;
}

// GET /api/lotteries
router.get("/", (req, res) => {
  res.json(LOTTERIES);
});

// GET /api/lotteries/:id
router.get("/:id", async (req, res) => {
  const lottery = LOTTERIES.find(l => l.id === req.params.id);
  if (!lottery) return res.status(404).json({ message: 'Lottery not found' });
  res.json(lottery);
});

async function drawsHandler(req: any, res: any) {
  const lottery = LOTTERIES.find(l => l.id === req.params.id);
  if (!lottery) return res.status(404).json({ message: 'Lottery not found' });
  
  try {
    const data = await fetchLatestDraw(req.params.id);
    const normalized = normalizeDrawData(data, req.params.id);
    res.json(normalized ? [normalized] : []);
  } catch (error) {
    res.json([]);
  }
}

router.get("/:id/draws", drawsHandler);
router.get("/:id/draws/:extra", drawsHandler);

// GET /api/lotteries/:id/next-draw
router.get("/:id/next-draw", async (req, res) => {
  const lottery = LOTTERIES.find(l => l.id === req.params.id);
  if (!lottery) return res.status(404).json({ message: 'Lottery not found' });
  
  const nextDrawDate = getNextDrawDate(lottery.drawDays, lottery.drawTime);
  const now = new Date();
  const diff = Math.max(0, nextDrawDate.getTime() - now.getTime());
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  const isLive = getIsLive(lottery.drawDays, lottery.drawTime);

  try {
    const data = await fetchLatestDraw(req.params.id);
    const contestNumber = data?.numero || data?.contestNumber || 1;
    const estimatedPrize = data?.valorEstimadoProximoConcurso || 'R$ 0,00';
    
    res.json({
      contestNumber: contestNumber + 1,
      drawDate: nextDrawDate.toISOString(),
      drawTime: lottery.drawTime,
      timeRemaining: { days, hours, minutes, seconds },
      estimatedPrize,
      isLive,
    });
  } catch {
    res.json({
      contestNumber: 1,
      drawDate: nextDrawDate.toISOString(),
      drawTime: lottery.drawTime,
      timeRemaining: { days, hours, minutes, seconds },
      estimatedPrize: 'R$ 0,00',
      isLive,
    });
  }
});

// GET /api/lotteries/:id/prizes — dados reais de premiação da Caixa
router.get("/:id/prizes", async (req, res) => {
  const lottery = LOTTERIES.find(l => l.id === req.params.id);
  if (!lottery) return res.status(404).json({ message: 'Lottery not found' });

  try {
    const data = await fetchLatestDraw(req.params.id);
    if (!data) return res.status(503).json({ message: 'Dados indisponíveis no momento' });

    const contestNumber   = data.numero || data.contestNumber || 0;
    const nextContest     = contestNumber + 1;
    const estimatedPrize  = data.valorEstimadoProximoConcurso || 0;
    const drawDate        = data.dataApuracao || data.data || null;
    const accumulated     = data.acumulado ?? false;

    // Normaliza premiacao de diferentes formatos da Caixa
    const rawPrizes: any[] = data.premiacao || data.premiacoes || data.listaRateioPremio || [];

    const prizes = rawPrizes.map((p: any, i: number) => {
      const valor   = p.valorPremio ?? p.valor ?? p.premio ?? p.valorLiquido ?? 0;
      const winners = p.ganhadores ?? p.numeroPessoas ?? p.vencedores ?? 0;
      const desc    = p.descricao ?? p.faixaDescricao ?? p.nome ?? `${i + 1}ª Faixa`;
      return {
        tier: i + 1,
        name: desc,
        winners: Number(winners),
        prizeAmount: Number(valor),
        prizeFormatted: Number(valor) > 0
          ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(Number(valor))
          : '—',
        isAccumulated: Number(winners) === 0,
      };
    });

    res.json({
      lotteryId: req.params.id,
      contestNumber,
      nextContest,
      drawDate,
      accumulated,
      estimatedPrize: Number(estimatedPrize),
      estimatedPrizeFormatted: Number(estimatedPrize) > 0
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(Number(estimatedPrize))
        : '—',
      prizes,
    });
  } catch (err: any) {
    res.status(503).json({ message: 'Erro ao buscar prêmios', error: err?.message });
  }
});

// GET /api/lotteries/:id/frequency
router.get("/:id/frequency", async (req, res) => {
  const lottery = LOTTERIES.find(l => l.id === req.params.id);
  if (!lottery) return res.status(404).json({ message: 'Lottery not found' });

  try {
    const draws       = await fetchHistoricalDraws(req.params.id, 30);
    const frequencies = computeFrequencies(lottery.totalNumbers, draws);

    // Metadados extras para visualização no frontend
    const hot  = frequencies.filter(f => f.temperature === 'hot');
    const cold = frequencies.filter(f => f.temperature === 'cold');
    const warm = frequencies.filter(f => f.temperature === 'warm');

    // Responde com envelope enriquecido mas mantém compatibilidade:
    // o campo `frequencies` é o array principal (mantém compat com código existente)
    res.json({
      frequencies,
      meta: {
        lotteryId: lottery.id,
        totalNumbers: lottery.totalNumbers,
        minNumbers: lottery.minNumbers,
        drawsAnalyzed: draws.length,
        recentWindow: Math.min(10, draws.length),
        topHot:  hot.slice(0, 10).map(f => f.number),
        topCold: cold.slice(0, 10).map(f => f.number),
        topWarm: warm.slice(0, 10).map(f => f.number),
        topFrequency: frequencies.slice(0, 15).map(f => ({ number: f.number, frequency: f.frequency, temperature: f.temperature })),
      },
    });
  } catch {
    res.json({ frequencies: computeFrequencies(lottery.totalNumbers, []), meta: {} });
  }
});

// GET /api/lotteries/:id/history
router.get("/:id/history", async (req, res) => {
  const lottery = LOTTERIES.find(l => l.id === req.params.id);
  if (!lottery) return res.status(404).json({ message: 'Lottery not found' });

  try {
    const count = Math.min(parseInt(req.query.count as string) || 20, 50);
    const draws = await fetchHistoricalDraws(req.params.id, count);
    res.json({ lotteryId: req.params.id, drawCount: draws.length, draws });
  } catch {
    res.json({ lotteryId: req.params.id, drawCount: 0, draws: [] });
  }
});


export default router;
