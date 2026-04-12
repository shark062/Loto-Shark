import { logger } from "./logger";
import { providers, evolutionLog, recalcPriorities } from "./aiProviders";
import type { ProviderConfig } from "./aiProviders";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProviderRole =
  | "frequency_analyst"
  | "statistical_predictor"
  | "mathematical_analyzer"
  | "pattern_recognizer"
  | "strategy_advisor"
  | "ensemble_judge";

export interface DrawData {
  contestNumber: number;
  numbers: number[];
}

export interface LotteryContext {
  lotteryId: string;
  lotteryName: string;
  totalNumbers: number;
  minNumbers: number;
  draws: DrawData[];
  hotNumbers: number[];
  coldNumbers: number[];
  warmNumbers: number[];
  frequencyMap: Record<number, number>;
  avgSum: number;
  avgEvens: number;
}

export interface ProviderResult {
  providerId: string;
  providerName: string;
  role: ProviderRole;
  suggestedNumbers: number[];
  confidence: number;
  reasoning: string;
  latencyMs: number;
  success: boolean;
  error?: string;
  extras?: Record<string, any>;
}

export interface EnsembleResult {
  consensusNumbers: number[];
  alternativeGames: Array<{ numbers: number[]; source: string; confidence: number }>;
  providerResults: ProviderResult[];
  consensusScore: Record<number, number>;
  overallConfidence: number;
  reasoning: string;
  successfulProviders: number;
  totalProviders: number;
  latencyMs: number;
}

// ─── System prompts per role ──────────────────────────────────────────────────

const ROLE_PROMPTS: Record<ProviderRole, (ctx: LotteryContext) => string> = {
  frequency_analyst: (ctx) => `Você é um ANALISTA DE FREQUÊNCIA especializado em loterias brasileiras.
Analise os dados de frequência dos últimos ${ctx.draws.length} sorteios da ${ctx.lotteryName}.

DADOS DE FREQUÊNCIA:
- Números QUENTES (mais frequentes): ${ctx.hotNumbers.join(", ")}
- Números MORNOS: ${ctx.warmNumbers.join(", ")}
- Números FRIOS (menos frequentes): ${ctx.coldNumbers.join(", ")}
- Mapa completo: ${JSON.stringify(ctx.frequencyMap)}

Últimos 5 sorteios: ${ctx.draws.slice(0, 5).map(d => `[${d.numbers.join(",")}]`).join(", ")}

Sua tarefa: identifique os ${ctx.minNumbers} números com maior potencial baseado em frequência histórica.
Use a teoria de "retorno à média" — números frios tendem a aparecer, quentes tendem a pausar.

Responda APENAS JSON válido sem markdown:
{
  "suggestedNumbers": [lista de ${ctx.minNumbers} números de 1 a ${ctx.totalNumbers}],
  "confidence": 0.XX,
  "reasoning": "explicação curta",
  "hotBalance": "percentual de quentes escolhidos",
  "coldBalance": "percentual de frios escolhidos"
}`,

  statistical_predictor: (ctx) => `Você é um PREDITOR ESTATÍSTICO de loterias brasileiras.
Use probabilidade Bayesiana e análise de frequência para prever os próximos números da ${ctx.lotteryName}.

DADOS ESTATÍSTICOS:
- Total de números possíveis: 1 a ${ctx.totalNumbers}
- Números a escolher: ${ctx.minNumbers}
- Sorteios analisados: ${ctx.draws.length}
- Soma média dos sorteios: ${ctx.avgSum.toFixed(1)}
- Média de pares por sorteio: ${ctx.avgEvens.toFixed(1)}
- Quentes: ${ctx.hotNumbers.slice(0, 10).join(", ")}
- Frios: ${ctx.coldNumbers.slice(0, 10).join(", ")}

Histórico recente: ${ctx.draws.slice(0, 8).map(d => `Concurso ${d.contestNumber}: [${d.numbers.join(",")}]`).join(" | ")}

Calcule a previsão mais provável usando:
1. Frequência ponderada por recência (sorteios mais recentes têm peso maior)
2. Equilíbrio par/ímpar próximo da média histórica (${ctx.avgEvens.toFixed(0)} pares)
3. Soma total próxima da média histórica (${ctx.avgSum.toFixed(0)})
4. Evitar mais de 3 números consecutivos

Responda APENAS JSON válido:
{
  "suggestedNumbers": [lista de exatamente ${ctx.minNumbers} números distintos de 1 a ${ctx.totalNumbers}],
  "confidence": 0.XX,
  "reasoning": "raciocínio estatístico",
  "expectedSum": numero,
  "evenOddBalance": "X pares / Y ímpares"
}`,

  mathematical_analyzer: (ctx) => `Você é um ANALISADOR MATEMÁTICO de padrões em loterias brasileiras.
Foque em padrões matemáticos: somas, paridade, consecutividade, distribuição por dezenas.

${ctx.lotteryName} — últimos ${ctx.draws.length} sorteios:
${ctx.draws.slice(0, 10).map(d => {
  const sum = d.numbers.reduce((a, b) => a + b, 0);
  const evens = d.numbers.filter(n => n % 2 === 0).length;
  const consec = d.numbers.sort((a,b)=>a-b).reduce((c,n,i,arr) => i>0 && n===arr[i-1]+1 ? c+1 : c, 0);
  return `[${d.numbers.join(",")}] soma=${sum} pares=${evens} consec=${consec}`;
}).join("\n")}

Média de soma: ${ctx.avgSum.toFixed(1)}
Números possíveis: 1 a ${ctx.totalNumbers}, escolher ${ctx.minNumbers}

Analise:
1. Padrão de soma ideal para o próximo sorteio
2. Equilíbrio par/ímpar mais provável
3. Distribuição por faixas (baixo/médio/alto)
4. Números com padrão matemático favorável

Responda APENAS JSON válido:
{
  "suggestedNumbers": [lista de exatamente ${ctx.minNumbers} números distintos de 1 a ${ctx.totalNumbers}],
  "confidence": 0.XX,
  "reasoning": "padrões matemáticos identificados",
  "targetSum": numero,
  "distribution": "X baixos / Y médios / Z altos"
}`,

  pattern_recognizer: (ctx) => `Você é um RECONHECEDOR DE PADRÕES em sequências de loterias brasileiras.
Identifique padrões recorrentes, ciclos, e tendências nos dados da ${ctx.lotteryName}.

Sequência histórica completa (${ctx.draws.length} sorteios mais recentes):
${ctx.draws.map((d, i) => `#${i+1} [${d.numbers.sort((a,b)=>a-b).join(",")}]`).join("\n")}

Números que NUNCA apareceram nos últimos ${ctx.draws.length} sorteios: ${
  Array.from({length: ctx.totalNumbers}, (_, i) => i+1)
    .filter(n => !Object.keys(ctx.frequencyMap).some(k => parseInt(k) === n && ctx.frequencyMap[parseInt(k)] > 0))
    .join(", ") || "nenhum"
}

Analise padrões como:
1. Números que aparecem juntos frequentemente (co-ocorrência)
2. Ciclos de ausência e retorno
3. Números que saíram nos últimos 3 sorteios vs que não saíram há mais de 5
4. Padrões posicionais

Responda APENAS JSON válido:
{
  "suggestedNumbers": [lista de exatamente ${ctx.minNumbers} números distintos de 1 a ${ctx.totalNumbers}],
  "confidence": 0.XX,
  "reasoning": "padrões detectados",
  "keyPattern": "principal padrão identificado",
  "overduNumbers": [números mais atrasados]
}`,

  strategy_advisor: (ctx) => `Você é um CONSELHEIRO ESTRATÉGICO de loterias brasileiras.
Combine análise técnica com visão estratégica para recomendar os melhores números da ${ctx.lotteryName}.

CONTEXTO COMPLETO:
- Loteria: ${ctx.lotteryName} (escolher ${ctx.minNumbers} de ${ctx.totalNumbers})
- Análise de ${ctx.draws.length} sorteios históricos reais da Caixa Econômica Federal
- Quentes: ${ctx.hotNumbers.join(", ")}
- Frios: ${ctx.coldNumbers.join(", ")}
- Soma média histórica: ${ctx.avgSum.toFixed(1)}
- Paridade média: ${ctx.avgEvens.toFixed(1)} pares por sorteio

Histórico recente: ${ctx.draws.slice(0,5).map(d=>`[${d.numbers.join(",")}]`).join(", ")}

Como conselheiro estratégico:
1. Equilibre teoria da frequência com teoria da aleatoriedade
2. Considere viés de representação (distribuição uniforme pelo range)
3. Aplique estratégia de diversificação de risco
4. Recomende números com melhor relação risco/retorno estatístico

Responda APENAS JSON válido:
{
  "suggestedNumbers": [lista de exatamente ${ctx.minNumbers} números distintos de 1 a ${ctx.totalNumbers}],
  "confidence": 0.XX,
  "reasoning": "raciocínio estratégico completo",
  "strategy": "nome da estratégia",
  "riskLevel": "baixo|médio|alto"
}`,

  ensemble_judge: (ctx) => `Você é o JUIZ DO ENSEMBLE, responsável por construir o consenso final.
Você recebe as sugestões de múltiplas IAs especializadas e cria a melhor previsão possível.

LOTERIA: ${ctx.lotteryName} — escolher ${ctx.minNumbers} números de 1 a ${ctx.totalNumbers}

Dados estatísticos base:
- Quentes: ${ctx.hotNumbers.join(", ")}
- Frios: ${ctx.coldNumbers.join(", ")}
- Soma média: ${ctx.avgSum.toFixed(1)}

Combine as informações disponíveis para gerar a previsão de consenso final, priorizando:
1. Números sugeridos por múltiplas fontes
2. Equilíbrio matemático (soma, paridade)
3. Mix de quentes e frios

Responda APENAS JSON válido:
{
  "suggestedNumbers": [lista de exatamente ${ctx.minNumbers} números distintos de 1 a ${ctx.totalNumbers}],
  "confidence": 0.XX,
  "reasoning": "síntese do consenso"
}`,
};

// ─── Role assignment per provider type ───────────────────────────────────────

const PROVIDER_ROLES: Record<string, ProviderRole> = {
  groq:        "frequency_analyst",
  openai:      "statistical_predictor",
  deepseek:    "mathematical_analyzer",
  gemini:      "pattern_recognizer",
  anthropic:   "strategy_advisor",
  openrouter:  "ensemble_judge",
  mistral:     "statistical_predictor",
  cohere:      "pattern_recognizer",
  together:    "frequency_analyst",
  custom:      "frequency_analyst",
};

// ─── HTTP call per provider type ─────────────────────────────────────────────

async function callProvider(provider: ProviderConfig, prompt: string): Promise<{ text: string; latencyMs: number }> {
  const start = Date.now();
  let response: Response;

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
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text().catch(() => "")}`);
    const data = await response.json();
    return { text: data.content?.[0]?.text || "", latencyMs: Date.now() - start };
  }

  response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
      ...(provider.type === "openrouter" ? { "HTTP-Referer": "https://lotoshark.app", "X-Title": "LotoShark" } : {}),
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: 800,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text().catch(() => "")}`);
  const data = await response.json();
  return { text: data.choices?.[0]?.message?.content || "", latencyMs: Date.now() - start };
}

function parseNumbers(text: string, min: number, max: number, count: number): number[] {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const nums = parsed.suggestedNumbers || parsed.prediction || parsed.numbers || parsed.consensusNumbers;
      if (Array.isArray(nums)) {
        const valid = nums
          .map(Number)
          .filter(n => !isNaN(n) && n >= 1 && n <= max)
          .filter((n, i, arr) => arr.indexOf(n) === i);
        if (valid.length >= count) return valid.slice(0, count).sort((a, b) => a - b);
      }
    } catch {}
  }
  // Fallback: extract numbers from text
  const found = [...text.matchAll(/\b([0-9]{1,3})\b/g)]
    .map(m => parseInt(m[1]))
    .filter(n => n >= 1 && n <= max)
    .filter((n, i, arr) => arr.indexOf(n) === i);
  return found.slice(0, count).sort((a, b) => a - b);
}

function parseConfidence(text: string): number {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const c = parseFloat(parsed.confidence);
      if (!isNaN(c) && c >= 0 && c <= 1) return c;
    }
  } catch {}
  return 0.6;
}

function parseReasoning(text: string): string {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.reasoning || parsed.rationale || "";
    }
  } catch {}
  return text.slice(0, 300);
}

// ─── Core ensemble function ───────────────────────────────────────────────────

export async function runEnsemble(ctx: LotteryContext): Promise<EnsembleResult> {
  const ensembleStart = Date.now();
  const allProviders = [...providers.values()].filter(p => p.enabled);

  if (allProviders.length === 0) {
    throw new Error("Nenhum provider de IA configurado");
  }

  // Assign roles — each type gets its specialized role
  const assignments = allProviders.map(p => ({
    provider: p,
    role: PROVIDER_ROLES[p.type] || "frequency_analyst",
  }));

  // Run all providers in parallel
  const tasks = assignments.map(async ({ provider, role }): Promise<ProviderResult> => {
    const prompt = ROLE_PROMPTS[role](ctx);
    const start = Date.now();
    try {
      const { text, latencyMs } = await callProvider(provider, prompt);
      const suggestedNumbers = parseNumbers(text, 1, ctx.totalNumbers, ctx.minNumbers);
      const confidence = parseConfidence(text);
      const reasoning = parseReasoning(text);

      // Update provider stats
      provider.totalCalls++;
      if (suggestedNumbers.length >= ctx.minNumbers) {
        provider.successCalls++;
        provider.avgLatencyMs = Math.round(provider.avgLatencyMs * 0.8 + latencyMs * 0.2);
        provider.lastUsed = new Date().toISOString();
      }
      provider.successRate = provider.successCalls / Math.max(provider.totalCalls, 1);
      evolutionLog.unshift({ providerName: provider.name, action: "success", latencyMs, details: `role: ${role}`, timestamp: new Date().toISOString() });

      logger.info({ provider: provider.name, role, latencyMs, numbers: suggestedNumbers }, "Provider retornou resultado");

      return {
        providerId: provider.id,
        providerName: provider.name,
        role,
        suggestedNumbers,
        confidence,
        reasoning,
        latencyMs,
        success: suggestedNumbers.length >= ctx.minNumbers,
      };
    } catch (err: any) {
      provider.totalCalls++;
      provider.successRate = provider.successCalls / Math.max(provider.totalCalls, 1);
      provider.lastError = err.message;
      const latencyMs = Date.now() - start;
      evolutionLog.unshift({ providerName: provider.name, action: "error", latencyMs, details: err.message?.slice(0, 80), timestamp: new Date().toISOString() });
      logger.warn({ provider: provider.name, role, err: err.message }, "Provider falhou no ensemble");
      return {
        providerId: provider.id,
        providerName: provider.name,
        role,
        suggestedNumbers: [],
        confidence: 0,
        reasoning: "",
        latencyMs,
        success: false,
        error: err.message,
      };
    }
  });

  const results = await Promise.all(tasks);
  recalcPriorities();

  // ── Weighted consensus ──────────────────────────────────────────────────────
  const successfulResults = results.filter(r => r.success && r.suggestedNumbers.length >= ctx.minNumbers);

  // Score each number: sum of (provider_weight * provider_confidence) across all providers that suggested it
  const numberScores: Record<number, number> = {};
  for (let n = 1; n <= ctx.totalNumbers; n++) numberScores[n] = 0;

  for (const result of successfulResults) {
    const provider = providers.get(result.providerId);
    // Weight: performance-based + role importance
    const roleWeight: Record<ProviderRole, number> = {
      ensemble_judge:        1.8,
      strategy_advisor:      1.5,
      statistical_predictor: 1.4,
      mathematical_analyzer: 1.3,
      pattern_recognizer:    1.2,
      frequency_analyst:     1.1,
    };
    const perfWeight = provider ? Math.max(provider.successRate, 0.5) : 0.7;
    const weight = roleWeight[result.role] * perfWeight * result.confidence;

    for (const num of result.suggestedNumbers) {
      numberScores[num] = (numberScores[num] || 0) + weight;
    }
  }

  // Sort by score and pick top-N
  const ranked = Object.entries(numberScores)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([n, score]) => ({ number: parseInt(n), score: Number(score) }));

  const consensusNumbers = ranked
    .slice(0, ctx.minNumbers)
    .map(r => r.number)
    .sort((a, b) => a - b);

  // If not enough, fill with statistical fallback
  if (consensusNumbers.length < ctx.minNumbers) {
    const hot = ctx.hotNumbers.filter(n => !consensusNumbers.includes(n));
    while (consensusNumbers.length < ctx.minNumbers && hot.length > 0) {
      consensusNumbers.push(hot.shift()!);
    }
    consensusNumbers.sort((a, b) => a - b);
  }

  const overallConfidence = successfulResults.length > 0
    ? successfulResults.reduce((s, r) => s + r.confidence, 0) / successfulResults.length
    : 0;

  // Build alternative games — one per role
  const alternativeGames = successfulResults
    .slice(0, 5)
    .map(r => ({
      numbers: r.suggestedNumbers,
      source: `${r.providerName} (${r.role.replace(/_/g, " ")})`,
      confidence: r.confidence,
    }));

  const ensembleReasoning = successfulResults.length > 0
    ? `Ensemble de ${successfulResults.length} IAs: ${successfulResults.map(r => r.providerName).join(", ")}. ` +
      `Os números foram escolhidos por votação ponderada — cada IA contribuiu com seu peso baseado em especialidade e desempenho.`
    : "Análise estatística (providers indisponíveis)";

  return {
    consensusNumbers,
    alternativeGames,
    providerResults: results,
    consensusScore: numberScores,
    overallConfidence: parseFloat(overallConfidence.toFixed(3)),
    reasoning: ensembleReasoning,
    successfulProviders: successfulResults.length,
    totalProviders: allProviders.length,
    latencyMs: Date.now() - ensembleStart,
  };
}

// ─── Single call with fallback chain ─────────────────────────────────────────

export async function callWithFallback(
  prompt: string,
  systemPrompt: string,
  preferredRole?: ProviderRole
): Promise<{ text: string; provider: string }> {
  const allProviders = [...providers.values()]
    .filter(p => p.enabled)
    .sort((a, b) => {
      // Prefer matching role
      if (preferredRole) {
        const roleA = PROVIDER_ROLES[a.type] === preferredRole ? 1 : 0;
        const roleB = PROVIDER_ROLES[b.type] === preferredRole ? 1 : 0;
        if (roleA !== roleB) return roleB - roleA;
      }
      return a.priority - b.priority;
    });

  for (const provider of allProviders) {
    try {
      let fullPrompt = prompt;
      if (systemPrompt && provider.type !== "anthropic") {
        fullPrompt = `${systemPrompt}\n\n${prompt}`;
      }
      const { text } = await callProvider(provider, fullPrompt);
      if (text) {
        provider.totalCalls++;
        provider.successCalls++;
        provider.successRate = provider.successCalls / provider.totalCalls;
        provider.lastUsed = new Date().toISOString();
        evolutionLog.unshift({ providerName: provider.name, action: "success", details: "fallback call", timestamp: new Date().toISOString() });
        return { text, provider: provider.name };
      }
    } catch (err: any) {
      provider.totalCalls++;
      provider.successRate = provider.successCalls / provider.totalCalls;
      provider.lastError = err.message;
      evolutionLog.unshift({ providerName: provider.name, action: "error", details: err.message?.slice(0, 80), timestamp: new Date().toISOString() });
      logger.warn({ provider: provider.name }, "Fallback: tentando próximo provider");
    }
  }
  throw new Error("Todos os providers falharam");
}
