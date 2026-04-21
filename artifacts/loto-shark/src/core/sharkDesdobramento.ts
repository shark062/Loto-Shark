// ============================================================
//  Shark Desdobramento Inteligente
//  Gera combinações baseadas nos melhores jogos gerados,
//  priorizando números mais frequentes entre eles
// ============================================================

export interface JogoComNumeros {
  jogo?: number[];
  numbers?: number[];
  score?: number;
}

export interface DesdobramentoInteligente {
  combinacoes: number[][];
  total: number;
  poolUsado: number[];
  freqMap: Record<number, number>;
}

// Mapa de frequência entre todos os jogos passados
function buildFreqMap(jogos: JogoComNumeros[]): Record<number, number> {
  const freq: Record<number, number> = {};
  for (const j of jogos) {
    const nums = j.jogo || j.numbers || [];
    for (const n of nums) {
      freq[n] = (freq[n] || 0) + 1;
    }
  }
  return freq;
}

// Gera combinações únicas sem repetição (com limite)
function gerarCombinacoes(pool: number[], k: number, limite: number): number[][] {
  const result: number[][] = [];

  function backtrack(start: number, atual: number[]) {
    if (result.length >= limite) return;
    if (atual.length === k) {
      result.push([...atual].sort((a, b) => a - b));
      return;
    }
    for (let i = start; i < pool.length; i++) {
      if (result.length >= limite) break;
      atual.push(pool[i]);
      backtrack(i + 1, atual);
      atual.pop();
    }
  }

  backtrack(0, []);
  return result;
}

// Desdobramento inteligente — baseado nos números mais frequentes entre os jogos
export function desdobramentoInteligente(
  jogos: JogoComNumeros[],
  minNumbers: number = 6,
  limite: number = 50,
  poolSize: number = 20,
): DesdobramentoInteligente {
  if (!jogos || jogos.length === 0) {
    return { combinacoes: [], total: 0, poolUsado: [], freqMap: {} };
  }

  const freqMap = buildFreqMap(jogos);

  // Ordena por frequência (mais citados entre os jogos = mais relevantes)
  const ordenados = Object.entries(freqMap)
    .sort((a, b) => b[1] - a[1])
    .map(([n]) => Number(n));

  // Pool: os N números mais frequentes (mínimo = minNumbers + 2)
  const tamanhoPool = Math.max(minNumbers + 2, Math.min(poolSize, ordenados.length));
  const pool = ordenados.slice(0, tamanhoPool).sort((a, b) => a - b);

  if (pool.length < minNumbers) {
    return { combinacoes: [], total: 0, poolUsado: pool, freqMap };
  }

  // Tenta combinações determinísticas primeiro
  const combinacoes = gerarCombinacoes(pool, minNumbers, limite);

  return {
    combinacoes,
    total: combinacoes.length,
    poolUsado: pool,
    freqMap,
  };
}

// Versão aleatória — embaralha o pool e gera jogos únicos
export function desdobramentoAleatorio(
  jogos: JogoComNumeros[],
  minNumbers: number = 6,
  quantidade: number = 50,
  poolSize: number = 20,
): number[][] {
  if (!jogos || jogos.length === 0) return [];

  const freqMap = buildFreqMap(jogos);
  const ordenados = Object.entries(freqMap)
    .sort((a, b) => b[1] - a[1])
    .map(([n]) => Number(n));

  const tamanhoPool = Math.max(minNumbers + 2, Math.min(poolSize, ordenados.length));
  const pool = ordenados.slice(0, tamanhoPool);

  const vistos = new Set<string>();
  const resultado: number[][] = [];
  let tentativas = 0;

  while (resultado.length < quantidade && tentativas < quantidade * 20) {
    tentativas++;
    const embaralhado = [...pool].sort(() => Math.random() - 0.5);
    const jogo = embaralhado.slice(0, minNumbers).sort((a, b) => a - b);
    const key = jogo.join(",");
    if (!vistos.has(key)) {
      vistos.add(key);
      resultado.push(jogo);
    }
  }

  return resultado;
}

// ─── DESDOBRAMENTO 1: Linhas e Colunas ───────────────────────────────────────
/**
 * Divide os números disponíveis em faixas (linhas) e gera combinações
 * garantindo representação de múltiplas faixas.
 */
export function desdobramentoLinhaColuna(
  numbers: number[],
  picks: number,
  rowSize = 10,
  maxGames = 10
): number[][] {
  const sorted = [...numbers].sort((a, b) => a - b);
  const rows: number[][] = [];
  for (let i = 0; i < sorted.length; i += rowSize) {
    rows.push(sorted.slice(i, i + rowSize));
  }
  const games: number[][] = [];
  const perRow = Math.max(1, Math.floor(picks / rows.length));

  for (let g = 0; g < maxGames; g++) {
    const game: number[] = [];
    const shuffledRows = [...rows].sort(() => Math.random() - 0.5);
    for (const row of shuffledRows) {
      const take = Math.min(perRow, row.length, picks - game.length);
      const shuffled = [...row].sort(() => Math.random() - 0.5);
      game.push(...shuffled.slice(0, take));
      if (game.length >= picks) break;
    }
    if (game.length < picks) {
      const remaining = sorted.filter(n => !game.includes(n)).sort(() => Math.random() - 0.5);
      game.push(...remaining.slice(0, picks - game.length));
    }
    const finalGame = game.slice(0, picks).sort((a, b) => a - b);
    const key = finalGame.join(',');
    if (!games.some(g2 => g2.join(',') === key)) {
      games.push(finalGame);
    }
  }
  return games;
}

// ─── DESDOBRAMENTO 2: Números Fixos + Variáveis ──────────────────────────────
/**
 * Gera combinações mantendo números fixos em todos os jogos
 * e variando os demais a partir de um pool.
 */
export function desdobramentoFixosVariaveis(
  fixed: number[],
  pool: number[],
  picks: number,
  maxGames = 10
): number[][] {
  if (fixed.length >= picks) return [fixed.slice(0, picks).sort((a, b) => a - b)];
  const variableCount = picks - fixed.length;
  const available = pool.filter(n => !fixed.includes(n));
  const games: number[][] = [];
  const seen = new Set<string>();

  let attempts = 0;
  while (games.length < maxGames && attempts < maxGames * 20) {
    attempts++;
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    const variables = shuffled.slice(0, variableCount);
    if (variables.length < variableCount) break;
    const game = [...fixed, ...variables].sort((a, b) => a - b);
    const key = game.join(',');
    if (!seen.has(key)) {
      seen.add(key);
      games.push(game);
    }
  }
  return games;
}

// ─── DESDOBRAMENTO 3: Grupos por Intervalo ───────────────────────────────────
/**
 * Agrupa números em intervalos definidos e gera jogos com
 * representação balanceada de diferentes grupos.
 */
export function desdobramentoGrupos(
  numbers: number[],
  picks: number,
  groupSize = 10,
  maxGames = 10
): number[][] {
  const sorted = [...numbers].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const groups: number[][] = [];

  for (let start = min; start <= max; start += groupSize) {
    const g = sorted.filter(n => n >= start && n < start + groupSize);
    if (g.length > 0) groups.push(g);
  }

  const games: number[][] = [];
  const seen = new Set<string>();

  let attempts = 0;
  while (games.length < maxGames && attempts < maxGames * 20) {
    attempts++;
    const game: number[] = [];
    const shuffledGroups = [...groups].sort(() => Math.random() - 0.5);

    for (const grp of shuffledGroups) {
      if (game.length >= picks) break;
      const take = Math.min(
        Math.max(1, Math.floor(picks / groups.length)),
        grp.length,
        picks - game.length
      );
      const shuffled = [...grp].sort(() => Math.random() - 0.5);
      game.push(...shuffled.slice(0, take));
    }

    if (game.length < picks) {
      const remaining = sorted.filter(n => !game.includes(n)).sort(() => Math.random() - 0.5);
      game.push(...remaining.slice(0, picks - game.length));
    }

    const finalGame = game.slice(0, picks).sort((a, b) => a - b);
    const key = finalGame.join(',');
    if (!seen.has(key)) {
      seen.add(key);
      games.push(finalGame);
    }
  }
  return games;
}

// ─── DESDOBRAMENTO 4: Pares e Ímpares ───────────────────────────────────────
/**
 * Gera combinações com distribuição controlada de pares e ímpares.
 */
export function desdobramentoParesImpares(
  numbers: number[],
  picks: number,
  evenCount?: number,
  maxGames = 10
): number[][] {
  const evens = numbers.filter(n => n % 2 === 0);
  const odds  = numbers.filter(n => n % 2 !== 0);

  const targetEvens = evenCount !== undefined
    ? Math.min(evenCount, picks, evens.length)
    : Math.round(picks / 2);
  const targetOdds = picks - targetEvens;

  if (evens.length < targetEvens || odds.length < targetOdds) {
    const all = [...numbers].sort(() => Math.random() - 0.5);
    return [all.slice(0, picks).sort((a, b) => a - b)];
  }

  const games: number[][] = [];
  const seen = new Set<string>();
  let attempts = 0;

  while (games.length < maxGames && attempts < maxGames * 20) {
    attempts++;
    const shuffledEvens = [...evens].sort(() => Math.random() - 0.5);
    const shuffledOdds  = [...odds].sort(() => Math.random() - 0.5);
    const game = [
      ...shuffledEvens.slice(0, targetEvens),
      ...shuffledOdds.slice(0, targetOdds),
    ].sort((a, b) => a - b);

    const key = game.join(',');
    if (!seen.has(key)) {
      seen.add(key);
      games.push(game);
    }
  }
  return games;
}
