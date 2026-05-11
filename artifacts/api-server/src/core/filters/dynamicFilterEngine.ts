// ============================================================
//  Dynamic Filter Engine — Filtros Adaptativos em Tempo Real
//  Aplica filtros configuráveis dinamicamente baseados no
//  perfil histórico da modalidade e nas preferências do usuário.
//  Cada filtro tem um score de aplicabilidade e pode ser
//  ativado/desativado individualmente.
// ============================================================

import { logger } from "../../lib/logger";

// ─── Tipos ────────────────────────────────────────────────────

export type FilterId =
  | "sum_range"
  | "parity_balance"
  | "quadrant_coverage"
  | "max_sequence"
  | "prime_count"
  | "digit_root"
  | "repetition_guard"
  | "cold_floor"
  | "heat_cap"
  | "custom";

export interface FilterConfig {
  id:          FilterId | string;
  name:        string;
  enabled:     boolean;
  /** Rigidez: 0 = suave (penaliza score), 1 = estrito (elimina) */
  strictness:  number;
  params:      Record<string, number | boolean | string>;
}

export interface FilterResult {
  passed:     boolean;
  penalty:    number;   // 0 = nenhuma, negativo = penalizado
  message:    string;
  filterId:   string;
}

export interface DynamicFilterResult {
  numbers:       number[];
  passed:        boolean;   // passou em todos os filtros estritos
  totalPenalty:  number;    // soma das penalidades
  filterScore:   number;    // 100 - abs(totalPenalty), capped em 0
  results:       FilterResult[];
  appliedCount:  number;
  failedFilters: string[];
}

// ─── Configuração Padrão por Modalidade ───────────────────────

export function getDefaultFilters(
  lotteryId: string,
  avgSum: number,
  stdSum: number,
  avgEvens: number,
  totalNumbers: number,
  pickCount: number,
): FilterConfig[] {
  const sumLow  = Math.round(avgSum - 2 * Math.max(stdSum, 10));
  const sumHigh = Math.round(avgSum + 2 * Math.max(stdSum, 10));
  const minEvens = Math.max(0, Math.floor(avgEvens - 2));
  const maxEvens = Math.min(pickCount, Math.ceil(avgEvens + 2));

  return [
    {
      id: "sum_range",
      name: "Intervalo de soma",
      enabled: true,
      strictness: 0.3,
      params: { min: sumLow, max: sumHigh },
    },
    {
      id: "parity_balance",
      name: "Equilíbrio par/ímpar",
      enabled: true,
      strictness: 0.2,
      params: { minEvens, maxEvens },
    },
    {
      id: "quadrant_coverage",
      name: "Cobertura de quadrantes",
      enabled: true,
      strictness: 0.5,
      params: { minCoveredQuadrants: totalNumbers > 25 ? 3 : 2 },
    },
    {
      id: "max_sequence",
      name: "Sequências máximas",
      enabled: true,
      strictness: 0.3,
      params: { maxLength: pickCount <= 6 ? 3 : 4 },
    },
    {
      id: "repetition_guard",
      name: "Guarda de repetição",
      enabled: true,
      strictness: 0.8,
      params: { maxRepeatedFromLast: Math.ceil(pickCount * 0.70) },
    },
    {
      id: "cold_floor",
      name: "Piso de frios",
      enabled: lotteryId !== "lotomania",
      strictness: 0.1,
      params: { minColdNumbers: 1 },
    },
    {
      id: "heat_cap",
      name: "Teto de quentes",
      enabled: true,
      strictness: 0.1,
      params: { maxHotNumbers: Math.ceil(pickCount * 0.80) },
    },
  ];
}

// ─── Executores de Filtros ────────────────────────────────────

function applySumRangeFilter(
  numbers: number[],
  params: Record<string, any>,
): FilterResult {
  const sum = numbers.reduce((a, b) => a + b, 0);
  const { min, max } = params as { min: number; max: number };

  if (sum < min) {
    return { passed: false, penalty: -15, message: `Soma ${sum} abaixo do mínimo ${min}`, filterId: "sum_range" };
  }
  if (sum > max) {
    return { passed: false, penalty: -15, message: `Soma ${sum} acima do máximo ${max}`, filterId: "sum_range" };
  }
  return { passed: true, penalty: 0, message: `Soma ${sum} dentro do intervalo [${min}, ${max}]`, filterId: "sum_range" };
}

function applyParityFilter(
  numbers: number[],
  params: Record<string, any>,
): FilterResult {
  const evens = numbers.filter(n => n % 2 === 0).length;
  const { minEvens, maxEvens } = params as { minEvens: number; maxEvens: number };

  if (evens < minEvens || evens > maxEvens) {
    const pen = Math.abs(evens < minEvens ? evens - minEvens : evens - maxEvens) * 8;
    return { passed: false, penalty: -pen, message: `${evens} pares fora do intervalo [${minEvens}, ${maxEvens}]`, filterId: "parity_balance" };
  }
  return { passed: true, penalty: 0, message: `Paridade OK: ${evens} pares`, filterId: "parity_balance" };
}

function applyQuadrantFilter(
  numbers: number[],
  params: Record<string, any>,
  totalNumbers: number,
): FilterResult {
  const { minCoveredQuadrants } = params as { minCoveredQuadrants: number };
  const qSize = Math.ceil(totalNumbers / 4);
  const covered = new Set<number>();
  for (const n of numbers) covered.add(Math.min(3, Math.floor((n - 1) / qSize)));

  if (covered.size < minCoveredQuadrants) {
    return { passed: false, penalty: -20, message: `Apenas ${covered.size} quadrantes cobertos (mín: ${minCoveredQuadrants})`, filterId: "quadrant_coverage" };
  }
  return { passed: true, penalty: 0, message: `${covered.size} quadrantes cobertos`, filterId: "quadrant_coverage" };
}

function applySequenceFilter(
  numbers: number[],
  params: Record<string, any>,
): FilterResult {
  const { maxLength } = params as { maxLength: number };
  const sorted = [...numbers].sort((a, b) => a - b);
  let maxSeq = 1; let cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) { cur++; maxSeq = Math.max(maxSeq, cur); }
    else cur = 1;
  }
  if (maxSeq > maxLength) {
    return { passed: false, penalty: -(maxSeq - maxLength) * 12, message: `Sequência de ${maxSeq} (máx: ${maxLength})`, filterId: "max_sequence" };
  }
  return { passed: true, penalty: 0, message: `Maior sequência: ${maxSeq}`, filterId: "max_sequence" };
}

function applyRepetitionGuard(
  numbers: number[],
  params: Record<string, any>,
  lastDraw: number[],
): FilterResult {
  if (lastDraw.length === 0) return { passed: true, penalty: 0, message: "Sem último sorteio para comparar", filterId: "repetition_guard" };
  const { maxRepeatedFromLast } = params as { maxRepeatedFromLast: number };
  const lastSet = new Set(lastDraw);
  const repeated = numbers.filter(n => lastSet.has(n)).length;
  if (repeated > maxRepeatedFromLast) {
    return { passed: false, penalty: -25, message: `${repeated} repetições do último sorteio (máx: ${maxRepeatedFromLast})`, filterId: "repetition_guard" };
  }
  return { passed: true, penalty: 0, message: `${repeated} repetições — dentro do limite`, filterId: "repetition_guard" };
}

function applyColdFloor(
  numbers: number[],
  params: Record<string, any>,
  coldNumbers: number[],
): FilterResult {
  const { minColdNumbers } = params as { minColdNumbers: number };
  const coldSet = new Set(coldNumbers);
  const coldInGame = numbers.filter(n => coldSet.has(n)).length;
  if (coldInGame < minColdNumbers) {
    return { passed: false, penalty: -10, message: `Apenas ${coldInGame} números frios (mín: ${minColdNumbers})`, filterId: "cold_floor" };
  }
  return { passed: true, penalty: 0, message: `${coldInGame} números frios presentes`, filterId: "cold_floor" };
}

function applyHeatCap(
  numbers: number[],
  params: Record<string, any>,
  hotNumbers: number[],
): FilterResult {
  const { maxHotNumbers } = params as { maxHotNumbers: number };
  const hotSet = new Set(hotNumbers);
  const hotInGame = numbers.filter(n => hotSet.has(n)).length;
  if (hotInGame > maxHotNumbers) {
    return { passed: false, penalty: -8, message: `${hotInGame} números quentes (máx: ${maxHotNumbers})`, filterId: "heat_cap" };
  }
  return { passed: true, penalty: 0, message: `${hotInGame} números quentes — OK`, filterId: "heat_cap" };
}

// ─── Função Principal ─────────────────────────────────────────

/**
 * Aplica todos os filtros dinâmicos a um jogo.
 */
export function applyDynamicFilters(
  numbers: number[],
  filters: FilterConfig[],
  context: {
    totalNumbers:   number;
    lastDraw?:      number[];
    hotNumbers?:    number[];
    coldNumbers?:   number[];
  },
): DynamicFilterResult {
  const results: FilterResult[] = [];
  let totalPenalty = 0;
  let passedAll = true;
  const failedFilters: string[] = [];

  for (const filter of filters) {
    if (!filter.enabled) continue;

    let result: FilterResult;

    switch (filter.id) {
      case "sum_range":
        result = applySumRangeFilter(numbers, filter.params);
        break;
      case "parity_balance":
        result = applyParityFilter(numbers, filter.params);
        break;
      case "quadrant_coverage":
        result = applyQuadrantFilter(numbers, filter.params, context.totalNumbers);
        break;
      case "max_sequence":
        result = applySequenceFilter(numbers, filter.params);
        break;
      case "repetition_guard":
        result = applyRepetitionGuard(numbers, filter.params, context.lastDraw || []);
        break;
      case "cold_floor":
        result = applyColdFloor(numbers, filter.params, context.coldNumbers || []);
        break;
      case "heat_cap":
        result = applyHeatCap(numbers, filter.params, context.hotNumbers || []);
        break;
      default:
        continue;
    }

    results.push(result);
    totalPenalty += result.penalty;

    // Filtragem estrita: só elimina se strictness >= 0.5 E falhou
    if (!result.passed && filter.strictness >= 0.5) {
      passedAll = false;
      failedFilters.push(filter.name);
    }
  }

  const filterScore = Math.max(0, 100 + totalPenalty);

  return {
    numbers,
    passed:       passedAll,
    totalPenalty,
    filterScore:  Math.min(100, filterScore),
    results,
    appliedCount: results.length,
    failedFilters,
  };
}

/**
 * Filtra uma lista de jogos, retornando apenas os aprovados.
 * Jogos reprovados nos filtros estritos são descartados.
 * Jogos com penalidades têm seus scores ajustados.
 */
export function filterGamesBatch(
  games: Array<{ numbers: number[]; score: number }>,
  filters: FilterConfig[],
  context: {
    totalNumbers:   number;
    lastDraw?:      number[];
    hotNumbers?:    number[];
    coldNumbers?:   number[];
  },
  fallbackIfEmpty: boolean = true,
): Array<{ numbers: number[]; score: number; filterScore: number; passed: boolean }> {
  const results = games.map(g => {
    const filterResult = applyDynamicFilters(g.numbers, filters, context);
    return {
      numbers:     g.numbers,
      score:       g.score + filterResult.totalPenalty,
      filterScore: filterResult.filterScore,
      passed:      filterResult.passed,
    };
  });

  const passed = results.filter(r => r.passed);

  // Fallback: se nenhum passou, relaxa e retorna todos com penalidade
  if (passed.length === 0 && fallbackIfEmpty) {
    logger.warn({ totalGames: games.length }, "[DynamicFilter] Nenhum jogo passou nos filtros estritos — fallback para todos");
    return results.sort((a, b) => b.score - a.score);
  }

  return passed.sort((a, b) => b.score - a.score);
}
