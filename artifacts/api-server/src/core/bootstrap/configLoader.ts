// ============================================================
//  Config Loader — Carrega configurações do banco de dados
//  Lê a tabela system_config e popula o estado da aplicação.
//  Fallback gracioso se o banco não estiver disponível.
// ============================================================

import { logger } from "../../lib/logger";

// ─── Tipos ────────────────────────────────────────────────────

export interface SystemConfig {
  /** Versão do algoritmo atual */
  algorithmVersion:   string;
  /** Versão do pipeline */
  pipelineVersion:    string;
  /** Máximo de jogos por geração */
  maxGamesPerRequest: number;
  /** Máximo de candidatos gerados internamente */
  maxCandidates:      number;
  /** TTL do cache de estatísticas (ms) */
  statsCacheTtlMs:    number;
  /** TTL do cache de sorteios (ms) */
  drawsCacheTtlMs:    number;
  /** Habilitar modo debug */
  debugMode:          boolean;
  /** Versão da configuração carregada */
  configVersion:      number;
  /** Idioma padrão */
  defaultLanguage:    string;
  /** Pesos globais do pipeline */
  globalWeights:      Record<string, number>;
  /** Metadata extra */
  metadata:           Record<string, any>;
  /** Quando foi carregado */
  loadedAt:           string;
}

// ─── Configuração Padrão ──────────────────────────────────────

const DEFAULT_CONFIG: SystemConfig = {
  algorithmVersion:   "3.0.0",
  pipelineVersion:    "v3",
  maxGamesPerRequest: 50,
  maxCandidates:      150,
  statsCacheTtlMs:    10 * 60 * 1000,   // 10 min
  drawsCacheTtlMs:    4 * 60 * 60 * 1000, // 4h
  debugMode:          false,
  configVersion:      1,
  defaultLanguage:    "pt-BR",
  globalWeights: {
    hyperScore:    0.25,
    precision:     0.20,
    distribution:  0.15,
    risk:          0.15,
    cycle:         0.10,
    entropy:       0.08,
    correlation:   0.07,
  },
  metadata: {},
  loadedAt: new Date().toISOString(),
};

// ─── Estado ───────────────────────────────────────────────────

let activeConfig: SystemConfig = { ...DEFAULT_CONFIG };
let configLoadedFromDb = false;

// ─── Loader ───────────────────────────────────────────────────

/**
 * Carrega configurações do banco de dados.
 * Se falhar, usa configuração padrão silenciosamente.
 */
export async function loadSystemConfig(): Promise<SystemConfig> {
  try {
    const { db } = await import("@workspace/db");
    const { sql } = await import("drizzle-orm");

    // Tenta ler da tabela system_config
    const rows = await db.execute(
      sql`SELECT key, value FROM system_config WHERE active = true ORDER BY updated_at DESC`
    ).catch(() => ({ rows: [] }));

    if (!rows.rows || rows.rows.length === 0) {
      logger.info("[ConfigLoader] Nenhuma configuração no banco — usando defaults");
      activeConfig = { ...DEFAULT_CONFIG, loadedAt: new Date().toISOString() };
      return activeConfig;
    }

    const merged: Record<string, any> = { ...DEFAULT_CONFIG };
    for (const row of rows.rows as any[]) {
      try {
        merged[row.key] = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
      } catch {
        merged[row.key] = row.value;
      }
    }

    activeConfig = { ...merged, loadedAt: new Date().toISOString() } as SystemConfig;
    configLoadedFromDb = true;

    logger.info(
      { configVersion: activeConfig.configVersion, algorithmVersion: activeConfig.algorithmVersion },
      "[ConfigLoader] Configuração carregada do banco",
    );

  } catch (err: any) {
    logger.warn(
      { err: err.message },
      "[ConfigLoader] Falha ao carregar configuração — usando defaults",
    );
    activeConfig = { ...DEFAULT_CONFIG, loadedAt: new Date().toISOString() };
  }

  return activeConfig;
}

/**
 * Retorna a configuração ativa (sem aguardar banco).
 */
export function getSystemConfig(): SystemConfig {
  return activeConfig;
}

/**
 * Atualiza um valor de configuração em tempo de execução.
 */
export function setConfigValue<K extends keyof SystemConfig>(
  key: K,
  value: SystemConfig[K],
): void {
  (activeConfig as any)[key] = value;
  logger.debug({ key, value }, "[ConfigLoader] Configuração atualizada em runtime");
}

/**
 * Indica se a configuração foi carregada do banco.
 */
export function isConfigFromDatabase(): boolean {
  return configLoadedFromDb;
}
