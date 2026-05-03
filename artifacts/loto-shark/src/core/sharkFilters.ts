// ============================================================
//  Shark Filters — Filtros Profissionais de Jogos
//  Rejeita automaticamente jogos com padrões ruins.
//  Não depende de nenhum módulo existente.
// ============================================================

export interface FilterResult {
  valid: boolean;
  rejections: string[];
}

interface ModalityConfig {
  sumMin: number;
  sumMax: number;
  maxConsecutive: number;
  minEven: number;
  maxEven: number;
}

// Faixas de soma ideal por modalidade (baseadas em estatística histórica)
const MODALITY_CONFIG: Record<string, ModalityConfig> = {
  megasena:   { sumMin: 120, sumMax: 260, maxConsecutive: 5, minEven: 2, maxEven: 4 },
  lotofacil:  { sumMin: 160, sumMax: 310, maxConsecutive: 5, minEven: 6, maxEven: 9 },
  quina:      { sumMin:  60, sumMax: 220, maxConsecutive: 4, minEven: 2, maxEven: 3 },
  lotomania:  { sumMin: 900, sumMax: 1500, maxConsecutive: 5, minEven: 8, maxEven: 12 },
  duplasena:  { sumMin:  60, sumMax: 220, maxConsecutive: 4, minEven: 2, maxEven: 3 },
  timemania:  { sumMin:  60, sumMax: 220, maxConsecutive: 4, minEven: 2, maxEven: 4 },
  diadesorte: { sumMin:  40, sumMax: 180, maxConsecutive: 4, minEven: 2, maxEven: 4 },
  supersete:  { sumMin:  15, sumMax:  55, maxConsecutive: 3, minEven: 2, maxEven: 5 },
};

const DEFAULT_CONFIG: ModalityConfig = {
  sumMin: 60, sumMax: 300, maxConsecutive: 5, minEven: 2, maxEven: 4,
};

function getConfig(modalityId: string): ModalityConfig {
  return MODALITY_CONFIG[modalityId.toLowerCase()] || DEFAULT_CONFIG;
}

function maxConsecutive(sorted: number[]): number {
  let max = 1, cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    cur = sorted[i] === sorted[i - 1] + 1 ? cur + 1 : 1;
    max = Math.max(max, cur);
  }
  return max;
}

export function isValidGame(game: number[], modalityId: string): FilterResult {
  const sorted = [...game].sort((a, b) => a - b);
  const cfg = getConfig(modalityId);
  const rejections: string[] = [];
  const n = sorted.length;

  if (n === 0) return { valid: false, rejections: ["Jogo vazio"] };

  // --- Soma total ---
  const soma = sorted.reduce((a, b) => a + b, 0);
  if (soma < cfg.sumMin) rejections.push(`Soma muito baixa (${soma} < ${cfg.sumMin})`);
  if (soma > cfg.sumMax) rejections.push(`Soma muito alta (${soma} > ${cfg.sumMax})`);

  // --- Consecutivos ---
  const seqMax = maxConsecutive(sorted);
  if (seqMax >= cfg.maxConsecutive + 1) {
    rejections.push(`${seqMax} números consecutivos (limite ${cfg.maxConsecutive})`);
  }

  // --- Pares/Ímpares ---
  const pares = sorted.filter(x => x % 2 === 0).length;
  if (pares === 0)  rejections.push("Todos ímpares");
  if (pares === n)  rejections.push("Todos pares");
  if (pares < cfg.minEven) rejections.push(`Poucos pares (${pares} < ${cfg.minEven})`);
  if (pares > cfg.maxEven) rejections.push(`Muitos pares (${pares} > ${cfg.maxEven})`);

  // --- Concentração em faixas numéricas ---
  const maxNum = sorted[n - 1];
  if (maxNum > 20) {
    const metade = Math.ceil(maxNum / 2);
    const baixos = sorted.filter(x => x <= metade).length;
    if (baixos >= Math.ceil(n * 0.85)) rejections.push("Concentração excessiva na metade inferior");
    if (baixos <= Math.floor(n * 0.15)) rejections.push("Concentração excessiva na metade superior");
  }

  // --- Terminações repetidas ---
  const termCount: Record<number, number> = {};
  for (const x of sorted) termCount[x % 10] = (termCount[x % 10] || 0) + 1;
  const maxTerm = Math.max(...Object.values(termCount));
  if (maxTerm >= Math.ceil(n * 0.5)) {
    rejections.push("Muitas dezenas com mesma terminação");
  }

  // --- Sequência humana (1,2,3,4... ou aritméticas óbvias) ---
  const diffs = sorted.slice(1).map((v, i) => v - sorted[i]);
  const diffUnique = new Set(diffs).size;
  if (diffUnique === 1 && diffs[0] > 0 && n >= 4) {
    rejections.push("Sequência aritmética perfeita (padrão humano óbvio)");
  }

  return { valid: rejections.length === 0, rejections };
}

// Versão rápida para uso em loops — retorna só boolean
export function isGameOk(game: number[], modalityId: string): boolean {
  return isValidGame(game, modalityId).valid;
}
