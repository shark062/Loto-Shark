// ============================================================
//  Adaptive Cycle Engine — Detecção de Ciclos Adaptativos
//  Identifica padrões de repetição e alternância em series
//  temporais de sorteios. Detecta "janelas de oportunidade"
//  onde certos grupos de números tendem a reaparecer.
// ============================================================

export interface CyclePattern {
  type: "hot_streak" | "cold_streak" | "alternating" | "cluster" | "steady";
  numbers: number[];
  confidence: number;       // 0–1
  avgCycleLength: number;   // sorteios por ciclo
  lastCycleStart: number;   // sorteio atrás onde começou o ciclo atual
  description: string;
}

export interface AdaptiveCycleResult {
  patterns: CyclePattern[];
  cyclicNumbers: number[];      // números com padrão cíclico detectável
  steadyNumbers: number[];      // números estáveis (sem padrão detectável)
  hotStreakActive: number[];     // em streak quente agora
  coldStreakActive: number[];    // em streak fria agora
  overallCycleScore: number;    // 0–100 (qualidade dos padrões)
}

/**
 * Detecta ciclos adaptativos nos sorteios.
 * Analisa os últimos N sorteios para identificar padrões.
 *
 * @param draws  Histórico de sorteios (mais recente primeiro)
 * @param totalNumbers Total de números da modalidade
 * @param windowSize   Janela de análise (padrão: 20 sorteios)
 */
export function detectAdaptiveCycles(
  draws: number[][],
  totalNumbers: number,
  windowSize = 20
): AdaptiveCycleResult {
  const window = draws.slice(0, Math.min(windowSize, draws.length));

  if (window.length < 5) {
    return {
      patterns: [], cyclicNumbers: [], steadyNumbers: [],
      hotStreakActive: [], coldStreakActive: [], overallCycleScore: 0,
    };
  }

  // Constrói bitmap de presença por número × sorteio
  const presence = new Map<number, boolean[]>();
  for (let n = 1; n <= totalNumbers; n++) {
    presence.set(n, window.map(d => d.includes(n)));
  }

  const patterns: CyclePattern[] = [];
  const cyclicNumbers: number[] = [];
  const steadyNumbers: number[] = [];
  const hotStreakActive: number[] = [];
  const coldStreakActive: number[] = [];

  for (let n = 1; n <= totalNumbers; n++) {
    const bits = presence.get(n)!;
    const trueCount = bits.filter(Boolean).length;

    // Hot streak: saiu em >= 60% dos últimos sorteios
    const recentWindow = bits.slice(0, Math.min(8, bits.length));
    const recentHot = recentWindow.filter(Boolean).length / recentWindow.length;

    if (recentHot >= 0.6) {
      hotStreakActive.push(n);
      // Encontra início da streak
      let streakStart = 0;
      for (let i = 0; i < bits.length; i++) {
        if (!bits[i]) { streakStart = i; break; }
      }
      patterns.push({
        type: "hot_streak",
        numbers: [n],
        confidence: Math.min(0.95, recentHot),
        avgCycleLength: 1 / Math.max(0.01, trueCount / window.length),
        lastCycleStart: streakStart,
        description: `Nº ${n} em streak quente: ${Math.round(recentHot * 100)}% de presença recente`,
      });
      cyclicNumbers.push(n);
    }

    // Cold streak: ausente nos últimos >= 70% dos sorteios
    const recentCold = 1 - recentHot;
    if (recentCold >= 0.7) {
      coldStreakActive.push(n);
      cyclicNumbers.push(n);
    }

    // Steady: frequência entre 30-55% (comportamento esperado)
    const relFreq = trueCount / window.length;
    if (relFreq >= 0.30 && relFreq <= 0.55 && recentHot < 0.6 && recentCold < 0.7) {
      steadyNumbers.push(n);
    }

    // Alternância: padrão 1010 detectado
    let alternatingScore = 0;
    for (let i = 0; i < bits.length - 1; i++) {
      if (bits[i] !== bits[i + 1]) alternatingScore++;
    }
    const altRate = alternatingScore / (bits.length - 1);
    if (altRate >= 0.7) {
      cyclicNumbers.push(n);
      patterns.push({
        type: "alternating",
        numbers: [n],
        confidence: Math.min(0.85, altRate),
        avgCycleLength: 2,
        lastCycleStart: 0,
        description: `Nº ${n} alterna presença a cada ~2 sorteios (padrão ${Math.round(altRate * 100)}%)`,
      });
    }
  }

  // Remove duplicatas de cyclicNumbers
  const uniqueCyclic = [...new Set(cyclicNumbers)];
  const uniqueSteady = steadyNumbers.filter(n => !uniqueCyclic.includes(n));

  // Score geral de qualidade dos ciclos
  const overallCycleScore = Math.min(100, Math.round(
    (hotStreakActive.length * 3 + coldStreakActive.length * 2 + uniqueCyclic.length) /
    totalNumbers * 200
  ));

  // Ordena padrões por confiança
  patterns.sort((a, b) => b.confidence - a.confidence);

  return {
    patterns: patterns.slice(0, 15),
    cyclicNumbers: uniqueCyclic,
    steadyNumbers: uniqueSteady.slice(0, 20),
    hotStreakActive,
    coldStreakActive,
    overallCycleScore,
  };
}

/**
 * Aplica ajuste de score baseado em ciclos detectados.
 * Favorece jogos com mix equilibrado de numbers de ciclos distintos.
 */
export function applyCycleAdjustment(
  gameNumbers: number[],
  cycles: AdaptiveCycleResult,
  targetHotRatio = 0.4
): { adjustedScore: number; hotCount: number; coldCount: number; steadyCount: number } {
  const hotCount  = gameNumbers.filter(n => cycles.hotStreakActive.includes(n)).length;
  const coldCount = gameNumbers.filter(n => cycles.coldStreakActive.includes(n)).length;
  const steadyCount = gameNumbers.filter(n => cycles.steadyNumbers.includes(n)).length;
  const total = gameNumbers.length;

  const actualHotRatio = hotCount / total;
  const deviation = Math.abs(actualHotRatio - targetHotRatio);

  // Penaliza desvio do ratio alvo; premia equilíbrio
  const adjustedScore = Math.max(0, 100 - deviation * 200 + steadyCount * 5);

  return { adjustedScore: Math.round(adjustedScore), hotCount, coldCount, steadyCount };
}
