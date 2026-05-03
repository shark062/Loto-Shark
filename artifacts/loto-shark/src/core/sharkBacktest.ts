// ============================================================
//  Shark Backtest — Análise Histórica de Desempenho
//  Simula o jogo contra histórico real de sorteios.
//  Não depende de API — usa os dados passados como parâmetro.
// ============================================================

export interface BacktestResult {
  hits11: number;
  hits12: number;
  hits13: number;
  hits14: number;
  hits15: number;
  hitsMin: number;       // acertos no mínimo exigido pela modalidade
  roi: number;           // retorno sobre investimento estimado (%)
  bestStreak: number;    // maior sequência premiada
  dryStreak: number;     // maior seca consecutiva
  totalGames: number;    // concursos analisados
  totalCost: number;     // custo total (R$)
  totalPrize: number;    // prêmio estimado (R$)
  winRate: number;       // % de concursos com pelo menos minHit acertos
}

// Tabela de prêmios aproximada para Lotofácil (15 números)
const LOTOFACIL_PRIZES: Record<number, number> = {
  11: 6,
  12: 12,
  13: 30,
  14: 1000,
  15: 3000000,
};

// Tabela de prêmios aproximada para Mega-Sena (6 números)
const MEGASENA_PRIZES: Record<number, number> = {
  4: 1000,
  5: 50000,
  6: 5000000,
};

// Tabela de prêmios aproximada para Quina (5 números)
const QUINA_PRIZES: Record<number, number> = {
  2: 4,
  3: 40,
  4: 5000,
  5: 10000000,
};

function getPrizeTable(gameSize: number): Record<number, number> {
  if (gameSize === 15) return LOTOFACIL_PRIZES;
  if (gameSize === 6)  return MEGASENA_PRIZES;
  if (gameSize === 5)  return QUINA_PRIZES;
  return LOTOFACIL_PRIZES; // fallback
}

function getMinHit(gameSize: number): number {
  if (gameSize === 15) return 11;
  if (gameSize === 6)  return 4;
  if (gameSize === 5)  return 2;
  return Math.ceil(gameSize * 0.7);
}

export function runBacktest(
  game: number[],
  history: number[][],
  ticketPrice: number = 3.0,
): BacktestResult {
  const n = game.length;
  const prizeTable = getPrizeTable(n);
  const minHit = getMinHit(n);

  const result: BacktestResult = {
    hits11: 0, hits12: 0, hits13: 0, hits14: 0, hits15: 0,
    hitsMin: 0,
    roi: 0,
    bestStreak: 0,
    dryStreak: 0,
    totalGames: history.length,
    totalCost: parseFloat((history.length * ticketPrice).toFixed(2)),
    totalPrize: 0,
    winRate: 0,
  };

  if (history.length === 0) return result;

  let streak = 0, dry = 0, maxStreak = 0, maxDry = 0, wins = 0;

  for (const draw of history) {
    const hits = game.filter(num => draw.includes(num)).length;

    if (hits >= 15) result.hits15++;
    else if (hits >= 14) result.hits14++;
    else if (hits >= 13) result.hits13++;
    else if (hits >= 12) result.hits12++;
    else if (hits >= 11) result.hits11++;

    const isWin = hits >= minHit;
    if (isWin) {
      wins++;
      streak++;
      maxStreak = Math.max(maxStreak, streak);
      dry = 0;
      result.hitsMin++;

      // Calcula prêmio: pega o maior tier que o jogo atingiu
      const prizeKeys = Object.keys(prizeTable)
        .map(Number)
        .filter(k => hits >= k)
        .sort((a, b) => b - a);
      if (prizeKeys.length > 0) {
        result.totalPrize += prizeTable[prizeKeys[0]];
      }
    } else {
      dry++;
      maxDry = Math.max(maxDry, dry);
      streak = 0;
    }
  }

  result.bestStreak = maxStreak;
  result.dryStreak = maxDry;
  result.winRate = parseFloat(((wins / history.length) * 100).toFixed(1));
  result.roi = result.totalCost > 0
    ? parseFloat(((result.totalPrize - result.totalCost) / result.totalCost * 100).toFixed(2))
    : 0;

  return result;
}

export function formatBacktest(r: BacktestResult, gameSize = 15): string[] {
  const lines: string[] = [
    `Concursos analisados: ${r.totalGames}`,
    `Taxa de prêmio: ${r.winRate}%`,
  ];

  if (gameSize === 15) {
    if (r.hits15 > 0) lines.push(`🏆 15 acertos: ${r.hits15}x`);
    if (r.hits14 > 0) lines.push(`⭐ 14 acertos: ${r.hits14}x`);
    if (r.hits13 > 0) lines.push(`✅ 13 acertos: ${r.hits13}x`);
    if (r.hits12 > 0) lines.push(`📌 12 acertos: ${r.hits12}x`);
    if (r.hits11 > 0) lines.push(`📎 11 acertos: ${r.hits11}x`);
  } else {
    lines.push(`Premiações: ${r.hitsMin}x`);
  }

  lines.push(
    `ROI estimado: ${r.roi > 0 ? "+" : ""}${r.roi}%`,
    `Melhor série: ${r.bestStreak} concursos premiados seguidos`,
    `Maior seca: ${r.dryStreak} concursos sem prêmio`,
  );

  return lines;
}
