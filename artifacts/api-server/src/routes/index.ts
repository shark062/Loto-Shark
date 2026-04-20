import { Router, type IRouter } from "express";
import healthRouter from "./health";
import lotteryRouter from "./lottery";
import { Request, Response } from "express";
import { LOTTERIES, fetchHistoricalDraws, computeFrequencies, getHistoryConfig, computeTopPairs } from "../lib/lotteryData";
import { gerarJogosMaster, gerarDesdobramento } from "../core/sharkEngine";
import { db, userGamesTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { buildSharkAnalysisContext, callWithFallback, runEnsemble } from "../lib/aiEnsemble";
import { listProviders } from "../lib/aiProviders";

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

router.get('/lottery/analyze/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const lottery = LOTTERIES.find(l => l.id === type);
    const totalNumbers = lottery?.totalNumbers || 60;
    const { optimal } = getHistoryConfig(type);

    const draws = await fetchHistoricalDraws(type, optimal);
    if (draws.length === 0) {
      return res.json({
        recommendation: 'Dados insuficientes para análise. Tente novamente em instantes.',
        stats: { hotNumbers: [], coldNumbers: [], warmNumbers: [], rareNumbers: [], frequencyMap: {}, delayMap: {}, drawsAnalyzed: 0 },
      });
    }

    const freqs = computeFrequencies(totalNumbers, draws);
    // Usa temperatura do computeFrequencies (fonte única de verdade)
    const hotNumbers  = freqs.filter(f => f.temperature === 'hot').map(f => f.number);
    const warmNumbers = freqs.filter(f => f.temperature === 'warm').map(f => f.number);
    const coldNumbers = freqs.filter(f => f.temperature === 'cold').map(f => f.number);

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
      .slice(0, 10)
      .map(([n]) => Number(n));

    const frequencyMap = Object.fromEntries(freqs.map(f => [f.number, f.frequency]));
    const topPairs = computeTopPairs(draws, 10);

    res.json({
      recommendation: `Análise de ${draws.length} sorteios reais. Quentes: ${hotNumbers.slice(0,5).join(', ')}. Atrasados: ${overdue.slice(0,3).join(', ')}. Soma média: ${Math.round(avgSum)}. Pares médios: ${avgEvens.toFixed(1)}.`,
      stats: {
        hotNumbers:     hotNumbers.slice(0, 15),
        warmNumbers:    warmNumbers.slice(0, 15),
        coldNumbers:    coldNumbers.slice(0, 15),
        rareNumbers:    coldNumbers.slice(0, 8),
        overdueNumbers: overdue,
        frequencyMap,
        delayMap,
        topPairs,
        avgSum:        Math.round(avgSum),
        avgEvens:      parseFloat(avgEvens.toFixed(1)),
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

router.post('/games/generate', async (req: Request, res: Response) => {
  const { lotteryId = 'megasena', numbersCount, gamesCount = 1, strategy = 'mixed' } = req.body;

  const lottery = LOTTERIES.find(l => l.id === lotteryId) || LOTTERIES[0];
  const qty   = Math.min(Math.max(numbersCount || lottery.minNumbers, lottery.minNumbers), lottery.totalNumbers);
  const count = Math.min(Math.max(gamesCount, 1), 100);

  try {
    // Usa histórico adaptativo por modalidade
    const { optimal } = getHistoryConfig(lotteryId);
    const draws = await fetchHistoricalDraws(lotteryId, optimal);

    if (draws.length < 2) {
      return res.status(503).json({
        message: `Não foi possível buscar sorteios reais da ${lottery.displayName}. Aguarde e tente novamente.`,
      });
    }

    // Pesos por estratégia
    const pesosReq = req.body.pesos;
    const pesosEstrategia = STRATEGY_PESOS[strategy] || STRATEGY_PESOS.mixed;
    const pesosFinais = (strategy === 'shark' && pesosReq && typeof pesosReq === 'object')
      ? {
          frequencia: Math.max(0.05, Math.min(0.90, Number(pesosReq.frequencia) || pesosEstrategia.frequencia)),
          atraso:     Math.max(0.05, Math.min(0.90, Number(pesosReq.atraso)     || pesosEstrategia.atraso)),
          repeticao:  Math.max(0.05, Math.min(0.90, Number(pesosReq.repeticao)  || pesosEstrategia.repeticao)),
        }
      : pesosEstrategia;

    // --- PIPELINE INTEGRADO ---
    // 1. Análise estatística (sempre roda)
    const freqs = computeFrequencies(lottery.totalNumbers, draws);
    const hotNumbers  = freqs.filter(f => f.temperature === 'hot').map(f => f.number);
    const coldNumbers = freqs.filter(f => f.temperature === 'cold').map(f => f.number);
    const warmNumbers = freqs.filter(f => f.temperature === 'warm').map(f => f.number);
    const frequencyMap: Record<number, number> = {};
    for (const f of freqs) frequencyMap[f.number] = f.frequency;
    const avgSum = draws.reduce((s, d) => s + d.reduce((a, b) => a + b, 0), 0) / draws.length;
    const avgEvens = draws.reduce((s, d) => s + d.filter(n => n % 2 === 0).length, 0) / draws.length;
    const baseCtx = {
      lotteryId, lotteryName: lottery.displayName,
      totalNumbers: lottery.totalNumbers, minNumbers: qty,
      draws: draws.map((d, i) => ({ contestNumber: i + 1, numbers: d })),
      hotNumbers, coldNumbers, warmNumbers, frequencyMap, avgSum, avgEvens,
    };
    const sharkCtx = buildSharkAnalysisContext(baseCtx, draws);

    // 2. SharkEngine gera candidatos baseados em análise estatística
    const { jogos, contexto } = gerarJogosMaster(draws, count, lottery.totalNumbers, qty, pesosFinais);

    // 3. Se strategy === 'ai' ou 'shark' e houver IAs disponíveis, refina com ensemble
    let aiRefinement: any = null;
    if ((strategy === 'ai' || strategy === 'shark') && count <= 10) {
      try {
        const { stats } = listProviders();
        if (stats.active > 0) {
          const ensemble = await runEnsemble(sharkCtx);
          if (ensemble.successfulProviders > 0) {
            aiRefinement = {
              consensusNumbers: ensemble.consensusNumbers,
              confidence: ensemble.overallConfidence,
              reasoning: ensemble.reasoning,
              successfulProviders: ensemble.successfulProviders,
            };
            // Injeta o jogo consenso da IA como primeiro resultado se não estiver lá
            const consensusKey = ensemble.consensusNumbers.slice().sort((a,b)=>a-b).join(',');
            const alreadyIn = jogos.some(j => j.jogo.slice().sort((a,b)=>a-b).join(',') === consensusKey);
            if (!alreadyIn && jogos.length > 0) {
              jogos[0] = { jogo: ensemble.consensusNumbers, score: 9999, origem: 'ensemble_ia' };
            }
          }
        }
      } catch {
        // Falha silenciosa — SharkEngine já gerou jogos suficientes
      }
    }

    const insertValues = jogos.map(result => ({
      lotteryId,
      selectedNumbers: result.jogo,
      strategy,
      confidence: String(parseFloat(Math.min(0.95, 0.55 + result.score / 600).toFixed(2))),
      reasoning: `${STRATEGY_REASONING[strategy] || 'Análise Shark'} | ${contexto.totalValidados} jogos validados | ${draws.length} sorteios analisados`,
      dataSource: `${draws.length} sorteios reais da Caixa Econômica Federal`,
      sharkScore: String(result.score),
      sharkOrigem: result.origem,
      sharkContexto: {
        estrategia:        STRATEGY_LABEL[strategy] || strategy,
        pesosUsados:       pesosFinais,
        hot:               contexto.hot.slice(0, 12),
        warm:              contexto.warm.slice(0, 10),
        cold:              contexto.cold.slice(0, 10),
        overdueTop:        sharkCtx.overdueNumbers.slice(0, 8),
        topPairs:          sharkCtx.topPairs.slice(0, 5),
        totalCandidatos:   contexto.totalCandidatos,
        totalValidados:    contexto.totalValidados,
        estrategiasUsadas: contexto.estrategiasUsadas,
        sorteiosAnalisados: draws.length,
        aiRefinement,
      },
      matches:       0,
      prizeWon:      '0',
      contestNumber: null as number | null,
      status:        'pending',
      hits:          0,
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

// POST /api/games/score — Pontua um jogo contra o histórico real (sem salvar no banco)
router.post('/games/score', async (req: Request, res: Response) => {
  try {
    const { lotteryId = 'megasena', numbers } = req.body;
    if (!Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({ message: 'Envie o campo "numbers" com os números do jogo.' });
    }

    const lottery = LOTTERIES.find(l => l.id === lotteryId);
    if (!lottery) return res.status(404).json({ message: 'Loteria não encontrada.' });

    const { optimal } = getHistoryConfig(lotteryId);
    const draws = await fetchHistoricalDraws(lotteryId, optimal);
    if (draws.length < 2) return res.status(503).json({ message: 'Histórico indisponível no momento.' });

    const freqs = computeFrequencies(lottery.totalNumbers, draws);
    const frequencyMap: Record<number, number> = {};
    for (const f of freqs) frequencyMap[f.number] = f.frequency;

    const delayMap: Record<number, number> = {};
    for (let n = 1; n <= lottery.totalNumbers; n++) {
      const idx = draws.findIndex(d => d.includes(n));
      delayMap[n] = idx === -1 ? draws.length : idx;
    }

    const avgSum = draws.reduce((s, d) => s + d.reduce((a, b) => a + b, 0), 0) / draws.length;
    const avgEvens = draws.reduce((s, d) => s + d.filter(n => n % 2 === 0).length, 0) / draws.length;

    const hotNumbers  = freqs.filter(f => f.temperature === 'hot').map(f => f.number);
    const coldNumbers = freqs.filter(f => f.temperature === 'cold').map(f => f.number);

    // Calcula score do jogo
    const gameNums = numbers as number[];
    const sumTotal  = gameNums.reduce((a, b) => a + b, 0);
    const evenCount = gameNums.filter(n => n % 2 === 0).length;
    const hotCount  = gameNums.filter(n => hotNumbers.includes(n)).length;
    const coldCount = gameNums.filter(n => coldNumbers.includes(n)).length;
    const warmCount = gameNums.length - hotCount - coldCount;
    const maxDelay  = Math.max(...gameNums.map(n => delayMap[n] || 0));
    const avgFreq   = gameNums.reduce((s, n) => s + (frequencyMap[n] || 0), 0) / gameNums.length;

    const sumScore  = Math.max(0, 100 - Math.abs(sumTotal - avgSum) / avgSum * 100);
    const parScore  = Math.max(0, 100 - Math.abs(evenCount - avgEvens) * 20);
    const hotScore  = Math.min(100, (hotCount / Math.max(lottery.minNumbers, 1)) * 150);
    const delayBonus = Math.min(40, maxDelay * 2);
    const freqScore = Math.min(100, (avgFreq / Math.max(...Object.values(frequencyMap), 1)) * 100);

    const totalScore = Math.round(sumScore * 0.25 + parScore * 0.20 + hotScore * 0.30 + freqScore * 0.15 + delayBonus * 0.10);

    // Últimos 20 sorteios: quantos acertos teria tido em média
    const recentHits = draws.slice(0, 20).map(d => gameNums.filter(n => d.includes(n)).length);
    const avgHits = recentHits.reduce((a, b) => a + b, 0) / recentHits.length;

    const topPairs = computeTopPairs(draws, 20);
    const gamePairs: string[] = [];
    for (let i = 0; i < gameNums.length; i++)
      for (let j = i + 1; j < gameNums.length; j++) {
        const pair = [gameNums[i], gameNums[j]].sort((a, b) => a - b);
        const found = topPairs.find(p => p.pair[0] === pair[0] && p.pair[1] === pair[1]);
        if (found) gamePairs.push(`(${pair[0]},${pair[1]}):${found.count}x`);
      }

    res.json({
      lotteryId,
      numbers: gameNums.sort((a, b) => a - b),
      score: totalScore,
      scoreBreakdown: {
        sumScore:   Math.round(sumScore),
        parScore:   Math.round(parScore),
        hotScore:   Math.round(hotScore),
        freqScore:  Math.round(freqScore),
        delayBonus: Math.round(delayBonus),
      },
      composition: {
        hotCount,
        warmCount,
        coldCount,
        sumTotal,
        evenCount,
        oddCount: gameNums.length - evenCount,
        maxDelay,
        avgFrequency: parseFloat(avgFreq.toFixed(1)),
      },
      historicalSimulation: {
        drawsChecked: recentHits.length,
        avgHitsPerDraw: parseFloat(avgHits.toFixed(2)),
        maxHits: Math.max(...recentHits),
        minHits: Math.min(...recentHits),
        hitsDistribution: recentHits,
      },
      coOccurrencePairs: gamePairs,
      recommendation: totalScore >= 70
        ? 'Jogo com boa cobertura estatística 🟢'
        : totalScore >= 50
        ? 'Jogo com cobertura moderada 🟡'
        : 'Jogo com baixa aderência estatística 🔴',
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Erro ao pontuar jogo.', error: err?.message });
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
