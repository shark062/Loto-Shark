# 🦈 PROMPT PARA O REPLIT — LOTO SHARK: NOVA LÓGICA DE GERAÇÃO

> **Instruções de uso:** Cole este prompt inteiro no agente do Replit (ou no chat do AI do projeto). Ele contém tudo que o agente precisa saber: o que fazer, por que fazer, e os trechos exatos a substituir.

---

## CONTEXTO E OBJETIVO

Este projeto é o Loto Shark, um gerador de jogos de loteria. A lógica atual classifica números em **quentes / mornos / frios** usando apenas frequência absoluta nos sorteios históricos.

Preciso mudar a lógica principal para uma abordagem de **variação entre números quentes (alta frequência recente) e dezenas frias (alto atraso/ausência)**. O fluxo novo é:

1. Analisar dados históricos calculando **frequência recente** E **atraso atual** de cada número
2. Classificar: **quente** = alta freq nos últimos sorteios | **fria** = muitos sorteios consecutivos sem aparecer
3. Antes de entregar os jogos finais, executar o **desdobramento automático** do pool quente+frio
4. Filtrar e pontuar as combinações do desdobramento para entregar os jogos com maior margem de acerto

**REGRA FUNDAMENTAL: Não quebrar nenhuma interface existente.** Todas as rotas da API, nomes de campos do banco de dados, e componentes React devem continuar funcionando. As mudanças são **somente** na lógica interna do motor e nas funções de geração.

---

## ARQUIVOS A MODIFICAR

Apenas estes 2 arquivos devem ser alterados. Nenhum outro.

1. `artifacts/api-server/src/core/sharkEngine.ts`
2. `artifacts/api-server/src/routes/index.ts`

---

## ARQUIVO 1 — SUBSTITUIÇÃO COMPLETA

### `artifacts/api-server/src/core/sharkEngine.ts`

**Substitua o conteúdo COMPLETO deste arquivo pelo código abaixo:**

```typescript
// ============================================================
//  Shark Engine v2 — Motor Master com Variação Quente/Fria
//  Lógica: frequência recente (quente) + atraso acumulado (fria)
//  Fluxo: análise → desdobramento → score → entrega
// ============================================================

export interface SharkPesos {
  frequencia: number;
  atraso:     number;
  repeticao:  number;
}

const PESOS_PADRAO: SharkPesos = {
  frequencia: 0.50,
  atraso:     0.30,
  repeticao:  0.20,
};

export interface SharkContext {
  frequency:      Record<number, number>;
  recentFrequency: Record<number, number>; // freq nos últimos 10 sorteios
  delay:          Record<number, number>;
  lastDraw:       number[];
  // Mantém hot/warm/cold para compatibilidade com respostas da API
  hot:  number[]; // alta frequência recente — números quentes
  warm: number[]; // frequência intermediária
  cold: number[]; // alto atraso — dezenas frias
  totalNumbers: number;
  minNumbers:   number;
}

export interface SharkResult {
  jogo:   number[];
  score:  number;
  origem: string;
}

export interface MasterOutput {
  jogos: SharkResult[];
  contexto: {
    hot:  number[];
    warm: number[];
    cold: number[];
    totalCandidatos: number;
    totalValidados:  number;
    estrategiasUsadas: string[];
  };
}

export interface DesdobramentoOutput {
  combinacoes: number[][];
  total:       number;
  poolUsado:   number[];
}

// ============================================================
//  Utilitários
// ============================================================

function pick(arr: number[], n: number): number[] {
  return shuffle([...arr]).slice(0, Math.min(n, arr.length));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function dedup(jogo: number[]): number[] {
  return [...new Set(jogo)];
}

// ============================================================
//  1. CONTEXTO COM VARIAÇÃO QUENTE/FRIA
//  - Quente = alta frequência nos últimos 10 sorteios (recência)
//  - Fria   = maior número de sorteios consecutivos sem aparecer (atraso)
//  - Morna  = frequência/atraso intermediários (faixa do meio)
// ============================================================

function buildContextCompleto(
  draws: number[][],
  totalNumbers: number,
  minNumbers: number,
): SharkContext {
  const frequency: Record<number, number>       = {};
  const recentFrequency: Record<number, number> = {};
  const delay: Record<number, number>           = {};
  const lastDraw = draws[0] || [];

  // Frequência global
  draws.forEach(draw => {
    draw.forEach(n => {
      frequency[n] = (frequency[n] || 0) + 1;
    });
  });

  // Frequência recente: apenas os últimos 10 sorteios
  const recentDraws = draws.slice(0, Math.min(10, draws.length));
  recentDraws.forEach(draw => {
    draw.forEach(n => {
      recentFrequency[n] = (recentFrequency[n] || 0) + 1;
    });
  });

  // Atraso: quantos sorteios consecutivos o número ficou ausente
  for (let n = 1; n <= totalNumbers; n++) {
    const idx = draws.findIndex(d => d.includes(n));
    delay[n] = idx === -1 ? draws.length : idx;
  }

  const numeros = Array.from({ length: totalNumbers }, (_, i) => i + 1);

  // --- Classificação QUENTE: ordenar por frequência recente (últimos 10)
  const sortedByRecent = [...numeros].sort(
    (a, b) => (recentFrequency[b] || 0) - (recentFrequency[a] || 0)
  );

  // --- Classificação FRIA: ordenar por maior atraso (mais sorteios ausente)
  const sortedByDelay = [...numeros].sort(
    (a, b) => (delay[b] || 0) - (delay[a] || 0)
  );

  // Top 33% em frequência recente = quentes
  // Top 33% em atraso = frias
  // Resto = mornas
  const hotCut  = Math.floor(totalNumbers * 0.33);
  const coldCut = Math.floor(totalNumbers * 0.33);

  const hotSet  = new Set(sortedByRecent.slice(0, hotCut));
  const coldSet = new Set(sortedByDelay.slice(0, coldCut));

  // Remove overlap: se um número é quente E frio (borda), fica no que tem maior score
  const hot:  number[] = [];
  const cold: number[] = [];
  const warm: number[] = [];

  for (const n of numeros) {
    const isHotCandidate  = hotSet.has(n);
    const isColdCandidate = coldSet.has(n);

    if (isHotCandidate && !isColdCandidate) {
      hot.push(n);
    } else if (isColdCandidate && !isHotCandidate) {
      cold.push(n);
    } else if (isHotCandidate && isColdCandidate) {
      // Desempate: maior frequência recente vira quente, senão fria
      (recentFrequency[n] || 0) >= 2 ? hot.push(n) : cold.push(n);
    } else {
      warm.push(n);
    }
  }

  return {
    frequency,
    recentFrequency,
    delay,
    lastDraw,
    hot,
    warm,
    cold,
    totalNumbers,
    minNumbers,
  };
}

// ============================================================
//  2. VALIDAÇÃO (mantida — regras universais de loteria)
// ============================================================

function validarJogo(jogo: number[], totalNumbers: number, minNumbers: number): boolean {
  if (jogo.length !== minNumbers) return false;
  if (new Set(jogo).size !== jogo.length) return false;
  if (jogo.some(n => n < 1 || n > totalNumbers)) return false;

  const pares = jogo.filter(n => n % 2 === 0).length;
  const minPares = Math.floor(minNumbers * 0.25);
  const maxPares = Math.ceil(minNumbers * 0.75);
  if (pares < minPares || pares > maxPares) return false;

  const sorted = [...jogo].sort((a, b) => a - b);
  let maxSeq = 0;
  let seq = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      seq++;
      maxSeq = Math.max(maxSeq, seq);
    } else {
      seq = 1;
    }
  }
  const maxSeqPermitida = Math.ceil(minNumbers * 0.35);
  if (maxSeq > maxSeqPermitida) return false;

  return true;
}

// ============================================================
//  3. SCORE v2 — Premia variação quente + fria no mesmo jogo
//  Lógica: jogo ideal = mistura de números quentes (momentum)
//  + dezenas frias (compensação estatística de atraso)
// ============================================================

function scoreCompleto(jogo: number[], ctx: SharkContext, pesos: SharkPesos = PESOS_PADRAO): number {
  let score = 0;

  jogo.forEach(n => {
    // Frequência recente tem peso maior (mais relevante que histórico total)
    score += (ctx.recentFrequency[n] || 0) * pesos.frequencia * 15;

    // Atraso: números com alto atraso são bonificados (probabilidade de compensação)
    score += (ctx.delay[n] || 0) * pesos.atraso * 8;
  });

  // Bônus de variação: jogo com pelo menos 1 quente E 1 fria recebe bônus extra
  const temQuente = jogo.some(n => ctx.hot.includes(n));
  const temFria   = jogo.some(n => ctx.cold.includes(n));
  if (temQuente && temFria) score += 40;

  // Proporção ideal: ~40% quentes, ~30% frias no jogo
  const qtdQuentes = jogo.filter(n => ctx.hot.includes(n)).length;
  const qtdFrias   = jogo.filter(n => ctx.cold.includes(n)).length;
  const propQ = qtdQuentes / ctx.minNumbers;
  const propF = qtdFrias   / ctx.minNumbers;
  if (propQ >= 0.30 && propQ <= 0.55) score += 25;
  if (propF >= 0.20 && propF <= 0.45) score += 25;

  // Paridade (regra universal de loteria)
  const pares = jogo.filter(n => n % 2 === 0).length;
  const idealPares = ctx.minNumbers / 2;
  if (Math.abs(pares - idealPares) <= 1) score += 20;

  // Repetição controlada do último sorteio
  const repetidos = jogo.filter(n => ctx.lastDraw.includes(n)).length;
  const repIdeal  = ctx.minNumbers * pesos.repeticao * 2;
  const repDiff   = Math.abs(repetidos - repIdeal);
  score += Math.max(0, 30 - repDiff * 4) * (pesos.repeticao * 3);

  return Math.round(score);
}

// ============================================================
//  4. ESTRATÉGIAS DE GERAÇÃO — todas usam variação quente/fria
// ============================================================

// Estratégia IMPULSO: maioria quentes + minoria frias (momentum + surpresa)
function gerarImpulso(ctx: SharkContext): number[] {
  const { hot, cold, warm, minNumbers } = ctx;
  const hotQ  = Math.ceil(minNumbers * 0.50);
  const coldQ = Math.ceil(minNumbers * 0.25);
  const warmQ = minNumbers - hotQ - coldQ;
  return dedup([
    ...pick(hot,  hotQ),
    ...pick(cold, coldQ),
    ...pick(warm, warmQ),
  ]).slice(0, minNumbers);
}

// Estratégia COMPENSAÇÃO: maioria frias + minoria quentes (dezenas vencidas)
function gerarCompensacao(ctx: SharkContext): number[] {
  const { hot, cold, warm, minNumbers } = ctx;
  const coldQ = Math.ceil(minNumbers * 0.50);
  const hotQ  = Math.ceil(minNumbers * 0.25);
  const warmQ = minNumbers - coldQ - hotQ;
  return dedup([
    ...pick(cold, coldQ),
    ...pick(hot,  hotQ),
    ...pick(warm, warmQ),
  ]).slice(0, minNumbers);
}

// Estratégia VARIAÇÃO PURA: equilíbrio exato quente/fria/morna
function gerarVariacaoPura(ctx: SharkContext): number[] {
  const { hot, cold, warm, minNumbers } = ctx;
  const terco = Math.floor(minNumbers / 3);
  const resto = minNumbers - terco * 2;
  return dedup([
    ...pick(hot,  terco),
    ...pick(cold, terco),
    ...pick(warm, resto),
  ]).slice(0, minNumbers);
}

// Estratégia PESO DINÂMICO: pondera freq recente + atraso por número
function gerarPorPeso(ctx: SharkContext, pesos: SharkPesos = PESOS_PADRAO): number[] {
  const { recentFrequency, delay, totalNumbers, minNumbers } = ctx;
  const nums = Array.from({ length: totalNumbers }, (_, i) => i + 1);

  const ranked = nums
    .map(n => ({
      n,
      peso: (recentFrequency[n] || 0) * pesos.frequencia * 15
          + (delay[n]            || 0) * pesos.atraso     * 8,
    }))
    .sort((a, b) => b.peso - a.peso);

  // Pega top 50% por peso e embaralha para diversidade
  const top = ranked.slice(0, Math.floor(totalNumbers * 0.5)).map(p => p.n);
  return pick(top, minNumbers);
}

// Estratégia ALTA REPETIÇÃO: repete ~60% do último sorteio + frias
function gerarRepInteligente(ctx: SharkContext): number[] {
  const { lastDraw, cold, totalNumbers, minNumbers } = ctx;
  const repQ  = Math.ceil(minNumbers * 0.50);
  const friaQ = Math.ceil(minNumbers * 0.25);

  const repetidos   = lastDraw.length >= repQ ? pick(lastDraw, repQ) : [...lastDraw];
  const frias       = cold.filter(n => !repetidos.includes(n));
  const friasEsc    = pick(frias, friaQ);
  const todos       = Array.from({ length: totalNumbers }, (_, i) => i + 1);
  const disponiveis = todos.filter(n => !repetidos.includes(n) && !friasEsc.includes(n));
  const novos       = pick(disponiveis, minNumbers - repetidos.length - friasEsc.length);

  return dedup([...repetidos, ...friasEsc, ...novos]).slice(0, minNumbers);
}

// Estratégia BAIXA REPETIÇÃO: poucos repetidos, força quentes + frias novas
function gerarRepBaixa(ctx: SharkContext): number[] {
  const { lastDraw, hot, cold, totalNumbers, minNumbers } = ctx;
  const repQ  = Math.ceil(minNumbers * 0.20);
  const hotQ  = Math.ceil(minNumbers * 0.40);
  const coldQ = Math.ceil(minNumbers * 0.25);

  const repetidos   = lastDraw.length >= repQ ? pick(lastDraw, repQ) : [...lastDraw];
  const quentes     = hot.filter(n => !repetidos.includes(n));
  const frias       = cold.filter(n => !repetidos.includes(n));
  const quentesEsc  = pick(quentes, hotQ);
  const friasEsc    = pick(frias,   coldQ);
  const todos       = Array.from({ length: totalNumbers }, (_, i) => i + 1);
  const resto       = todos.filter(n =>
    !repetidos.includes(n) && !quentesEsc.includes(n) && !friasEsc.includes(n)
  );
  const novos = pick(resto, minNumbers - repetidos.length - quentesEsc.length - friasEsc.length);

  return dedup([...repetidos, ...quentesEsc, ...friasEsc, ...novos]).slice(0, minNumbers);
}

// ============================================================
//  5. GERAÇÃO MULTI-ESTRATÉGIA
// ============================================================

const ESTRATEGIAS = [
  { nome: 'impulso',       fn: gerarImpulso },
  { nome: 'compensacao',   fn: gerarCompensacao },
  { nome: 'variacao_pura', fn: gerarVariacaoPura },
  { nome: 'peso',          fn: gerarPorPeso },
  { nome: 'rep_alta',      fn: gerarRepInteligente },
  { nome: 'rep_baixa',     fn: gerarRepBaixa },
];

function gerarMultiplasEstrategias(
  ctx: SharkContext,
  rodadas: number = 300,
  pesos: SharkPesos = PESOS_PADRAO,
): Array<{ jogo: number[]; origem: string }> {
  const candidatos: Array<{ jogo: number[]; origem: string }> = [];

  for (let i = 0; i < rodadas; i++) {
    for (const { nome, fn } of ESTRATEGIAS) {
      const raw = (nome === 'peso'
        ? gerarPorPeso(ctx, pesos)
        : fn(ctx)
      ).sort((a, b) => a - b);
      candidatos.push({ jogo: raw, origem: nome });
    }
  }

  return candidatos;
}

// ============================================================
//  6. DESDOBRAMENTO INTERNO — núcleo do novo fluxo
//  Pool = union dos melhores candidatos quentes + frias
//  Gera todas as combinações C(pool, minNumbers) e pontua
// ============================================================

function combinacoes(arr: number[], k: number, limite: number): number[][] {
  const result: number[][] = [];

  function backtrack(start: number, current: number[]) {
    if (result.length >= limite) return;
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      if (result.length >= limite) break;
      current.push(arr[i]);
      backtrack(i + 1, current);
      current.pop();
    }
  }

  backtrack(0, []);
  return result;
}

function buildPoolQuenteFria(ctx: SharkContext, qtdJogos: number): number[] {
  // Pool: top quentes por freq recente + top frias por atraso
  // Tamanho do pool varia com a quantidade de jogos pedidos (mínimo útil: minNumbers * 1.5)
  const poolSize = Math.min(
    ctx.totalNumbers,
    Math.max(
      Math.ceil(ctx.minNumbers * 2.5),
      Math.ceil(qtdJogos * ctx.minNumbers * 0.4),
    ),
  );

  const metade = Math.floor(poolSize / 2);

  // Quentes: ordenados por frequência recente desc
  const quentesOrdenados = [...ctx.hot].sort(
    (a, b) => (ctx.recentFrequency[b] || 0) - (ctx.recentFrequency[a] || 0)
  );

  // Frias: ordenadas por atraso desc
  const friasOrdenadas = [...ctx.cold].sort(
    (a, b) => (ctx.delay[b] || 0) - (ctx.delay[a] || 0)
  );

  const pool = dedup([
    ...quentesOrdenados.slice(0, metade),
    ...friasOrdenadas.slice(0, metade),
  ]);

  // Se pool ainda for pequeno demais, completa com mornas
  if (pool.length < ctx.minNumbers + 2) {
    const extras = ctx.warm.filter(n => !pool.includes(n));
    pool.push(...extras.slice(0, ctx.minNumbers + 2 - pool.length));
  }

  return pool.sort((a, b) => a - b);
}

// ============================================================
//  7. FUNÇÃO MASTER PRINCIPAL — novo fluxo com desdobramento
// ============================================================

export function gerarJogosMaster(
  draws: number[][],
  qtd: number = 10,
  totalNumbers: number = 60,
  minNumbers: number = 6,
  pesos?: SharkPesos,
): MasterOutput {
  const pesosAtivos: SharkPesos = pesos
    ? { frequencia: pesos.frequencia, atraso: pesos.atraso, repeticao: pesos.repeticao }
    : { ...PESOS_PADRAO };

  if (draws.length < 2) {
    const nums = Array.from({ length: totalNumbers }, (_, i) => i + 1);
    const jogos: SharkResult[] = Array.from({ length: qtd }, () => ({
      jogo:   shuffle(nums).slice(0, minNumbers).sort((a, b) => a - b),
      score:  0,
      origem: 'aleatorio',
    }));
    return {
      jogos,
      contexto: { hot: [], warm: [], cold: [], totalCandidatos: 0, totalValidados: 0, estrategiasUsadas: [] },
    };
  }

  const ctx = buildContextCompleto(draws, totalNumbers, minNumbers);

  // PASSO 1: Geração multi-estratégia (candidatos brutos)
  const rodadas   = Math.max(300, qtd * 30);
  const candidatos = gerarMultiplasEstrategias(ctx, rodadas, pesosAtivos);

  // PASSO 2: Deduplicação e validação dos candidatos
  const vistos   = new Set<string>();
  const validados: Array<{ jogo: number[]; origem: string }> = [];

  for (const c of candidatos) {
    const key = c.jogo.join(',');
    if (vistos.has(key)) continue;
    if (!validarJogo(c.jogo, totalNumbers, minNumbers)) continue;
    vistos.add(key);
    validados.push(c);
  }

  // PASSO 3: Desdobramento do pool quente+fria
  // Gera um pool concentrado e expande combinações para cobrir mais prêmios
  const pool           = buildPoolQuenteFria(ctx, qtd);
  const limiteDesd     = Math.min(2000, Math.max(500, qtd * 80));
  const combosDesd     = combinacoes(pool, minNumbers, limiteDesd);

  // Converte combos do desdobramento para o mesmo formato dos candidatos
  const candidatosDesd: Array<{ jogo: number[]; origem: string }> = combosDesd
    .filter(combo => {
      const key = combo.join(',');
      if (vistos.has(key)) return false;
      if (!validarJogo(combo, totalNumbers, minNumbers)) return false;
      vistos.add(key);
      return true;
    })
    .map(combo => ({ jogo: combo, origem: 'desdobramento' }));

  // PASSO 4: Une candidatos das estratégias + desdobramento
  const todosValidados = [...validados, ...candidatosDesd];

  // PASSO 5: Pontua todos e ordena pelo score do novo sistema quente/fria
  const pontuados: SharkResult[] = todosValidados.map(c => ({
    jogo:   c.jogo,
    score:  scoreCompleto(c.jogo, ctx, pesosAtivos),
    origem: c.origem,
  }));

  pontuados.sort((a, b) => b.score - a.score);

  // PASSO 6: Entrega os N melhores jogos
  const melhores = pontuados.slice(0, qtd);

  return {
    jogos: melhores,
    contexto: {
      hot:  ctx.hot.slice(0, 10),
      warm: ctx.warm.slice(0, 10),
      cold: ctx.cold.slice(0, 10),
      totalCandidatos: candidatos.length + combosDesd.length,
      totalValidados:  todosValidados.length,
      estrategiasUsadas: [...ESTRATEGIAS.map(e => e.nome), 'desdobramento'],
    },
  };
}

// ============================================================
//  8. DESDOBRAMENTO EXTERNO — rota /games/desdobramento
//  (mantém compatibilidade com a API existente)
// ============================================================

export function gerarDesdobramento(
  jogos: SharkResult[],
  minNumbers: number,
  limite: number = 500,
): DesdobramentoOutput {
  const poolBruto = jogos.flatMap(j => j.jogo);
  const pool = [...new Set(poolBruto)].sort((a, b) => a - b);

  if (pool.length < minNumbers) {
    return { combinacoes: [], total: 0, poolUsado: pool };
  }

  const combos = combinacoes(pool, minNumbers, limite);

  return {
    combinacoes: combos,
    total:       combos.length,
    poolUsado:   pool,
  };
}

// Mantém compatibilidade com código antigo
export { gerarJogosMaster as sharkAutonomo };
```

---

## ARQUIVO 2 — MUDANÇAS CIRÚRGICAS (NÃO SUBSTITUIR O ARQUIVO INTEIRO)

### `artifacts/api-server/src/routes/index.ts`

Neste arquivo, faça **apenas** as 2 substituições abaixo usando str_replace (ou edição pontual). Não altere nada fora dessas seções.

---

### SUBSTITUIÇÃO 2A — STRATEGY_REASONING no POST /games/generate

**Encontre este bloco exato:**

```typescript
  const STRATEGY_REASONING: Record<string, string> = {
    hot:    'Números com maior frequência nos últimos 20 sorteios reais',
    cold:   'Números com menor frequência nos últimos 20 sorteios reais',
    mixed:  'Combinação balanceada: 40% quentes, 30% mornos, 30% frios',
    ai:     'Análise estatística: frequência real + paridade + soma + padrões consecutivos',
    manual: 'Seleção manual do usuário',
    shark:  'Motor Shark Autônomo: simula estratégias, escolhe a melhor e gera jogos pontuados',
  };
```

**Substitua por:**

```typescript
  const STRATEGY_REASONING: Record<string, string> = {
    hot:    'Números quentes: alta frequência recente nos últimos 10 sorteios',
    cold:   'Dezenas frias: alto atraso acumulado — números vencidos que tendem a compensar',
    mixed:  'Variação quente+fria: impulso de frequência recente + compensação de atraso',
    ai:     'Análise estatística avançada: frequência recente + atraso + paridade + distribuição',
    manual: 'Seleção manual do usuário',
    shark:  'Motor Shark v2: desdobramento quente/fria → score de variação → melhores jogos',
  };
```

---

### SUBSTITUIÇÃO 2B — sharkContexto no bloco strategy === 'shark'

**Encontre este bloco exato:**

```typescript
        sharkContexto: {
          hot:  contexto.hot.slice(0, 8),
          warm: contexto.warm.slice(0, 8),
          cold: contexto.cold.slice(0, 8),
          totalCandidatos: contexto.totalCandidatos,
          totalValidados:  contexto.totalValidados,
        },
```

**Substitua por:**

```typescript
        sharkContexto: {
          hot:  contexto.hot.slice(0, 8),
          warm: contexto.warm.slice(0, 8),
          cold: contexto.cold.slice(0, 8),
          totalCandidatos:   contexto.totalCandidatos,
          totalValidados:    contexto.totalValidados,
          estrategiasUsadas: contexto.estrategiasUsadas,
        },
```

---

## VERIFICAÇÃO FINAL

Depois de aplicar as mudanças, confirme:

- [ ] `sharkEngine.ts` exporta `gerarJogosMaster`, `gerarDesdobramento` e `sharkAutonomo` (aliases mantidos)
- [ ] `SharkContext` ainda tem os campos `hot`, `warm`, `cold` (compatibilidade de resposta)
- [ ] `SharkPesos` ainda tem `frequencia`, `atraso`, `repeticao` (compatibilidade de entrada)
- [ ] A rota `POST /api/games/generate` com `strategy: 'shark'` continua funcionando
- [ ] A rota `POST /api/games/desdobramento` continua funcionando
- [ ] Nenhum arquivo do frontend foi alterado

---

## RESUMO DA NOVA LÓGICA

| Antes | Depois |
|---|---|
| Quente = top 33% por freq total | Quente = top 33% por freq **recente** (últimos 10 sorteios) |
| Morno = faixa do meio | Morno = faixa intermediária (freq/atraso médios) |
| Frio = bottom 33% por freq total | Fria = top 33% por **atraso acumulado** (mais sorteios sem sair) |
| Estratégias: quente/frio/misto/peso/rep | Estratégias: impulso/compensação/variação_pura/peso/rep_alta/rep_baixa |
| Score: freq global + atraso simples | Score: **bônus de variação** quente+fria no mesmo jogo |
| Desdobramento: apenas via rota externa | **Desdobramento interno** antes de entregar os jogos finais |
| Pool do desdobramento: union dos jogos gerados | Pool do desdobramento: **top quentes + top frias por atraso** |
