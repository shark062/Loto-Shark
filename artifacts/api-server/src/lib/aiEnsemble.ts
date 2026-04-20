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

export interface SharkAnalysisContext extends LotteryContext {
  delayMap: Record<number, number>;
  topPairs: Array<{ pair: [number, number]; count: number; percentage: number }>;
  overdueNumbers: number[];
  topFrequencyList: string;
  avgDelay: number;
  modalityProfile: string;
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

// ─── buildSharkAnalysisContext ────────────────────────────────────────────────

export function buildSharkAnalysisContext(
  base: LotteryContext,
  draws: number[][],
): SharkAnalysisContext {
  // Calcula delay de cada número
  const delayMap: Record<number, number> = {};
  for (let n = 1; n <= base.totalNumbers; n++) {
    const idx = draws.findIndex(d => d.includes(n));
    delayMap[n] = idx === -1 ? draws.length : idx;
  }

  // Top 10 atrasados
  const overdueNumbers = Object.entries(delayMap)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 10)
    .map(([n]) => parseInt(n));

  // Lista formatada das 15 maiores frequências com atraso
  const topFrequencyList = Object.entries(base.frequencyMap)
    .map(([n, f]) => ({ n: parseInt(n), f: f as number, d: delayMap[parseInt(n)] || 0 }))
    .sort((a, b) => b.f - a.f)
    .slice(0, 15)
    .map(e => `${e.n}(${e.f}x,atr:${e.d})`)
    .join(', ');

  // Atraso médio
  const allDelays = Object.values(delayMap);
  const avgDelay = allDelays.length > 0
    ? parseFloat((allDelays.reduce((a, b) => a + b, 0) / allDelays.length).toFixed(1))
    : 0;

  // Co-ocorrência de pares (top 10)
  const pairCounts: Record<string, number> = {};
  for (const draw of draws.slice(0, 50)) {
    const s = [...draw].sort((a, b) => a - b);
    for (let i = 0; i < s.length; i++)
      for (let j = i + 1; j < s.length; j++) {
        const k = `${s[i]}-${s[j]}`;
        pairCounts[k] = (pairCounts[k] || 0) + 1;
      }
  }
  const topPairs = Object.entries(pairCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([key, count]) => {
      const [a, b] = key.split('-').map(Number);
      return { pair: [a, b] as [number, number], count, percentage: Math.round(count / Math.max(draws.length, 1) * 100) };
    });

  const modalityProfile = `${base.lotteryName}: escolher ${base.minNumbers} de ${base.totalNumbers} | soma média: ${base.avgSum.toFixed(0)} | pares médios: ${base.avgEvens.toFixed(1)} | ${draws.length} sorteios analisados`;

  return {
    ...base,
    delayMap,
    topPairs,
    overdueNumbers,
    topFrequencyList,
    avgDelay,
    modalityProfile,
  };
}

// ─── System prompts per role ──────────────────────────────────────────────────

const ROLE_PROMPTS: Record<ProviderRole, (ctx: LotteryContext) => string> = {
  frequency_analyst: (ctx) => {
    const sc = ctx as any; // pode ser SharkAnalysisContext
    const topFreq = sc.topFrequencyList ||
      Object.entries(ctx.frequencyMap).sort((a,b) => (b[1] as number)-(a[1] as number))
        .slice(0,15).map(([n,f]) => `${n}(${f}x)`).join(', ');
    return `Você é um ANALISTA DE FREQUÊNCIA especializado em loterias brasileiras.
Analise os dados de frequência dos últimos ${ctx.draws.length} sorteios da ${ctx.lotteryName}.

FREQUÊNCIAS REAIS [número(saídas, atraso_atual)]: ${topFreq}
Números QUENTES (alta freq recente): ${ctx.hotNumbers.slice(0,12).join(', ')}
Números FRIOS (baixa freq recente): ${ctx.coldNumbers.slice(0,12).join(', ')}
Mais ATRASADOS: ${(sc.overdueNumbers || ctx.coldNumbers.slice(0,8)).slice(0,8).join(', ')}
Últimos 3 sorteios: ${ctx.draws.slice(0,3).map(d=>`[${d.numbers.join(',')}]`).join(' | ')}

Tarefa: selecione os ${ctx.minNumbers} números com maior potencial para o próximo sorteio.
Misture quentes (momentum) com atrasados de alta frequência global (compensação).

Responda APENAS JSON válido sem markdown:
{"suggestedNumbers":[exatamente ${ctx.minNumbers} números distintos de 1 a ${ctx.totalNumbers}],"confidence":0.XX,"reasoning":"baseado nos dados reais","hotCount":N,"coldCount":N}`;
  },

  statistical_predictor: (ctx) => {
    const sc = ctx as any;
    return `Você é um PREDITOR ESTATÍSTICO de loterias brasileiras.
Use probabilidade Bayesiana e análise de frequência para prever os próximos números da ${ctx.lotteryName}.

PERFIL: ${sc.modalityProfile || `${ctx.lotteryName}: ${ctx.minNumbers} de ${ctx.totalNumbers}, ${ctx.draws.length} sorteios`}
Soma média histórica: ${ctx.avgSum.toFixed(1)} | Pares médios: ${ctx.avgEvens.toFixed(1)}
Quentes: ${ctx.hotNumbers.slice(0,10).join(', ')}
Frios: ${ctx.coldNumbers.slice(0,10).join(', ')}
Atraso médio do universo: ${sc.avgDelay || '?'} sorteios
Histórico recente: ${ctx.draws.slice(0,5).map(d=>`[${d.numbers.join(',')}]`).join(' | ')}

Calcule com:
1. Frequência ponderada por recência
2. Equilíbrio par/ímpar próximo de ${ctx.avgEvens.toFixed(0)} pares
3. Soma próxima de ${ctx.avgSum.toFixed(0)} (±12%)
4. Máximo 3 consecutivos

Responda APENAS JSON válido:
{"suggestedNumbers":[exatamente ${ctx.minNumbers} números distintos de 1 a ${ctx.totalNumbers}],"confidence":0.XX,"reasoning":"raciocínio estatístico","expectedSum":N,"evenOddBalance":"X pares / Y ímpares"}`;
  },

  mathematical_analyzer: (ctx) => {
    const sc = ctx as any;
    const recentStats = ctx.draws.slice(0,8).map(d => {
      const nums = d.numbers;
      const sum  = nums.reduce((a:number,b:number)=>a+b,0);
      const evens = nums.filter((n:number)=>n%2===0).length;
      const sorted = [...nums].sort((a:number,b:number)=>a-b);
      const consec = sorted.reduce((c:number,n:number,i:number,arr:number[])=>i>0&&n===arr[i-1]+1?c+1:c,0);
      return `[${nums.join(',')}] S=${sum} P=${evens} C=${consec}`;
    }).join('\n');
    return `Você é um ANALISADOR MATEMÁTICO de padrões em loterias brasileiras.
Foque em somas, paridade, consecutividade e distribuição por quadrantes da ${ctx.lotteryName}.

Últimos 8 sorteios (S=soma, P=pares, C=consecutivos):
${recentStats}

Universo: 1 a ${ctx.totalNumbers} | Escolher: ${ctx.minNumbers}
Soma média: ${ctx.avgSum.toFixed(1)} | Pares médios: ${ctx.avgEvens.toFixed(1)}
Pares mais frequentes juntos: ${sc.topPairs ? sc.topPairs.slice(0,5).map((p:any)=>`(${p.pair[0]},${p.pair[1]}):${p.count}x`).join(' ') : 'N/D'}

Analise o padrão matemático mais provável e distribua pelos 4 quadrantes de ${Math.ceil(ctx.totalNumbers/4)} números cada.

Responda APENAS JSON válido:
{"suggestedNumbers":[exatamente ${ctx.minNumbers} números distintos de 1 a ${ctx.totalNumbers}],"confidence":0.XX,"reasoning":"padrões matemáticos","targetSum":N,"distribution":"X baixos / Y médios / Z altos"}`;
  },

  pattern_recognizer: (ctx) => {
    const sc = ctx as any;
    const neverAppeared = Array.from({length: ctx.totalNumbers}, (_,i)=>i+1)
      .filter(n => !ctx.frequencyMap[n] || (ctx.frequencyMap[n] as number) === 0);
    return `Você é um RECONHECEDOR DE PADRÕES em sequências de loterias brasileiras.
Identifique padrões recorrentes, ciclos e tendências na ${ctx.lotteryName}.

Sequência dos ${ctx.draws.length} sorteios mais recentes:
${ctx.draws.slice(0,15).map((d,i)=>`#${i+1} [${[...d.numbers].sort((a:number,b:number)=>a-b).join(',')}]`).join('\n')}

Nunca apareceram nos últimos ${ctx.draws.length} sorteios: ${neverAppeared.join(', ') || 'nenhum'}
Mais atrasados: ${(sc.overdueNumbers || ctx.coldNumbers.slice(0,8)).join(', ')}
Pares com maior co-ocorrência: ${sc.topPairs ? sc.topPairs.slice(0,5).map((p:any)=>`(${p.pair[0]},${p.pair[1]}):${p.count}x`).join(' ') : 'N/D'}

Identifique:
1. Co-ocorrências (números que saem juntos)
2. Ciclos de ausência e retorno
3. Números quentes dos últimos 3 sorteios vs ausentes há >5 sorteios

Responda APENAS JSON válido:
{"suggestedNumbers":[exatamente ${ctx.minNumbers} números distintos de 1 a ${ctx.totalNumbers}],"confidence":0.XX,"reasoning":"padrões detectados","keyPattern":"principal padrão","overdueNumbers":[números mais atrasados incluídos]}`;
  },

  strategy_advisor: (ctx) => {
    const sc = ctx as any;
    return `Você é um CONSELHEIRO ESTRATÉGICO de loterias brasileiras.
Combine análise técnica com visão estratégica para ${ctx.lotteryName}.

CONTEXTO COMPLETO:
- ${sc.modalityProfile || `${ctx.lotteryName}: ${ctx.minNumbers} de ${ctx.totalNumbers}`}
- Quentes: ${ctx.hotNumbers.slice(0,10).join(', ')}
- Frios/Atrasados: ${ctx.coldNumbers.slice(0,10).join(', ')}
- Soma alvo: ${ctx.avgSum.toFixed(0)} (±15%)
- Pares alvo: ${ctx.avgEvens.toFixed(0)}
- Top pares co-ocorrentes: ${sc.topPairs ? sc.topPairs.slice(0,5).map((p:any)=>`(${p.pair[0]},${p.pair[1]})`).join(' ') : 'N/D'}

Estratégia ideal para maximizar acertos:
1. 40-50% quentes (momentum), 25-30% atrasados de alta frequência global, resto mornos
2. Inclua ao menos 1 par co-ocorrente de alto índice
3. Distribua pelos quadrantes do universo de números
4. Soma e paridade próximas à média histórica

Responda APENAS JSON válido:
{"suggestedNumbers":[exatamente ${ctx.minNumbers} números distintos de 1 a ${ctx.totalNumbers}],"confidence":0.XX,"reasoning":"raciocínio estratégico completo","strategy":"nome da estratégia","riskLevel":"baixo|médio|alto"}`;
  },

  ensemble_judge: (ctx) => {
    const sc = ctx as any;
    return `Você é o JUIZ DO ENSEMBLE para ${ctx.lotteryName}.
Você receberá sugestões de múltiplas IAs especializadas e construirá o consenso final.

DADOS ESTATÍSTICOS BASE:
- ${sc.modalityProfile || `${ctx.lotteryName}: ${ctx.minNumbers} de ${ctx.totalNumbers}`}
- Quentes: ${ctx.hotNumbers.slice(0,10).join(', ')}
- Atrasados prioritários: ${(sc.overdueNumbers || ctx.coldNumbers.slice(0,5)).join(', ')}
- Soma média histórica: ${ctx.avgSum.toFixed(1)}
- Pares médios: ${ctx.avgEvens.toFixed(1)}
- Frequências reais: ${sc.topFrequencyList || ''}

Para o consenso final, priorize números que:
1. Aparecem em 3+ sugestões das IAs
2. São quentes OU têm atraso alto com frequência global acima da média
3. Resultam em soma próxima de ${ctx.avgSum.toFixed(0)} (±15%)
4. Equilibram pares/ímpares próximo de ${ctx.avgEvens.toFixed(0)} pares

Responda APENAS JSON válido:
{"suggestedNumbers":[exatamente ${ctx.minNumbers} números distintos de 1 a ${ctx.totalNumbers}],"confidence":0.XX,"reasoning":"consenso das IAs com critérios estatísticos","consensusStrength":"forte|médio|fraco"}`;
  },
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

async function callProvider(
  provider: ProviderConfig,
  prompt: string,
  systemPrompt?: string,
): Promise<{ text: string; latencyMs: number }> {
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
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
        ...(systemPrompt ? { system: systemPrompt } : {}),
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text().catch(() => "")}`);
    const data = await response.json() as any;
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
      max_tokens: 2000,
      temperature: 0.3,
      messages: [
        ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
        { role: "user" as const, content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text().catch(() => "")}`);
  const data = await response.json() as any;
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

export async function runEnsemble(ctx: LotteryContext | SharkAnalysisContext): Promise<EnsembleResult> {
  const ensembleStart = Date.now();
  const allProviders = [...providers.values()].filter(p => p.enabled);

  if (allProviders.length === 0) {
    throw new Error("Nenhum provider de IA configurado");
  }

  // Passa o contexto enriquecido para os prompts (cast é seguro — SharkAnalysisContext extends LotteryContext)
  const enrichedCtx = ctx as SharkAnalysisContext;

  // Assign roles — each type gets its specialized role
  const assignments = allProviders.map(p => ({
    provider: p,
    role: PROVIDER_ROLES[p.type] || "frequency_analyst",
  }));

  // Run all providers in parallel
  const tasks = assignments.map(async ({ provider, role }): Promise<ProviderResult> => {
    const prompt = ROLE_PROMPTS[role](enrichedCtx);
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

  const numberScores: Record<number, number> = {};
  for (let n = 1; n <= ctx.totalNumbers; n++) numberScores[n] = 0;

  for (const result of successfulResults) {
    const provider = providers.get(result.providerId);
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

  const ranked = Object.entries(numberScores)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([n, score]) => ({ number: parseInt(n), score: Number(score) }));

  const consensusNumbers = ranked
    .slice(0, ctx.minNumbers)
    .map(r => r.number)
    .sort((a, b) => a - b);

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
      if (preferredRole) {
        const roleA = PROVIDER_ROLES[a.type] === preferredRole ? 1 : 0;
        const roleB = PROVIDER_ROLES[b.type] === preferredRole ? 1 : 0;
        if (roleA !== roleB) return roleB - roleA;
      }
      return a.priority - b.priority;
    });

  for (const provider of allProviders) {
    try {
      const { text } = await callProvider(provider, prompt, systemPrompt);
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
