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
