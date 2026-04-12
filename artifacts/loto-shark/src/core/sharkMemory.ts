// ============================================================
//  Shark Memory — Sistema de Aprendizado por Feedback Real
//  (roda no browser via localStorage, sem servidor)
// ============================================================

const MEMORY_KEY = "shark_memory_v1";
const PESOS_KEY  = "shark_pesos_v1";
const MAX_MEMORIA = 200;

export interface SharkMemoryItem {
  id: string;
  jogo: number[];
  score: number;
  origem: string;
  lotteryId: string;
  data: number;
  acertos?: number;
}

export interface SharkPesos {
  frequencia: number;
  atraso: number;
  repeticao: number;
}

export const PESOS_PADRAO: SharkPesos = {
  frequencia: 0.50,
  atraso:     0.30,
  repeticao:  0.20,
};

// ============================================================
//  Persistência
// ============================================================

export function carregarMemoria(): SharkMemoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(MEMORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function persistirMemoria(items: SharkMemoryItem[]): void {
  const ordenado = [...items]
    .sort((a, b) => b.data - a.data)
    .slice(0, MAX_MEMORIA);
  localStorage.setItem(MEMORY_KEY, JSON.stringify(ordenado));
}

export function carregarPesos(): SharkPesos {
  try {
    const raw = localStorage.getItem(PESOS_KEY);
    return raw ? JSON.parse(raw) : { ...PESOS_PADRAO };
  } catch {
    return { ...PESOS_PADRAO };
  }
}

export function salvarPesos(pesos: SharkPesos): void {
  localStorage.setItem(PESOS_KEY, JSON.stringify(pesos));
}

// ============================================================
//  PASSO 2 — Salvar jogos gerados
// ============================================================

export function salvarJogos(
  jogos: Array<{ jogo: number[]; score: number; origem: string }>,
  lotteryId: string,
): void {
  const memoria = carregarMemoria();

  const novos: SharkMemoryItem[] = jogos.map(j => ({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    jogo: j.jogo,
    score: j.score,
    origem: j.origem || "master",
    lotteryId,
    data: Date.now(),
  }));

  persistirMemoria([...novos, ...memoria]);
}

// ============================================================
//  PASSO 3 — Registrar resultado real (coração do aprendizado)
// ============================================================

export function registrarResultadoOficial(
  resultadoReal: number[],
  lotteryId: string,
): { registrados: number; melhorAcerto: number } {
  const memoria = carregarMemoria();

  let registrados = 0;
  let melhorAcerto = 0;

  const atualizado = memoria.map(item => {
    if (item.acertos !== undefined) return item;
    if (item.lotteryId !== lotteryId)   return item;

    const acertos = item.jogo.filter(n => resultadoReal.includes(n)).length;
    registrados++;
    melhorAcerto = Math.max(melhorAcerto, acertos);
    return { ...item, acertos };
  });

  persistirMemoria(atualizado);
  return { registrados, melhorAcerto };
}

// ============================================================
//  PASSO 4 — Analisar performance por estratégia
// ============================================================

export function analisarPerformance(): Record<
  string,
  { media: number; total: number; melhor: number }
> {
  const memoria = carregarMemoria();
  const comAcertos = memoria.filter(m => m.acertos !== undefined);

  const grupos: Record<string, number[]> = {};
  comAcertos.forEach(item => {
    const key = item.origem || "desconhecido";
    grupos[key] = grupos[key] || [];
    grupos[key].push(item.acertos!);
  });

  const resultado: Record<string, { media: number; total: number; melhor: number }> = {};
  Object.entries(grupos).forEach(([k, arr]) => {
    resultado[k] = {
      media:  parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)),
      total:  arr.length,
      melhor: Math.max(...arr),
    };
  });

  return resultado;
}

// ============================================================
//  PASSO 5 — Ajuste automático de pesos adaptativo
// ============================================================

export function ajustarPesos(): SharkPesos {
  const memoria = carregarMemoria();
  const comAcertos = memoria
    .filter(m => m.acertos !== undefined)
    .sort((a, b) => b.data - a.data);   // recentes primeiro

  if (comAcertos.length < 3) return carregarPesos();

  const pesos = carregarPesos();

  // Usa últimos 50 (prioriza dados recentes)
  const recentes = comAcertos.slice(0, 50);
  const tamanhoJogo = recentes[0]?.jogo.length || 6;
  const limiarBom   = Math.round(tamanhoJogo * 0.70);
  const limiarRuim  = Math.round(tamanhoJogo * 0.50);

  const bons = recentes.filter(m => m.acertos! >= limiarBom).length;
  const ruins = recentes.filter(m => m.acertos! < limiarRuim).length;

  const DELTA = 0.04;

  if (bons > ruins * 1.5) {
    // Estratégia funcionando — reforça frequência
    pesos.frequencia = Math.min(0.80, pesos.frequencia + DELTA);
    pesos.atraso     = Math.max(0.10, pesos.atraso     - DELTA * 0.5);
  } else if (ruins > bons * 1.5) {
    // Estratégia falhando — migra peso para atraso (números atrasados)
    pesos.atraso     = Math.min(0.70, pesos.atraso     + DELTA);
    pesos.frequencia = Math.max(0.15, pesos.frequencia - DELTA * 0.7);
  }

  // Garante que repeticao não some
  pesos.repeticao = Math.max(0.10, 1 - pesos.frequencia - pesos.atraso);

  // Normaliza para soma = 1
  const total = pesos.frequencia + pesos.atraso + pesos.repeticao;
  const p: SharkPesos = {
    frequencia: parseFloat((pesos.frequencia / total).toFixed(3)),
    atraso:     parseFloat((pesos.atraso     / total).toFixed(3)),
    repeticao:  0,
  };
  p.repeticao = parseFloat((1 - p.frequencia - p.atraso).toFixed(3));

  salvarPesos(p);
  return p;
}

// ============================================================
//  Estatísticas gerais (para o painel)
// ============================================================

export function estatisticasGerais(): {
  totalJogos: number;
  totalComAcertos: number;
  mediaGeral: number;
  melhorAcerto: number;
  melhorJogo: SharkMemoryItem | null;
  pesosAtivos: SharkPesos;
  geracoes: number;
} {
  const memoria = carregarMemoria();
  const comAcertos = memoria.filter(m => m.acertos !== undefined);
  const mediaGeral = comAcertos.length > 0
    ? parseFloat((comAcertos.reduce((s, m) => s + m.acertos!, 0) / comAcertos.length).toFixed(2))
    : 0;
  const melhorJogo = comAcertos.reduce(
    (best: SharkMemoryItem | null, m) =>
      (m.acertos! > (best?.acertos ?? -1) ? m : best),
    null,
  );

  return {
    totalJogos:      memoria.length,
    totalComAcertos: comAcertos.length,
    mediaGeral,
    melhorAcerto:    melhorJogo?.acertos ?? 0,
    melhorJogo,
    pesosAtivos:     carregarPesos(),
    geracoes:        new Set(memoria.map(m => Math.floor(m.data / 1000))).size,
  };
}

export function resetarMemoria(): void {
  localStorage.removeItem(MEMORY_KEY);
  localStorage.removeItem(PESOS_KEY);
}
