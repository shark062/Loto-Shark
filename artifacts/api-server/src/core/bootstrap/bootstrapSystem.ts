// ============================================================
//  Bootstrap System — Inicialização Completa da Plataforma
//  Orquestra o carregamento de todos os subsistemas:
//  1. Variáveis de ambiente
//  2. Configurações do banco
//  3. Feature flags
//  4. Idioma padrão
//  5. Providers de IA
//  Fallback gracioso em cada etapa.
// ============================================================

import { logger } from "../../lib/logger";
import { loadEnvironment } from "./environmentLoader";
import { loadSystemConfig } from "./configLoader";
import { loadFlagsFromDb, getEnabledFlagIds } from "./featureFlagLoader";
import { setDefaultLanguage } from "../i18n/languageManager";

// ─── Tipos ────────────────────────────────────────────────────

export interface BootstrapResult {
  success:          boolean;
  durationMs:       number;
  steps:            BootstrapStep[];
  environment:      string;
  algorithmVersion: string;
  enabledFlags:     string[];
  language:         string;
  warnings:         string[];
}

export interface BootstrapStep {
  name:     string;
  status:   "ok" | "warn" | "error" | "skipped";
  durationMs: number;
  message?:   string;
}

// ─── Estado Global ────────────────────────────────────────────

let bootstrapResult: BootstrapResult | null = null;
let isBootstrapped = false;

// ─── Bootstrap ───────────────────────────────────────────────

/**
 * Inicializa todos os subsistemas da plataforma.
 * Idempotente: pode ser chamado múltiplas vezes sem efeito.
 */
export async function bootstrap(force: boolean = false): Promise<BootstrapResult> {
  if (isBootstrapped && !force && bootstrapResult) {
    return bootstrapResult;
  }

  const startMs = Date.now();
  const steps: BootstrapStep[] = [];
  const warnings: string[] = [];

  logger.info("[Bootstrap] Iniciando bootstrap da plataforma Loto-Shark v3...");

  // ── Step 1: Environment ──────────────────────────────────────
  const step1Start = Date.now();
  try {
    const env = loadEnvironment(true);
    warnings.push(...env.warnings);
    steps.push({
      name: "environment",
      status: env.warnings.length > 0 ? "warn" : "ok",
      durationMs: Date.now() - step1Start,
      message: `Node.js env=${env.nodeEnv}, port=${env.port}, db=${env.isDatabaseReady ? "ok" : "missing"}`,
    });
  } catch (err: any) {
    steps.push({ name: "environment", status: "error", durationMs: Date.now() - step1Start, message: err.message });
    warnings.push(`Environment loader falhou: ${err.message}`);
  }

  // ── Step 2: System Config ──────────────────────────────────
  const step2Start = Date.now();
  try {
    const config = await loadSystemConfig();
    steps.push({
      name: "system_config",
      status: "ok",
      durationMs: Date.now() - step2Start,
      message: `v${config.algorithmVersion}, pipeline=${config.pipelineVersion}`,
    });
  } catch (err: any) {
    steps.push({ name: "system_config", status: "warn", durationMs: Date.now() - step2Start, message: `Usando defaults: ${err.message}` });
    warnings.push(`Config loader usou defaults: ${err.message}`);
  }

  // ── Step 3: Feature Flags ────────────────────────────────────
  const step3Start = Date.now();
  try {
    await loadFlagsFromDb();
    const enabled = getEnabledFlagIds();
    steps.push({
      name: "feature_flags",
      status: "ok",
      durationMs: Date.now() - step3Start,
      message: `${enabled.length} flags habilitadas`,
    });
  } catch (err: any) {
    steps.push({ name: "feature_flags", status: "warn", durationMs: Date.now() - step3Start, message: `Usando defaults: ${err.message}` });
  }

  // ── Step 4: Language ─────────────────────────────────────────
  const step4Start = Date.now();
  try {
    const env = loadEnvironment();
    setDefaultLanguage(env.defaultLanguage || "pt-BR");
    steps.push({
      name: "language",
      status: "ok",
      durationMs: Date.now() - step4Start,
      message: `Idioma: ${env.defaultLanguage || "pt-BR"}`,
    });
  } catch (err: any) {
    steps.push({ name: "language", status: "warn", durationMs: Date.now() - step4Start, message: err.message });
  }

  // ── Step 5: AI Providers ─────────────────────────────────────
  const step5Start = Date.now();
  try {
    const { initDefaultProviders, listProviders } = await import("../../lib/aiProviders");
    await initDefaultProviders();
    const { stats } = listProviders();
    steps.push({
      name: "ai_providers",
      status: stats.active > 0 ? "ok" : "warn",
      durationMs: Date.now() - step5Start,
      message: `${stats.active} providers ativos de ${stats.total} configurados`,
    });
    if (stats.active === 0) {
      warnings.push("Nenhum provider de IA ativo — funcionalidades de IA serão degradadas");
    }
  } catch (err: any) {
    steps.push({ name: "ai_providers", status: "warn", durationMs: Date.now() - step5Start, message: err.message });
    warnings.push(`AI providers: ${err.message}`);
  }

  // ── Step 6: Cache Warm-up (background, não-bloqueante) ────────
  // Dispara pre-fetch para todas as loterias em segundo plano
  // para garantir que haverá dados disponíveis mesmo com API offline
  setImmediate(async () => {
    try {
      const { LOTTERIES, fetchHistoricalDraws, getHistoryConfig } = await import("../../lib/lotteryData");
      const targets = ["megasena", "lotofacil", "quina", "lotomania", "duplasena",
                       "timemania", "diadesorte", "supersete", "maisMilionaria"];
      for (const id of targets) {
        try {
          const { optimal } = getHistoryConfig(id);
          await fetchHistoricalDraws(id, optimal);
        } catch { /* silêncio */ }
        // pequena pausa para não sobrecarregar
        await new Promise(r => setTimeout(r, 300));
      }
      logger.info({ lotteries: targets.length }, "[Bootstrap] Cache warm-up concluído");
    } catch (err: any) {
      logger.warn({ err: err.message }, "[Bootstrap] Cache warm-up falhou (não crítico)");
    }
  });

  // ── Resultado ────────────────────────────────────────────────
  const { getSystemConfig } = await import("./configLoader");
  const config = getSystemConfig();

  bootstrapResult = {
    success:          steps.every(s => s.status !== "error"),
    durationMs:       Date.now() - startMs,
    steps,
    environment:      process.env.NODE_ENV || "development",
    algorithmVersion: config.algorithmVersion,
    enabledFlags:     getEnabledFlagIds(),
    language:         config.defaultLanguage,
    warnings,
  };

  isBootstrapped = true;

  const failedSteps = steps.filter(s => s.status === "error");
  if (failedSteps.length > 0) {
    logger.error({ failedSteps }, "[Bootstrap] Bootstrap concluído com erros");
  } else {
    logger.info(
      {
        durationMs: bootstrapResult.durationMs,
        steps: steps.map(s => `${s.name}:${s.status}`).join(" | "),
        enabledFeatures: bootstrapResult.enabledFlags.length,
        warnings: warnings.length,
      },
      "[Bootstrap] Plataforma Loto-Shark v3 pronta",
    );
  }

  return bootstrapResult;
}

/**
 * Retorna o resultado do último bootstrap (ou null se ainda não ocorreu).
 */
export function getBootstrapResult(): BootstrapResult | null {
  return bootstrapResult;
}

/**
 * Verifica se o sistema foi inicializado.
 */
export function isSystemReady(): boolean {
  return isBootstrapped && (bootstrapResult?.success ?? false);
}
