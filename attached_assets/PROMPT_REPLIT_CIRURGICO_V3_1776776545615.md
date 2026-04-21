# PROMPT CIRÚRGICO PARA O REPLIT — LOTO-SHARK V3
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
8. **Faça SOMENTE o que está descrito neste prompt. Nada a mais, nada a menos.**

---

## VISÃO GERAL — O QUE SERÁ FEITO

Duas mudanças cirúrgicas e isoladas:

**Mudança 1 — Cache de dezenas sorteadas no `localStorage`:**
Na aba de Resultados, quando o usuário clica em "Buscar Resultado Oficial", os resultados retornados devem ser salvos automaticamente no `localStorage` do navegador. Na próxima vez que o usuário abrir a aba de Resultados, os resultados em cache devem ser carregados e exibidos imediatamente, sem precisar clicar no botão novamente. O usuário pode forçar uma nova busca a qualquer momento clicando no botão "Buscar Resultado Oficial". O botão "Limpar" apaga tanto a exibição quanto o cache salvo.

**Mudança 2 — Desdobramento de Jogos (4 estratégias novas):**
No arquivo de desdobramento existente (`sharkDesdobramento.ts`), adicionar 4 novas funções de desdobramento conforme especificado abaixo. Não remover nem alterar nenhuma função existente.

---

## ARQUIVOS A MODIFICAR

```
artifacts/loto-shark/src/pages/Results.tsx
artifacts/loto-shark/src/core/sharkDesdobramento.ts
```

---

## ALTERAÇÃO 1 — `artifacts/loto-shark/src/pages/Results.tsx`

### Contexto
O componente `LiveSorteioCard` já possui o estado `lotteryDraws` e a função `fetchOfficialResults`. A mudança é adicionar persistência via `localStorage` **sem alterar nenhuma outra lógica existente**.

### O que adicionar

**Passo 1 — Definir a chave do cache.**
Logo após as constantes `CANAL_CAIXA_URL` e `CANAL_CAIXA_CHANNEL_ID` (antes do mapa `PT_WORD_MAP`), adicione uma linha:

```typescript
const DRAWS_CACHE_KEY = 'shark_official_draws_cache';
```

**Passo 2 — Carregar cache ao montar o componente.**
Dentro do componente `LiveSorteioCard`, logo após a declaração dos estados (`useState`), adicione um `useEffect` de montagem que lê o cache:

```typescript
// Carrega cache do localStorage ao montar
useEffect(() => {
  try {
    const raw = localStorage.getItem(DRAWS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setLotteryDraws(parsed);
      }
    }
  } catch {
    // ignora erros de parse
  }
}, []);
```

**Passo 3 — Salvar no cache após busca bem-sucedida.**
Dentro da função `fetchOfficialResults`, logo após a linha `setLotteryDraws(ok);` (dentro do bloco `if (ok.length === 0)` NÃO, mas logo antes do `if (ok.length === 0)`), adicione:

```typescript
if (ok.length > 0) {
  try {
    localStorage.setItem(DRAWS_CACHE_KEY, JSON.stringify(ok));
  } catch {
    // ignora erros de storage
  }
}
```

**Passo 4 — Limpar cache ao clicar em "Limpar".**
Na função `clearAll` existente, adicione a remoção do cache:

```typescript
const clearAll = () => {
  setLotteryDraws([]);
  setFetchError('');
  try {
    localStorage.removeItem(DRAWS_CACHE_KEY);
  } catch {
    // ignora
  }
};
```

**Passo 5 — Indicador visual de cache.**
Logo após o bloco do `fetchError` (a tag `{fetchError && ...}`), adicione um indicador discreto que avisa quando os dados exibidos vieram do cache (não de uma busca nova). Para isso, adicione um estado de controle:

```typescript
const [fromCache, setFromCache] = useState(false);
```

No `useEffect` do Passo 2, após `setLotteryDraws(parsed)`, adicione `setFromCache(true);`.
Na função `fetchOfficialResults`, antes do `finally`, após `setLotteryDraws(ok)`, adicione `setFromCache(false);`.
Na função `clearAll`, adicione `setFromCache(false);`.

E no JSX, logo após `{fetchError && ...}`, adicione:

```tsx
{fromCache && lotteryDraws.length > 0 && (
  <p className="text-xs text-yellow-400/70 bg-yellow-500/10 rounded-lg p-2 flex items-center gap-1.5">
    <span>⚡</span>
    Exibindo resultado salvo anteriormente. Clique em "Buscar Resultado Oficial" para atualizar.
  </p>
)}
```

---

## ALTERAÇÃO 2 — `artifacts/loto-shark/src/core/sharkDesdobramento.ts`

### Contexto
Adicionar 4 novas funções exportadas ao arquivo existente. **Não altere nenhuma linha existente.** Acrescente as funções novas no **final do arquivo**, antes do último `export` ou após todos os exports existentes.

### Funções a adicionar

```typescript
// ─── DESDOBRAMENTO 1: Linhas e Colunas ───────────────────────────────────────
/**
 * Divide os números disponíveis em faixas (linhas) e gera combinações
 * garantindo representação de múltiplas faixas.
 * @param numbers  Lista de números disponíveis (ex: 1..25)
 * @param picks    Quantidade de números por jogo
 * @param rowSize  Tamanho de cada faixa/linha (default 10)
 * @param maxGames Máximo de jogos gerados (default 10)
 */
export function desdobramentoLinhaColuna(
  numbers: number[],
  picks: number,
  rowSize = 10,
  maxGames = 10
): number[][] {
  const sorted = [...numbers].sort((a, b) => a - b);
  // Agrupa em faixas
  const rows: number[][] = [];
  for (let i = 0; i < sorted.length; i += rowSize) {
    rows.push(sorted.slice(i, i + rowSize));
  }
  const games: number[][] = [];
  const perRow = Math.max(1, Math.floor(picks / rows.length));

  for (let g = 0; g < maxGames; g++) {
    const game: number[] = [];
    const shuffledRows = [...rows].sort(() => Math.random() - 0.5);
    for (const row of shuffledRows) {
      const take = Math.min(perRow, row.length, picks - game.length);
      const shuffled = [...row].sort(() => Math.random() - 0.5);
      game.push(...shuffled.slice(0, take));
      if (game.length >= picks) break;
    }
    // Completa se necessário
    if (game.length < picks) {
      const remaining = sorted.filter(n => !game.includes(n)).sort(() => Math.random() - 0.5);
      game.push(...remaining.slice(0, picks - game.length));
    }
    const finalGame = game.slice(0, picks).sort((a, b) => a - b);
    // Evita duplicatas
    const key = finalGame.join(',');
    if (!games.some(g2 => g2.join(',') === key)) {
      games.push(finalGame);
    }
  }
  return games;
}

// ─── DESDOBRAMENTO 2: Números Fixos + Variáveis ──────────────────────────────
/**
 * Gera combinações mantendo números fixos em todos os jogos
 * e variando os demais a partir de um pool.
 * @param fixed     Números que aparecem em todos os jogos
 * @param pool      Números variáveis disponíveis (não deve conter os fixos)
 * @param picks     Total de números por jogo
 * @param maxGames  Máximo de jogos gerados (default 10)
 */
export function desdobramentoFixosVariaveis(
  fixed: number[],
  pool: number[],
  picks: number,
  maxGames = 10
): number[][] {
  if (fixed.length >= picks) return [fixed.slice(0, picks).sort((a, b) => a - b)];
  const variableCount = picks - fixed.length;
  const available = pool.filter(n => !fixed.includes(n));
  const games: number[][] = [];
  const seen = new Set<string>();

  let attempts = 0;
  while (games.length < maxGames && attempts < maxGames * 20) {
    attempts++;
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    const variables = shuffled.slice(0, variableCount);
    if (variables.length < variableCount) break;
    const game = [...fixed, ...variables].sort((a, b) => a - b);
    const key = game.join(',');
    if (!seen.has(key)) {
      seen.add(key);
      games.push(game);
    }
  }
  return games;
}

// ─── DESDOBRAMENTO 3: Grupos por Intervalo ───────────────────────────────────
/**
 * Agrupa números em intervalos definidos e gera jogos com
 * representação balanceada de diferentes grupos.
 * @param numbers    Lista de números disponíveis
 * @param picks      Quantidade de números por jogo
 * @param groupSize  Tamanho de cada grupo/intervalo (default 10)
 * @param maxGames   Máximo de jogos gerados (default 10)
 */
export function desdobramentoGrupos(
  numbers: number[],
  picks: number,
  groupSize = 10,
  maxGames = 10
): number[][] {
  const sorted = [...numbers].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const groups: number[][] = [];

  for (let start = min; start <= max; start += groupSize) {
    const g = sorted.filter(n => n >= start && n < start + groupSize);
    if (g.length > 0) groups.push(g);
  }

  const games: number[][] = [];
  const seen = new Set<string>();

  let attempts = 0;
  while (games.length < maxGames && attempts < maxGames * 20) {
    attempts++;
    const game: number[] = [];
    const shuffledGroups = [...groups].sort(() => Math.random() - 0.5);

    for (const grp of shuffledGroups) {
      if (game.length >= picks) break;
      const take = Math.min(
        Math.max(1, Math.floor(picks / groups.length)),
        grp.length,
        picks - game.length
      );
      const shuffled = [...grp].sort(() => Math.random() - 0.5);
      game.push(...shuffled.slice(0, take));
    }

    // Completa se necessário
    if (game.length < picks) {
      const remaining = sorted.filter(n => !game.includes(n)).sort(() => Math.random() - 0.5);
      game.push(...remaining.slice(0, picks - game.length));
    }

    const finalGame = game.slice(0, picks).sort((a, b) => a - b);
    const key = finalGame.join(',');
    if (!seen.has(key)) {
      seen.add(key);
      games.push(finalGame);
    }
  }
  return games;
}

// ─── DESDOBRAMENTO 4: Pares e Ímpares ───────────────────────────────────────
/**
 * Gera combinações com distribuição controlada de pares e ímpares.
 * @param numbers     Lista de números disponíveis
 * @param picks       Quantidade de números por jogo
 * @param evenCount   Quantidade de pares por jogo (default: metade de picks)
 * @param maxGames    Máximo de jogos gerados (default 10)
 */
export function desdobramentoParesImpares(
  numbers: number[],
  picks: number,
  evenCount?: number,
  maxGames = 10
): number[][] {
  const evens = numbers.filter(n => n % 2 === 0);
  const odds  = numbers.filter(n => n % 2 !== 0);

  // Se não especificado, usa distribuição 50/50 arredondada
  const targetEvens = evenCount !== undefined
    ? Math.min(evenCount, picks, evens.length)
    : Math.round(picks / 2);
  const targetOdds = picks - targetEvens;

  if (evens.length < targetEvens || odds.length < targetOdds) {
    // Fallback: distribuição natural sem restrição
    const all = [...numbers].sort(() => Math.random() - 0.5);
    return [all.slice(0, picks).sort((a, b) => a - b)];
  }

  const games: number[][] = [];
  const seen = new Set<string>();
  let attempts = 0;

  while (games.length < maxGames && attempts < maxGames * 20) {
    attempts++;
    const shuffledEvens = [...evens].sort(() => Math.random() - 0.5);
    const shuffledOdds  = [...odds].sort(() => Math.random() - 0.5);
    const game = [
      ...shuffledEvens.slice(0, targetEvens),
      ...shuffledOdds.slice(0, targetOdds),
    ].sort((a, b) => a - b);

    const key = game.join(',');
    if (!seen.has(key)) {
      seen.add(key);
      games.push(game);
    }
  }
  return games;
}
```

---

## VERIFICAÇÃO FINAL

Após as alterações, confirme:

- [ ] `Results.tsx` compila sem erros TypeScript (os `useEffect` e `useState` adicionados estão dentro do componente `LiveSorteioCard`, não fora)
- [ ] `sharkDesdobramento.ts` compila sem erros TypeScript (as 4 funções são pure functions sem dependências externas)
- [ ] Nenhum outro arquivo foi modificado
- [ ] O comportamento de busca de resultados continua idêntico — a única mudança é que o resultado agora é salvo/carregado do `localStorage`
- [ ] As funções de desdobramento existentes continuam intactas

---

## RESUMO DO QUE FOI ALTERADO

| Arquivo | O que mudou |
|---|---|
| `Results.tsx` | Cache automático de dezenas sorteadas no `localStorage` com indicador visual |
| `sharkDesdobramento.ts` | +4 funções de desdobramento exportadas no final do arquivo |

**Nenhum outro arquivo foi tocado.**
