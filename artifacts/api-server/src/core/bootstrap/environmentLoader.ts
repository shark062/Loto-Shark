// ============================================================
//  Environment Loader — Carrega e valida variáveis de ambiente
//  Fornece valores padrão seguros e registra warnings.
//  Nunca falha — sempre retorna um estado válido com fallbacks.
// ============================================================

import { logger } from "../../lib/logger";

// ─── Tipos ────────────────────────────────────────────────────

export interface EnvironmentConfig {
  nodeEnv:         "development" | "production" | "test";
  port:            number;
  databaseUrl:     string;
  isDatabaseReady: boolean;
  aiKeys: {
    openai?:    string;
    anthropic?: string;
    groq?:      string;
    replitAi?:  string;
  };
  featureFlags: {
    enableAI:          boolean;
    enableBacktest:    boolean;
    enableMonteCarlo:  boolean;
    enableAdvancedPipeline: boolean;
    enableAdaptiveLearning: boolean;
    enableHyperScore:  boolean;
    enableEntropyEngine: boolean;
    enableCorrelationEngine: boolean;
    enableTemporalTrend: boolean;
    enableROIOptimizer: boolean;
    enableQualityRanking: boolean;
    enableEnsembleDecision: boolean;
    enableDynamicFilters: boolean;
  };
  defaultLanguage: string;
  logLevel:        string;
  loadedAt:        string;
  warnings:        string[];
}

// ─── Loader ───────────────────────────────────────────────────

let cachedConfig: EnvironmentConfig | null = null;

/**
 * Carrega e valida todas as variáveis de ambiente.
 * Retorna configuração com fallbacks para tudo.
 */
export function loadEnvironment(force: boolean = false): EnvironmentConfig {
  if (cachedConfig && !force) return cachedConfig;

  const warnings: string[] = [];

  // Node env
  const nodeEnvRaw = process.env.NODE_ENV || "development";
  const nodeEnv = (["development", "production", "test"].includes(nodeEnvRaw)
    ? nodeEnvRaw
    : "development") as EnvironmentConfig["nodeEnv"];

  // Port
  const portRaw = parseInt(process.env.PORT || "8082");
  const port = isNaN(portRaw) ? 8082 : portRaw;

  // Database
  const databaseUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || "";
  if (!databaseUrl) {
    warnings.push("DATABASE_URL não configurado — funcionalidades de persistência desabilitadas");
  }

  // AI Keys
  const openaiKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const groqKey    = process.env.GROQ_API_KEY;
  const replitAiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY; // Replit AI usa formato OpenAI

  if (!openaiKey && !anthropicKey && !groqKey) {
    warnings.push("Nenhuma chave de IA configurada — funcionalidades de IA desabilitadas");
  }

  // Feature flags: lê do env ou usa defaults
  const flag = (key: string, def: boolean = true): boolean => {
    const v = process.env[`FEATURE_${key.toUpperCase()}`];
    if (v === undefined) return def;
    return v !== "false" && v !== "0";
  };

  const featureFlags = {
    enableAI:                flag("AI", true),
    enableBacktest:          flag("BACKTEST", true),
    enableMonteCarlo:        flag("MONTE_CARLO", true),
    enableAdvancedPipeline:  flag("ADVANCED_PIPELINE", true),
    enableAdaptiveLearning:  flag("ADAPTIVE_LEARNING", true),
    enableHyperScore:        flag("HYPER_SCORE", true),
    enableEntropyEngine:     flag("ENTROPY_ENGINE", true),
    enableCorrelationEngine: flag("CORRELATION_ENGINE", true),
    enableTemporalTrend:     flag("TEMPORAL_TREND", true),
    enableROIOptimizer:      flag("ROI_OPTIMIZER", true),
    enableQualityRanking:    flag("QUALITY_RANKING", true),
    enableEnsembleDecision:  flag("ENSEMBLE_DECISION", true),
    enableDynamicFilters:    flag("DYNAMIC_FILTERS", true),
  };

  const defaultLanguage = process.env.DEFAULT_LANGUAGE || "pt-BR";
  const logLevel        = process.env.LOG_LEVEL || "info";

  cachedConfig = {
    nodeEnv,
    port,
    databaseUrl,
    isDatabaseReady: databaseUrl.length > 0,
    aiKeys: {
      openai:    openaiKey,
      anthropic: anthropicKey,
      groq:      groqKey,
      replitAi:  replitAiKey,
    },
    featureFlags,
    defaultLanguage,
    logLevel,
    loadedAt: new Date().toISOString(),
    warnings,
  };

  if (warnings.length > 0) {
    logger.warn({ warnings }, "[EnvLoader] Avisos de configuração");
  }

  logger.info(
    { nodeEnv, port, dbReady: cachedConfig.isDatabaseReady, features: Object.keys(featureFlags).filter(k => featureFlags[k as keyof typeof featureFlags]) },
    "[EnvLoader] Ambiente carregado",
  );

  return cachedConfig;
}

/**
 * Verifica se uma feature flag está habilitada.
 */
export function isFeatureEnabled(
  flag: keyof EnvironmentConfig["featureFlags"],
): boolean {
  return loadEnvironment().featureFlags[flag] ?? true;
}

/**
 * Retorna o idioma padrão configurado.
 */
export function getDefaultLanguage(): string {
  return loadEnvironment().defaultLanguage;
}
