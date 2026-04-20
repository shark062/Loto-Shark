import { randomUUID } from "crypto";
import { logger } from "./logger";
import { db } from "@workspace/db";
import { aiProvidersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProviderConfig {
  id: string;
  type: string;
  name: string;
  apiKey: string;
  model: string;
  baseUrl: string;
  enabled: boolean;
  priority: number;
  successRate: number;
  totalCalls: number;
  successCalls: number;
  avgLatencyMs: number;
  lastUsed: string | null;
  lastError: string | null;
}

export interface EvolutionLogEntry {
  providerName: string;
  action: "success" | "error" | "added" | "removed" | "updated";
  latencyMs?: number;
  details?: string;
  timestamp: string;
}

// ─── In-memory cache (source of truth = Neon DB) ──────────────────────────────

export const providers = new Map<string, ProviderConfig>();
export const evolutionLog: EvolutionLogEntry[] = [];

// ─── Default base URLs per provider type ─────────────────────────────────────

const DEFAULT_URLS: Record<string, string> = {
  openai:     "https://api.openai.com/v1",
  anthropic:  "https://api.anthropic.com/v1",
  gemini:     "https://generativelanguage.googleapis.com/v1beta/openai",
  deepseek:   "https://api.deepseek.com/v1",
  groq:       "https://api.groq.com/openai/v1",
  mistral:    "https://api.mistral.ai/v1",
  cohere:     "https://api.cohere.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  together:   "https://api.together.xyz/v1",
};

const DEFAULT_MODELS: Record<string, string> = {
  openai:     "gpt-4o-mini",
  anthropic:  "claude-3-5-haiku-20241022",
  gemini:     "gemini-2.0-flash",
  deepseek:   "deepseek-chat",
  groq:       "llama-3.3-70b-versatile",
  mistral:    "mistral-small-latest",
  cohere:     "command-r",
  openrouter: "meta-llama/llama-3.1-8b-instruct:free",
  together:   "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
};

// ─── Mascaramento de chave (nunca expõe a chave completa ao cliente) ──────────

function maskApiKey(key: string): string {
  if (!key) return "****";
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}${"*".repeat(Math.min(8, key.length - 6))}${key.slice(-2)}`;
}

// ─── DB row → ProviderConfig ──────────────────────────────────────────────────

function rowToConfig(row: any): ProviderConfig {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    apiKey: row.apiKey,
    model: row.model,
    baseUrl: row.baseUrl,
    enabled: row.enabled,
    priority: row.priority,
    successRate: parseFloat(row.successRate ?? "0.7"),
    totalCalls: row.totalCalls ?? 0,
    successCalls: row.successCalls ?? 0,
    avgLatencyMs: parseFloat(row.avgLatencyMs ?? "0"),
    lastUsed: row.lastUsed ?? null,
    lastError: row.lastError ?? null,
  };
}

// ─── Load all providers from DB into memory ───────────────────────────────────

export async function loadProvidersFromDB(): Promise<void> {
  try {
    const rows = await db.select().from(aiProvidersTable);
    providers.clear();
    for (const row of rows) {
      providers.set(row.id, rowToConfig(row));
    }
    logger.info({ count: rows.length }, "Providers carregados do banco de dados");
  } catch (err: any) {
    logger.error({ err: err.message }, "Falha ao carregar providers do banco");
  }
}

// ─── Persist a provider to DB ─────────────────────────────────────────────────

async function persistProvider(p: ProviderConfig): Promise<void> {
  try {
    await db.insert(aiProvidersTable).values({
      id: p.id,
      type: p.type,
      name: p.name,
      apiKey: p.apiKey,
      model: p.model,
      baseUrl: p.baseUrl,
      enabled: p.enabled,
      priority: p.priority,
      successRate: String(p.successRate),
      totalCalls: p.totalCalls,
      successCalls: p.successCalls,
      avgLatencyMs: String(p.avgLatencyMs),
      lastUsed: p.lastUsed ?? undefined,
      lastError: p.lastError ?? undefined,
    }).onConflictDoUpdate({
      target: aiProvidersTable.id,
      set: {
        type: p.type,
        name: p.name,
        apiKey: p.apiKey,
        model: p.model,
        baseUrl: p.baseUrl,
        enabled: p.enabled,
        priority: p.priority,
        successRate: String(p.successRate),
        totalCalls: p.totalCalls,
        successCalls: p.successCalls,
        avgLatencyMs: String(p.avgLatencyMs),
        lastUsed: p.lastUsed ?? undefined,
        lastError: p.lastError ?? undefined,
        updatedAt: new Date(),
      },
    });
  } catch (err: any) {
    logger.warn({ err: err.message, id: p.id }, "Falha ao persistir provider no banco");
  }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export function listProviders(): {
  providers: (Omit<ProviderConfig, "apiKey"> & { apiKey: string })[];
  stats: { total: number; active: number; avgSuccessRate: number };
} {
  const list = [...providers.values()];
  const active = list.filter(p => p.enabled).length;
  const avgSuccessRate = list.length > 0
    ? list.reduce((s, p) => s + p.successRate, 0) / list.length
    : 0;
  const masked = list.map(p => ({ ...p, apiKey: maskApiKey(p.apiKey) }));
  return { providers: masked, stats: { total: list.length, active, avgSuccessRate } };
}

export async function addProvider(input: {
  type: string;
  name: string;
  apiKey: string;
  model?: string;
  baseUrl?: string;
}): Promise<ProviderConfig> {
  const id = randomUUID();
  const provider: ProviderConfig = {
    id,
    type: input.type,
    name: input.name,
    apiKey: input.apiKey,
    model: input.model || DEFAULT_MODELS[input.type] || "gpt-4o-mini",
    baseUrl: input.baseUrl || DEFAULT_URLS[input.type] || "https://api.openai.com/v1",
    enabled: true,
    priority: providers.size,
    successRate: 0.7,
    totalCalls: 0,
    successCalls: 0,
    avgLatencyMs: 0,
    lastUsed: null,
    lastError: null,
  };
  providers.set(id, provider);
  evolutionLog.unshift({ providerName: provider.name, action: "added", timestamp: new Date().toISOString() });
  logger.info({ id, type: provider.type, name: provider.name }, "Provider adicionado");
  await persistProvider(provider);
  return provider;
}

export async function updateProvider(id: string, updates: Partial<ProviderConfig>): Promise<ProviderConfig | null> {
  const provider = providers.get(id);
  if (!provider) return null;
  const immutable = ["id", "totalCalls", "successCalls", "successRate"];
  for (const [key, value] of Object.entries(updates)) {
    if (!immutable.includes(key)) {
      (provider as any)[key] = value;
    }
  }
  evolutionLog.unshift({ providerName: provider.name, action: "updated", timestamp: new Date().toISOString() });
  await persistProvider(provider);
  return provider;
}

export async function deleteProvider(id: string): Promise<boolean> {
  const provider = providers.get(id);
  if (!provider) return false;
  providers.delete(id);
  evolutionLog.unshift({ providerName: provider.name, action: "removed", timestamp: new Date().toISOString() });
  try {
    await db.delete(aiProvidersTable).where(eq(aiProvidersTable.id, id));
  } catch (err: any) {
    logger.warn({ err: err.message }, "Falha ao remover provider do banco");
  }
  return true;
}

export function getEvolutionLog(limit = 50): EvolutionLogEntry[] {
  return evolutionLog.slice(0, limit);
}

// ─── Test a provider with a simple prompt ─────────────────────────────────────

export async function testProvider(id: string): Promise<{
  success: boolean;
  latencyMs: number;
  message: string;
}> {
  const provider = providers.get(id);
  if (!provider) return { success: false, latencyMs: 0, message: "Provider não encontrado" };

  const start = Date.now();
  try {
    let response: Response;
    const prompt = "Responda apenas: OK";

    if (provider.type === "anthropic") {
      response = await fetch(`${provider.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "x-api-key": provider.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: provider.model,
          max_tokens: 10,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: AbortSignal.timeout(15000),
      });
    } else {
      response = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: provider.model,
          max_tokens: 10,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: AbortSignal.timeout(15000),
      });
    }

    const latencyMs = Date.now() - start;
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      provider.lastError = `HTTP ${response.status}`;
      evolutionLog.unshift({ providerName: provider.name, action: "error", latencyMs, details: `test: HTTP ${response.status}`, timestamp: new Date().toISOString() });
      return { success: false, latencyMs, message: `HTTP ${response.status}: ${text.slice(0, 100)}` };
    }

    provider.lastUsed = new Date().toISOString();
    evolutionLog.unshift({ providerName: provider.name, action: "success", latencyMs, details: "test", timestamp: new Date().toISOString() });
    persistProvider(provider).catch(() => {});
    return { success: true, latencyMs, message: "Provider funcionando corretamente" };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    provider.lastError = err.message;
    evolutionLog.unshift({ providerName: provider.name, action: "error", latencyMs, details: `test: ${err.message?.slice(0, 60)}`, timestamp: new Date().toISOString() });
    return { success: false, latencyMs, message: err.message };
  }
}

// ─── Call the best available provider ────────────────────────────────────────

export async function callBestProvider(prompt: string, systemPrompt?: string): Promise<string> {
  const sorted = [...providers.values()]
    .filter(p => p.enabled)
    .sort((a, b) => a.priority - b.priority);

  if (sorted.length === 0) throw new Error("Nenhum provider configurado");

  for (const provider of sorted) {
    try {
      let response: Response;
      const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

      if (provider.type === "anthropic") {
        response = await fetch(`${provider.baseUrl}/messages`, {
          method: "POST",
          headers: {
            "x-api-key": provider.apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: provider.model,
            max_tokens: 1500,
            messages: [{ role: "user", content: prompt }],
            system: systemPrompt,
          }),
          signal: AbortSignal.timeout(25000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const text = data.content?.[0]?.text || "";
        if (text) {
          provider.totalCalls++;
          provider.successCalls++;
          provider.successRate = provider.successCalls / provider.totalCalls;
          provider.lastUsed = new Date().toISOString();
          persistProvider(provider).catch(() => {});
          return text;
        }
      } else {
        response = await fetch(`${provider.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${provider.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: provider.model,
            max_tokens: 1500,
            temperature: 0.7,
            messages: [{ role: "user", content: fullPrompt }],
          }),
          signal: AbortSignal.timeout(25000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || "";
        if (text) {
          provider.totalCalls++;
          provider.successCalls++;
          provider.successRate = provider.successCalls / provider.totalCalls;
          provider.lastUsed = new Date().toISOString();
          persistProvider(provider).catch(() => {});
          return text;
        }
      }
    } catch (err: any) {
      provider.totalCalls++;
      provider.successRate = provider.successCalls / Math.max(provider.totalCalls, 1);
      provider.lastError = err.message;
      logger.warn({ provider: provider.name, err: err.message }, "callBestProvider: tentando próximo");
    }
  }

  throw new Error("Todos os providers falharam");
}

// ─── Recalculate priorities based on performance ──────────────────────────────

export function recalcPriorities(): void {
  const sorted = [...providers.values()]
    .sort((a, b) => b.successRate - a.successRate);
  sorted.forEach((p, i) => { p.priority = i; });
}

// ─── Initialize providers: load from DB, seed from env if empty ───────────────

export async function initDefaultProviders(): Promise<void> {
  await loadProvidersFromDB();

  const envProviders: Array<{ type: string; name: string; envKey: string; model?: string }> = [
    { type: "openai",     name: "OpenAI",     envKey: "OPENAI_API_KEY" },
    { type: "anthropic",  name: "Anthropic",  envKey: "ANTHROPIC_API_KEY" },
    { type: "gemini",     name: "Gemini",     envKey: "GOOGLE_API_KEY" },
    { type: "groq",       name: "Groq",       envKey: "GROQ_API_KEY" },
    { type: "deepseek",   name: "DeepSeek",   envKey: "DEEPSEEK_API_KEY" },
    { type: "openrouter", name: "OpenRouter", envKey: "OPENROUTER_API_KEY" },
    { type: "mistral",    name: "Mistral",    envKey: "MISTRAL_API_KEY" },
    { type: "cohere",     name: "Cohere",     envKey: "COHERE_API_KEY" },
  ];

  // Sempre sincroniza chaves do ambiente com o banco — garante que mudanças de secrets
  // sejam aplicadas mesmo quando já existem providers no banco.
  let updated = 0;
  let added = 0;

  for (const ep of envProviders) {
    const envKey = process.env[ep.envKey];
    if (!envKey) continue;

    // Verifica se já existe um provider deste tipo
    const existing = [...providers.values()].find(p => p.type === ep.type);
    if (existing) {
      // Atualiza a chave se for diferente
      if (existing.apiKey !== envKey) {
        await updateProvider(existing.id, { apiKey: envKey, enabled: true });
        logger.info({ type: ep.type }, "Chave de API atualizada da variável de ambiente");
        updated++;
      }
    } else {
      // Cria novo provider
      await addProvider({ type: ep.type, name: ep.name, apiKey: envKey, model: ep.model });
      added++;
    }
  }

  const total = providers.size;
  if (total === 0) {
    logger.warn("Nenhuma chave de API encontrada. Configure providers via /api/ai-providers");
  } else {
    logger.info({ total, updated, added }, "Providers sincronizados com variáveis de ambiente");
  }
}
