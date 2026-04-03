/**
 * 🛡️ FASE 1 - CONSOLIDAÇÃO: Sistema de Validação de Dados
 * 
 * Sistema robusto de validação para garantir integridade e consistência
 * dos dados das loterias brasileiras em toda a aplicação.
 */

import { z } from 'zod';
import { LOTTERY_CONFIGS, DATE_FORMATS, NUMBER_TEMPERATURE, getLotteryConfig } from './lotteryConstants';

/**
 * 📋 SCHEMAS DE VALIDAÇÃO CENTRALIZADOS
 */

// Validação de ID de loteria
export const lotteryIdSchema = z.string()
  .min(1, 'ID da loteria é obrigatório')
  .refine(id => id in LOTTERY_CONFIGS, {
    message: 'ID de loteria inválido. Deve ser uma das modalidades oficiais brasileiras.',
  });

// Validação de números da loteria
export const lotteryNumbersSchema = (lotteryId: string) => {
  const config = getLotteryConfig(lotteryId);
  if (!config) throw new Error(`Configuração não encontrada para loteria: ${lotteryId}`);

  return z.array(z.number())
    .min(config.minNumbers, `Mínimo de ${config.minNumbers} números para ${config.displayName}`)
    .max(config.maxNumbers, `Máximo de ${config.maxNumbers} números para ${config.displayName}`)
    .refine(numbers => {
      // Verificar se todos os números estão no range válido
      return numbers.every(num => num >= 1 && num <= config.totalNumbers);
    }, {
      message: `Números devem estar entre 1 e ${config.totalNumbers} para ${config.displayName}`,
    })
    .refine(numbers => {
      // Verificar se não há números duplicados
      return new Set(numbers).size === numbers.length;
    }, {
      message: 'Não é permitido números duplicados no jogo',
    });
};

// Validação de data ISO 8601
export const isoDateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/, {
    message: 'Data deve estar no formato ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ)',
  });

// Validação de concurso/sorteio
export const contestNumberSchema = z.number()
  .int('Número do concurso deve ser um número inteiro')
  .positive('Número do concurso deve ser positivo')
  .max(999999, 'Número do concurso muito alto');

// Validação de valor de prêmio
export const prizeAmountSchema = z.string()
  .regex(/^\d+(\.\d{2})?$/, 'Valor do prêmio deve estar no formato decimal com 2 casas (ex: 1000000.50)')
  .refine(value => {
    const num = parseFloat(value);
    return num >= 0 && num <= 999999999999.99;
  }, {
    message: 'Valor do prêmio deve estar entre R$ 0,00 e R$ 999.999.999.999,99',
  });

// Validação de estratégia de jogo
export const gameStrategySchema = z.enum(['hot', 'cold', 'mixed', 'ai', 'random'], {
  errorMap: () => ({ message: 'Estratégia deve ser: hot, cold, mixed, ai ou random' }),
});

// Validação de temperatura do número
export const temperatureSchema = z.enum(['hot', 'warm', 'cold'], {
  errorMap: () => ({ message: 'Temperatura deve ser: hot, warm ou cold' }),
});

/**
 * 🔍 VALIDADORES DE INTEGRIDADE DE DADOS
 */

export class DataValidator {
  /**
   * Valida dados completos de um sorteio
   */
  static validateDraw(data: {
    lotteryId: string;
    contestNumber: number;
    drawDate: string;
    drawnNumbers: number[];
    prizeAmount?: string;
  }) {
    const schema = z.object({
      lotteryId: lotteryIdSchema,
      contestNumber: contestNumberSchema,
      drawDate: isoDateSchema,
      drawnNumbers: z.lazy(() => lotteryNumbersSchema(data.lotteryId)),
      prizeAmount: prizeAmountSchema.optional(),
    });

    return schema.parse(data);
  }

  /**
   * Valida dados de jogo do usuário
   */
  static validateUserGame(data: {
    lotteryId: string;
    selectedNumbers: number[];
    strategy?: string;
    contestNumber?: number;
  }) {
    const schema = z.object({
      lotteryId: lotteryIdSchema,
      selectedNumbers: z.lazy(() => lotteryNumbersSchema(data.lotteryId)),
      strategy: gameStrategySchema.optional(),
      contestNumber: contestNumberSchema.optional(),
    });

    return schema.parse(data);
  }

  /**
   * Valida dados de frequência de números
   */
  static validateNumberFrequency(data: {
    lotteryId: string;
    number: number;
    frequency: number;
    temperature: string;
    drawsSinceLastSeen: number;
  }) {
    const config = getLotteryConfig(data.lotteryId);
    if (!config) throw new Error(`Configuração não encontrada para loteria: ${data.lotteryId}`);

    const schema = z.object({
      lotteryId: lotteryIdSchema,
      number: z.number()
        .int('Número deve ser um inteiro')
        .min(1, 'Número deve ser no mínimo 1')
        .max(config.totalNumbers, `Número deve ser no máximo ${config.totalNumbers}`),
      frequency: z.number()
        .int('Frequência deve ser um inteiro')
        .min(0, 'Frequência não pode ser negativa'),
      temperature: temperatureSchema,
      drawsSinceLastSeen: z.number()
        .int('Dias desde último sorteio deve ser um inteiro')
        .min(0, 'Dias não pode ser negativo'),
    });

    return schema.parse(data);
  }

  /**
   * Valida consistência de dados entre sorteios
   */
  static validateDrawConsistency(currentDraw: any, previousDraw?: any) {
    const errors: string[] = [];

    if (previousDraw) {
      // Verificar se o número do concurso é sequencial
      if (currentDraw.contestNumber <= previousDraw.contestNumber) {
        errors.push(`Número do concurso deve ser maior que o anterior (${previousDraw.contestNumber})`);
      }

      // Verificar se a data é posterior
      if (new Date(currentDraw.drawDate) <= new Date(previousDraw.drawDate)) {
        errors.push('Data do sorteio deve ser posterior ao sorteio anterior');
      }
    }

    // Verificar se a data não é futura demais (máximo 1 ano à frente)
    const maxFutureDate = new Date();
    maxFutureDate.setFullYear(maxFutureDate.getFullYear() + 1);
    
    if (new Date(currentDraw.drawDate) > maxFutureDate) {
      errors.push('Data do sorteio não pode ser mais de 1 ano no futuro');
    }

    if (errors.length > 0) {
      throw new Error(`Inconsistências detectadas: ${errors.join(', ')}`);
    }

    return true;
  }
}

/**
 * 🧹 UTILITÁRIOS DE LIMPEZA E FORMATAÇÃO
 */

export class DataFormatter {
  /**
   * Formatar data para ISO 8601
   */
  static formatToISO(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString();
  }

  /**
   * Formatar valor monetário para string decimal
   */
  static formatPrizeAmount(amount: number): string {
    return amount.toFixed(2);
  }

  /**
   * Formatar números do sorteio (ordenar e limpar)
   */
  static formatDrawNumbers(numbers: number[]): number[] {
    return Array.from(new Set(numbers)).sort((a, b) => a - b);
  }

  /**
   * Calcular temperatura do número baseada na frequência
   */
  static calculateTemperature(frequency: number, totalDraws: number): 'hot' | 'warm' | 'cold' {
    if (totalDraws < NUMBER_TEMPERATURE.MIN_DRAWS_SAMPLE) {
      return 'warm'; // Dados insuficientes
    }

    const ratio = frequency / totalDraws;

    if (ratio >= NUMBER_TEMPERATURE.HOT_THRESHOLD) return 'hot';
    if (ratio >= NUMBER_TEMPERATURE.WARM_THRESHOLD) return 'warm';
    return 'cold';
  }
}

/**
 * 🚨 DETECTOR DE ANOMALIAS
 */

export class AnomalyDetector {
  /**
   * Detectar padrões suspeitos nos números sorteados
   */
  static detectSuspiciousPatterns(numbers: number[]): string[] {
    const warnings: string[] = [];

    // Verificar sequência muito longa
    const sortedNumbers = [...numbers].sort((a, b) => a - b);
    let consecutiveCount = 1;
    let maxConsecutive = 1;

    for (let i = 1; i < sortedNumbers.length; i++) {
      if (sortedNumbers[i] === sortedNumbers[i - 1] + 1) {
        consecutiveCount++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveCount);
      } else {
        consecutiveCount = 1;
      }
    }

    if (maxConsecutive >= 4) {
      warnings.push(`Sequência suspeita de ${maxConsecutive} números consecutivos`);
    }

    // Verificar se todos os números são pares ou ímpares
    const evenCount = numbers.filter(n => n % 2 === 0).length;
    if (evenCount === numbers.length || evenCount === 0) {
      warnings.push('Todos os números são pares ou todos são ímpares');
    }

    // Verificar padrões geométricos (múltiplos)
    const multiples = numbers.filter(n => n % 10 === 0).length;
    if (multiples >= Math.ceil(numbers.length / 2)) {
      warnings.push('Muitos números múltiplos de 10');
    }

    return warnings;
  }

  /**
   * Verificar inconsistências temporais nos sorteios
   */
  static validateTemporalConsistency(draws: any[]): string[] {
    const errors: string[] = [];

    for (let i = 1; i < draws.length; i++) {
      const current = draws[i];
      const previous = draws[i - 1];

      try {
        DataValidator.validateDrawConsistency(current, previous);
      } catch (error) {
        errors.push(`Sorteio ${current.contestNumber}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return errors;
  }
}

/**
 * 📊 MÉTRICAS DE QUALIDADE DOS DADOS
 */

export class DataQualityMetrics {
  static calculateDataQuality(draws: any[]) {
    let totalScore = 100;
    const issues: string[] = [];

    // Verificar completude dos dados
    const completeDraws = draws.filter(draw => 
      draw.contestNumber && 
      draw.drawDate && 
      draw.drawnNumbers && 
      draw.drawnNumbers.length > 0
    );

    const completenessRatio = completeDraws.length / draws.length;
    if (completenessRatio < 0.95) {
      totalScore -= 20;
      issues.push(`${((1 - completenessRatio) * 100).toFixed(1)}% dos sorteios têm dados incompletos`);
    }

    // Verificar consistência temporal
    const temporalErrors = AnomalyDetector.validateTemporalConsistency(draws);
    if (temporalErrors.length > 0) {
      totalScore -= Math.min(30, temporalErrors.length * 5);
      issues.push(`${temporalErrors.length} inconsistências temporais detectadas`);
    }

    // Verificar anomalias nos números
    let suspiciousPatterns = 0;
    draws.forEach(draw => {
      if (draw.drawnNumbers) {
        const patterns = AnomalyDetector.detectSuspiciousPatterns(draw.drawnNumbers);
        suspiciousPatterns += patterns.length;
      }
    });

    if (suspiciousPatterns > draws.length * 0.1) {
      totalScore -= 15;
      issues.push(`${suspiciousPatterns} padrões suspeitos detectados nos números`);
    }

    return {
      score: Math.max(0, totalScore),
      issues,
      completeness: completenessRatio * 100,
      temporalConsistency: temporalErrors.length === 0,
      anomaliesDetected: suspiciousPatterns,
    };
  }
}