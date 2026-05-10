// ============================================================
//  Audit Logger — Fase 15
//  Registra todas as gerações, versões, scores, filtros,
//  snapshots e IAs utilizadas para rastreabilidade total.
// ============================================================

import { logger } from "./logger";

// ─── Tipos ────────────────────────────────────────────────────

export type AuditEventType =
  | "game_generated"
  | "game_saved"
  | "game_checked"
  | "ai_called"
  | "ai_failed"
  | "backtest_run"
  | "monte_carlo_run"
  | "snapshot_captured"
  | "pipeline_run"
  | "cache_hit"
  | "cache_miss"
  | "temporal_violation"
  | "similarity_filtered"
  | "coverage_applied"
  | "auto_learning_updated";

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  timestamp: string;
  modality?: string;
  contestNumber?: number;
  algorithmVersion?: string;
  aiVersion?: string;
  generationHash?: string;
  gamesCount?: number;
  score?: number;
  filters?: Record<string, any>;
  aiUsed?: string;
  latencyMs?: number;
  success?: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

// ─── Buffer de Auditoria ──────────────────────────────────────
// Em memória — ring buffer de 2000 eventos

const MAX_EVENTS = 2000;
const auditBuffer: AuditEvent[] = [];
let eventCounter = 0;

// ─── Funções Públicas ─────────────────────────────────────────

function generateEventId(): string {
  return `AUD-${Date.now().toString(36).toUpperCase()}-${(++eventCounter).toString(36).toUpperCase()}`;
}

/**
 * Registra um evento de auditoria.
 */
export function auditLog(
  type: AuditEventType,
  data: Omit<AuditEvent, "id" | "type" | "timestamp">,
): string {
  const event: AuditEvent = {
    id: generateEventId(),
    type,
    timestamp: new Date().toISOString(),
    ...data,
  };

  // Ring buffer
  if (auditBuffer.length >= MAX_EVENTS) {
    auditBuffer.shift();
  }
  auditBuffer.push(event);

  // Log estruturado via pino (apenas para eventos importantes)
  const important: AuditEventType[] = [
    "game_generated",
    "ai_failed",
    "temporal_violation",
    "pipeline_run",
  ];

  if (important.includes(type)) {
    logger.info(
      { auditId: event.id, type, modality: data.modality, contestNumber: data.contestNumber, hash: data.generationHash },
      `[Audit] ${type}`,
    );
  }

  return event.id;
}

/**
 * Retorna os últimos N eventos de auditoria.
 */
export function getRecentAuditEvents(limit: number = 100): AuditEvent[] {
  return auditBuffer.slice(-limit).reverse();
}

/**
 * Filtra eventos por tipo.
 */
export function filterAuditEvents(
  type: AuditEventType,
  limit: number = 50,
): AuditEvent[] {
  return auditBuffer.filter(e => e.type === type).slice(-limit).reverse();
}

/**
 * Retorna estatísticas do buffer de auditoria.
 */
export function getAuditStats(): {
  total: number;
  byType: Record<string, number>;
  oldestEvent: string | null;
  newestEvent: string | null;
} {
  const byType: Record<string, number> = {};
  for (const e of auditBuffer) {
    byType[e.type] = (byType[e.type] || 0) + 1;
  }

  return {
    total: auditBuffer.length,
    byType,
    oldestEvent: auditBuffer[0]?.timestamp || null,
    newestEvent: auditBuffer[auditBuffer.length - 1]?.timestamp || null,
  };
}

/**
 * Registra especificamente uma geração de jogos.
 */
export function auditGameGeneration(params: {
  modality: string;
  contestNumber: number;
  gamesCount: number;
  strategy: string;
  algorithmVersion: string;
  aiVersion?: string;
  generationHash: string;
  latencyMs: number;
  aiUsed?: string;
  filtersApplied?: string[];
}): string {
  return auditLog("game_generated", {
    modality: params.modality,
    contestNumber: params.contestNumber,
    algorithmVersion: params.algorithmVersion,
    aiVersion: params.aiVersion,
    generationHash: params.generationHash,
    gamesCount: params.gamesCount,
    aiUsed: params.aiUsed,
    latencyMs: params.latencyMs,
    success: true,
    filters: { strategy: params.strategy, applied: params.filtersApplied || [] },
  });
}

/**
 * Registra uma violação temporal (data leakage).
 */
export function auditTemporalViolation(params: {
  modality: string;
  targetContest: number;
  violatingContest: number;
  context: string;
}): string {
  return auditLog("temporal_violation", {
    modality: params.modality,
    contestNumber: params.targetContest,
    success: false,
    error: `Data leakage: concurso ${params.violatingContest} usado ao analisar alvo ${params.targetContest}`,
    metadata: { context: params.context, violatingContest: params.violatingContest },
  });
}
