import { Router, type IRouter } from "express";
import healthRouter from "./health";
import lotteryRouter from "./lottery";
import { Request, Response } from "express";
import { LOTTERIES, fetchHistoricalDraws, computeFrequencies } from "../lib/lotteryData";
import { gerarJogosMaster, gerarDesdobramento } from "../core/sharkEngine";
import { db, userGamesTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

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

    const draws = await fetchHistoricalDraws(type, 30);
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

    const delayMap: Record<number, number> = {};
    for (let n = 1; n <= totalNumbers; n++) {
      let delay = draws.length;
      for (let i = 0; i < draws.length; i++) {
        if (draws[i].includes(n)) { delay = i; break; }
      }
      delayMap[n] = delay;
    }

    const avgSum   = draws.reduce((s, d) => s + d.reduce((a, b) => a + b, 0), 0) / draws.length;
    const avgEvens = draws.reduce((s, d) => s + d.filter(n => n % 2 === 0).length, 0) / draws.length;

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

router.post("/lottery/generate", async (req: Request, res: Response) => {
  // Rota legada — encaminha para o Shark Engine via /api/games/generate
  const { gameType, lotteryId, quantity, numbersCount, amountOfGames, gamesCount, strategy = 'mixed' } = req.body;
  const finalLotteryId  = lotteryId || gameType || 'megasena';
  const finalGamesCount = gamesCount || amountOfGames || 1;
  const finalNumbers    = numbersCount || quantity;

  const lottery = LOTTERIES.find(l => l.id === finalLotteryId) || LOTTERIES[0];
  const qty     = finalNumbers
    ? Math.min(Math.max(finalNumbers, lottery.minNumbers), lottery.totalNumbers)
    : lottery.minNumbers;
  const count = Math.min(Math.max(finalGamesCount, 1), 50);

  try {
    const draws     = await fetchHistoricalDraws(finalLotteryId, 30);
    const drawsUsed = draws.length;
    if (drawsUsed < 2) return res.status(503).json({ message: 'Sorteios indisponíveis no momento.' });

    const pesosEstrategia = STRATEGY_PESOS[strategy] || STRATEGY_PESOS.mixed;
    const { jogos } = gerarJogosMaster(draws, count, lottery.totalNumbers, qty, pesosEstrategia);

    res.json(jogos.map(j => ({
      numbers: j.jogo,
      strategy,
      sharkScore: j.score,
      sharkOrigem: j.origem,
      dataSource: `${drawsUsed} sorteios reais`,
    })));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/user/games — busca jogos salvos do banco de dados
router.get("/user/games", async (req: Request, res: Response) => {
  try {
    const games = await db
      .select()
      .from(userGamesTable)
      .orderBy(desc(userGamesTable.createdAt))
      .limit(500);

    const formatted = games.map(g => ({
      id: g.id,
      lotteryId: g.lotteryId,
      gameType: g.lotteryId,
      numbers: g.selectedNumbers as number[],
      selectedNumbers: g.selectedNumbers as number[],
      strategy: g.strategy,
      confidence: g.confidence ? Number(g.confidence) : undefined,
      reasoning: g.reasoning,
      dataSource: g.dataSource,
      sharkScore: g.sharkScore ? Number(g.sharkScore) : undefined,
      sharkOrigem: g.sharkOrigem,
      sharkContexto: g.sharkContexto,
      matches: g.matches,
      prizeWon: g.prizeWon,
      contestNumber: g.contestNumber,
      status: g.status,
      hits: g.hits,
      createdAt: g.createdAt.toISOString(),
    }));

    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ message: 'Erro ao buscar jogos salvos', error: err?.message });
  }
});

// POST /api/user/games — salva um jogo no banco de dados
router.post("/user/games", async (req: Request, res: Response) => {
  try {
    const {
      lotteryId, gameType, selectedNumbers, numbers,
      strategy, confidence, reasoning, dataSource,
      sharkScore, sharkOrigem, sharkContexto,
      matches, prizeWon, contestNumber,
    } = req.body;

    const finalLotteryId = lotteryId || gameType || 'megasena';
    const finalNumbers   = selectedNumbers || numbers || [];

    const [inserted] = await db
      .insert(userGamesTable)
      .values({
        lotteryId: finalLotteryId,
        selectedNumbers: finalNumbers,
        strategy: strategy || 'mixed',
        confidence: confidence != null ? String(confidence) : null,
        reasoning: reasoning || null,
        dataSource: dataSource || null,
        sharkScore: sharkScore != null ? String(sharkScore) : null,
        sharkOrigem: sharkOrigem || null,
        sharkContexto: sharkContexto || null,
        matches: matches ?? 0,
        prizeWon: prizeWon ?? '0',
        contestNumber: contestNumber || null,
        status: 'pending',
        hits: 0,
      })
      .returning();

    res.status(201).json({
      id: inserted.id,
      lotteryId: inserted.lotteryId,
      gameType: inserted.lotteryId,
      numbers: inserted.selectedNumbers,
      selectedNumbers: inserted.selectedNumbers,
      strategy: inserted.strategy,
      confidence: inserted.confidence ? Number(inserted.confidence) : undefined,
      reasoning: inserted.reasoning,
      dataSource: inserted.dataSource,
      sharkScore: inserted.sharkScore ? Number(inserted.sharkScore) : undefined,
      sharkOrigem: inserted.sharkOrigem,
      sharkContexto: inserted.sharkContexto,
      matches: inserted.matches,
      prizeWon: inserted.prizeWon,
      contestNumber: inserted.contestNumber,
      status: inserted.status,
      hits: inserted.hits,
      createdAt: inserted.createdAt.toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Erro ao salvar jogo', error: err?.message });
  }
});

router.post("/user/games/check", (req: Request, res: Response) => {
  res.json({ updatedCount: 0 });
});

// GET /api/games — busca jogos salvos do banco de dados
router.get("/games", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const games = await db
      .select()
      .from(userGamesTable)
      .orderBy(desc(userGamesTable.createdAt))
      .limit(limit);

    const formatted = games.map(g => ({
      id: g.id,
      lotteryId: g.lotteryId,
      selectedNumbers: g.selectedNumbers as number[],
      strategy: g.strategy,
      confidence: g.confidence ? Number(g.confidence) : undefined,
      reasoning: g.reasoning,
      sharkScore: g.sharkScore ? Number(g.sharkScore) : undefined,
      sharkOrigem: g.sharkOrigem,
      sharkContexto: g.sharkContexto,
      matches: g.matches,
      prizeWon: g.prizeWon,
      contestNumber: g.contestNumber,
      status: g.status,
      hits: g.hits,
      createdAt: g.createdAt.toISOString(),
    }));

    res.json(formatted);
  } catch {
    res.json([]);
  }
});

// DELETE /api/games/:id — remove um jogo específico
router.delete("/games/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'ID inválido' });
    await db.delete(userGamesTable).where(eq(userGamesTable.id, id));
    res.json({ success: true, deleted: id });
  } catch (err: any) {
    res.status(500).json({ message: 'Erro ao deletar jogo', error: err?.message });
  }
});

// DELETE /api/games — zera todos os jogos salvos
router.delete("/games", async (req: Request, res: Response) => {
  try {
    await db.delete(userGamesTable);
    res.json({ success: true, message: 'Todos os jogos foram removidos com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ message: 'Erro ao limpar jogos', error: err?.message });
  }
});

// Pesos por estratégia — define o comportamento do Shark Engine por modo
const STRATEGY_PESOS: Record<string, { frequencia: number; atraso: number; repeticao: number }> = {
  hot:   { frequencia: 0.70, atraso: 0.15, repeticao: 0.15 }, // Prioriza quentes (alta freq recente)
  cold:  { frequencia: 0.15, atraso: 0.70, repeticao: 0.15 }, // Prioriza frias (maior atraso)
  mixed: { frequencia: 0.50, atraso: 0.30, repeticao: 0.20 }, // Equilibrado quente+fria
  ai:    { frequencia: 0.40, atraso: 0.40, repeticao: 0.20 }, // Análise avançada: pesos iguais
  shark: { frequencia: 0.50, atraso: 0.30, repeticao: 0.20 }, // Motor master (pesos do request têm prioridade)
};

const STRATEGY_LABEL: Record<string, string> = {
  hot:   'Números Quentes',
  cold:  'Dezenas Frias',
  mixed: 'Estratégia Mista',
  ai:    'IA Avançada',
  shark: 'Motor Shark Master',
};

const STRATEGY_REASONING: Record<string, string> = {
  hot:   'Análise dos 30 últimos sorteios — prioriza dezenas com alta frequência recente (quentes)',
  cold:  'Análise dos 30 últimos sorteios — prioriza dezenas com maior atraso acumulado (frias/vencidas)',
  mixed: 'Análise dos 30 últimos sorteios — combina quentes (frequência recente) + frias (atraso) equilibrado',
  ai:    'Análise dos 30 últimos sorteios — pesos iguais para frequência recente e atraso, análise estatística completa',
  shark: 'Motor Shark Master — desdobramento quente/fria com score de variação sobre os 30 últimos sorteios',
};

router.post("/games/generate", async (req: Request, res: Response) => {
  const { lotteryId = 'megasena', numbersCount, gamesCount = 1, strategy = 'mixed' } = req.body;

  const lottery = LOTTERIES.find(l => l.id === lotteryId) || LOTTERIES[0];
  const qty   = Math.min(Math.max(numbersCount || lottery.minNumbers, lottery.minNumbers), lottery.totalNumbers);
  const count = Math.min(Math.max(gamesCount, 1), 100);

  try {
    // SEMPRE busca os 30 últimos sorteios reais para TODAS as estratégias
    const draws     = await fetchHistoricalDraws(lotteryId, 30);
    const drawsUsed = draws.length;

    if (drawsUsed < 2) {
      return res.status(503).json({
        message: `Não foi possível buscar sorteios reais da ${lottery.displayName}. Aguarde e tente novamente.`,
      });
    }

    // Pesos: usa do request se veio (estratégia shark com pesos customizados), senão usa o padrão da estratégia
    const pesosReq = req.body.pesos;
    const pesosEstrategia = STRATEGY_PESOS[strategy] || STRATEGY_PESOS.mixed;
    const pesosFinais = (strategy === 'shark' && pesosReq && typeof pesosReq === 'object')
      ? {
          frequencia: Math.max(0.05, Math.min(0.90, Number(pesosReq.frequencia) || pesosEstrategia.frequencia)),
          atraso:     Math.max(0.05, Math.min(0.90, Number(pesosReq.atraso)     || pesosEstrategia.atraso)),
          repeticao:  Math.max(0.05, Math.min(0.90, Number(pesosReq.repeticao)  || pesosEstrategia.repeticao)),
        }
      : pesosEstrategia;

    // TODAS as estratégias passam pelo Shark Engine v2 com análise real dos sorteios
    const { jogos, contexto } = gerarJogosMaster(
      draws,
      count,
      lottery.totalNumbers,
      qty,
      pesosFinais,
    );

    const insertValues = jogos.map(result => ({
      lotteryId,
      selectedNumbers: result.jogo,
      strategy,
      confidence: String(parseFloat(Math.min(0.95, 0.55 + result.score / 600).toFixed(2))),
      reasoning: `${STRATEGY_REASONING[strategy] || 'Análise Shark'} | ${contexto.totalValidados} jogos validados`,
      dataSource: `${drawsUsed} sorteios reais da Caixa Econômica Federal`,
      sharkScore: String(result.score),
      sharkOrigem: result.origem,
      sharkContexto: {
        estrategia:        STRATEGY_LABEL[strategy] || strategy,
        pesosUsados:       pesosFinais,
        hot:               contexto.hot.slice(0, 10),
        warm:              contexto.warm.slice(0, 10),
        cold:              contexto.cold.slice(0, 10),
        totalCandidatos:   contexto.totalCandidatos,
        totalValidados:    contexto.totalValidados,
        estrategiasUsadas: contexto.estrategiasUsadas,
        sorteiosAnalisados: drawsUsed,
      },
      matches: 0,
      prizeWon: '0',
      contestNumber: null as number | null,
      status: 'pending',
      hits: 0,
    }));

    const inserted = await db.insert(userGamesTable).values(insertValues).returning();

    const games = inserted.map(g => ({
      id: g.id,
      lotteryId: g.lotteryId,
      selectedNumbers: g.selectedNumbers as number[],
      strategy: g.strategy,
      confidence: g.confidence ? Number(g.confidence) : undefined,
      reasoning: g.reasoning,
      dataSource: g.dataSource,
      sharkScore: g.sharkScore ? Number(g.sharkScore) : undefined,
      sharkOrigem: g.sharkOrigem,
      sharkContexto: g.sharkContexto,
      matches: g.matches,
      prizeWon: g.prizeWon,
      contestNumber: g.contestNumber,
      createdAt: g.createdAt.toISOString(),
    }));

    res.json(games);
  } catch (err: any) {
    res.status(500).json({ message: 'Erro ao buscar dados da Caixa. Tente novamente.', error: err?.message });
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

router.get("/users/stats", async (req: Request, res: Response) => {
  try {
    const games = await db.select().from(userGamesTable);
    const wins = games.filter(g => g.status === 'won').length;
    const total = games.length;
    res.json({
      totalGames: total,
      totalChecked: games.filter(g => g.status !== 'pending').length,
      wins,
      winRate: total > 0 ? parseFloat((wins / total * 100).toFixed(1)) : 0,
      totalPrize: 0,
    });
  } catch {
    res.json({ totalGames: 0, totalChecked: 0, wins: 0, winRate: 0, totalPrize: 0 });
  }
});

router.post("/auth/upgrade", (req: Request, res: Response) => {
  res.json({
    user: { id: 'user-1', isPremium: true },
  });
});

export default router;
