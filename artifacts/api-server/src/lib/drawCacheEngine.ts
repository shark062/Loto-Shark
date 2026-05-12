// ============================================================
//  Draw Cache Engine — Loto-Shark SharkCore v3
//  Cache inteligente para resultados oficiais da Caixa
//  TTL dinâmico: curto pré-sorteio, longo pós-sorteio
// ============================================================

import { logger } from "./logger";
import type { OfficialDraw } from "./officialDrawProvider";

interface CacheEntry {
  draw: OfficialDraw;
  cachedAt: number;
  ttlMs: number;
  contestNumber: number;
}

// In-memory cache (por processo — persiste enquanto o servidor rodar)
const drawCache = new Map<string, CacheEntry>();

// TTLs (ms)
const TTL_AVAILABLE   = 4 * 60 * 60 * 1000; // 4h — resultado disponível (não muda)
const TTL_PENDING     = 10 * 60 * 1000;       // 10min — aguardando resultado
const TTL_UNAVAILABLE = 30 * 60 * 1000;       // 30min — Caixa indisponível

function cacheKey(lotteryId: string, contest?: number): string {
  return contest ? `${lotteryId}:${contest}` : `${lotteryId}:latest`;
}

/**
 * Guarda um resultado no cache com TTL dinâmico.
 */
export function cacheDraw(draw: OfficialDraw, contest?: number): void {
  const key = cacheKey(draw.lotteryId, contest);
  const ttlMs = draw.status === "available"
    ? TTL_AVAILABLE
    : draw.status === "pending"
    ? TTL_PENDING
    : TTL_UNAVAILABLE;

  drawCache.set(key, {
    draw,
    cachedAt: Date.now(),
    ttlMs,
    contestNumber: draw.contestNumber,
  });

  logger.debug({ key, ttlMs, status: draw.status }, "[DrawCache] Entrada armazenada");
}

/**
 * Recupera um resultado do cache se ainda válido.
 * Retorna null se expirado ou inexistente.
 */
export function getCachedDraw(lotteryId: string, contest?: number): OfficialDraw | null {
  const key = cacheKey(lotteryId, contest);
  const entry = drawCache.get(key);

  if (!entry) return null;

  const age = Date.now() - entry.cachedAt;
  if (age > entry.ttlMs) {
    drawCache.delete(key);
    logger.debug({ key, ageMs: age }, "[DrawCache] Entrada expirada — removida");
    return null;
  }

  return entry.draw;
}

/**
 * Invalida o cache de uma modalidade (usar após novo sorteio conhecido).
 */
export function invalidateDrawCache(lotteryId: string): void {
  const prefix = `${lotteryId}:`;
  for (const key of Array.from(drawCache.keys())) {
    if (key.startsWith(prefix)) {
      drawCache.delete(key);
      logger.debug({ key }, "[DrawCache] Invalidado");
    }
  }
}

/**
 * Retorna estatísticas do cache atual.
 */
export function getDrawCacheStats(): {
  totalEntries: number;
  entries: Array<{ key: string; status: string; ageMs: number; ttlMs: number; expiresInMs: number }>
} {
  const now = Date.now();
  const entries = Array.from(drawCache.entries()).map(([key, entry]) => {
    const ageMs = now - entry.cachedAt;
    return {
      key,
      status: entry.draw.status,
      ageMs,
      ttlMs: entry.ttlMs,
      expiresInMs: Math.max(0, entry.ttlMs - ageMs),
    };
  });

  return { totalEntries: entries.length, entries };
}

/**
 * Wrapper: busca do cache ou executa o fetcher e armazena.
 */
export async function withDrawCache<T extends OfficialDraw | null>(
  lotteryId: string,
  fetcher: () => Promise<T>,
  contest?: number
): Promise<T> {
  const cached = getCachedDraw(lotteryId, contest);
  if (cached) {
    logger.debug({ lotteryId, contest }, "[DrawCache] Cache hit");
    return cached as T;
  }

  const result = await fetcher();
  if (result) {
    cacheDraw(result, contest);
  }
  return result;
}
