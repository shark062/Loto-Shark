const CAIXA_API = 'https://servicebus2.caixa.gov.br/portaldeloterias/api';

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
  percentage: number;
  temperature: 'hot' | 'warm' | 'cold';
  isHot?: boolean;
  isCold?: boolean;
}

type DrawCache = { draws: number[][]; latestContest: number; fetchedAt: number };
const cache: Record<string, DrawCache> = {};
const CACHE_TTL = 2 * 60 * 60 * 1000;

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
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const nums = data.dezenas?.map(Number) || data.listaDezenas?.map(Number) || [];
    return nums.length > 0 ? nums : null;
  } catch {
    return null;
  }
}

export async function fetchHistoricalDraws(lotteryId: string, count: number = 20): Promise<number[][]> {
  const cached = cache[lotteryId];
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL && cached.draws.length >= Math.min(count, 5)) {
    return cached.draws.slice(0, count);
  }

  const latest = await fetchLatestDraw(lotteryId);
  if (!latest) return cached?.draws || [];

  const latestContest = latest.numero || latest.contestNumber || 0;
  const latestNums = latest.dezenas?.map(Number) || latest.listaDezenas?.map(Number) || [];
  const draws: number[][] = latestNums.length > 0 ? [latestNums] : [];

  const targets: number[] = [];
  for (let i = 1; i < count && latestContest - i > 0; i++) {
    targets.push(latestContest - i);
  }

  for (let i = 0; i < targets.length; i += 5) {
    const batch = targets.slice(i, i + 5);
    const results = await Promise.allSettled(batch.map(n => fetchDraw(lotteryId, n)));
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) draws.push(r.value);
    }
    if (draws.length >= count) break;
  }

  cache[lotteryId] = { draws, latestContest, fetchedAt: Date.now() };
  return draws;
}

export function computeFrequencies(totalNumbers: number, draws: number[][]): NumberFrequency[] {
  const freq: Record<number, number> = {};
  for (let i = 1; i <= totalNumbers; i++) freq[i] = 0;
  draws.forEach(draw => draw.forEach(n => { if (freq[n] !== undefined) freq[n]++; }));

  const sorted = Object.entries(freq).sort((a, b) => Number(b[1]) - Number(a[1]));
  const hotCut  = Math.floor(sorted.length * 0.25);
  const coldCut = Math.floor(sorted.length * 0.75);
  const hotSet  = new Set(sorted.slice(0, hotCut).map(([n]) => parseInt(n)));
  const coldSet = new Set(sorted.slice(coldCut).map(([n]) => parseInt(n)));
  const total   = Math.max(draws.length, 1);

  return Object.entries(freq).map(([num, frequency]) => {
    const n = parseInt(num);
    const temperature: 'hot' | 'warm' | 'cold' = hotSet.has(n) ? 'hot' : coldSet.has(n) ? 'cold' : 'warm';
    return { number: n, frequency, percentage: Math.round((frequency / total) * 100), temperature, isHot: temperature === 'hot', isCold: temperature === 'cold' };
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
    const targetSum = Math.round((totalNumbers + 1) * count / 2);
    const tolerance = Math.round(targetSum * 0.25);
    let best: number[] = [];
    let bestScore = -Infinity;

    for (let attempt = 0; attempt < 150; attempt++) {
      const weights = frequencies.map(f => f.frequency + 1);
      const totalW  = weights.reduce((a, b) => a + b, 0);
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

      const sum    = candidate.reduce((a, b) => a + b, 0);
      const evens  = candidate.filter(n => n % 2 === 0).length;
      const odds   = count - evens;
      const sorted2 = [...candidate].sort((a, b) => a - b);
      const consecutive = sorted2.reduce((c, n, i) => i > 0 && n === sorted2[i - 1] + 1 ? c + 1 : c, 0);

      const sumScore  = 1 - Math.min(Math.abs(sum - targetSum) / (tolerance || 1), 1);
      const balScore  = 1 - Math.abs(evens - odds) / count;
      const consScore = consecutive <= 2 ? 1 : 0.5;
      const freqScore = candidate.reduce((a, n) => a + (frequencies.find(f => f.number === n)?.frequency || 0), 0) / Math.max(count, 1) / Math.max(sorted[0]?.frequency || 1, 1);

      const score = sumScore * 0.35 + balScore * 0.25 + consScore * 0.15 + freqScore * 0.25;
      if (score > bestScore) { bestScore = score; best = [...candidate]; }
    }

    return (best.length === count ? best : pickRandom(all, count)).sort((a, b) => a - b);
  }

  return pickRandom(all, count).sort((a, b) => a - b);
}
