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

  // Se hoje é dia de sorteio e ainda não passou o horário em Brasília
  if (drawDayNumbers.includes(today)) {
    const brazilH = brazilNow.getUTCHours();
    const brazilMin = brazilNow.getUTCMinutes();
    if (brazilH < h || (brazilH === h && brazilMin < m)) {
      const todayDraw = new Date(now);
      todayDraw.setUTCHours(h + 3, m, 0, 0); // 20:00 BRT = 23:00 UTC
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
  next.setUTCHours(h + 3, m, 0, 0); // 20:00 BRT = 23:00 UTC

  return next;
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
    });
  } catch {
    res.json({
      contestNumber: 1,
      drawDate: nextDrawDate.toISOString(),
      drawTime: lottery.drawTime,
      timeRemaining: { days, hours, minutes, seconds },
      estimatedPrize: 'R$ 0,00',
    });
  }
});

// GET /api/lotteries/:id/frequency
router.get("/:id/frequency", async (req, res) => {
  const lottery = LOTTERIES.find(l => l.id === req.params.id);
  if (!lottery) return res.status(404).json({ message: 'Lottery not found' });

  try {
    const draws = await fetchHistoricalDraws(req.params.id, 20);
    const frequencies = computeFrequencies(lottery.totalNumbers, draws);
    res.json(frequencies);
  } catch {
    res.json(computeFrequencies(lottery.totalNumbers, []));
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

// POST /api/lotteries/:id/generate
router.post("/:id/generate", (req, res) => {
  const lottery = LOTTERIES.find(l => l.id === req.params.id);
  if (!lottery) return res.status(404).json({ message: 'Lottery not found' });
  
  const { quantity = lottery.minNumbers, strategy = 'random', amountOfGames = 1 } = req.body;
  
  const games = [];
  for (let i = 0; i < Math.min(amountOfGames, 50); i++) {
    games.push({
      numbers: generateNumbers(lottery, strategy, quantity),
      strategy,
    });
  }
  
  res.json(games);
});

export default router;
