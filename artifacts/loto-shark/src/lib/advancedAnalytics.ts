// Módulos estatísticos avançados para análise de loterias - Shark Loterias
// Implementa correlações, heatmaps evolutivos, chi-square e detecção de ciclos

import { format, subDays, parseISO } from 'date-fns';

export interface NumberData {
  number: number;
  frequency: number;
  lastDrawn: Date;
  temperature: 'hot' | 'warm' | 'cold';
}

export interface DrawData {
  numbers: number[];
  date: Date;
  contestNumber: number;
}

export interface EvolutionaryHeatMap {
  period: string;
  heatData: { number: number; intensity: number; frequency: number }[];
  trend: 'ascending' | 'descending' | 'stable';
  variance: number;
}

export interface CorrelationMatrix {
  correlations: { numberA: number; numberB: number; correlation: number; confidence: number }[];
  strongPairs: { pair: [number, number]; strength: number }[];
  avoidPairs: { pair: [number, number]; avoidance: number }[];
}

export interface CycleDetection {
  cycleLength: number;
  confidence: number;
  nextPredicted: number[];
  pattern: string;
  lastOccurrence: Date;
}

export interface StatisticalInsight {
  type: 'correlation' | 'cycle' | 'trend' | 'anomaly';
  title: string;
  description: string;
  confidence: number;
  data: any;
  actionable: boolean;
}

class AdvancedAnalyticsEngine {
  
  // Análise de correlação entre números
  calculateCorrelationMatrix(draws: DrawData[], windowSize: number = 100): CorrelationMatrix {
    const recentDraws = draws.slice(-windowSize);
    const allNumbers = this.getAllNumbers(draws);
    const correlations: { numberA: number; numberB: number; correlation: number; confidence: number }[] = [];
    
    for (let i = 0; i < allNumbers.length; i++) {
      for (let j = i + 1; j < allNumbers.length; j++) {
        const numberA = allNumbers[i];
        const numberB = allNumbers[j];
        
        const correlation = this.calculatePairwiseCorrelation(numberA, numberB, recentDraws);
        const confidence = this.calculateCorrelationConfidence(correlation, recentDraws.length);
        
        correlations.push({
          numberA,
          numberB,
          correlation,
          confidence
        });
      }
    }
    
    // Identificar pares fortes (correlação positiva alta)
    const strongPairs = correlations
      .filter(c => c.correlation > 0.6 && c.confidence > 0.7)
      .map(c => ({ pair: [c.numberA, c.numberB] as [number, number], strength: c.correlation }))
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 10);
    
    // Identificar pares que se evitam (correlação negativa)
    const avoidPairs = correlations
      .filter(c => c.correlation < -0.4 && c.confidence > 0.6)
      .map(c => ({ pair: [c.numberA, c.numberB] as [number, number], avoidance: Math.abs(c.correlation) }))
      .sort((a, b) => b.avoidance - a.avoidance)
      .slice(0, 10);
    
    return {
      correlations: correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)),
      strongPairs,
      avoidPairs
    };
  }
  
  // Mapas de calor evolutivos por período
  generateEvolutionaryHeatMaps(draws: DrawData[], periodDays: number[] = [30, 90, 180, 365]): EvolutionaryHeatMap[] {
    const heatMaps: EvolutionaryHeatMap[] = [];
    const now = new Date();
    
    for (const days of periodDays) {
      const cutoffDate = subDays(now, days);
      const periodDraws = draws.filter(draw => draw.date >= cutoffDate);
      
      if (periodDraws.length < 5) continue;
      
      const heatData = this.calculateHeatIntensity(periodDraws);
      const trend = this.calculateTrend(periodDraws);
      const variance = this.calculateVariance(heatData.map(h => h.frequency));
      
      heatMaps.push({
        period: `${days}d`,
        heatData,
        trend,
        variance
      });
    }
    
    return heatMaps;
  }
  
  // Detecção de ciclos e padrões temporais
  detectCycles(draws: DrawData[], minCycleLength: number = 5, maxCycleLength: number = 50): CycleDetection[] {
    const cycles: CycleDetection[] = [];
    const allNumbers = this.getAllNumbers(draws);
    
    for (const number of allNumbers) {
      const numberDraws = draws.filter(draw => draw.numbers.includes(number));
      
      for (let cycleLength = minCycleLength; cycleLength <= maxCycleLength; cycleLength++) {
        const cycleAnalysis = this.analyzeCycleForNumber(number, numberDraws, cycleLength);
        
        if (cycleAnalysis.confidence > 0.6) {
          cycles.push(cycleAnalysis);
        }
      }
    }
    
    return cycles.sort((a, b) => b.confidence - a.confidence).slice(0, 15);
  }
  
  // Teste Chi-Square para detectar anomalias na aleatoriedade
  performChiSquareTest(draws: DrawData[]): { statistic: number; pValue: number; isRandom: boolean; insight: string } {
    const allNumbers = this.getAllNumbers(draws);
    const expectedFrequency = draws.length / allNumbers.length;
    
    let chiSquare = 0;
    const frequencies = this.calculateFrequencies(draws);
    
    for (const number of allNumbers) {
      const observed = frequencies[number] || 0;
      const expected = expectedFrequency;
      chiSquare += Math.pow(observed - expected, 2) / expected;
    }
    
    const degreesOfFreedom = allNumbers.length - 1;
    const pValue = this.calculatePValue(chiSquare, degreesOfFreedom);
    const isRandom = pValue > 0.05; // Nível de significância 5%
    
    let insight = '';
    if (!isRandom) {
      insight = pValue < 0.01 ? 
        'ANOMALIA FORTE: Distribuição altamente não-aleatória detectada!' :
        'Desvio moderado da aleatoriedade detectado.';
    } else {
      insight = 'Distribuição dentro dos padrões esperados de aleatoriedade.';
    }
    
    return {
      statistic: chiSquare,
      pValue,
      isRandom,
      insight
    };
  }
  
  // Análise de tendências com regressão linear
  analyzeTrends(draws: DrawData[], number: number): {
    trend: 'up' | 'down' | 'stable';
    slope: number;
    confidence: number;
    prediction: number;
    nextDrawProbability: number;
  } {
    const numberDraws = draws.filter(draw => draw.numbers.includes(number));
    
    if (numberDraws.length < 10) {
      return {
        trend: 'stable',
        slope: 0,
        confidence: 0,
        prediction: 0,
        nextDrawProbability: 0.1
      };
    }
    
    // Preparar dados para regressão (posição vs frequência acumulada)
    const dataPoints: [number, number][] = [];
    let cumulativeFreq = 0;
    
    for (let i = 0; i < draws.length; i++) {
      if (draws[i].numbers.includes(number)) {
        cumulativeFreq++;
      }
      if (i % 10 === 0) { // Sample a cada 10 sorteios
        dataPoints.push([i, cumulativeFreq]);
      }
    }
    
    const regression = this.linearRegression(dataPoints);
    const trend = regression.slope > 0.1 ? 'up' : regression.slope < -0.1 ? 'down' : 'stable';
    
    return {
      trend,
      slope: regression.slope,
      confidence: regression.rSquared,
      prediction: regression.predict(draws.length + 1),
      nextDrawProbability: this.calculateNextDrawProbability(number, draws)
    };
  }
  
  // Gerador de insights acionáveis baseado em todas as análises
  generateActionableInsights(draws: DrawData[]): StatisticalInsight[] {
    const insights: StatisticalInsight[] = [];
    
    // Análise de correlações
    const correlations = this.calculateCorrelationMatrix(draws);
    if (correlations.strongPairs.length > 0) {
      const topPair = correlations.strongPairs[0];
      insights.push({
        type: 'correlation',
        title: 'PAR PODEROSO DETECTADO',
        description: `Números ${topPair.pair[0]} e ${topPair.pair[1]} aparecem juntos em ${(topPair.strength * 100).toFixed(1)}% dos casos!`,
        confidence: topPair.strength,
        data: topPair,
        actionable: true
      });
    }
    
    // Análise de ciclos
    const cycles = this.detectCycles(draws);
    if (cycles.length > 0) {
      const topCycle = cycles[0];
      insights.push({
        type: 'cycle',
        title: 'CICLO TEMPORAL IDENTIFICADO',
        description: `Padrão de ${topCycle.cycleLength} sorteios detectado com ${(topCycle.confidence * 100).toFixed(1)}% de confiança!`,
        confidence: topCycle.confidence,
        data: topCycle,
        actionable: true
      });
    }
    
    // Teste de aleatoriedade
    const chiSquare = this.performChiSquareTest(draws);
    if (!chiSquare.isRandom) {
      insights.push({
        type: 'anomaly',
        title: 'ANOMALIA ESTATÍSTICA',
        description: chiSquare.insight,
        confidence: 1 - chiSquare.pValue,
        data: chiSquare,
        actionable: true
      });
    }
    
    return insights.sort((a, b) => b.confidence - a.confidence);
  }
  
  // Métodos auxiliares privados
  private getAllNumbers(draws: DrawData[]): number[] {
    const numbers = new Set<number>();
    draws.forEach(draw => draw.numbers.forEach(num => numbers.add(num)));
    return Array.from(numbers).sort((a, b) => a - b);
  }
  
  private calculatePairwiseCorrelation(numberA: number, numberB: number, draws: DrawData[]): number {
    let bothAppear = 0;
    let onlyA = 0;
    let onlyB = 0;
    let neitherAppear = 0;
    
    draws.forEach(draw => {
      const hasA = draw.numbers.includes(numberA);
      const hasB = draw.numbers.includes(numberB);
      
      if (hasA && hasB) bothAppear++;
      else if (hasA) onlyA++;
      else if (hasB) onlyB++;
      else neitherAppear++;
    });
    
    const total = draws.length;
    const expectedBoth = ((onlyA + bothAppear) / total) * ((onlyB + bothAppear) / total) * total;
    
    if (expectedBoth === 0) return 0;
    
    return (bothAppear - expectedBoth) / Math.sqrt(expectedBoth);
  }
  
  private calculateCorrelationConfidence(correlation: number, sampleSize: number): number {
    const tStatistic = Math.abs(correlation) * Math.sqrt((sampleSize - 2) / (1 - correlation * correlation));
    return Math.min(0.99, tStatistic / 3); // Simplificado
  }
  
  private calculateHeatIntensity(draws: DrawData[]): { number: number; intensity: number; frequency: number }[] {
    const frequencies = this.calculateFrequencies(draws);
    const maxFreq = Math.max(...Object.values(frequencies));
    
    return Object.entries(frequencies).map(([number, frequency]) => ({
      number: parseInt(number),
      frequency,
      intensity: frequency / maxFreq
    }));
  }
  
  private calculateTrend(draws: DrawData[]): 'ascending' | 'descending' | 'stable' {
    if (draws.length < 20) return 'stable';
    
    const firstHalf = draws.slice(0, Math.floor(draws.length / 2));
    const secondHalf = draws.slice(Math.floor(draws.length / 2));
    
    const firstAvgNumbers = firstHalf.reduce((sum, draw) => sum + draw.numbers.length, 0) / firstHalf.length;
    const secondAvgNumbers = secondHalf.reduce((sum, draw) => sum + draw.numbers.length, 0) / secondHalf.length;
    
    const diff = secondAvgNumbers - firstAvgNumbers;
    return diff > 0.5 ? 'ascending' : diff < -0.5 ? 'descending' : 'stable';
  }
  
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }
  
  private analyzeCycleForNumber(number: number, numberDraws: DrawData[], cycleLength: number): CycleDetection {
    const intervals: number[] = [];
    
    for (let i = 1; i < numberDraws.length; i++) {
      const interval = Math.abs(numberDraws[i].contestNumber - numberDraws[i-1].contestNumber);
      intervals.push(interval);
    }
    
    const cyclicMatches = intervals.filter(interval => Math.abs(interval - cycleLength) <= 2).length;
    const confidence = cyclicMatches / intervals.length;
    
    return {
      cycleLength,
      confidence,
      nextPredicted: [number],
      pattern: `Número ${number} com ciclo de ~${cycleLength} sorteios`,
      lastOccurrence: numberDraws[numberDraws.length - 1]?.date || new Date()
    };
  }
  
  private calculateFrequencies(draws: DrawData[]): { [number: number]: number } {
    const frequencies: { [number: number]: number } = {};
    
    draws.forEach(draw => {
      draw.numbers.forEach(number => {
        frequencies[number] = (frequencies[number] || 0) + 1;
      });
    });
    
    return frequencies;
  }
  
  private calculatePValue(chiSquare: number, df: number): number {
    // Aproximação simplificada do p-value
    const critical: { [key: number]: number } = {
      1: 3.84, 5: 11.07, 10: 18.31, 20: 31.41, 30: 43.77, 50: 67.50, 60: 79.08
    };
    
    const criticalValue = critical[df] || critical[60];
    return chiSquare > criticalValue ? 0.01 : 0.1; // Simplificado
  }
  
  private linearRegression(points: [number, number][]): {
    slope: number;
    intercept: number;
    rSquared: number;
    predict: (x: number) => number;
  } {
    const n = points.length;
    if (n < 2) return { slope: 0, intercept: 0, rSquared: 0, predict: () => 0 };
    
    const sumX = points.reduce((sum, [x]) => sum + x, 0);
    const sumY = points.reduce((sum, [, y]) => sum + y, 0);
    const sumXY = points.reduce((sum, [x, y]) => sum + x * y, 0);
    const sumXX = points.reduce((sum, [x]) => sum + x * x, 0);
    const sumYY = points.reduce((sum, [, y]) => sum + y * y, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    const meanY = sumY / n;
    const ssTotal = points.reduce((sum, [, y]) => sum + Math.pow(y - meanY, 2), 0);
    const ssRes = points.reduce((sum, [x, y]) => sum + Math.pow(y - (slope * x + intercept), 2), 0);
    const rSquared = 1 - (ssRes / ssTotal);
    
    return {
      slope,
      intercept,
      rSquared,
      predict: (x: number) => slope * x + intercept
    };
  }
  
  private calculateNextDrawProbability(number: number, draws: DrawData[]): number {
    const recentDraws = draws.slice(-20);
    const recentAppearances = recentDraws.filter(draw => draw.numbers.includes(number)).length;
    const baseProb = recentAppearances / recentDraws.length;
    
    // Ajustar baseado no tempo desde última aparição
    const lastAppearance = draws.findIndex(draw => draw.numbers.includes(number));
    const daysSinceLastDraw = lastAppearance >= 0 ? lastAppearance : 999;
    
    const recencyFactor = Math.min(2, 1 + (daysSinceLastDraw / 30));
    
    return Math.min(0.9, baseProb * recencyFactor);
  }
}

// Instância singleton
export const advancedAnalytics = new AdvancedAnalyticsEngine();

// Hook para usar análises avançadas
export function useAdvancedAnalytics() {
  return {
    calculateCorrelationMatrix: advancedAnalytics.calculateCorrelationMatrix.bind(advancedAnalytics),
    generateEvolutionaryHeatMaps: advancedAnalytics.generateEvolutionaryHeatMaps.bind(advancedAnalytics),
    detectCycles: advancedAnalytics.detectCycles.bind(advancedAnalytics),
    performChiSquareTest: advancedAnalytics.performChiSquareTest.bind(advancedAnalytics),
    analyzeTrends: advancedAnalytics.analyzeTrends.bind(advancedAnalytics),
    generateActionableInsights: advancedAnalytics.generateActionableInsights.bind(advancedAnalytics)
  };
}