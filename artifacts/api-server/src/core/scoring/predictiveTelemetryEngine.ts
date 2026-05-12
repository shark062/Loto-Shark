// ============================================================
//  Predictive Telemetry Engine — C9
//  Registra previsões vs resultados reais para medir precisão
//  acumulada do SharkCore ao longo do tempo.
//  Sem persistência em DB — usa memória do processo (fast path).
//  Para persistência, os dados devem ser exportados via endpoint.
// ============================================================

import { logger } from "../../lib/logger";

export interface PredictionRecord {
  id: string;
  lotteryId: string;
  contestNumber: number;
  predictedNumbers: number[];
  engineUsed: string;
  sharkScore: number;
  createdAt: string;
  // Preenchido quando o resultado é conhecido
  actualNumbers?: number[];
  hits?: number;
  resolvedAt?: string;
  accuracy?: number;  // hits / total expected min
}

export interface TelemetryStats {
  totalPredictions: number;
  resolved: number;
  pending: number;
  avgHitsPerGame: number;
  avgAccuracy: number;          // 0–1
  bestAccuracy: number;
  engineBreakdown: Record<string, { predictions: number; avgHits: number; avgAccuracy: number }>;
  lotteryBreakdown: Record<string, { predictions: number; avgHits: number }>;
  recentTrend: "improving" | "stable" | "degrading";
}

// In-memory store
const predictions = new Map<string, PredictionRecord>();
let idCounter = 0;

/**
 * Registra uma nova previsão do SharkCore.
 */
export function registerPrediction(
  lotteryId: string,
  contestNumber: number,
  predictedNumbers: number[],
  engineUsed: string,
  sharkScore: number
): string {
  const id = `pred_${Date.now()}_${++idCounter}`;
  predictions.set(id, {
    id,
    lotteryId,
    contestNumber,
    predictedNumbers: [...predictedNumbers].sort((a, b) => a - b),
    engineUsed,
    sharkScore,
    createdAt: new Date().toISOString(),
  });

  logger.debug({ id, lotteryId, contestNumber, engineUsed }, "[Telemetry] Previsão registrada");
  return id;
}

/**
 * Resolve uma previsão com o resultado oficial.
 * Calcula acertos e accuracy.
 *
 * @param predictionId ID retornado por registerPrediction
 * @param actualNumbers Dezenas sorteadas no concurso
 * @param minNumbers    Mínimo de dezenas do tipo de loteria
 */
export function resolvePrediction(
  predictionId: string,
  actualNumbers: number[],
  minNumbers: number
): PredictionRecord | null {
  const rec = predictions.get(predictionId);
  if (!rec) {
    logger.warn({ predictionId }, "[Telemetry] Previsão não encontrada");
    return null;
  }

  const hits = rec.predictedNumbers.filter(n => actualNumbers.includes(n)).length;
  const accuracy = hits / minNumbers;

  const resolved: PredictionRecord = {
    ...rec,
    actualNumbers: [...actualNumbers].sort((a, b) => a - b),
    hits,
    resolvedAt: new Date().toISOString(),
    accuracy: parseFloat(accuracy.toFixed(4)),
  };

  predictions.set(predictionId, resolved);
  logger.info({ predictionId, hits, accuracy }, "[Telemetry] Previsão resolvida");
  return resolved;
}

/**
 * Retorna estatísticas acumuladas de telemetria.
 */
export function getTelemetryStats(): TelemetryStats {
  const all = Array.from(predictions.values());
  const resolved = all.filter(p => p.resolvedAt);
  const pending = all.filter(p => !p.resolvedAt);

  const engineBreakdown: Record<string, { predictions: number; avgHits: number; avgAccuracy: number }> = {};
  const lotteryBreakdown: Record<string, { predictions: number; avgHits: number }> = {};

  for (const p of resolved) {
    // Engine breakdown
    if (!engineBreakdown[p.engineUsed]) {
      engineBreakdown[p.engineUsed] = { predictions: 0, avgHits: 0, avgAccuracy: 0 };
    }
    engineBreakdown[p.engineUsed].predictions++;
    engineBreakdown[p.engineUsed].avgHits += p.hits ?? 0;
    engineBreakdown[p.engineUsed].avgAccuracy += p.accuracy ?? 0;

    // Lottery breakdown
    if (!lotteryBreakdown[p.lotteryId]) {
      lotteryBreakdown[p.lotteryId] = { predictions: 0, avgHits: 0 };
    }
    lotteryBreakdown[p.lotteryId].predictions++;
    lotteryBreakdown[p.lotteryId].avgHits += p.hits ?? 0;
  }

  // Normaliza médias
  for (const key of Object.keys(engineBreakdown)) {
    const n = engineBreakdown[key].predictions;
    if (n > 0) {
      engineBreakdown[key].avgHits = parseFloat((engineBreakdown[key].avgHits / n).toFixed(2));
      engineBreakdown[key].avgAccuracy = parseFloat((engineBreakdown[key].avgAccuracy / n).toFixed(4));
    }
  }
  for (const key of Object.keys(lotteryBreakdown)) {
    const n = lotteryBreakdown[key].predictions;
    if (n > 0) lotteryBreakdown[key].avgHits = parseFloat((lotteryBreakdown[key].avgHits / n).toFixed(2));
  }

  // Trend: compara últimas 10 vs anteriores 10
  const sorted = resolved.sort((a, b) =>
    new Date(a.resolvedAt!).getTime() - new Date(b.resolvedAt!).getTime()
  );
  const recentN = sorted.slice(-10);
  const olderN = sorted.slice(-20, -10);
  let trend: TelemetryStats["recentTrend"] = "stable";
  if (recentN.length > 0 && olderN.length > 0) {
    const recentAvg = recentN.reduce((s, p) => s + (p.accuracy ?? 0), 0) / recentN.length;
    const olderAvg = olderN.reduce((s, p) => s + (p.accuracy ?? 0), 0) / olderN.length;
    if (recentAvg - olderAvg > 0.02) trend = "improving";
    else if (olderAvg - recentAvg > 0.02) trend = "degrading";
  }

  const avgHits = resolved.length > 0
    ? parseFloat((resolved.reduce((s, p) => s + (p.hits ?? 0), 0) / resolved.length).toFixed(2))
    : 0;
  const avgAccuracy = resolved.length > 0
    ? parseFloat((resolved.reduce((s, p) => s + (p.accuracy ?? 0), 0) / resolved.length).toFixed(4))
    : 0;
  const bestAccuracy = resolved.length > 0
    ? Math.max(...resolved.map(p => p.accuracy ?? 0))
    : 0;

  return {
    totalPredictions: all.length,
    resolved: resolved.length,
    pending: pending.length,
    avgHitsPerGame: avgHits,
    avgAccuracy,
    bestAccuracy,
    engineBreakdown,
    lotteryBreakdown,
    recentTrend: trend,
  };
}

/**
 * Lista todas as previsões (para exportação ou debug).
 */
export function listPredictions(limit = 50): PredictionRecord[] {
  return Array.from(predictions.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}
