import { Router, type IRouter } from "express";
import healthRouter from "./health";
import lotteryRouter from "./lottery";
import { Request, Response } from "express";
import { LOTTERIES, fetchHistoricalDraws, computeFrequencies, generateSmartNumbers } from "../lib/lotteryData";
import { gerarJogosMaster, gerarDesdobramento } from "../core/sharkEngine";

const router: IRouter = Router();

router.use(healthRouter);

router.use("/lotteries", lotteryRouter);

router.get("/lottery/games", async (req: Request, res: Response) => {
  try {
    const { type, limit = 20 } = req.query;
    const CAIXA_API = 'https://servicebus2.caixa.gov.br/portaldeloterias/api';
    if (type) {
      const resp = await fetch(`${CAIXA_API}/${type}`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
      });
      if (resp.ok) {
        const data = await resp.json();
        return res.json([data]);
      }
    }
    res.json([]);
  } catch {
    res.json([]);
  }
});

router.get("/lottery/latest/:type", async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const CAIXA_API = 'https://servicebus2.caixa.gov.br/portaldeloterias/api';
    const resp = await fetch(`${CAIXA_API}/${type}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
    });
    if (resp.ok) {
      const data = await resp.json();
      const numbers = data.dezenas?.map(Number) || data.listaDezenas?.map(Number) || [];
      return res.json({
        type,
        contestNumber: data.numero || 1,
        drawnNumbers: numbers,
        drawDate: data.dataApuracao || new Date().toISOString(),
        prizeAmount: data.valorArrecadado || 'R$ 0,00',
      });
    }
    res.status(404).json({ message: 'Not found' });
  } catch {
    res.status(404).json({ message: 'Not found' });
  }
});

router.get("/lottery/analyze/:type", async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const lottery = LOTTERIES.find(l => l.id === type);
    const totalNumbers = lottery?.totalNumbers || 60;

    const draws = await fetchHistoricalDraws(type, 50);
    if (draws.length === 0) {
      return res.json({
        recommendation: 'Dados insuficientes para análise. Tente novamente em instantes.',
        stats: { hotNumbers: [], coldNumbers: [], warmNumbers: [], rareNumbers: [], frequencyMap: {}, delayMap: {}, drawsAnalyzed: 0 },
      });
    }

    const freqs = computeFrequencies(totalNumbers, draws);
    const sorted = [...freqs].sort((a, b) => b.frequency - a.frequency);
    const hotCut  = Math.floor(sorted.length * 0.25);
    const coldCut = Math.floor(sorted.length * 0.75);

    const hotNumbers  = sorted.slice(0, hotCut).map(f => f.number);
    const warmNumbers = sorted.slice(hotCut, coldCut).map(f => f.number);
    const coldNumbers = sorted.slice(coldCut).map(f => f.number);

    // Atraso real: quantos sorteios desde a última aparição de cada número
    const delayMap: Record<number, number> = {};
    for (let n = 1; n <= totalNumbers; n++) {
      let delay = draws.length;
      for (let i = 0; i < draws.length; i++) {
        if (draws[i].includes(n)) { delay = i; break; }
      }
      delayMap[n] = delay;
    }

    // Estatísticas de distribuição
    const avgSum   = draws.reduce((s, d) => s + d.reduce((a, b) => a + b, 0), 0) / draws.length;
    const avgEvens = draws.reduce((s, d) => s + d.filter(n => n % 2 === 0).length, 0) / draws.length;

    // Números com maior atraso (overdue)
    const overdue = Object.entries(delayMap)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 8)
      .map(([n]) => Number(n));

    const frequencyMap = Object.fromEntries(freqs.map(f => [f.number, f.frequency]));

    res.json({
      recommendation: `Análise baseada em ${draws.length} sorteios reais. Quentes: ${hotNumbers.slice(0, 5).join(', ')}. Maior atraso: ${overdue.slice(0, 3).join(', ')}. Soma média: ${Math.round(avgSum)}. Média pares: ${avgEvens.toFixed(1)}.`,
      stats: {
        hotNumbers:   hotNumbers.slice(0, 12),
        warmNumbers:  warmNumbers.slice(0, 12),
        coldNumbers:  coldNumbers.slice(0, 12),
        rareNumbers:  coldNumbers.slice(0, 5),
        overdueNumbers: overdue,
        frequencyMap,
        delayMap,
        avgSum:    Math.round(avgSum),
        avgEvens:  parseFloat(avgEvens.toFixed(1)),
        drawsAnalyzed: draws.length,
      },
    });
  } catch {
    res.json({
      recommendation: 'Análise indisponível no momento.',
      stats: { hotNumbers: [], coldNumbers: [], rareNumbers: [], frequencyMap: {} },
    });
  }
});

router.post("/lottery/generate", (req: Request, res: Response) => {
  const { gameType = 'megasena', quantity = 6, amountOfGames = 1, strategy = 'random' } = req.body;
  
  const CONFIGS: Record<string, { total: number; min: number }> = {
    megasena: { total: 60, min: 6 },
    lotofacil: { total: 25, min: 15 },
    quina: { total: 80, min: 5 },
    lotomania: { total: 100, min: 50 },
    duplasena: { total: 50, min: 6 },
    timemania: { total: 80, min: 10 },
    diadesorte: { total: 31, min: 7 },
    supersete: { total: 10, min: 7 },
  };
  
  const config = CONFIGS[gameType] || { total: 60, min: 6 };
  const games = [];
  
  for (let i = 0; i < Math.min(amountOfGames, 50); i++) {
    const nums: number[] = [];
    const qty = Math.max(quantity || config.min, config.min);
    while (nums.length < qty) {
      const n = Math.floor(Math.random() * config.total) + 1;
      if (!nums.includes(n)) nums.push(n);
    }
    games.push({ numbers: nums.sort((a, b) => a - b), strategy });
  }
  
  res.json(games);
});

const userGamesStore: any[] = [];

router.get("/user/games", (req: Request, res: Response) => {
  res.json(userGamesStore);
});

router.post("/user/games", (req: Request, res: Response) => {
  const game = { id: Date.now(), ...req.body, createdAt: new Date().toISOString() };
  userGamesStore.push(game);
  res.status(201).json(game);
});

router.post("/user/games/check", (req: Request, res: Response) => {
  res.json({ updatedCount: 0 });
});

router.get("/games", (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  res.json(userGamesStore.slice(-limit).reverse());
});

router.post("/games/generate", async (req: Request, res: Response) => {
  const { lotteryId = 'megasena', numbersCount, gamesCount = 1, strategy = 'mixed' } = req.body;

  const lottery = LOTTERIES.find(l => l.id === lotteryId) || LOTTERIES[0];
  const qty   = Math.min(Math.max(numbersCount || lottery.minNumbers, lottery.minNumbers), lottery.totalNumbers);
  const count = Math.min(Math.max(gamesCount, 1), 100);

  const STRATEGY_REASONING: Record<string, string> = {
    hot:    'Números com maior frequência nos últimos 20 sorteios reais',
    cold:   'Números com menor frequência nos últimos 20 sorteios reais',
    mixed:  'Combinação balanceada: 40% quentes, 30% mornos, 30% frios',
    ai:     'Análise estatística: frequência real + paridade + soma + padrões consecutivos',
    manual: 'Seleção manual do usuário',
    shark:  'Motor Shark Autônomo: simula estratégias, escolhe a melhor e gera jogos pontuados',
  };

  try {
    const draws     = await fetchHistoricalDraws(lotteryId, 50);
    const drawsUsed = draws.length;

    if (strategy === 'shark') {
      const pesosReq = req.body.pesos;
      const pesosNorm = pesosReq && typeof pesosReq === 'object'
        ? {
            frequencia: Math.max(0.05, Math.min(0.90, Number(pesosReq.frequencia) || 0.50)),
            atraso:     Math.max(0.05, Math.min(0.90, Number(pesosReq.atraso)     || 0.30)),
            repeticao:  Math.max(0.05, Math.min(0.90, Number(pesosReq.repeticao)  || 0.20)),
          }
        : undefined;

      const { jogos, contexto } = gerarJogosMaster(draws, count, lottery.totalNumbers, qty, pesosNorm);

      const games = jogos.map((result, i) => {
        const game = {
          id: Date.now() + i,
          lotteryId,
          selectedNumbers: result.jogo,
          strategy: 'shark',
          confidence: parseFloat(Math.min(0.95, 0.60 + result.score / 800).toFixed(2)),
          reasoning: `Motor Shark Master — ${contexto.estrategiasUsadas.length} estratégias | ${contexto.totalValidados} jogos validados`,
          dataSource: `${drawsUsed} sorteios reais da Caixa Econômica Federal`,
          sharkScore: result.score,
          sharkOrigem: result.origem,
          sharkContexto: {
            hot:  contexto.hot.slice(0, 8),
            warm: contexto.warm.slice(0, 8),
            cold: contexto.cold.slice(0, 8),
            totalCandidatos: contexto.totalCandidatos,
            totalValidados:  contexto.totalValidados,
          },
          matches: 0,
          prizeWon: '0',
          contestNumber: null,
          createdAt: new Date().toISOString(),
        };
        userGamesStore.push(game);
        return game;
      });

      return res.json(games);
    }

    const freqs = computeFrequencies(lottery.totalNumbers, draws);

    // Confiança baseada na qualidade dos dados: mais sorteios = mais confiável
    const dataQuality = Math.min(drawsUsed / 50, 1);
    const baseConfidence: Record<string, number> = {
      hot: 0.62, cold: 0.58, mixed: 0.65, ai: 0.72, manual: 0.50,
    };
    const strategyBase = baseConfidence[strategy] ?? 0.60;

    const games = [];
    for (let i = 0; i < count; i++) {
      const selected = generateSmartNumbers(freqs, qty, strategy, lottery.totalNumbers);
      const confidence = parseFloat((strategyBase * (0.85 + dataQuality * 0.15)).toFixed(2));
      const game = {
        id: Date.now() + i,
        lotteryId,
        selectedNumbers: selected,
        strategy,
        confidence,
        reasoning: STRATEGY_REASONING[strategy] || 'Geração baseada em dados reais',
        dataSource: `${drawsUsed} sorteios reais da Caixa Econômica Federal`,
        matches: 0,
        prizeWon: '0',
        contestNumber: null,
        createdAt: new Date().toISOString(),
      };
      userGamesStore.push(game);
      games.push(game);
    }
    res.json(games);
  } catch {
    res.status(500).json({ message: 'Erro ao buscar dados da Caixa. Tente novamente.' });
  }
});

// POST /api/games/desdobramento — Gera combinações a partir do pool dos melhores jogos Shark
router.post("/games/desdobramento", async (req: Request, res: Response) => {
  const { lotteryId = 'megasena', jogos = [], limite = 500 } = req.body;

  const lottery = LOTTERIES.find(l => l.id === lotteryId) || LOTTERIES[0];

  if (!Array.isArray(jogos) || jogos.length === 0) {
    return res.status(400).json({ message: 'Envie os jogos Shark para gerar o desdobramento' });
  }

  const sharkResults = jogos.map((j: any) => ({
    jogo: Array.isArray(j.jogo) ? j.jogo : j.selectedNumbers || [],
    score: j.score || 0,
    origem: j.sharkOrigem || 'shark',
  }));

  const { combinacoes, total, poolUsado } = gerarDesdobramento(
    sharkResults,
    lottery.minNumbers,
    Math.min(limite, 500),
  );

  const games = combinacoes.map((combo, i) => ({
    id: Date.now() + i,
    lotteryId,
    selectedNumbers: combo,
    strategy: 'desdobramento-shark',
    confidence: 0.75,
    reasoning: `Desdobramento Shark — pool de ${poolUsado.length} dezenas únicas → ${total} combinações`,
    dataSource: 'Desdobramento automático do Motor Shark Master',
    matches: 0,
    prizeWon: '0',
    contestNumber: null,
    createdAt: new Date().toISOString(),
  }));

  res.json({
    lotteryId,
    poolUsado,
    totalCombinacoes: total,
    games,
  });
});

router.get("/auth/user", (req: Request, res: Response) => {
  res.json({
    id: "guest-user",
    name: "SHARK User",
    email: "user@lotoshark.com",
    isPremium: false,
  });
});

router.post("/auth/login", (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email e senha são obrigatórios' });
  }
  res.json({
    user: { id: 'user-1', email, name: email.split('@')[0], isPremium: false },
    token: 'mock-token-' + Date.now(),
  });
});

router.post("/auth/register", (req: Request, res: Response) => {
  const { email, password, firstName } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email e senha são obrigatórios' });
  }
  res.json({
    user: { id: 'user-' + Date.now(), email, name: firstName || email.split('@')[0], isPremium: false },
    token: 'mock-token-' + Date.now(),
  });
});

router.get("/users/stats", (req: Request, res: Response) => {
  res.json({
    totalGames: userGamesStore.length,
    totalChecked: 0,
    wins: 0,
    winRate: 0,
    totalPrize: 0,
  });
});

router.post("/auth/upgrade", (req: Request, res: Response) => {
  res.json({
    user: { id: 'user-1', isPremium: true },
  });
});

export default router;
