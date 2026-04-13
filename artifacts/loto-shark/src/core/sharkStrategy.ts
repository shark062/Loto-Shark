// ============================================================
//  Shark Strategy — Pesos Adaptativos por Tipo de Estratégia
//  Cada estratégia evolui de forma independente com base
//  no histórico de acertos registrado na memória do Shark
// ============================================================

import { carregarMemoria } from "./sharkMemory";

const KEY = "shark_strategy_weights_v1";

export interface StrategyWeights {
  quente:    number;
  frio:      number;
  misto:     number;
  peso:      number;
  rep_alta:  number;
  rep_baixa: number;
  shark:     number;
  ia:        number;
}

const DEFAULT_WEIGHTS: StrategyWeights = {
  quente:    1.0,
  frio:      1.0,
  misto:     1.0,
  peso:      1.0,
  rep_alta:  1.0,
  rep_baixa: 1.0,
  shark:     1.0,
  ia:        1.0,
};

// Lê os pesos do localStorage
export function getPesos(): StrategyWeights {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_WEIGHTS };
    const parsed = JSON.parse(raw);
    // Garante que todas as chaves existem (compatibilidade)
    return { ...DEFAULT_WEIGHTS, ...parsed };
  } catch {
    return { ...DEFAULT_WEIGHTS };
  }
}

// Salva os pesos
function salvarPesos(pesos: StrategyWeights): void {
  localStorage.setItem(KEY, JSON.stringify(pesos));
}

// Atualiza pesos com base no histórico de acertos por estratégia
export function atualizarPesos(): StrategyWeights {
  const memoria = carregarMemoria();
  const comAcertos = memoria.filter(m => m.acertos !== undefined);
  const pesos = getPesos();

  if (comAcertos.length < 3) return pesos;

  // Agrupa acertos por origem (estratégia)
  const grupos: Record<string, number[]> = {};
  for (const m of comAcertos) {
    const key = m.origem || "default";
    grupos[key] = grupos[key] || [];
    grupos[key].push(m.acertos!);
  }

  // Limiar de "bom desempenho": 50% do tamanho do jogo
  const tamanhoJogo = comAcertos[0]?.jogo.length || 6;
  const limiarBom  = tamanhoJogo * 0.5;

  for (const [tipo, acertos] of Object.entries(grupos)) {
    if (!(tipo in pesos)) continue;
    const media = acertos.reduce((a, b) => a + b, 0) / acertos.length;

    if (media >= limiarBom * 1.4) {
      (pesos as any)[tipo] = Math.min(2.5, (pesos as any)[tipo] + 0.1);
    } else if (media >= limiarBom) {
      (pesos as any)[tipo] = Math.min(2.0, (pesos as any)[tipo] + 0.05);
    } else {
      (pesos as any)[tipo] = Math.max(0.1, (pesos as any)[tipo] - 0.05);
    }
  }

  salvarPesos(pesos);
  return pesos;
}

// Normaliza pesos para soma = número de estratégias (mantém escala relativa)
export function normalizarPesos(pesos: StrategyWeights): StrategyWeights {
  const valores = Object.values(pesos);
  const soma = valores.reduce((a, b) => a + b, 0);
  const n = valores.length;
  const fator = n / soma;

  const normalizado: any = {};
  for (const [k, v] of Object.entries(pesos)) {
    normalizado[k] = parseFloat((v * fator).toFixed(3));
  }
  return normalizado as StrategyWeights;
}

// Escolhe uma estratégia com base nos pesos (roleta ponderada)
export function escolherEstrategiaAleatoria(pesos?: StrategyWeights): keyof StrategyWeights {
  const p = pesos || getPesos();
  const entradas = Object.entries(p) as [keyof StrategyWeights, number][];
  const total = entradas.reduce((s, [, v]) => s + v, 0);
  let rand = Math.random() * total;
  for (const [nome, peso] of entradas) {
    rand -= peso;
    if (rand <= 0) return nome;
  }
  return "misto";
}

// Resetar pesos para o padrão
export function resetarPesos(): void {
  localStorage.removeItem(KEY);
}

// Retorna um resumo dos pesos ordenado por performance
export function resumoPesos(): Array<{ nome: string; peso: number; percentual: number }> {
  const pesos = getPesos();
  const total = Object.values(pesos).reduce((a, b) => a + b, 0);
  return Object.entries(pesos)
    .map(([nome, peso]) => ({ nome, peso, percentual: Math.round((peso / total) * 100) }))
    .sort((a, b) => b.peso - a.peso);
}
