import { logger } from "./logger";

export type AIProviderType =
  | "openai" | "anthropic" | "gemini" | "deepseek"
  | "groq" | "mistral" | "cohere" | "together" | "openrouter" | "custom";

export interface ProviderConfig {
  id: string;
  type: AIProviderType;
  name: string;
  apiKey: string;
  model: string;
  baseUrl?: string;
  enabled: boolean;
  priority: number;
  totalCalls: number;
  successCalls: number;
  successRate: number;
  avgLatencyMs: number;
  lastUsed?: string;
  lastError?: string;
}

export interface EvolutionEntry {
  timestamp: string;
  providerName: string;
  action: string;
  latencyMs?: number;
  details?: string;
}

export const BASE_URLS: Record<AIProviderType, string> = {
  openai:      "https://api.openai.com/v1",
  anthropic:   "https://api.anthropic.com/v1",
  gemini:      "https://generativelanguage.googleapis.com/v1beta/openai",
  deepseek:    "https://api.deepseek.com/v1",
  groq:        "https://api.groq.com/openai/v1",
  mistral:     "https://api.mistral.ai/v1",
  cohere:      "https://api.cohere.ai/compatibility/v1",
  together:    "https://api.together.xyz/v1",
  openrouter:  "https://openrouter.ai/api/v1",
  custom:      "",
};

const DEFAULT_MODELS: Record<AIProviderType, string> = {
  openai:      "gpt-4o-mini",
  anthropic:   "claude-3-haiku-20240307",
  gemini:      "gemini-2.0-flash",
  deepseek:    "deepseek-chat",
  groq:        "llama-3.3-70b-versatile",
  mistral:     "mistral-small-latest",
  cohere:      "command-r",
  together:    "meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo",
  openrouter:  "openai/gpt-4o-mini",
  custom:      "gpt-3.5-turbo",
};

// Exported so aiEnsemble.ts can access and mutate directly
export const providers: Map<string, ProviderConfig> = new Map();
export const evolutionLog: EvolutionEntry[] = [];

function maskKey(key: string): string {
  if (!key || key.length < 8) return "****";
  return key.slice(0, 6) + "****" + key.slice(-4);
}

export function addEvolution(entry: Omit<EvolutionEntry, "timestamp">) {
  evolutionLog.unshift({ ...entry, timestamp: new Date().toISOString() });
  if (evolutionLog.length > 300) evolutionLog.splice(300);
}

export function recalcPriorities() {
  const sorted = [...providers.values()]
    .filter(p => p.enabled)
    .sort((a, b) => {
      const scoreA = a.successRate * 0.6 - (a.avgLatencyMs / 10000) * 0.4;
      const scoreB = b.successRate * 0.6 - (b.avgLatencyMs / 10000) * 0.4;
      return scoreB - scoreA;
    });
  sorted.forEach((p, i) => {
    const prov = providers.get(p.id)!;
    if (prov.priority !== i + 1) {
      if (i === 0 && prov.priority !== 1) {
        addEvolution({ providerName: prov.name, action: "promoted", details: "Melhor provider" });
      }
      prov.priority = i + 1;
    }
  });
}

export function initDefaultProviders() {
  const envProviders: { type: AIProviderType; envKey: string; name: string }[] = [
    { type: "openai",     envKey: "OPENAI_API_KEY",     name: "OpenAI GPT" },
    { type: "anthropic",  envKey: "ANTHROPIC_API_KEY",  name: "Anthropic Claude" },
    { type: "gemini",     envKey: "GEMINI_API_KEY",     name: "Google Gemini" },
    { type: "deepseek",   envKey: "DEEPSEEK_API_KEY",   name: "DeepSeek" },
    { type: "groq",       envKey: "GROQ_API_KEY",       name: "Groq LLaMA" },
    { type: "openrouter", envKey: "OPENROUTER_API_KEY", name: "OpenRouter" },
  ];

  for (const { type, envKey, name } of envProviders) {
    const key = process.env[envKey];
    if (key) {
      const id = `env-${type}`;
      if (!providers.has(id)) {
        providers.set(id, {
          id,
          type,
          name,
          apiKey: key,
          model: DEFAULT_MODELS[type],
          baseUrl: BASE_URLS[type],
          enabled: true,
          priority: providers.size + 1,
          totalCalls: 0,
          successCalls: 0,
          successRate: 1.0,
          avgLatencyMs: 500,
        });
        logger.info({ type, name }, "Provider de IA carregado");
        addEvolution({ providerName: name, action: "success", details: "Carregado do ambiente" });
      }
    }
  }
  recalcPriorities();
}

export function listProviders() {
  const list = [...providers.values()]
    .sort((a, b) => a.priority - b.priority)
    .map(p => ({ ...p, apiKey: maskKey(p.apiKey) }));

  const best = list.find(p => p.enabled)?.name || "-";
  return {
    providers: list,
    stats: {
      total: list.length,
      active: list.filter(p => p.enabled).length,
      best,
      totalCalls: list.reduce((s, p) => s + p.totalCalls, 0),
    },
  };
}

export function addProvider(data: {
  type: AIProviderType;
  name: string;
  apiKey: string;
  model: string;
  baseUrl?: string;
}): ProviderConfig {
  const id = `custom-${Date.now()}`;
  const provider: ProviderConfig = {
    id,
    type: data.type,
    name: data.name,
    apiKey: data.apiKey,
    model: data.model || DEFAULT_MODELS[data.type],
    baseUrl: data.baseUrl || BASE_URLS[data.type],
    enabled: true,
    priority: providers.size + 1,
    totalCalls: 0,
    successCalls: 0,
    successRate: 1.0,
    avgLatencyMs: 500,
  };
  providers.set(id, provider);
  recalcPriorities();
  addEvolution({ providerName: provider.name, action: "success", details: "Provider adicionado" });
  return { ...provider, apiKey: maskKey(provider.apiKey) };
}

export function updateProvider(id: string, updates: Partial<ProviderConfig>): ProviderConfig | null {
  const p = providers.get(id);
  if (!p) return null;
  Object.assign(p, updates);
  recalcPriorities();
  return { ...p, apiKey: maskKey(p.apiKey) };
}

export function deleteProvider(id: string): boolean {
  const p = providers.get(id);
  if (!p) return false;
  providers.delete(id);
  recalcPriorities();
  return true;
}

export async function testProvider(id: string): Promise<{ success: boolean; latencyMs: number; error?: string }> {
  const p = providers.get(id);
  if (!p) return { success: false, latencyMs: 0, error: "Provider não encontrado" };

  const baseUrl = p.baseUrl || BASE_URLS[p.type];
  const start = Date.now();

  try {
    addEvolution({ providerName: p.name, action: "call", details: "Teste de conexão" });

    let response: Response;
    if (p.type === "anthropic") {
      response = await fetch(`${baseUrl}/messages`, {
        method: "POST",
        headers: { "x-api-key": p.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: p.model, max_tokens: 10, messages: [{ role: "user", content: "Olá" }] }),
        signal: AbortSignal.timeout(10000),
      });
    } else {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${p.apiKey}`,
          "Content-Type": "application/json",
          ...(p.type === "openrouter" ? { "HTTP-Referer": "https://lotoshark.app" } : {}),
        },
        body: JSON.stringify({ model: p.model, max_tokens: 10, messages: [{ role: "user", content: "Olá" }] }),
        signal: AbortSignal.timeout(10000),
      });
    }

    const latencyMs = Date.now() - start;
    p.totalCalls++;

    if (response.ok || response.status === 400) {
      p.successCalls++;
      p.avgLatencyMs = Math.round(p.avgLatencyMs * 0.8 + latencyMs * 0.2);
      p.successRate = p.successCalls / p.totalCalls;
      p.lastUsed = new Date().toISOString();
      p.lastError = undefined;
      recalcPriorities();
      addEvolution({ providerName: p.name, action: "success", latencyMs, details: `HTTP ${response.status}` });
      return { success: true, latencyMs };
    } else {
      const body = await response.text().catch(() => "");
      p.successRate = p.successCalls / p.totalCalls;
      p.lastError = `HTTP ${response.status}`;
      addEvolution({ providerName: p.name, action: "error", latencyMs, details: `HTTP ${response.status}: ${body.slice(0, 80)}` });
      return { success: false, latencyMs, error: `HTTP ${response.status}: ${body.slice(0, 200)}` };
    }
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    p.totalCalls++;
    p.successRate = p.successCalls / p.totalCalls;
    p.lastError = err.message;
    addEvolution({ providerName: p.name, action: "error", latencyMs, details: err.message });
    return { success: false, latencyMs, error: err.message };
  }
}

export async function callBestProvider(prompt: string, systemPrompt?: string): Promise<string> {
  const { callWithFallback } = await import("./aiEnsemble");
  const { text } = await callWithFallback(prompt, systemPrompt || "Você é um especialista em loterias brasileiras.");
  return text;
}

export function getEvolutionLog(limit = 50): EvolutionEntry[] {
  return evolutionLog.slice(0, limit);
}
