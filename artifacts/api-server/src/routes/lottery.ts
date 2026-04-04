import { Router } from "express";

const router = Router();

const LOTTERIES = [
  { id: 'megasena', name: 'megasena', displayName: 'Mega-Sena', emoji: '💎', minNumbers: 6, maxNumbers: 15, totalNumbers: 60, drawDays: ['Terça', 'Quinta', 'Sábado'], drawTime: '21:00', isActive: true },
  { id: 'lotofacil', name: 'lotofacil', displayName: 'Lotofácil', emoji: '⭐', minNumbers: 15, maxNumbers: 20, totalNumbers: 25, drawDays: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'], drawTime: '21:00', isActive: true },
  { id: 'quina', name: 'quina', displayName: 'Quina', emoji: '🪙', minNumbers: 5, maxNumbers: 15, totalNumbers: 80, drawDays: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'], drawTime: '21:00', isActive: true },
  { id: 'lotomania', name: 'lotomania', displayName: 'Lotomania', emoji: '♾️', minNumbers: 50, maxNumbers: 50, totalNumbers: 100, drawDays: ['Seg', 'Qua', 'Sex'], drawTime: '21:00', isActive: true },
  { id: 'duplasena', name: 'duplasena', displayName: 'Dupla Sena', emoji: '👑', minNumbers: 6, maxNumbers: 15, totalNumbers: 50, drawDays: ['Ter', 'Qui', 'Sáb'], drawTime: '21:00', isActive: true },
  { id: 'timemania', name: 'timemania', displayName: 'Timemania', emoji: '⚽', minNumbers: 10, maxNumbers: 10, totalNumbers: 80, drawDays: ['Ter', 'Qui', 'Sáb'], drawTime: '21:00', isActive: true },
  { id: 'diadesorte', name: 'diadesorte', displayName: 'Dia de Sorte', emoji: '🍀', minNumbers: 7, maxNumbers: 15, totalNumbers: 31, drawDays: ['Ter', 'Qui', 'Sáb'], drawTime: '21:00', isActive: true },
  { id: 'supersete', name: 'supersete', displayName: 'Super Sete', emoji: '7️⃣', minNumbers: 7, maxNumbers: 7, totalNumbers: 10, drawDays: ['Ter', 'Qui', 'Sáb'], drawTime: '21:00', isActive: true },
];

const CAIXA_API = 'https://servicebus2.caixa.gov.br/portaldeloterias/api';
const FALLBACK_API = 'https://loteriascaixa-api.herokuapp.com/api';

async function fetchLatestDraw(lotteryId: string) {
  try {
    const resp = await fetch(`${CAIXA_API}/${lotteryId}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
    });
    if (resp.ok) {
      const data = await resp.json();
      return data;
    }
  } catch {}
  try {
    const resp = await fetch(`${FALLBACK_API}/${lotteryId}/latest`);
    if (resp.ok) return await resp.json();
  } catch {}
  return null;
}

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

function generateNumberFrequencies(totalNumbers: number, recentDraws: number[][]) {
  const freq: Record<number, number> = {};
  for (let i = 1; i <= totalNumbers; i++) freq[i] = 0;
  
  recentDraws.forEach(draw => {
    draw.forEach(num => {
      if (freq[num] !== undefined) freq[num]++;
    });
  });

  const maxFreq = Math.max(...Object.values(freq), 1);
  const sortedByFreq = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  const hotThreshold = sortedByFreq[Math.floor(sortedByFreq.length * 0.2)][1];
  const coldThreshold = sortedByFreq[Math.floor(sortedByFreq.length * 0.8)][1];

  return Object.entries(freq).map(([num, frequency]) => ({
    number: parseInt(num),
    frequency,
    percentage: Math.round((frequency / (recentDraws.length || 1)) * 100),
    isHot: frequency >= hotThreshold,
    isCold: frequency <= coldThreshold,
  }));
}

function generateNumbers(config: typeof LOTTERIES[0], strategy: string, count: number) {
  const total = config.totalNumbers;
  const min = strategy === 'lotofacil' ? config.minNumbers : config.minNumbers;
  const qty = Math.min(count, config.minNumbers);
  
  const numbers: number[] = [];
  while (numbers.length < qty) {
    const n = Math.floor(Math.random() * total) + 1;
    if (!numbers.includes(n)) numbers.push(n);
  }
  return numbers.sort((a, b) => a - b);
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

  const now = new Date();
  const today = now.getDay();
  const [h, m] = drawTime.split(':').map(Number);

  const drawDayNumbers = drawDays.map(d => dayMap[d.toLowerCase()] ?? -1).filter(d => d >= 0);
  if (drawDayNumbers.length === 0) drawDayNumbers.push(3);

  // Se hoje é dia de sorteio e ainda não passou do horário, o próximo sorteio é hoje
  if (drawDayNumbers.includes(today)) {
    const todayDraw = new Date(now);
    todayDraw.setHours(h, m, 0, 0);
    if (now < todayDraw) return todayDraw;
  }

  // Encontra o próximo dia de sorteio
  let daysUntilNext = 7;
  for (const dayNum of drawDayNumbers) {
    let diff = dayNum - today;
    if (diff <= 0) diff += 7;
    if (diff < daysUntilNext) daysUntilNext = diff;
  }

  const next = new Date(now);
  next.setDate(now.getDate() + daysUntilNext);
  next.setHours(h, m, 0, 0);

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
    const data = await fetchLatestDraw(req.params.id);
    const drawnNumbers = data?.dezenas?.map(Number) || data?.listaDezenas?.map(Number) || [];
    const frequencies = generateNumberFrequencies(lottery.totalNumbers, drawnNumbers.length > 0 ? [drawnNumbers] : []);
    res.json(frequencies);
  } catch {
    const frequencies = generateNumberFrequencies(lottery.totalNumbers, []);
    res.json(frequencies);
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
