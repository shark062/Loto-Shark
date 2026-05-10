// ============================================================
//  Cycle Engine — Fase 8: Engine de Ciclos
//  Analisa ciclos estatísticos: dezenas saturadas,
//  faltantes, recuperação e atraso estrutural.
// ============================================================

// ─── Tipos ────────────────────────────────────────────────────

export interface CycleInfo {
  number: number;
  /** Sorteios consecutivos sem aparecer (atraso atual) */
  currentDelay: number;
  /** Média histórica de ciclos deste número */
  avgCycleLength: number;
  /** Desvio padrão dos ciclos */
  cycleStdDev: number;
  /** Ciclos completos detectados */
  cycleCount: number;
  /** Se o número está em "atraso estrutural" (delay > 2x avg) */
  isStructurallyOverdue: boolean;
  /** Se o número está "saturado" (saiu muito recentemente, abaixo do ciclo médio) */
  isSaturated: boolean;
  /** Score de ciclo: negativo = saturado, positivo = overdue */
  cycleScore: number;
  /** Probabilidade estimada de saída no próximo sorteio (em %) */
  estimatedProbability: number;
  /** Fase do ciclo: "overdue", "due", "recent", "saturated" */
  phase: "overdue" | "due" | "recent" | "saturated";
}

export interface CycleAnalysis {
  cycles: CycleInfo[];
  structurallyOverdue: number[];
  saturated: number[];
  due: number[];
  avgCycleLength: number;
  cycleScore: (number: number) => number;
}

// ─── Análise de Ciclos ────────────────────────────────────────

/**
 * Extrai os comprimentos de ciclo de um número a partir do histórico.
 * Um ciclo é o intervalo entre duas aparições consecutivas.
 */
function extractCycleLengths(draws: number[][], n: number): number[] {
  const cycles: number[] = [];
  let gap = 0;
  let lastSeen = false;

  for (const draw of draws) {
    if (draw.includes(n)) {
      if (lastSeen) cycles.push(gap);
      gap = 1;
      lastSeen = true;
    } else {
      if (lastSeen) gap++;
    }
  }

  return cycles;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[], avg: number): number {
  if (arr.length < 2) return 0;
  const variance = arr.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

/**
 * Analisa os ciclos de todas as dezenas do universo.
 *
 * @param draws         Histórico de sorteios (mais recente primeiro)
 * @param totalNumbers  Universo da modalidade
 * @param minNumbers    Quantidade mínima de números por jogo
 */
export function analyzeCycles(
  draws: number[][],
  totalNumbers: number,
  minNumbers: number,
): CycleAnalysis {
  if (draws.length < 10) {
    const empty: CycleInfo[] = Array.from({ length: totalNumbers }, (_, i) => ({
      number: i + 1,
      currentDelay: 0,
      avgCycleLength: 0,
      cycleStdDev: 0,
      cycleCount: 0,
      isStructurallyOverdue: false,
      isSaturated: false,
      cycleScore: 0,
      estimatedProbability: (minNumbers / totalNumbers) * 100,
      phase: "due" as const,
    }));
    return {
      cycles: empty,
      structurallyOverdue: [],
      saturated: [],
      due: [],
      avgCycleLength: totalNumbers / minNumbers,
      cycleScore: () => 0,
    };
  }

  const theoreticalCycle = totalNumbers / minNumbers;
  const cycles: CycleInfo[] = [];

  for (let n = 1; n <= totalNumbers; n++) {
    // Atraso atual (sorteios desde última aparição)
    const currentDelay = (() => {
      const idx = draws.findIndex(d => d.includes(n));
      return idx === -1 ? draws.length : idx;
    })();

    const cycleLengths = extractCycleLengths(draws, n);
    const avg = cycleLengths.length > 0 ? mean(cycleLengths) : theoreticalCycle;
    const std = stdDev(cycleLengths, avg);

    // Saturado: saiu muito recentemente (delay < 30% do ciclo médio)
    const isSaturated = currentDelay < Math.max(1, avg * 0.30);
    // Estruturalmente overdue: delay > 2x o ciclo médio
    const isStructurallyOverdue = currentDelay > avg * 2.0;
    // Due: delay entre 0.8x e 2x do ciclo (zona de expectativa)
    const isDue = !isSaturated && !isStructurallyOverdue && currentDelay >= avg * 0.80;

    // Score de ciclo (positivo = esperado, negativo = saturado)
    const normalized = avg > 0 ? (currentDelay - avg) / Math.max(std, 1) : 0;
    const cycleScoreVal = Math.round(Math.min(100, Math.max(-100, normalized * 20)));

    // Probabilidade estimada simples: baseada no ciclo médio
    const remaining = Math.max(0, avg - currentDelay);
    const prob = avg > 0 ? Math.min(99, Math.round((1 - remaining / avg) * (minNumbers / totalNumbers) * 200)) : (minNumbers / totalNumbers) * 100;

    let phase: CycleInfo["phase"];
    if (isSaturated) phase = "saturated";
    else if (isStructurallyOverdue) phase = "overdue";
    else if (isDue) phase = "due";
    else phase = "recent";

    cycles.push({
      number: n,
      currentDelay,
      avgCycleLength: Math.round(avg * 10) / 10,
      cycleStdDev: Math.round(std * 10) / 10,
      cycleCount: cycleLengths.length,
      isStructurallyOverdue,
      isSaturated,
      cycleScore: cycleScoreVal,
      estimatedProbability: Math.max(1, prob),
      phase,
    });
  }

  const scoreMap: Record<number, number> = {};
  for (const c of cycles) scoreMap[c.number] = c.cycleScore;

  return {
    cycles,
    structurallyOverdue: cycles.filter(c => c.isStructurallyOverdue).map(c => c.number),
    saturated: cycles.filter(c => c.isSaturated).map(c => c.number),
    due: cycles.filter(c => c.phase === "due").map(c => c.number),
    avgCycleLength: Math.round(theoreticalCycle * 10) / 10,
    cycleScore: (n: number) => scoreMap[n] || 0,
  };
}

/**
 * Retorna o score de ciclo agregado para um conjunto de números.
 * Score positivo = jogo com bom alinhamento de ciclos.
 */
export function computeGameCycleScore(
  numbers: number[],
  cycleAnalysis: CycleAnalysis,
): number {
  if (numbers.length === 0) return 0;
  const total = numbers.reduce((sum, n) => sum + cycleAnalysis.cycleScore(n), 0);
  return Math.round(total / numbers.length);
}
