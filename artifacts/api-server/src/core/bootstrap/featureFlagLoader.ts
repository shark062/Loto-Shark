// ============================================================
//  Feature Flag Loader — Gerenciamento de Feature Flags
//  Flags podem vir de: ENV vars > DB > defaults hardcoded.
//  Suporte a flags por modalidade e por usuário (futuro).
// ============================================================

import { logger } from "../../lib/logger";

// ─── Tipos ────────────────────────────────────────────────────

export interface FeatureFlag {
  id:           string;
  name:         string;
  enabled:      boolean;
  description:  string;
  /** Porcentagem de rollout (0–100), 100 = todos */
  rollout:      number;
  /** Modalidades específicas (vazio = todas) */
  modalities?:  string[];
  /** Metadata */
  metadata?:    Record<string, any>;
}

export type FlagId =
  | "hyper_score_engine"
  | "entropy_engine"
  | "correlation_engine"
  | "distribution_engine"
  | "temporal_trend_engine"
  | "roi_optimizer"
  | "quality_ranking"
  | "ensemble_decision"
  | "dynamic_filters"
  | "adaptive_weights_v2"
  | "advanced_backtest"
  | "monte_carlo_v2"
  | "ai_ensemble"
  | "auto_learning"
  | "audit_db_persist"
  | string;

// ─── Flags Padrão ─────────────────────────────────────────────

const DEFAULT_FLAGS: FeatureFlag[] = [
  { id: "hyper_score_engine",      name: "HyperScore Engine",         enabled: true,  description: "Pontuação multiplicativa geométrica", rollout: 100 },
  { id: "entropy_engine",          name: "Entropy Engine",            enabled: true,  description: "Análise de dispersão e entropia",      rollout: 100 },
  { id: "correlation_engine",      name: "Correlation Engine",        enabled: true,  description: "Matriz de co-ocorrência histórica",    rollout: 100 },
  { id: "distribution_engine",     name: "Distribution Engine",       enabled: true,  description: "Análise de distribuição completa",     rollout: 100 },
  { id: "temporal_trend_engine",   name: "Temporal Trend Engine",     enabled: true,  description: "Tendências temporais por número",      rollout: 100 },
  { id: "roi_optimizer",           name: "ROI Optimizer",             enabled: true,  description: "Otimização de retorno sobre investimento", rollout: 100 },
  { id: "quality_ranking",         name: "Quality Ranking Engine",    enabled: true,  description: "Ranqueamento profissional com medalhas", rollout: 100 },
  { id: "ensemble_decision",       name: "Ensemble Decision Engine",  enabled: true,  description: "Decisão por comitê de engines",        rollout: 100 },
  { id: "dynamic_filters",         name: "Dynamic Filter Engine",     enabled: true,  description: "Filtros adaptativos dinâmicos",        rollout: 100 },
  { id: "adaptive_weights_v2",     name: "Adaptive Weights v2",       enabled: true,  description: "Pesos adaptativos com aprendizado bayesiano", rollout: 100 },
  { id: "advanced_backtest",       name: "Advanced Backtest",         enabled: true,  description: "Backtest profissional com métricas avançadas", rollout: 100 },
  { id: "monte_carlo_v2",          name: "Monte Carlo v2",            enabled: true,  description: "Simulação Monte Carlo evoluída",       rollout: 100 },
  { id: "ai_ensemble",             name: "AI Ensemble",               enabled: true,  description: "Ensemble de provedores de IA",         rollout: 100 },
  { id: "auto_learning",           name: "Auto Learning",             enabled: true,  description: "Aprendizado automático com resultados", rollout: 100 },
  { id: "audit_db_persist",        name: "Audit DB Persist",          enabled: true,  description: "Persistência de audit logs no banco",  rollout: 100 },
];

// ─── Estado ───────────────────────────────────────────────────

const flagStore = new Map<string, FeatureFlag>(
  DEFAULT_FLAGS.map(f => [f.id, f]),
);

// ─── API ──────────────────────────────────────────────────────

/**
 * Verifica se uma feature flag está habilitada.
 */
export function isEnabled(flagId: FlagId, modality?: string): boolean {
  const flag = flagStore.get(flagId);
  if (!flag) return true; // assume habilitado se não encontrado

  if (!flag.enabled) return false;

  // Verifica rollout
  if (flag.rollout < 100) {
    return Math.random() * 100 < flag.rollout;
  }

  // Verifica modalidade
  if (modality && flag.modalities && flag.modalities.length > 0) {
    return flag.modalities.includes(modality);
  }

  return true;
}

/**
 * Lista todas as flags.
 */
export function listFlags(): FeatureFlag[] {
  return Array.from(flagStore.values());
}

/**
 * Atualiza uma flag em runtime.
 */
export function updateFlag(id: string, updates: Partial<FeatureFlag>): void {
  const existing = flagStore.get(id) || DEFAULT_FLAGS.find(f => f.id === id);
  if (!existing) {
    logger.warn({ id }, "[FeatureFlags] Flag não encontrada");
    return;
  }
  flagStore.set(id, { ...existing, ...updates });
  logger.info({ id, updates }, "[FeatureFlags] Flag atualizada");
}

/**
 * Carrega flags do banco de dados (complementa os defaults).
 */
export async function loadFlagsFromDb(): Promise<void> {
  try {
    const { db } = await import("@workspace/db");
    const { sql } = await import("drizzle-orm");

    const rows = await db.execute(
      sql`SELECT id, enabled, rollout, metadata FROM feature_flags WHERE 1=1`
    ).catch(() => ({ rows: [] }));

    for (const row of (rows.rows || []) as any[]) {
      const existing = flagStore.get(row.id);
      if (existing) {
        flagStore.set(row.id, {
          ...existing,
          enabled: row.enabled ?? existing.enabled,
          rollout: row.rollout ?? existing.rollout,
          metadata: row.metadata || existing.metadata,
        });
      }
    }

    logger.info({ count: rows.rows?.length || 0 }, "[FeatureFlags] Flags carregadas do banco");
  } catch (err: any) {
    logger.debug({ err: err.message }, "[FeatureFlags] Banco sem tabela feature_flags — usando defaults");
  }
}

/**
 * Retorna um resumo das flags habilitadas.
 */
export function getEnabledFlagIds(): string[] {
  return Array.from(flagStore.values())
    .filter(f => f.enabled)
    .map(f => f.id);
}
