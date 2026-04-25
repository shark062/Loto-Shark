import { db } from '@workspace/db';
import { lotteryDrawsCache } from '@workspace/db';

const CAIXA_API = 'https://servicebus2.caixa.gov.br/portaldeloterias/api';

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

export const LOTTERIES = [
  { id: 'megasena',   displayName: 'Mega-Sena',    emoji: '💎', minNumbers: 6,  maxNumbers: 15, totalNumbers: 60,  drawDays: ['Terça','Quinta','Sábado'],              drawTime: '21:00', isActive: true },
  { id: 'lotofacil',  displayName: 'Lotofácil',    emoji: '⭐', minNumbers: 15, maxNumbers: 20, totalNumbers: 25,  drawDays: ['Seg','Ter','Qua','Qui','Sex','Sáb'],    drawTime: '21:00', isActive: true },
  { id: 'quina',      displayName: 'Quina',        emoji: '🪙', minNumbers: 5,  maxNumbers: 15, totalNumbers: 80,  drawDays: ['Seg','Ter','Qua','Qui','Sex','Sáb'],    drawTime: '21:00', isActive: true },
  { id: 'lotomania',  displayName: 'Lotomania',    emoji: '♾️', minNumbers: 50, maxNumbers: 50, totalNumbers: 100, drawDays: ['Seg','Qua','Sex'],                      drawTime: '21:00', isActive: true },
  { id: 'duplasena',  displayName: 'Dupla Sena',   emoji: '👑', minNumbers: 6,  maxNumbers: 15, totalNumbers: 50,  drawDays: ['Ter','Qui','Sáb'],                      drawTime: '21:00', isActive: true },
  { id: 'timemania',  displayName: 'Timemania',    emoji: '⚽', minNumbers: 10, maxNumbers: 10, totalNumbers: 80,  drawDays: ['Ter','Qui','Sáb'],                      drawTime: '21:00', isActive: true },
  { id: 'diadesorte', displayName: 'Dia de Sorte', emoji: '🍀', minNumbers: 7,  maxNumbers: 15, totalNumbers: 31,  drawDays: ['Ter','Qui','Sáb'],                      drawTime: '21:00', isActive: true },
  { id: 'supersete',  displayName: 'Super Sete',   emoji: '7️⃣', minNumbers: 7,  maxNumbers: 7,  totalNumbers: 10,  drawDays: ['Ter','Qui','Sáb'],                      drawTime: '21:00', isActive: true },
];

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
  recentWindow?: number;
}

const CACHE_TTL_MS = 45 * 60 * 1000; // 45 minutos

// Cache em memória como fallback rápido (evita hits desnecessários ao banco)
const memCache: Record<string, { draws: number[][]; fetchedAt: number }> = {};

export async function fetchLatestDraw(lotteryId: string): Promise<any | null> {
  try {
    const resp = await fetch(`${CAIXA_API}/${lotteryId}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (resp.ok) return await resp.json();
  } catch {}
  return null;
}

async function fetchDraw(lotteryId: string, contestNumber: number): Promise<number[] | null> {
  try {
    const resp = await fetch(`${CAIXA_API}/${lotteryId}/${contestNumber}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(6000),
    });
    if (!resp.ok) return null;
    const data = await resp.json() as any;
    const nums = data.dezenas?.map(Number) || data.listaDezenas?.map(Number) || [];
    return nums.length > 0 ? nums : null;
  } catch {
    return null;
  }
}

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

function pickRandom(arr: number[], n: number): number[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, Math.min(n, arr.length));
}

export function generateSmartNumbers(frequencies: NumberFrequency[], count: number, strategy: string, totalNumbers: number): number[] {
  const sorted = [...frequencies].sort((a, b) => b.frequency - a.frequency);
  const all = sorted.map(f => f.number);

  if (strategy === 'hot') {
    const hot = sorted.filter(f => f.temperature === 'hot').map(f => f.number);
    const pool = hot.length >= count ? hot : all;
    return pickRandom(pool, count).sort((a, b) => a - b);
  }

  if (strategy === 'cold') {
    const cold = sorted.filter(f => f.temperature === 'cold').map(f => f.number);
    const pool = cold.length >= count ? cold : [...all].reverse();
    return pickRandom(pool, count).sort((a, b) => a - b);
  }

  if (strategy === 'mixed') {
    const hot  = sorted.filter(f => f.temperature === 'hot').map(f => f.number);
    const warm = sorted.filter(f => f.temperature === 'warm').map(f => f.number);
    const cold = sorted.filter(f => f.temperature === 'cold').map(f => f.number);
    const hotN  = Math.round(count * 0.40);
    const warmN = Math.round(count * 0.30);
    const coldN = count - hotN - warmN;
    const selected = [
      ...pickRandom(hot,  hotN),
      ...pickRandom(warm, warmN),
      ...pickRandom(cold, coldN),
    ];
    const remaining = all.filter(n => !selected.includes(n));
    while (selected.length < count && remaining.length > 0) {
      selected.push(remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0]);
    }
    return selected.sort((a, b) => a - b);
  }

  if (strategy === 'ai') {
    const targetSum  = Math.round((totalNumbers + 1) * count / 2);
    const tolerance  = Math.round(targetSum * 0.22);
    const rangeSize  = Math.ceil(totalNumbers / 4);
    let best: number[] = [];
    let bestScore = -Infinity;

    const freqMap = new Map<number, number>(frequencies.map(f => [f.number, f.frequency]));
    const maxFreq = Math.max(...frequencies.map(f => f.frequency), 1);

    const weights = frequencies.map(f => {
      const freq  = f.frequency + 1;
      const delay = f.temperature === 'cold' ? 1.3 : f.temperature === 'warm' ? 1.1 : 1.0;
      return freq * delay;
    });
    const totalW = weights.reduce((a, b) => a + b, 0);

    for (let attempt = 0; attempt < 500; attempt++) {
      const candidate: number[] = [];
      const used = new Set<number>();

      while (candidate.length < count) {
        let r = Math.random() * totalW;
        let picked = false;
        for (let i = 0; i < frequencies.length; i++) {
          r -= weights[i];
          if (r <= 0 && !used.has(frequencies[i].number)) {
            candidate.push(frequencies[i].number);
            used.add(frequencies[i].number);
            picked = true;
            break;
          }
        }
        if (!picked) {
          const rem = all.filter(n => !used.has(n));
          if (rem.length > 0) { const n = rem[Math.floor(Math.random() * rem.length)]; candidate.push(n); used.add(n); }
          else break;
        }
      }
      if (candidate.length < count) continue;

      const sorted2     = [...candidate].sort((a, b) => a - b);
      const sum         = sorted2.reduce((a, b) => a + b, 0);
      const evens       = sorted2.filter(n => n % 2 === 0).length;
      const odds        = count - evens;
      const consecutive = sorted2.reduce((c, n, i) => i > 0 && n === sorted2[i - 1] + 1 ? c + 1 : c, 0);

      const quadrants = [0, 0, 0, 0];
      sorted2.forEach(n => { quadrants[Math.min(3, Math.floor((n - 1) / rangeSize))]++; });
      const quadBalance = 1 - (Math.max(...quadrants) - Math.min(...quadrants)) / Math.max(count, 1);

      const sumScore  = 1 - Math.min(Math.abs(sum - targetSum) / (tolerance || 1), 1);
      const parScore  = 1 - Math.abs(evens - odds) / count;
      const consScore = consecutive === 0 ? 0.9 : consecutive <= 2 ? 1.0 : consecutive <= 3 ? 0.7 : 0.4;
      const freqScore = sorted2.reduce((a, n) => a + (freqMap.get(n) || 0), 0) / count / maxFreq;

      const score = sumScore * 0.30 + parScore * 0.20 + consScore * 0.15 + freqScore * 0.20 + quadBalance * 0.15;
      if (score > bestScore) { bestScore = score; best = [...sorted2]; }
    }

    return (best.length === count ? best : pickRandom(all, count)).sort((a, b) => a - b);
  }

  return pickRandom(all, count).sort((a, b) => a - b);
}

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
