// ============================================================
//  Statistics Cache — Fase 14: Performance
//  Cacheia resultados estatísticos custosos para evitar
//  recálculos desnecessários entre requests.
// ============================================================

import { logger } from "./logger";

// ─── Tipos ────────────────────────────────────────────────────

export interface CachedStatistics {
  lotteryId: string;
  computedAt: number;
  ttlMs: number;
  /** Frequência por número */
  frequencyMap: Record<number, number>;
  /** Atraso atual por número */
  delayMap: Record<number, number>;
  /** Números quentes */
  hotNumbers: number[];
  /** Números frios */
  coldNumbers: number[];
  /** Números mornos */
  warmNumbers: number[];
  /** Soma média histórica */
  avgSum: number;
  /** Média de pares */
  avgEvens: number;
  /** Score de ciclo por número */
  cycleScores?: Record<number, number>;
  /** Cobertura global */
  coverageScore?: number;
  /** Sorteios analisados */
  drawsAnalyzed: number;
}

// ─── Cache em Memória ─────────────────────────────────────────

const statsCache = new Map<string, CachedStatistics>();

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutos

// ─── Funções Públicas ─────────────────────────────────────────

function cacheKey(lotteryId: string, drawCount: number): string {
  return `${lotteryId}:${drawCount}`;
}

/**
 * Armazena estatísticas no cache.
 */
export function cacheStatistics(
  lotteryId: string,
  drawCount: number,
  stats: Omit<CachedStatistics, "lotteryId" | "computedAt" | "ttlMs">,
  ttlMs: number = DEFAULT_TTL_MS,
): void {
  const key = cacheKey(lotteryId, drawCount);
  statsCache.set(key, {
    ...stats,
    lotteryId,
    computedAt: Date.now(),
    ttlMs,
  });

  logger.debug(
    { key, drawsAnalyzed: stats.drawsAnalyzed },
    "[StatsCache] Estatísticas cacheadas",
  );
}

/**
 * Recupera estatísticas do cache (retorna null se expirado ou inexistente).
 */
export function getCachedStatistics(
  lotteryId: string,
  drawCount: number,
): CachedStatistics | null {
  const key = cacheKey(lotteryId, drawCount);
  const entry = statsCache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.computedAt > entry.ttlMs) {
    statsCache.delete(key);
    return null;
  }

  return entry;
}

/**
 * Invalida o cache para uma modalidade (ex: após novos sorteios).
 */
export function invalidateCache(lotteryId: string): void {
  const keys = Array.from(statsCache.keys()).filter(k => k.startsWith(lotteryId + ":"));
  for (const key of keys) statsCache.delete(key);
  logger.info({ lotteryId, keysRemoved: keys.length }, "[StatsCache] Cache invalidado");
}

/**
 * Invalida todo o cache.
 */
export function invalidateAllCache(): void {
  const total = statsCache.size;
  statsCache.clear();
  logger.info({ total }, "[StatsCache] Cache global invalidado");
}

/**
 * Retorna informações sobre o estado do cache.
 */
export function getCacheInfo(): {
  entries: number;
  lotteries: string[];
  oldestEntry: number | null;
  newestEntry: number | null;
} {
  const entries = Array.from(statsCache.values());
  const times = entries.map(e => e.computedAt);

  return {
    entries: statsCache.size,
    lotteries: [...new Set(entries.map(e => e.lotteryId))],
    oldestEntry: times.length > 0 ? Math.min(...times) : null,
    newestEntry: times.length > 0 ? Math.max(...times) : null,
  };
}

/**
 * Wrapper: retorna do cache ou executa o computador se expirado.
 */
export async function getOrCompute<T extends Omit<CachedStatistics, "lotteryId" | "computedAt" | "ttlMs">>(
  lotteryId: string,
  drawCount: number,
  compute: () => Promise<T>,
  ttlMs?: number,
): Promise<CachedStatistics> {
  const cached = getCachedStatistics(lotteryId, drawCount);
  if (cached) return cached;

  const result = await compute();
  cacheStatistics(lotteryId, drawCount, result, ttlMs);
  return { ...result, lotteryId, computedAt: Date.now(), ttlMs: ttlMs ?? DEFAULT_TTL_MS };
}
