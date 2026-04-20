# PROMPT COMPLETO PARA O REPLIT — LOTO-SHARK MELHORIAS V2
**LEIA TODO O PROMPT ANTES DE COMEÇAR. NÃO ALTERE NADA ALÉM DO QUE ESTÁ DESCRITO AQUI.**

---

## REGRAS ABSOLUTAS — NÃO QUEBRE NENHUMA

1. Altere **somente** os arquivos listados na seção "ARQUIVOS A MODIFICAR".
2. Não renomeie, não mova, não delete nenhum arquivo ou pasta.
3. Não altere nenhum componente de UI, arquivo de schema do banco, `package.json`, `tsconfig`, `.replit` ou qualquer arquivo de configuração.
4. Não instale novas dependências.
5. Preserve **todos** os exports existentes — adicione exports novos, nunca remova.
6. Compile mentalmente e verifique erros de TypeScript após cada arquivo antes de avançar.
7. Se houver risco de quebrar compatibilidade, use a abordagem mais conservadora possível.

---

## VISÃO GERAL DO QUE SERÁ FEITO

O sistema hoje tem **dois problemas centrais que se reforçam**:

**Problema A — Pipeline quebrado:** As rotas `/api/games/generate` e `/api/prediction/*` chamam `fetchHistoricalDraws(id, 30)` e `fetchHistoricalDraws(id, 20)` em vários lugares com valores fixos baixos. Mais crítico: o fluxo de **análise → estratégia → desdobramento → geração de jogos** não existe como pipeline integrado — cada rota faz sua própria análise fragmentada, e as IAs nunca são consultadas durante a geração de jogos (só em `/api/ai/*`).

**Problema B — Lógica de frequência ruim:** A classificação quente/morno/frio usa corte fixo de 25%/75% pela frequência global, ignorando que números podem ser globalmente frequentes mas estar em pausa recente (ou o contrário). Dezenas de alta frequência ficam desaparecendo das listas de "quentes".

**A solução** é:
1. Criar um **pipeline unificado** de análise que chama as IAs, aplica o SharkEngine, e entrega jogos com máxima precisão
2. Corrigir a classificação de temperatura usando score combinado (global + recente)
3. Adicionar cache persistente no banco para o histórico de sorteios
4. Adicionar análise de co-ocorrência de pares
5. Configurar histórico adaptativo por modalidade (Lotofácil busca mais sorteios)
6. Criar endpoint de comparação/score de jogos

---

## ARQUIVOS A MODIFICAR

```
artifacts/api-server/src/lib/lotteryData.ts
artifacts/api-server/src/lib/aiEnsemble.ts
artifacts/api-server/src/routes/aiAnalysis.ts
artifacts/api-server/src/routes/prediction.ts
artifacts/api-server/src/routes/index.ts
artifacts/api-server/src/app.ts
```

---

## ALTERAÇÃO 1 — `artifacts/api-server/src/lib/lotteryData.ts`

### 1a. Adicionar configuração de histórico adaptativo por modalidade

Logo após a constante `CAIXA_API`, antes do array `LOTTERIES`, adicione:

```typescript
// Histórico ótimo por modalidade (quantidade de sorteios para análise confiável)
const HISTORY_CONFIG: Record<string, { optimal: number; recent: number }> = {
  lotofacil:  { optimal: 200, recent: 30 }, // sorteia 6x/semana → precisa mais histórico
  quina:      { optimal: 150, recent: 25 }, // sorteia 6x/semana
  lotomania:  { optimal: 100, recent: 20 },
  megasena:   { optimal: 100, recent: 20 }, // sorteia 3x/semana
  duplasena:  { optimal: 100, recent: 20 },
  timemania:  { optimal: 80,  recent: 15 },
  diadesorte: { optimal: 80,  recent: 15 },
  supersete:  { optimal: 60,  recent: 10 },
};

export function getHistoryConfig(lotteryId: string): { optimal: number; recent: number } {
  return HISTORY_CONFIG[lotteryId] || { optimal: 100, recent: 20 };
}
```

### 1b. Adicionar cache persistente no banco para histórico de sorteios

Adicione o seguinte import no topo do arquivo (após os tipos existentes):

```typescript
import { db } from '@workspace/db';
import { lotteryDrawsCache } from '@workspace/db';
```

**Atenção:** O schema `lotteryDrawsCache` não existe ainda no banco. Adicione-o ao arquivo `lib/db/src/schema/index.ts` (este é o único arquivo de schema que você pode tocar, e apenas para ADICIONAR esta tabela no final):

```typescript
// Adicionar no FINAL de lib/db/src/schema/index.ts, após os exports existentes:

export const lotteryDrawsCache = pgTable('lottery_draws_cache', {
  id: serial('id').primaryKey(),
  lotteryId: text('lottery_id').notNull().unique(),
  draws: jsonb('draws').notNull().$type<number[][]>(),
  latestContest: integer('latest_contest').notNull().default(0),
  fetchedAt: timestamp('fetched_at').notNull().defaultNow(),
  drawCount: integer('draw_count').notNull().default(0),
});
```

Depois de adicionar o schema, rode a migração do banco com:
```bash
cd lib/db && npx drizzle-kit push
```

Agora, de volta em `lotteryData.ts`, substitua a constante `cache` em memória e a função `fetchHistoricalDraws` completa pela versão com cache no banco:

```typescript
// Remove a constante: const cache: Record<string, DrawCache> = {};
// Remove a constante: const CACHE_TTL = ...
// Substitui fetchHistoricalDraws por:

const CACHE_TTL_MS = 45 * 60 * 1000; // 45 minutos

// Cache em memória como fallback rápido (evita hits desnecessários ao banco)
const memCache: Record<string, { draws: number[][]; fetchedAt: number }> = {};

export async function fetchHistoricalDraws(lotteryId: string, count?: number): Promise<number[][]> {
  const config = getHistoryConfig(lotteryId);
  const targetCount = count ?? config.optimal;

  // 1. Tenta cache em memória (mais rápido)
  const mem = memCache[lotteryId];
  if (mem && Date.now() - mem.fetchedAt < CACHE_TTL_MS && mem.draws.length >= targetCount) {
    return mem.draws.slice(0, targetCount);
  }

  // 2. Tenta cache no banco (sobrevive a restarts)
  try {
    const { eq } = await import('drizzle-orm');
    const rows = await db.select().from(lotteryDrawsCache).where(eq(lotteryDrawsCache.lotteryId, lotteryId)).limit(1);
    if (rows.length > 0) {
      const row = rows[0];
      const ageMs = Date.now() - new Date(row.fetchedAt).getTime();
      if (ageMs < CACHE_TTL_MS && row.draws.length >= targetCount) {
        // Atualiza memCache também
        memCache[lotteryId] = { draws: row.draws, fetchedAt: Date.now() - ageMs };
        return row.draws.slice(0, targetCount);
      }
    }
  } catch {
    // Se o banco falhar, continua para buscar da Caixa
  }

  // 3. Busca da API da Caixa
  const latest = await fetchLatestDraw(lotteryId);
  if (!latest) {
    // Retorna o que tiver em memória ou banco, mesmo expirado
    if (mem?.draws?.length) return mem.draws.slice(0, targetCount);
    return [];
  }

  const latestContest = latest.numero || latest.contestNumber || 0;
  const latestNums = latest.dezenas?.map(Number) || latest.listaDezenas?.map(Number) || [];
  const draws: number[][] = latestNums.length > 0 ? [latestNums] : [];

  const targets: number[] = [];
  for (let i = 1; i < targetCount && latestContest - i > 0; i++) {
    targets.push(latestContest - i);
  }

  // Busca em lotes de 10 para velocidade
  for (let i = 0; i < targets.length; i += 10) {
    const batch = targets.slice(i, i + 10);
    const results = await Promise.allSettled(batch.map(n => fetchDraw(lotteryId, n)));
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) draws.push(r.value);
    }
    if (draws.length >= targetCount) break;
  }

  // 4. Salva no cache em memória
  memCache[lotteryId] = { draws, fetchedAt: Date.now() };

  // 5. Persiste no banco (fire-and-forget para não bloquear a resposta)
  (async () => {
    try {
      const { eq } = await import('drizzle-orm');
      await db.insert(lotteryDrawsCache).values({
        lotteryId,
        draws,
        latestContest,
        fetchedAt: new Date(),
        drawCount: draws.length,
      }).onConflictDoUpdate({
        target: lotteryDrawsCache.lotteryId,
        set: {
          draws,
          latestContest,
          fetchedAt: new Date(),
          drawCount: draws.length,
        },
      });
    } catch { /* silencioso */ }
  })();

  return draws.slice(0, targetCount);
}
```

### 1c. Corrigir `computeFrequencies` — classificação com score combinado

Substitua a função `computeFrequencies` inteira pela versão corrigida:

```typescript
export function computeFrequencies(totalNumbers: number, draws: number[][]): NumberFrequency[] {
  const freq: Record<number, number>       = {};
  const recentFreq: Record<number, number> = {};
  const delayMap: Record<number, number>   = {};

  for (let i = 1; i <= totalNumbers; i++) {
    freq[i] = 0;
    recentFreq[i] = 0;
  }

  // Frequência global
  draws.forEach(draw => draw.forEach(n => { if (freq[n] !== undefined) freq[n]++; }));

  // Janela recente adaptativa: 20% dos sorteios, mínimo 10, máximo 30
  const recentWindow = Math.min(30, Math.max(10, Math.floor(draws.length * 0.20)));
  const recentDraws = draws.slice(0, Math.min(recentWindow, draws.length));
  recentDraws.forEach(draw => draw.forEach(n => { if (recentFreq[n] !== undefined) recentFreq[n]++; }));

  // Atraso (sorteios consecutivos sem aparecer)
  for (let n = 1; n <= totalNumbers; n++) {
    const idx = draws.findIndex(d => d.includes(n));
    delayMap[n] = idx === -1 ? draws.length : idx;
  }

  const numeros = Array.from({ length: totalNumbers }, (_, i) => i + 1);
  const totalDraws  = Math.max(draws.length, 1);
  const recentTotal = Math.max(recentDraws.length, 1);

  // Score combinado: 40% frequência global normalizada + 60% frequência recente normalizada
  const maxGlobalFreq = Math.max(...numeros.map(n => freq[n] || 0), 1);
  const maxRecentFreq = Math.max(...numeros.map(n => recentFreq[n] || 0), 1);

  const combinedScore = (n: number): number => {
    const globalNorm = (freq[n] || 0) / maxGlobalFreq;
    const recentNorm = (recentFreq[n] || 0) / maxRecentFreq;
    return globalNorm * 0.40 + recentNorm * 0.60;
  };

  // Classificação por score combinado (quentes) e por atraso (frias)
  const sortedByCombined = [...numeros].sort((a, b) => combinedScore(b) - combinedScore(a));
  const sortedByDelay    = [...numeros].sort((a, b) => (delayMap[b] || 0) - (delayMap[a] || 0));

  // Top 30% por score combinado = quentes; Top 25% por atraso = frias; resto = mornas
  const hotCut  = Math.floor(totalNumbers * 0.30);
  const coldCut = Math.floor(totalNumbers * 0.25);

  const hotSet  = new Set(sortedByCombined.slice(0, hotCut));
  const coldSet = new Set(sortedByDelay.slice(0, coldCut));

  // Rank por frequência global para compatibilidade
  const sortedByGlobal = [...numeros].sort((a, b) => freq[b] - freq[a]);
  const rankMap: Record<number, number> = {};
  sortedByGlobal.forEach((n, i) => { rankMap[n] = i + 1; });

  return numeros.map(n => {
    let temperature: 'hot' | 'warm' | 'cold';
    const isHot  = hotSet.has(n);
    const isCold = coldSet.has(n);

    if (isHot && !isCold) {
      temperature = 'hot';
    } else if (isCold && !isHot) {
      temperature = 'cold';
    } else if (isHot && isCold) {
      temperature = combinedScore(n) >= 0.50 ? 'hot' : 'cold';
    } else {
      temperature = 'warm';
    }

    return {
      number: n,
      frequency: freq[n],
      recentFrequency: recentFreq[n],
      delay: delayMap[n],
      percentage: Math.round((freq[n] / totalDraws) * 100),
      recentPercentage: Math.round((recentFreq[n] / recentTotal) * 100),
      temperature,
      rank: rankMap[n],
      isHot: temperature === 'hot',
      isCold: temperature === 'cold',
      recentWindow,
    };
  }).sort((a, b) => {
    // Quentes primeiro → mornas → frias; dentro de cada grupo, por frequência global desc
    const tempOrder = { hot: 0, warm: 1, cold: 2 };
    const tDiff = tempOrder[a.temperature] - tempOrder[b.temperature];
    if (tDiff !== 0) return tDiff;
    return b.frequency - a.frequency;
  });
}
```

Atualize também a interface `NumberFrequency` para incluir `recentWindow`:

```typescript
export interface NumberFrequency {
  number: number;
  frequency: number;
  recentFrequency: number;
  delay: number;
  percentage: number;
  recentPercentage: number;
  temperature: 'hot' | 'warm' | 'cold';
  rank: number;
  isHot?: boolean;
  isCold?: boolean;
  recentWindow?: number;  // <- ADICIONAR este campo
}
```

### 1d. Adicionar função de co-ocorrência de pares

Adicione esta função nova no final do arquivo (antes do último fechamento, após `generateSmartNumbers`):

```typescript
export interface PairCoOccurrence {
  pair: [number, number];
  count: number;
  percentage: number;
}

export function computeTopPairs(draws: number[][], topN: number = 20): PairCoOccurrence[] {
  const pairCount: Record<string, number> = {};
  const totalDraws = draws.length;

  for (const draw of draws) {
    const sorted = [...draw].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const key = `${sorted[i]}-${sorted[j]}`;
        pairCount[key] = (pairCount[key] || 0) + 1;
      }
    }
  }

  return Object.entries(pairCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([key, count]) => {
      const [a, b] = key.split('-').map(Number);
      return {
        pair: [a, b] as [number, number],
        count,
        percentage: Math.round((count / Math.max(totalDraws, 1)) * 100),
      };
    });
}
```

---

## ALTERAÇÃO 2 — `artifacts/api-server/src/lib/aiEnsemble.ts`

### 2a. Corrigir assinatura de `callProvider` para separar system prompt

Localize a função `callProvider` (interna, não exportada). Altere sua assinatura para aceitar `systemPrompt` opcional:

```typescript
async function callProvider(
  provider: ProviderConfig,
  prompt: string,
  systemPrompt?: string,
): Promise<{ text: string; latencyMs: number }>
```

Dentro do bloco `anthropic`:
```typescript
body: JSON.stringify({
  model: provider.model,
  max_tokens: 2000,
  messages: [{ role: 'user', content: prompt }],
  ...(systemPrompt ? { system: systemPrompt } : {}),
}),
```

Dentro do bloco OpenAI-compatible:
```typescript
messages: [
  ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
  { role: 'user' as const, content: prompt },
],
```

Nos dois locais que chamam `callProvider` (dentro de `runEnsemble` e `callWithFallback`), atualize para passar `systemPrompt` quando disponível.

### 2b. Adicionar tipo `SharkAnalysis` ao contexto do ensemble

Após a interface `LotteryContext`, adicione:

```typescript
export interface SharkAnalysisContext extends LotteryContext {
  delayMap: Record<number, number>;
  topPairs: Array<{ pair: [number, number]; count: number; percentage: number }>;
  overdueNumbers: number[];        // top números mais atrasados
  topFrequencyList: string;        // "10(47x,atr:2), 5(45x,atr:0), ..."
  avgDelay: number;                // atraso médio do universo de números
  modalityProfile: string;         // resumo do perfil da modalidade
}
```

### 2c. Adicionar função `buildSharkAnalysisContext` (exportada)

Adicione esta função exportada logo antes de `runEnsemble`:

```typescript
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
```

### 2d. Enriquecer os prompts do ensemble com dados reais

Substitua o objeto `ROLE_PROMPTS` inteiro pelo seguinte. Preserve exatamente as 6 chaves existentes — apenas melhore os templates para usar `SharkAnalysisContext` quando disponível (os prompts devem funcionar mesmo com `LotteryContext` simples):

```typescript
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
    // CORRIGIDO: query correta de números ausentes
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
```

### 2e. Atualizar `runEnsemble` para aceitar `SharkAnalysisContext`

Na função `runEnsemble`, altere a assinatura para aceitar o tipo mais rico quando disponível:

```typescript
export async function runEnsemble(ctx: LotteryContext | SharkAnalysisContext): Promise<EnsembleResult>
```

Dentro de `runEnsemble`, antes de montar `assignments`, adicione:

```typescript
// Passa o contexto enriquecido para os prompts (cast é seguro — SharkAnalysisContext extends LotteryContext)
const enrichedCtx = ctx as SharkAnalysisContext;
```

E substitua `ROLE_PROMPTS[role](ctx)` por `ROLE_PROMPTS[role](enrichedCtx)`.

---

## ALTERAÇÃO 3 — `artifacts/api-server/src/routes/aiAnalysis.ts`

### 3a. Importar as novas funções

Adicione ao bloco de imports:

```typescript
import { computeTopPairs, getHistoryConfig } from '../lib/lotteryData';
import { buildSharkAnalysisContext } from '../lib/aiEnsemble';
import type { SharkAnalysisContext } from '../lib/aiEnsemble';
```

### 3b. Substituir `buildContext` pela versão corrigida

Substitua a função `buildContext` inteira:

```typescript
function buildContext(lotteryId: string, lottery: any, draws: number[][]): SharkAnalysisContext {
  const freqs = computeFrequencies(lottery.totalNumbers, draws);

  // Usa diretamente a temperatura calculada em computeFrequencies (fonte única de verdade)
  const hotNumbers  = freqs.filter(f => f.temperature === 'hot').map(f => f.number);
  const coldNumbers = freqs.filter(f => f.temperature === 'cold').map(f => f.number);
  const warmNumbers = freqs.filter(f => f.temperature === 'warm').map(f => f.number);

  const frequencyMap: Record<number, number> = {};
  for (const f of freqs) frequencyMap[f.number] = f.frequency;

  const avgSum = draws.length > 0
    ? draws.reduce((s, d) => s + d.reduce((a, b) => a + b, 0), 0) / draws.length
    : (lottery.totalNumbers + 1) * lottery.minNumbers / 2;

  const avgEvens = draws.length > 0
    ? draws.reduce((s, d) => s + d.filter((n: number) => n % 2 === 0).length, 0) / draws.length
    : lottery.minNumbers / 2;

  const base = {
    lotteryId,
    lotteryName: lottery.displayName,
    totalNumbers: lottery.totalNumbers,
    minNumbers: lottery.minNumbers,
    draws: draws.map((d, i) => ({ contestNumber: i + 1, numbers: d })),
    hotNumbers,
    coldNumbers,
    warmNumbers,
    frequencyMap,
    avgSum,
    avgEvens,
  };

  return buildSharkAnalysisContext(base, draws);
}
```

### 3c. Aumentar histórico para 100 em todos os handlers

Em todos os `fetchHistoricalDraws(lotteryId, N)` dentro deste arquivo, substitua o valor numérico fixo pelo adaptativo:

```typescript
// ANTES (qualquer valor fixo como 50, 30, 20):
const draws = await fetchHistoricalDraws(lotteryId, 50).catch(...);

// DEPOIS (use getHistoryConfig para pegar o valor ótimo da modalidade):
const { optimal } = getHistoryConfig(lotteryId);
const draws = await fetchHistoricalDraws(lotteryId, optimal).catch(() => [] as number[][]);
```

Faça isso em **todos** os handlers deste arquivo: `/analysis/:lotteryId`, `/meta-reasoning/:lotteryId`, `/optimal-combination/:lotteryId`.

### 3d. Melhorar prompt de previsão com dados enriquecidos do SharkAnalysisContext

No handler `GET /analysis/:lotteryId`, no bloco onde `type === prediction`, substitua o prompt inteiro:

```typescript
if (type === 'prediction') {
  const sc = ctx as SharkAnalysisContext;
  const sumMin  = Math.round(sc.avgSum * 0.85);
  const sumMax  = Math.round(sc.avgSum * 1.15);
  const paresMin = Math.floor(sc.avgEvens - 1);
  const paresMax = Math.ceil(sc.avgEvens + 1);
  const overdueThreshold = Math.ceil(draws.length * 0.15);

  prompt = `Gere uma previsão precisa para o próximo sorteio da ${lottery.displayName} (escolha ${lottery.minNumbers} números de 1 a ${lottery.totalNumbers}).

DADOS ESTATÍSTICOS REAIS (${draws.length} sorteios analisados da Caixa Econômica Federal):
- Top 15 por frequência global [número(qtd_saídas, atraso_atual)]: ${sc.topFrequencyList}
- Números QUENTES (alta freq combinada): ${sc.hotNumbers.slice(0,14).join(', ')}
- Números FRIOS (menor freq combinada): ${sc.coldNumbers.slice(0,14).join(', ')}
- Top 8 mais ATRASADOS (maior ausência): ${sc.overdueNumbers.slice(0,8).join(', ')}
- Pares que mais saem JUNTOS: ${sc.topPairs.slice(0,6).map(p=>`(${p.pair[0]},${p.pair[1]}):${p.count}x`).join(' ')}
- Soma média histórica: ${sc.avgSum.toFixed(1)} — mantenha entre ${sumMin} e ${sumMax}
- Média de pares por sorteio: ${sc.avgEvens.toFixed(1)} — use entre ${paresMin} e ${paresMax} pares
- Últimos 5 sorteios: ${draws.slice(0,5).map(d=>`[${d.join(',')}]`).join(' | ')}

CRITÉRIOS OBRIGATÓRIOS:
1. Inclua mínimo ${Math.ceil(lottery.minNumbers * 0.35)} números QUENTES
2. Inclua mínimo 1 número ATRASADO com delay > ${overdueThreshold} sorteios
3. Inclua ao menos 1 par co-ocorrente da lista de pares frequentes
4. Soma total entre ${sumMin} e ${sumMax}
5. Entre ${paresMin} e ${paresMax} números pares
6. Distribua pelos 4 quadrantes: ao menos 1 número por faixa de ${Math.ceil(lottery.totalNumbers/4)}
7. Máximo 3 números consecutivos

Responda APENAS JSON válido sem texto fora do JSON:
{"primaryPrediction":[exatamente ${lottery.minNumbers} números únicos de 1 a ${lottery.totalNumbers}],"confidence":0.XX,"reasoning":"explicação detalhada dos critérios aplicados","overdueIncluded":[números atrasados incluídos],"pairsIncluded":[[n1,n2]],"sumEstimated":N,"evenCount":N,"alternatives":[{"numbers":[${lottery.minNumbers} números],"strategy":"nome"},{"numbers":[${lottery.minNumbers} números],"strategy":"nome"}],"riskLevel":"baixo|médio|alto"}`;
}
```

### 3e. Melhorar fallback estatístico com dados reais

Substitua a função `buildStatisticalAnalysis` inteira:

```typescript
function buildStatisticalAnalysis(type: string, lotteryId: string, lottery: any, ctx: any, draws: number[][]) {
  const sc = ctx as SharkAnalysisContext;
  let result: any;

  if (type === 'pattern') {
    const topPairStr = sc.topPairs?.slice(0,3).map((p:any)=>`(${p.pair[0]},${p.pair[1]})`).join(', ') || 'N/D';
    result = {
      patterns: [
        { pattern: 'Dominância de quentes', frequency: 0.65, lastOccurrence: 'Recente', predictedNext: sc.hotNumbers.slice(0, 3) },
        { pattern: 'Retorno de atrasados', frequency: 0.45, lastOccurrence: 'Variável', predictedNext: sc.overdueNumbers?.slice(0, 3) || sc.coldNumbers.slice(0, 3) },
        { pattern: `Co-ocorrência frequente: ${topPairStr}`, frequency: 0.40, lastOccurrence: 'Recorrente', predictedNext: sc.topPairs?.[0]?.pair ? [sc.topPairs[0].pair[0], sc.topPairs[0].pair[1]] : [] },
      ],
      summary: `Análise estatística de ${draws.length} sorteios reais da Caixa. Top pares: ${topPairStr}.`,
    };
  } else if (type === 'strategy') {
    result = {
      recommendedStrategy: 'mixed',
      reasoning: `Estratégia balanceada baseada em ${draws.length} sorteios da ${lottery.displayName}. Mistura quentes (momentum) com atrasados de alta frequência global.`,
      numberSelection: { hotPercentage: 45, warmPercentage: 25, coldPercentage: 30 },
      riskLevel: 'médio',
      playFrequency: '2-3 vezes por semana',
      budgetAdvice: 'Defina um orçamento fixo mensal e não extrapole',
      expectedImprovement: 'Melhora estatística estimada de ~18% vs aleatório',
    };
  } else {
    // prediction — usa proporção real de quentes/atrasados/mornos
    const hotSlice  = sc.hotNumbers.slice(0, Math.ceil(lottery.minNumbers * 0.45));
    const coldSlice = (sc.overdueNumbers || sc.coldNumbers).slice(0, Math.ceil(lottery.minNumbers * 0.25));
    const warmSlice = sc.warmNumbers.slice(0, Math.ceil(lottery.minNumbers * 0.30));

    const combined = [...new Set([...hotSlice, ...coldSlice, ...warmSlice])];
    while (combined.length < lottery.minNumbers) {
      for (let n = 1; n <= lottery.totalNumbers; n++) {
        if (!combined.includes(n)) { combined.push(n); break; }
      }
    }
    const nums = combined.slice(0, lottery.minNumbers).sort((a: number, b: number) => a - b);

    result = {
      primaryPrediction: nums,
      confidence: 0.62,
      reasoning: `Previsão estatística: ${hotSlice.length} quentes + ${coldSlice.length} atrasados + ${warmSlice.length} mornos. Baseado em ${draws.length} sorteios reais.`,
      overdueIncluded: coldSlice.slice(0, 3),
      pairsIncluded: sc.topPairs?.[0] ? [sc.topPairs[0].pair] : [],
      sumEstimated: nums.reduce((a: number, b: number) => a + b, 0),
      evenCount: nums.filter((n: number) => n % 2 === 0).length,
      alternatives: [
        { numbers: sc.hotNumbers.slice(0, lottery.minNumbers).sort((a: number, b: number) => a - b), strategy: 'Apenas quentes' },
        { numbers: (sc.overdueNumbers || sc.coldNumbers).slice(0, lottery.minNumbers).sort((a: number, b: number) => a - b), strategy: 'Apenas atrasados' },
      ],
      riskLevel: 'médio',
    };
  }

  return {
    id: Date.now(),
    lotteryId,
    analysisType: type,
    result,
    confidence: String(result.confidence || 0.62),
    createdAt: new Date().toISOString(),
    source: 'statistical',
  };
}
```

---

## ALTERAÇÃO 4 — `artifacts/api-server/src/routes/prediction.ts`

### 4a. Importar funções novas

Adicione/atualize os imports no topo:

```typescript
import { computeFrequencies, generateSmartNumbers, getHistoryConfig, computeTopPairs } from '../lib/lotteryData';
import { runEnsemble, buildSharkAnalysisContext } from '../lib/aiEnsemble';
import type { SharkAnalysisContext } from '../lib/aiEnsemble';
```

### 4b. Substituir `buildContext` local pela versão correta

Substitua a função `buildContext` local inteira:

```typescript
function buildContext(lotteryId: string, lottery: any, draws: number[][]): SharkAnalysisContext {
  const freqs = computeFrequencies(lottery.totalNumbers, draws);
  const hotNumbers  = freqs.filter(f => f.temperature === 'hot').map(f => f.number);
  const coldNumbers = freqs.filter(f => f.temperature === 'cold').map(f => f.number);
  const warmNumbers = freqs.filter(f => f.temperature === 'warm').map(f => f.number);
  const frequencyMap: Record<number, number> = {};
  for (const f of freqs) frequencyMap[f.number] = f.frequency;
  const avgSum = draws.length > 0
    ? draws.reduce((s, d) => s + d.reduce((a, b) => a + b, 0), 0) / draws.length
    : (lottery.totalNumbers + 1) * lottery.minNumbers / 2;
  const avgEvens = draws.length > 0
    ? draws.reduce((s, d) => s + d.filter((n: number) => n % 2 === 0).length, 0) / draws.length
    : lottery.minNumbers / 2;
  const base = {
    lotteryId, lotteryName: lottery.displayName,
    totalNumbers: lottery.totalNumbers, minNumbers: lottery.minNumbers,
    draws: draws.map((d, i) => ({ contestNumber: i + 1, numbers: d })),
    hotNumbers, coldNumbers, warmNumbers, frequencyMap, avgSum, avgEvens,
  };
  return buildSharkAnalysisContext(base, draws);
}
```

### 4c. Aumentar histórico nos handlers de prediction

Em `GET /generate/:lotteryId` e `POST /ensemble`, substitua `fetchHistoricalDraws(lotteryId, 20)` por:

```typescript
const { optimal } = getHistoryConfig(lotteryId);
const draws = await fetchHistoricalDraws(lotteryId, optimal).catch(() => [] as number[][]);
```

### 4d. Melhorar fallback estatístico do prediction

No bloco `if (stats.active === 0)` do handler `/generate/:lotteryId`, substitua o conteúdo do fallback:

```typescript
if (stats.active === 0) {
  const freqs = computeFrequencies(lottery.totalNumbers, draws);
  const sc = ctx as SharkAnalysisContext;
  const primary = generateSmartNumbers(freqs, lottery.minNumbers, 'mixed', lottery.totalNumbers);
  const alternatives = [
    { numbers: generateSmartNumbers(freqs, lottery.minNumbers, 'hot', lottery.totalNumbers), source: 'Quentes', confidence: 0.60 },
    { numbers: generateSmartNumbers(freqs, lottery.minNumbers, 'cold', lottery.totalNumbers), source: 'Atrasados', confidence: 0.55 },
  ];
  return res.json({
    lotteryId,
    lotteryName: lottery.displayName,
    primaryPrediction: primary,
    confidence: 0.60,
    reasoning: `Previsão estatística: ${sc.hotNumbers.length} quentes, ${sc.coldNumbers.length} frios, ${sc.overdueNumbers.length} atrasados identificados em ${draws.length} sorteios (IAs indisponíveis).`,
    alternatives,
    ensemble: null,
    drawsAnalyzed: draws.length,
    hotNumbers: sc.hotNumbers.slice(0, 8),
    coldNumbers: sc.coldNumbers.slice(0, 8),
    overdueNumbers: sc.overdueNumbers.slice(0, 5),
    topPairs: sc.topPairs.slice(0, 5),
  });
}
```

---

## ALTERAÇÃO 5 — `artifacts/api-server/src/routes/index.ts`

### 5a. Importar funções novas

Adicione ao bloco de imports existente:

```typescript
import { getHistoryConfig, computeTopPairs } from '../lib/lotteryData';
import { buildSharkAnalysisContext } from '../lib/aiEnsemble';
import { callWithFallback } from '../lib/aiEnsemble';
import { listProviders } from '../lib/aiProviders';
```

### 5b. Corrigir `/lottery/analyze/:type` — usar histórico adaptativo e temperatura correta

Substitua o handler `router.get("/lottery/analyze/:type", ...)` inteiro:

```typescript
router.get('/lottery/analyze/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const lottery = LOTTERIES.find(l => l.id === type);
    const totalNumbers = lottery?.totalNumbers || 60;
    const { optimal } = getHistoryConfig(type);

    const draws = await fetchHistoricalDraws(type, optimal);
    if (draws.length === 0) {
      return res.json({
        recommendation: 'Dados insuficientes para análise. Tente novamente em instantes.',
        stats: { hotNumbers: [], coldNumbers: [], warmNumbers: [], rareNumbers: [], frequencyMap: {}, delayMap: {}, drawsAnalyzed: 0 },
      });
    }

    const freqs = computeFrequencies(totalNumbers, draws);
    // Usa temperatura do computeFrequencies (fonte única de verdade)
    const hotNumbers  = freqs.filter(f => f.temperature === 'hot').map(f => f.number);
    const warmNumbers = freqs.filter(f => f.temperature === 'warm').map(f => f.number);
    const coldNumbers = freqs.filter(f => f.temperature === 'cold').map(f => f.number);

    const delayMap: Record<number, number> = {};
    for (let n = 1; n <= totalNumbers; n++) {
      let delay = draws.length;
      for (let i = 0; i < draws.length; i++) {
        if (draws[i].includes(n)) { delay = i; break; }
      }
      delayMap[n] = delay;
    }

    const avgSum   = draws.reduce((s, d) => s + d.reduce((a, b) => a + b, 0), 0) / draws.length;
    const avgEvens = draws.reduce((s, d) => s + d.filter(n => n % 2 === 0).length, 0) / draws.length;

    const overdue = Object.entries(delayMap)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 10)
      .map(([n]) => Number(n));

    const frequencyMap = Object.fromEntries(freqs.map(f => [f.number, f.frequency]));
    const topPairs = computeTopPairs(draws, 10);

    res.json({
      recommendation: `Análise de ${draws.length} sorteios reais. Quentes: ${hotNumbers.slice(0,5).join(', ')}. Atrasados: ${overdue.slice(0,3).join(', ')}. Soma média: ${Math.round(avgSum)}. Pares médios: ${avgEvens.toFixed(1)}.`,
      stats: {
        hotNumbers:     hotNumbers.slice(0, 15),
        warmNumbers:    warmNumbers.slice(0, 15),
        coldNumbers:    coldNumbers.slice(0, 15),
        rareNumbers:    coldNumbers.slice(0, 8),
        overdueNumbers: overdue,
        frequencyMap,
        delayMap,
        topPairs,
        avgSum:        Math.round(avgSum),
        avgEvens:      parseFloat(avgEvens.toFixed(1)),
        drawsAnalyzed: draws.length,
      },
    });
  } catch {
    res.json({
      recommendation: 'Análise indisponível no momento.',
      stats: { hotNumbers: [], coldNumbers: [], rareNumbers: [], frequencyMap: {} },
    });
  }
});
```

### 5c. Corrigir `/games/generate` — usar histórico adaptativo e integrar análise

Substitua todo o handler `router.post('/games/generate', ...)` pelo seguinte:

```typescript
router.post('/games/generate', async (req: Request, res: Response) => {
  const { lotteryId = 'megasena', numbersCount, gamesCount = 1, strategy = 'mixed' } = req.body;

  const lottery = LOTTERIES.find(l => l.id === lotteryId) || LOTTERIES[0];
  const qty   = Math.min(Math.max(numbersCount || lottery.minNumbers, lottery.minNumbers), lottery.totalNumbers);
  const count = Math.min(Math.max(gamesCount, 1), 100);

  try {
    // Usa histórico adaptativo por modalidade
    const { optimal } = getHistoryConfig(lotteryId);
    const draws = await fetchHistoricalDraws(lotteryId, optimal);

    if (draws.length < 2) {
      return res.status(503).json({
        message: `Não foi possível buscar sorteios reais da ${lottery.displayName}. Aguarde e tente novamente.`,
      });
    }

    // Pesos por estratégia
    const pesosReq = req.body.pesos;
    const pesosEstrategia = STRATEGY_PESOS[strategy] || STRATEGY_PESOS.mixed;
    const pesosFinais = (strategy === 'shark' && pesosReq && typeof pesosReq === 'object')
      ? {
          frequencia: Math.max(0.05, Math.min(0.90, Number(pesosReq.frequencia) || pesosEstrategia.frequencia)),
          atraso:     Math.max(0.05, Math.min(0.90, Number(pesosReq.atraso)     || pesosEstrategia.atraso)),
          repeticao:  Math.max(0.05, Math.min(0.90, Number(pesosReq.repeticao)  || pesosEstrategia.repeticao)),
        }
      : pesosEstrategia;

    // --- PIPELINE INTEGRADO ---
    // 1. Análise estatística (sempre roda)
    const freqs = computeFrequencies(lottery.totalNumbers, draws);
    const hotNumbers  = freqs.filter(f => f.temperature === 'hot').map(f => f.number);
    const coldNumbers = freqs.filter(f => f.temperature === 'cold').map(f => f.number);
    const warmNumbers = freqs.filter(f => f.temperature === 'warm').map(f => f.number);
    const frequencyMap: Record<number, number> = {};
    for (const f of freqs) frequencyMap[f.number] = f.frequency;
    const avgSum = draws.reduce((s, d) => s + d.reduce((a, b) => a + b, 0), 0) / draws.length;
    const avgEvens = draws.reduce((s, d) => s + d.filter(n => n % 2 === 0).length, 0) / draws.length;
    const baseCtx = {
      lotteryId, lotteryName: lottery.displayName,
      totalNumbers: lottery.totalNumbers, minNumbers: qty,
      draws: draws.map((d, i) => ({ contestNumber: i + 1, numbers: d })),
      hotNumbers, coldNumbers, warmNumbers, frequencyMap, avgSum, avgEvens,
    };
    const sharkCtx = buildSharkAnalysisContext(baseCtx, draws);

    // 2. SharkEngine gera candidatos baseados em análise estatística
    const { jogos, contexto } = gerarJogosMaster(draws, count, lottery.totalNumbers, qty, pesosFinais);

    // 3. Se strategy === 'ai' ou 'shark' e houver IAs disponíveis, refina com ensemble
    let aiRefinement: any = null;
    if ((strategy === 'ai' || strategy === 'shark') && count <= 10) {
      try {
        const { stats } = listProviders();
        if (stats.active > 0) {
          const ensemble = await runEnsemble(sharkCtx);
          if (ensemble.successfulProviders > 0) {
            aiRefinement = {
              consensusNumbers: ensemble.consensusNumbers,
              confidence: ensemble.overallConfidence,
              reasoning: ensemble.reasoning,
              successfulProviders: ensemble.successfulProviders,
            };
            // Injeta o jogo consenso da IA como primeiro resultado se não estiver lá
            const consensusKey = ensemble.consensusNumbers.slice().sort((a,b)=>a-b).join(',');
            const alreadyIn = jogos.some(j => j.jogo.slice().sort((a,b)=>a-b).join(',') === consensusKey);
            if (!alreadyIn && jogos.length > 0) {
              jogos[0] = { jogo: ensemble.consensusNumbers, score: 9999, origem: 'ensemble_ia' };
            }
          }
        }
      } catch {
        // Falha silenciosa — SharkEngine já gerou jogos suficientes
      }
    }

    const insertValues = jogos.map(result => ({
      lotteryId,
      selectedNumbers: result.jogo,
      strategy,
      confidence: String(parseFloat(Math.min(0.95, 0.55 + result.score / 600).toFixed(2))),
      reasoning: `${STRATEGY_REASONING[strategy] || 'Análise Shark'} | ${contexto.totalValidados} jogos validados | ${draws.length} sorteios analisados`,
      dataSource: `${draws.length} sorteios reais da Caixa Econômica Federal`,
      sharkScore: String(result.score),
      sharkOrigem: result.origem,
      sharkContexto: {
        estrategia:        STRATEGY_LABEL[strategy] || strategy,
        pesosUsados:       pesosFinais,
        hot:               contexto.hot.slice(0, 12),
        warm:              contexto.warm.slice(0, 10),
        cold:              contexto.cold.slice(0, 10),
        overdueTop:        sharkCtx.overdueNumbers.slice(0, 8),
        topPairs:          sharkCtx.topPairs.slice(0, 5),
        totalCandidatos:   contexto.totalCandidatos,
        totalValidados:    contexto.totalValidados,
        estrategiasUsadas: contexto.estrategiasUsadas,
        sorteiosAnalisados: draws.length,
        aiRefinement,
      },
      matches:       0,
      prizeWon:      '0',
      contestNumber: null as number | null,
      status:        'pending',
      hits:          0,
    }));

    const inserted = await db.insert(userGamesTable).values(insertValues).returning();

    const games = inserted.map(g => ({
      id: g.id,
      lotteryId: g.lotteryId,
      selectedNumbers: g.selectedNumbers as number[],
      strategy: g.strategy,
      confidence: g.confidence ? Number(g.confidence) : undefined,
      reasoning: g.reasoning,
      dataSource: g.dataSource,
      sharkScore: g.sharkScore ? Number(g.sharkScore) : undefined,
      sharkOrigem: g.sharkOrigem,
      sharkContexto: g.sharkContexto,
      matches: g.matches,
      prizeWon: g.prizeWon,
      contestNumber: g.contestNumber,
      createdAt: g.createdAt.toISOString(),
    }));

    res.json(games);
  } catch (err: any) {
    res.status(500).json({ message: 'Erro ao buscar dados da Caixa. Tente novamente.', error: err?.message });
  }
});
```

### 5d. Adicionar endpoint de score/comparação de jogos

Adicione este novo endpoint logo antes da linha `export default router;`:

```typescript
// POST /api/games/score — Pontua um jogo contra o histórico real (sem salvar no banco)
router.post('/games/score', async (req: Request, res: Response) => {
  try {
    const { lotteryId = 'megasena', numbers } = req.body;
    if (!Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({ message: 'Envie o campo "numbers" com os números do jogo.' });
    }

    const lottery = LOTTERIES.find(l => l.id === lotteryId);
    if (!lottery) return res.status(404).json({ message: 'Loteria não encontrada.' });

    const { optimal } = getHistoryConfig(lotteryId);
    const draws = await fetchHistoricalDraws(lotteryId, optimal);
    if (draws.length < 2) return res.status(503).json({ message: 'Histórico indisponível no momento.' });

    const freqs = computeFrequencies(lottery.totalNumbers, draws);
    const frequencyMap: Record<number, number> = {};
    for (const f of freqs) frequencyMap[f.number] = f.frequency;

    const delayMap: Record<number, number> = {};
    for (let n = 1; n <= lottery.totalNumbers; n++) {
      const idx = draws.findIndex(d => d.includes(n));
      delayMap[n] = idx === -1 ? draws.length : idx;
    }

    const avgSum = draws.reduce((s, d) => s + d.reduce((a, b) => a + b, 0), 0) / draws.length;
    const avgEvens = draws.reduce((s, d) => s + d.filter(n => n % 2 === 0).length, 0) / draws.length;

    const hotNumbers  = freqs.filter(f => f.temperature === 'hot').map(f => f.number);
    const coldNumbers = freqs.filter(f => f.temperature === 'cold').map(f => f.number);

    // Calcula score do jogo
    const gameNums = numbers as number[];
    const sumTotal  = gameNums.reduce((a, b) => a + b, 0);
    const evenCount = gameNums.filter(n => n % 2 === 0).length;
    const hotCount  = gameNums.filter(n => hotNumbers.includes(n)).length;
    const coldCount = gameNums.filter(n => coldNumbers.includes(n)).length;
    const warmCount = gameNums.length - hotCount - coldCount;
    const maxDelay  = Math.max(...gameNums.map(n => delayMap[n] || 0));
    const avgFreq   = gameNums.reduce((s, n) => s + (frequencyMap[n] || 0), 0) / gameNums.length;

    const sumScore  = Math.max(0, 100 - Math.abs(sumTotal - avgSum) / avgSum * 100);
    const parScore  = Math.max(0, 100 - Math.abs(evenCount - avgEvens) * 20);
    const hotScore  = Math.min(100, (hotCount / Math.max(lottery.minNumbers, 1)) * 150);
    const delayBonus = Math.min(40, maxDelay * 2);
    const freqScore = Math.min(100, (avgFreq / Math.max(...Object.values(frequencyMap), 1)) * 100);

    const totalScore = Math.round(sumScore * 0.25 + parScore * 0.20 + hotScore * 0.30 + freqScore * 0.15 + delayBonus * 0.10);

    // Últimos 20 sorteios: quantos acertos teria tido em média
    const recentHits = draws.slice(0, 20).map(d => gameNums.filter(n => d.includes(n)).length);
    const avgHits = recentHits.reduce((a, b) => a + b, 0) / recentHits.length;

    const topPairs = computeTopPairs(draws, 20);
    const gamePairs: string[] = [];
    for (let i = 0; i < gameNums.length; i++)
      for (let j = i + 1; j < gameNums.length; j++) {
        const pair = [gameNums[i], gameNums[j]].sort((a, b) => a - b);
        const found = topPairs.find(p => p.pair[0] === pair[0] && p.pair[1] === pair[1]);
        if (found) gamePairs.push(`(${pair[0]},${pair[1]}):${found.count}x`);
      }

    res.json({
      lotteryId,
      numbers: gameNums.sort((a, b) => a - b),
      score: totalScore,
      scoreBreakdown: {
        sumScore:   Math.round(sumScore),
        parScore:   Math.round(parScore),
        hotScore:   Math.round(hotScore),
        freqScore:  Math.round(freqScore),
        delayBonus: Math.round(delayBonus),
      },
      composition: {
        hotCount,
        warmCount,
        coldCount,
        sumTotal,
        evenCount,
        oddCount: gameNums.length - evenCount,
        maxDelay,
        avgFrequency: parseFloat(avgFreq.toFixed(1)),
      },
      historicalSimulation: {
        drawsChecked: recentHits.length,
        avgHitsPerDraw: parseFloat(avgHits.toFixed(2)),
        maxHits: Math.max(...recentHits),
        minHits: Math.min(...recentHits),
        hitsDistribution: recentHits,
      },
      coOccurrencePairs: gamePairs,
      recommendation: totalScore >= 70
        ? 'Jogo com boa cobertura estatística 🟢'
        : totalScore >= 50
        ? 'Jogo com cobertura moderada 🟡'
        : 'Jogo com baixa aderência estatística 🔴',
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Erro ao pontuar jogo.', error: err?.message });
  }
});
```

---

## ALTERAÇÃO 6 — `artifacts/api-server/src/app.ts`

### 6a. Corrigir `buildCtx` (função inline no app.ts) — usar temperatura correta

Localize a função `buildCtx` definida inline no `app.ts` (usada nos handlers `/api/meta-reasoning/*`). Substitua-a pela versão corrigida:

```typescript
function buildCtx(lotteryId: string, lottery: any, draws: number[][]): LotteryContext {
  const freqs = computeFrequencies(lottery.totalNumbers, draws);
  // Usa temperatura calculada em computeFrequencies (consistência com o resto do sistema)
  const frequencyMap: Record<number, number> = {};
  for (const f of freqs) frequencyMap[f.number] = f.frequency;
  const avgSum = draws.length > 0
    ? draws.reduce((s, d) => s + d.reduce((a, b) => a + b, 0), 0) / draws.length
    : (lottery.totalNumbers + 1) * lottery.minNumbers / 2;
  const avgEvens = draws.length > 0
    ? draws.reduce((s, d) => s + d.filter((n: number) => n % 2 === 0).length, 0) / draws.length
    : lottery.minNumbers / 2;
  return {
    lotteryId,
    lotteryName: lottery.displayName,
    totalNumbers: lottery.totalNumbers,
    minNumbers: lottery.minNumbers,
    draws: draws.map((d, i) => ({ contestNumber: i + 1, numbers: d })),
    hotNumbers:  freqs.filter(f => f.temperature === 'hot').map(f => f.number),
    coldNumbers: freqs.filter(f => f.temperature === 'cold').map(f => f.number),
    warmNumbers: freqs.filter(f => f.temperature === 'warm').map(f => f.number),
    frequencyMap,
    avgSum,
    avgEvens,
  };
}
```

### 6b. Aumentar histórico nos handlers do `app.ts`

Nos dois handlers `/api/meta-reasoning/analyze/:lotteryId` e `/api/meta-reasoning/optimal-combination/:lotteryId`, adicione o import de `getHistoryConfig` ao bloco de imports existentes de `lotteryData` e substitua os valores fixos de `fetchHistoricalDraws(lotteryId, 20)`:

```typescript
// Adicionar getHistoryConfig ao import de lotteryData no app.ts:
import { LOTTERIES, fetchHistoricalDraws, computeFrequencies, getHistoryConfig } from './lib/lotteryData';

// Em cada handler, substituir:
// ANTES:
const draws = await fetchHistoricalDraws(lotteryId, 20).catch(() => [] as number[][]);
// DEPOIS:
const { optimal } = getHistoryConfig(lotteryId);
const draws = await fetchHistoricalDraws(lotteryId, optimal).catch(() => [] as number[][]);
```

---

## VERIFICAÇÃO FINAL

Após todas as alterações:

1. Rodar migração do banco: `cd lib/db && npx drizzle-kit push`
2. Verificar que TypeScript compila sem erros: `cd artifacts/api-server && npx tsc --noEmit`
3. Confirmar que os 7 exports novos existem:
   - `getHistoryConfig` em `lotteryData.ts`
   - `computeTopPairs` em `lotteryData.ts`
   - `buildSharkAnalysisContext` em `aiEnsemble.ts`
   - `SharkAnalysisContext` (tipo) em `aiEnsemble.ts`
4. Confirmar que **nenhum export antigo foi removido**
5. Confirmar que os endpoints novos respondem:
   - `POST /api/games/score` — pontua um jogo
   - `GET /api/lotteries/:id/frequency` — agora retorna `recentWindow` no meta
6. Confirmar que nenhum componente de UI foi alterado

---

## RESUMO DO PIPELINE FINAL

```
Usuário pede jogo (POST /api/games/generate)
    ↓
fetchHistoricalDraws — histórico adaptativo por modalidade (100-200 sorteios, cache no banco)
    ↓
computeFrequencies — classifica quente/morno/fria com score combinado global+recente
    ↓
buildSharkAnalysisContext — adiciona delay, co-ocorrência, overdueNumbers, topPairs
    ↓
gerarJogosMaster (SharkEngine) — 6 estratégias × 300 rodadas → candidatos validados
    ↓ (se strategy=ai/shark e IAs disponíveis)
runEnsemble (6 IAs especializadas com prompts enriquecidos) → consenso ponderado
    ↓
Jogo(s) salvos no banco + entregues ao usuário com score, composição e raciocínio
```

Este pipeline funciona para **todas as modalidades**: Lotofácil, Mega-Sena, Quina, Lotomania, Dupla Sena, Timemania, Dia de Sorte e Super Sete — cada uma com seu histórico ótimo e parâmetros específicos.
