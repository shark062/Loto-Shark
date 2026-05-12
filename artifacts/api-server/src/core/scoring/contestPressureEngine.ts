// ============================================================
//  Contest Pressure Engine — Motor de Pressão de Concurso
//  Calcula pressão estatística baseada no histórico de atrasos
//  e frequência de cada número em relação ao concurso atual.
//  Quanto maior a "pressão", maior a probabilidade de saída
//  segundo a lei de grandes números aplicada a loterias.
// ============================================================

export interface NumberPressure {
  number: number;
  delay: number;           // sorteios desde a última saída
  frequency: number;       // frequência relativa (0-1)
  expectedFreq: number;    // frequência esperada = 1/totalNumbers
  pressureScore: number;   // 0-100
  overdue: boolean;        // está além do atraso esperado?
  overdueRatio: number;    // delay / expectedInterval
}

export interface ContestPressureResult {
  totalNumbers: number;
  drawsAnalyzed: number;
  expectedInterval: number;  // = totalNumbers / minNumbers (média de sorteios até sair)
  topPressure: NumberPressure[];   // top 20 com mais pressão
  leastPressure: NumberPressure[]; // 10 com menos pressão (super quentes / recentes)
  avgDelay: number;
  pressureDistribution: { range: string; count: number }[];
}

/**
 * Calcula o índice de pressão de cada número baseado em:
 * 1. Atraso atual (draws desde a última saída)
 * 2. Frequência histórica vs frequência esperada
 * 3. Desvio da expectativa estatística
 *
 * @param draws    Histórico de sorteios (mais recente primeiro)
 * @param totalNumbers Total de números possíveis na modalidade
 * @param minNumbers   Dezenas sorteadas por concurso
 */
export function computeContestPressure(
  draws: number[][],
  totalNumbers: number,
  minNumbers: number
): ContestPressureResult {
  const N = draws.length;
  if (N === 0) {
    return {
      totalNumbers, drawsAnalyzed: 0, expectedInterval: totalNumbers / minNumbers,
      topPressure: [], leastPressure: [], avgDelay: 0, pressureDistribution: [],
    };
  }

  const expectedInterval = totalNumbers / minNumbers;

  // Conta frequência e atraso de cada número
  const freqMap = new Map<number, number>();
  const lastSeenMap = new Map<number, number>(); // sorteios atrás (0 = no último)

  for (let n = 1; n <= totalNumbers; n++) {
    freqMap.set(n, 0);
    lastSeenMap.set(n, N); // nunca visto = máximo atraso
  }

  for (let i = 0; i < N; i++) {
    for (const n of draws[i]) {
      freqMap.set(n, (freqMap.get(n) || 0) + 1);
      if (!lastSeenMap.has(n) || lastSeenMap.get(n) === N) {
        lastSeenMap.set(n, i); // i=0 é o mais recente
      }
    }
  }

  const expectedFreq = minNumbers / totalNumbers; // ex: 6/60 = 0.1

  const pressures: NumberPressure[] = [];
  for (let n = 1; n <= totalNumbers; n++) {
    const freq = freqMap.get(n) || 0;
    const relFreq = freq / N;
    const delay = lastSeenMap.get(n) ?? N;
    const overdueRatio = delay / expectedInterval;

    // Pressão de atraso: normalizada 0-100
    // overdueRatio = 1 → 50 pts | 2 → 75 pts | 3 → 90 pts
    const delayScore = Math.min(100, (overdueRatio / (overdueRatio + 1)) * 100 * 2);

    // Pressão de frequência: penaliza números super quentes (acima da média)
    // e premia sub-frequentes (abaixo da média)
    const freqDeficit = Math.max(0, expectedFreq - relFreq) / expectedFreq;
    const freqScore = Math.min(100, freqDeficit * 100);

    // Score final: 65% atraso + 35% frequência
    const pressureScore = Math.round(delayScore * 0.65 + freqScore * 0.35);

    pressures.push({
      number: n,
      delay,
      frequency: parseFloat(relFreq.toFixed(4)),
      expectedFreq: parseFloat(expectedFreq.toFixed(4)),
      pressureScore,
      overdue: overdueRatio > 1,
      overdueRatio: parseFloat(overdueRatio.toFixed(2)),
    });
  }

  pressures.sort((a, b) => b.pressureScore - a.pressureScore);

  const avgDelay = pressures.reduce((s, p) => s + p.delay, 0) / pressures.length;

  // Distribuição de pressão em faixas
  const ranges = [
    { min: 0, max: 25,  label: "0–25 (quente)"      },
    { min: 25, max: 50, label: "25–50 (neutro)"      },
    { min: 50, max: 75, label: "50–75 (atrasado)"    },
    { min: 75, max: 100, label: "75–100 (vencido)"   },
  ];
  const pressureDistribution = ranges.map(r => ({
    range: r.label,
    count: pressures.filter(p => p.pressureScore >= r.min && p.pressureScore < r.max).length,
  }));

  return {
    totalNumbers,
    drawsAnalyzed: N,
    expectedInterval: parseFloat(expectedInterval.toFixed(1)),
    topPressure: pressures.slice(0, 20),
    leastPressure: pressures.slice(-10).reverse(),
    avgDelay: parseFloat(avgDelay.toFixed(1)),
    pressureDistribution,
  };
}

/**
 * Aplica o contest pressure como filtro suave sobre uma lista de jogos candidatos.
 * Pontua cada jogo com base na soma de pressão dos seus números.
 * Retorna os jogos ordenados por pressão descendente.
 *
 * @param candidateGames Lista de jogos (cada um é um array de números)
 * @param pressure       Resultado do computeContestPressure
 */
export function scoreGamesByPressure(
  candidateGames: number[][],
  pressure: ContestPressureResult
): Array<{ game: number[]; pressureTotal: number; avgPressure: number }> {
  const pressureMap = new Map<number, number>(
    pressure.topPressure.map(p => [p.number, p.pressureScore])
  );

  const scored = candidateGames.map(game => {
    const total = game.reduce((s, n) => s + (pressureMap.get(n) ?? 30), 0);
    return {
      game,
      pressureTotal: total,
      avgPressure: parseFloat((total / game.length).toFixed(1)),
    };
  });

  scored.sort((a, b) => b.pressureTotal - a.pressureTotal);
  return scored;
}
