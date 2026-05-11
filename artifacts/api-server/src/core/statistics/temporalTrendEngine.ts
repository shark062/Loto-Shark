// ============================================================
//  Temporal Trend Engine — Análise de Tendências no Tempo
//  Detecta se números estão em tendência de alta ou baixa
//  recente, usando janelas temporais múltiplas.
//  Aplica médias móveis e regressão linear simples por número.
// ============================================================

// ─── Tipos ────────────────────────────────────────────────────

export interface NumberTrend {
  number:       number;
  /** Frequência na janela curta (últimos 10) */
  shortTermFreq: number;
  /** Frequência na janela média (últimos 30) */
  midTermFreq:  number;
  /** Frequência na janela longa (últimos 60) */
  longTermFreq: number;
  /** Inclinação da regressão linear (positivo = subindo) */
  slope:        number;
  /** Tendência: "subindo" | "estável" | "caindo" */
  trend:        "subindo" | "estável" | "caindo";
  /** Score de tendência: positivo = favorável */
  trendScore:   number;
  /** Força da tendência (0–100) */
  trendStrength: number;
}

export interface TemporalTrendAnalysis {
  /** Tendências por número */
  trends:            Record<number, NumberTrend>;
  /** Números em tendência de alta */
  risingNumbers:     number[];
  /** Números em tendência de baixa */
  fallingNumbers:    number[];
  /** Números estáveis */
  stableNumbers:     number[];
  /** Temperatura temporal dominante */
  dominantTrend:     "aquecimento" | "estável" | "resfriamento";
  /** Score global de tendência do histórico recente (0–100) */
  globalTrendScore:  number;
}

export interface GameTrendScore {
  /** Score de tendência temporal do jogo (0–100) */
  trendScore: number;
  /** Números do jogo em alta */
  risingInGame: number[];
  /** Números do jogo em queda */
  fallingInGame: number[];
  /** Interpretação */
  interpretation: string;
}

// ─── Configuração de Janelas Temporais ────────────────────────

const WINDOW_SHORT  = 10;
const WINDOW_MID    = 30;
const WINDOW_LONG   = 60;

// ─── Regressão Linear Simples ─────────────────────────────────

/**
 * Calcula a inclinação de uma regressão linear simples (OLS).
 * y = freq por janela deslizante, x = índice de tempo.
 */
function linearSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;

  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean);
    den += Math.pow(i - xMean, 2);
  }

  return den !== 0 ? num / den : 0;
}

/**
 * Computa a frequência de um número em uma janela de sorteios.
 */
function freqInWindow(draws: number[][], number: number, window: number): number {
  const slice = draws.slice(0, Math.min(window, draws.length));
  const count = slice.filter(d => d.includes(number)).length;
  return slice.length > 0 ? count / slice.length : 0;
}

// ─── Análise de Tendência por Número ──────────────────────────

/**
 * Analisa a tendência temporal de um número específico.
 */
function analyzeNumberTrend(number: number, draws: number[][]): NumberTrend {
  const shortFreq = freqInWindow(draws, number, WINDOW_SHORT);
  const midFreq   = freqInWindow(draws, number, WINDOW_MID);
  const longFreq  = freqInWindow(draws, number, WINDOW_LONG);

  // Calcula frequência em janelas de 10 para regressão
  const windowCount = Math.min(6, Math.floor(draws.length / 10));
  const windowFreqs = Array.from({ length: windowCount }, (_, i) => {
    const start = i * 10;
    const slice = draws.slice(start, start + 10);
    return slice.filter(d => d.includes(number)).length / Math.max(slice.length, 1);
  }).reverse(); // mais antigo primeiro para regressão temporal

  const slope = linearSlope(windowFreqs);

  let trend: NumberTrend["trend"];
  let trendScore: number;
  let trendStrength: number;

  if (slope > 0.01) {
    trend = "subindo";
    trendScore = Math.round(50 + slope * 500);
    trendStrength = Math.min(100, Math.round(Math.abs(slope) * 600));
  } else if (slope < -0.01) {
    trend = "caindo";
    trendScore = Math.round(50 + slope * 500);
    trendStrength = Math.min(100, Math.round(Math.abs(slope) * 600));
  } else {
    trend = "estável";
    trendScore = 50;
    trendStrength = Math.round(Math.abs(slope) * 200);
  }

  trendScore = Math.max(0, Math.min(100, trendScore));
  trendStrength = Math.max(0, Math.min(100, trendStrength));

  return {
    number,
    shortTermFreq: Math.round(shortFreq * 1000) / 1000,
    midTermFreq:   Math.round(midFreq   * 1000) / 1000,
    longTermFreq:  Math.round(longFreq  * 1000) / 1000,
    slope:         Math.round(slope * 10000) / 10000,
    trend,
    trendScore,
    trendStrength,
  };
}

// ─── Análise Global ───────────────────────────────────────────

/**
 * Analisa as tendências temporais de todos os números.
 *
 * @param draws        Histórico de sorteios (mais recente primeiro)
 * @param totalNumbers Universo da modalidade
 */
export function analyzeTemporalTrends(
  draws: number[][],
  totalNumbers: number,
): TemporalTrendAnalysis {
  if (draws.length < 10) {
    return {
      trends: {},
      risingNumbers: [],
      fallingNumbers: [],
      stableNumbers: Array.from({ length: totalNumbers }, (_, i) => i + 1),
      dominantTrend: "estável",
      globalTrendScore: 50,
    };
  }

  const trends: Record<number, NumberTrend> = {};
  const risingNumbers: number[] = [];
  const fallingNumbers: number[] = [];
  const stableNumbers: number[] = [];

  for (let n = 1; n <= totalNumbers; n++) {
    const trend = analyzeNumberTrend(n, draws);
    trends[n] = trend;

    if (trend.trend === "subindo") risingNumbers.push(n);
    else if (trend.trend === "caindo") fallingNumbers.push(n);
    else stableNumbers.push(n);
  }

  const risingRatio  = risingNumbers.length / totalNumbers;
  const fallingRatio = fallingNumbers.length / totalNumbers;

  let dominantTrend: TemporalTrendAnalysis["dominantTrend"];
  if (risingRatio > 0.35) dominantTrend = "aquecimento";
  else if (fallingRatio > 0.35) dominantTrend = "resfriamento";
  else dominantTrend = "estável";

  const avgTrendScore = Object.values(trends).reduce((s, t) => s + t.trendScore, 0) / Math.max(totalNumbers, 1);
  const globalTrendScore = Math.round(avgTrendScore);

  return {
    trends,
    risingNumbers:  risingNumbers.sort((a, b) => (trends[b]?.trendStrength || 0) - (trends[a]?.trendStrength || 0)),
    fallingNumbers: fallingNumbers.sort((a, b) => (trends[b]?.trendStrength || 0) - (trends[a]?.trendStrength || 0)),
    stableNumbers,
    dominantTrend,
    globalTrendScore,
  };
}

/**
 * Pontua um jogo específico em relação às tendências temporais.
 *
 * @param numbers    Números do jogo
 * @param analysis   Análise de tendência pré-computada
 * @param preference "rising" = premia quentes; "balanced" = equilibrado
 */
export function scoreGameTemporalTrend(
  numbers: number[],
  analysis: TemporalTrendAnalysis,
  preference: "rising" | "balanced" = "balanced",
): GameTrendScore {
  const risingInGame:  number[] = [];
  const fallingInGame: number[] = [];

  let totalScore = 0;
  let counted = 0;

  for (const n of numbers) {
    const t = analysis.trends[n];
    if (!t) { totalScore += 50; counted++; continue; }

    if (t.trend === "subindo") risingInGame.push(n);
    else if (t.trend === "caindo") fallingInGame.push(n);

    const contrib = preference === "rising"
      ? t.trendScore
      : t.trend === "subindo"
        ? 65 + t.trendStrength * 0.3
        : t.trend === "estável"
          ? 55
          : 35 + (50 - t.trendStrength) * 0.3;

    totalScore += Math.max(0, Math.min(100, contrib));
    counted++;
  }

  const trendScore = counted > 0 ? Math.round(totalScore / counted) : 50;

  let interpretation: string;
  if (trendScore >= 70) {
    interpretation = "Jogo alinhado com tendências recentes de alta — excelente timing.";
  } else if (trendScore >= 50) {
    interpretation = "Jogo com tendência neutra a positiva — timing adequado.";
  } else {
    interpretation = "Jogo predomina números em baixa recente — timing desfavorável.";
  }

  return { trendScore, risingInGame, fallingInGame, interpretation };
}
