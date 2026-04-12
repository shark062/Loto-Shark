// ============================================================
//  Shark Engine — Motor Master de Geração de Jogos
// ============================================================

export interface SharkPesos {
  frequencia: number;
  atraso:     number;
  repeticao:  number;
}

const PESOS_PADRAO: SharkPesos = {
  frequencia: 0.50,
  atraso:     0.30,
  repeticao:  0.20,
};

export interface SharkContext {
  frequency: Record<number, number>;
  delay: Record<number, number>;
  lastDraw: number[];
  hot: number[];
  warm: number[];
  cold: number[];
  totalNumbers: number;
  minNumbers: number;
}

export interface SharkResult {
  jogo: number[];
  score: number;
  origem: string;
}

export interface MasterOutput {
  jogos: SharkResult[];
  contexto: {
    hot: number[];
    warm: number[];
    cold: number[];
    totalCandidatos: number;
    totalValidados: number;
    estrategiasUsadas: string[];
  };
}

export interface DesdobramentoOutput {
  combinacoes: number[][];
  total: number;
  poolUsado: number[];
}

// ============================================================
//  Utilitários
// ============================================================

function pick(arr: number[], n: number): number[] {
  return shuffle([...arr]).slice(0, Math.min(n, arr.length));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function dedup(jogo: number[]): number[] {
  return [...new Set(jogo)];
}

// ============================================================
//  1. CONTEXTO COMPLETO
// ============================================================

function buildContextCompleto(
  draws: number[][],
  totalNumbers: number,
  minNumbers: number,
): SharkContext {
  const frequency: Record<number, number> = {};
  const delay: Record<number, number> = {};
  const lastDraw = draws[0] || [];

  draws.forEach(draw => {
    draw.forEach(n => {
      frequency[n] = (frequency[n] || 0) + 1;
    });
  });

  for (let n = 1; n <= totalNumbers; n++) {
    const idx = draws.findIndex(d => d.includes(n));
    delay[n] = idx === -1 ? draws.length : idx;
  }

  const numeros = Array.from({ length: totalNumbers }, (_, i) => i + 1);
  const sorted = [...numeros].sort((a, b) => (frequency[b] || 0) - (frequency[a] || 0));

  const hotCut  = Math.floor(totalNumbers * 0.33);
  const warmCut = Math.floor(totalNumbers * 0.66);

  return {
    frequency,
    delay,
    lastDraw,
    hot:  sorted.slice(0, hotCut),
    warm: sorted.slice(hotCut, warmCut),
    cold: sorted.slice(warmCut),
    totalNumbers,
    minNumbers,
  };
}

// ============================================================
//  2. VALIDAÇÃO
// ============================================================

function validarJogo(jogo: number[], totalNumbers: number, minNumbers: number): boolean {
  if (jogo.length !== minNumbers) return false;
  if (new Set(jogo).size !== jogo.length) return false;
  if (jogo.some(n => n < 1 || n > totalNumbers)) return false;

  const pares = jogo.filter(n => n % 2 === 0).length;
  const minPares = Math.floor(minNumbers * 0.25);
  const maxPares = Math.ceil(minNumbers * 0.75);
  if (pares < minPares || pares > maxPares) return false;

  const sorted = [...jogo].sort((a, b) => a - b);
  let maxSeq = 0;
  let seq = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      seq++;
      maxSeq = Math.max(maxSeq, seq);
    } else {
      seq = 1;
    }
  }
  const maxSeqPermitida = Math.ceil(minNumbers * 0.35);
  if (maxSeq > maxSeqPermitida) return false;

  return true;
}

// ============================================================
//  3. SCORE COMPLETO (usa pesos dinâmicos aprendidos)
// ============================================================

function scoreCompleto(jogo: number[], ctx: SharkContext, pesos: SharkPesos = PESOS_PADRAO): number {
  let score = 0;

  jogo.forEach(n => {
    score += (ctx.frequency[n] || 0) * pesos.frequencia * 10;
    score += (ctx.delay[n]     || 0) * pesos.atraso     * 5;
  });

  // Paridade (peso fixo — regra universal)
  const pares = jogo.filter(n => n % 2 === 0).length;
  const idealPares = ctx.minNumbers / 2;
  if (Math.abs(pares - idealPares) <= 1) score += 20;

  // Repetição do último sorteio (impacto proporcional ao peso)
  const repetidos = jogo.filter(n => ctx.lastDraw.includes(n)).length;
  const repIdeal  = ctx.minNumbers * pesos.repeticao * 2;
  const repDiff   = Math.abs(repetidos - repIdeal);
  score += Math.max(0, 30 - repDiff * 4) * (pesos.repeticao * 3);

  return Math.round(score);
}

// ============================================================
//  4. ESTRATÉGIAS DE GERAÇÃO
// ============================================================

function gerarQuente(ctx: SharkContext): number[] {
  const { hot, warm, minNumbers } = ctx;
  const hotQ = Math.ceil(minNumbers * 0.6);
  const warmQ = minNumbers - hotQ;
  return dedup([...pick(hot, hotQ), ...pick(warm, warmQ)]).slice(0, minNumbers);
}

function gerarFrio(ctx: SharkContext): number[] {
  const { cold, warm, minNumbers } = ctx;
  const coldQ = Math.ceil(minNumbers * 0.6);
  const warmQ = minNumbers - coldQ;
  return dedup([...pick(cold, coldQ), ...pick(warm, warmQ)]).slice(0, minNumbers);
}

function gerarMisto(ctx: SharkContext): number[] {
  const { hot, warm, cold, minNumbers } = ctx;
  const hotQ  = Math.round(minNumbers * 0.4);
  const warmQ = Math.round(minNumbers * 0.3);
  const coldQ = minNumbers - hotQ - warmQ;
  return dedup([...pick(hot, hotQ), ...pick(warm, warmQ), ...pick(cold, coldQ)]).slice(0, minNumbers);
}

function gerarPorPeso(ctx: SharkContext, pesos: SharkPesos = PESOS_PADRAO): number[] {
  const { frequency, delay, totalNumbers, minNumbers } = ctx;
  const nums = Array.from({ length: totalNumbers }, (_, i) => i + 1);

  const ranked = nums
    .map(n => ({ n, peso: (frequency[n] || 0) * pesos.frequencia + (delay[n] || 0) * pesos.atraso }))
    .sort((a, b) => b.peso - a.peso);

  const top = ranked.slice(0, Math.floor(totalNumbers * 0.5)).map(p => p.n);
  return pick(top, minNumbers);
}

function gerarRepInteligente(ctx: SharkContext): number[] {
  const { lastDraw, totalNumbers, minNumbers } = ctx;
  const repQ = Math.ceil(minNumbers * 0.6);
  const novosQ = minNumbers - repQ;

  const repetidos = lastDraw.length >= repQ ? pick(lastDraw, repQ) : [...lastDraw];
  const todos = Array.from({ length: totalNumbers }, (_, i) => i + 1);
  const disponiveis = todos.filter(n => !repetidos.includes(n));
  const novos = pick(disponiveis, novosQ + (repQ - repetidos.length));

  return dedup([...repetidos, ...novos]).slice(0, minNumbers);
}

function gerarRepBaixa(ctx: SharkContext): number[] {
  const { lastDraw, totalNumbers, minNumbers } = ctx;
  const repQ = Math.ceil(minNumbers * 0.3);

  const repetidos = lastDraw.length >= repQ ? pick(lastDraw, repQ) : [...lastDraw];
  const todos = Array.from({ length: totalNumbers }, (_, i) => i + 1);
  const disponiveis = todos.filter(n => !repetidos.includes(n));
  const novos = pick(disponiveis, minNumbers - repetidos.length);

  return dedup([...repetidos, ...novos]).slice(0, minNumbers);
}

// ============================================================
//  5. GERAÇÃO MULTI-ESTRATÉGIA
// ============================================================

const ESTRATEGIAS = [
  { nome: "quente",       fn: gerarQuente },
  { nome: "frio",         fn: gerarFrio },
  { nome: "misto",        fn: gerarMisto },
  { nome: "peso",         fn: gerarPorPeso },
  { nome: "rep_alta",     fn: gerarRepInteligente },
  { nome: "rep_baixa",    fn: gerarRepBaixa },
];

function gerarMultiplasEstrategias(ctx: SharkContext, rodadas: number = 300, pesos: SharkPesos = PESOS_PADRAO): Array<{ jogo: number[]; origem: string }> {
  const candidatos: Array<{ jogo: number[]; origem: string }> = [];

  for (let i = 0; i < rodadas; i++) {
    for (const { nome, fn } of ESTRATEGIAS) {
      const raw = (nome === "peso"
        ? gerarPorPeso(ctx, pesos)
        : fn(ctx)
      ).sort((a, b) => a - b);
      candidatos.push({ jogo: raw, origem: nome });
    }
  }

  return candidatos;
}

// ============================================================
//  6. FUNÇÃO MASTER PRINCIPAL
// ============================================================

export function gerarJogosMaster(
  draws: number[][],
  qtd: number = 10,
  totalNumbers: number = 60,
  minNumbers: number = 6,
  pesos?: SharkPesos,
): MasterOutput {
  const pesosAtivos: SharkPesos = pesos
    ? { frequencia: pesos.frequencia, atraso: pesos.atraso, repeticao: pesos.repeticao }
    : { ...PESOS_PADRAO };
  if (draws.length < 2) {
    const nums = Array.from({ length: totalNumbers }, (_, i) => i + 1);
    const jogos: SharkResult[] = Array.from({ length: qtd }, () => ({
      jogo: shuffle(nums).slice(0, minNumbers).sort((a, b) => a - b),
      score: 0,
      origem: "aleatório",
    }));
    return {
      jogos,
      contexto: { hot: [], warm: [], cold: [], totalCandidatos: 0, totalValidados: 0, estrategiasUsadas: [] },
    };
  }

  const ctx = buildContextCompleto(draws, totalNumbers, minNumbers);

  const candidatos = gerarMultiplasEstrategias(ctx, 300, pesosAtivos);

  const vistos = new Set<string>();
  const validados: Array<{ jogo: number[]; origem: string }> = [];

  for (const c of candidatos) {
    const key = c.jogo.join(",");
    if (vistos.has(key)) continue;
    if (!validarJogo(c.jogo, totalNumbers, minNumbers)) continue;
    vistos.add(key);
    validados.push(c);
  }

  const pontuados: SharkResult[] = validados.map(c => ({
    jogo: c.jogo,
    score: scoreCompleto(c.jogo, ctx, pesosAtivos),
    origem: c.origem,
  }));

  pontuados.sort((a, b) => b.score - a.score);

  const melhores = pontuados.slice(0, qtd);

  return {
    jogos: melhores,
    contexto: {
      hot:  ctx.hot.slice(0, 10),
      warm: ctx.warm.slice(0, 10),
      cold: ctx.cold.slice(0, 10),
      totalCandidatos: candidatos.length,
      totalValidados:  validados.length,
      estrategiasUsadas: ESTRATEGIAS.map(e => e.nome),
    },
  };
}

// ============================================================
//  7. DESDOBRAMENTO AUTOMÁTICO DOS MELHORES JOGOS
// ============================================================

function combinacoes(arr: number[], k: number, limite: number): number[][] {
  const result: number[][] = [];

  function backtrack(start: number, current: number[]) {
    if (result.length >= limite) return;
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      if (result.length >= limite) break;
      current.push(arr[i]);
      backtrack(i + 1, current);
      current.pop();
    }
  }

  backtrack(0, []);
  return result;
}

export function gerarDesdobramento(
  jogos: SharkResult[],
  minNumbers: number,
  limite: number = 500,
): DesdobramentoOutput {
  const poolBruto = jogos.flatMap(j => j.jogo);
  const pool = [...new Set(poolBruto)].sort((a, b) => a - b);

  if (pool.length < minNumbers) {
    return { combinacoes: [], total: 0, poolUsado: pool };
  }

  const combos = combinacoes(pool, minNumbers, limite);

  return {
    combinacoes: combos,
    total: combos.length,
    poolUsado: pool,
  };
}

// Mantém compatibilidade com código antigo
export { gerarJogosMaster as sharkAutonomo };
