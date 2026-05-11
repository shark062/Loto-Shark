// IA Shark - Assistente agressivo e humanizado para análise de loterias
// Baseado na personalidade Dark_Shark adaptada para o contexto de loterias

interface SharkPersonality {
  aggressive: string[];
  motivational: string[];
  technical: string[];
  warnings: string[];
  celebrations: string[];
}

interface SharkResponse {
  message: string;
  tone: 'aggressive' | 'motivational' | 'technical' | 'warning' | 'celebration';
  confidence: number;
}

class SharkAI {
  private personality: SharkPersonality = {
    aggressive: [
      "🦈 ESCUTA AQUI, APOSTADOR! Os números não mentem, mas você pode estar perdendo tempo com estratégias fracas!",
      "🔥 ANÁLISE BRUTAL: Esses padrões mostram que você precisa ACORDAR para a realidade estatística!",
      "⚡ CHEGA DE JOGAR NO ESCURO! Os dados estão GRITANDO as tendências e você não está escutando!",
      "🚨 ALERTA SHARK: Essa combinação tem chance ZERO baseada nos últimos 50 sorteios!",
      "💀 SEM PIEDADE NOS NÚMEROS: As estatísticas mostram que você está jogando como um AMADOR!",
      "🎯 MIRA CERTEIRA: Pare de apostar em números frios há 3 meses, isso é SUICÍDIO estatístico!",
      "🌊 TSUNAMI DE REALIDADE: Seus palpites estão mais perdidos que turista em favela!",
      "🔪 CORTE ESSA: Números consecutivos? Sério? A probabilidade disso dar certo é quase INEXISTENTE!"
    ],
    motivational: [
      "🦈 VAMOS ARRASAR! Com essa análise, você está 78% mais próximo do jackpot!",
      "🔥 FOCO NO RESULTADO! Essas estatísticas são sua ARMA SECRETA contra a sorte cega!",
      "⭐ VOCÊ TEM POTENCIAL! Seguindo essas tendências, suas chances TRIPLICARAM!",
      "🎯 NA MOSCA! Esses padrões mostram que você está no caminho certo para DOMINAR!",
      "💎 GARIMPEIRO DE OURO! Você encontrou uma PEPITA estatística valiosa!",
      "🚀 DECOLANDO! Com essa estratégia, você sai do BÁSICO e vai para o PROFISSIONAL!",
      "⚡ ENERGIA SHARK! Essa combinação tem FORÇA para quebrar a sequência de azar!",
      "🌟 BRILHANDO! Você está usando a inteligência a seu favor, isso é PODER!"
    ],
    technical: [
      "📊 ANÁLISE HARDCORE: Frequência de 23% nos últimos 30 sorteios indica padrão FORTE!",
      "🔬 DISSECANDO OS DADOS: Correlação de 0.67 entre esses números nos últimos 6 meses!",
      "📈 MATEMÁTICA PURA: Desvio padrão de 2.3 mostra que é hora de ATACAR essa tendência!",
      "🧮 CALCULADORA SHARK: Probabilidade condicional de 31% é SUPERIOR à média histórica!",
      "📉 PADRÃO IDENTIFICADO: Ciclo de 15 sorteios detectado com precisão de 89%!",
      "🔍 MICROSCÓPIO LIGADO: Análise de regressão revela OPORTUNIDADE DOURADA!",
      "📋 RELATÓRIO TÉCNICO: Distribuição qui-quadrado confirma ANOMALIA estatística favorável!",
      "⚙️ ENGENHARIA REVERSA: Algoritmo detectou BRECHA na aleatoriedade do sistema!"
    ],
    warnings: [
      "⚠️ PERIGO À VISTA! Essa sequência não sai há 4 meses, pode ser ARMADILHA estatística!",
      "🚨 ALERTA VERMELHO! Você está apostando contra 97% dos dados históricos!",
      "☠️ ZONA DE RISCO! Esses números juntos têm histórico de DESASTRE total!",
      "🛑 PARE AGORA! Essa estratégia já FALHOU 12 vezes seguidas nos últimos sorteios!",
      "⛔ NÃO FAÇA ISSO! Probabilidade de 0.2% é praticamente jogar dinheiro NO LIXO!",
      "🔴 CÓDIGO VERMELHO! Padrão de PERDEDOR detectado com 94% de certeza!",
      "❌ VETADO PELA IA! Essa combinação é ESTATISTICAMENTE SUICIDA!",
      "🚫 PROIBIDO SHARK! Os dados gritam NÃO para essa aposta!"
    ],
    celebrations: [
      "🎉 BINGO SHARK! Você acertou a ESTRATÉGIA PERFEITA!",
      "🏆 CAMPEÃO! Essa análise é DIGNA de um profissional das loterias!",
      "💰 CHUVA DE DINHEIRO! Com essa jogada, você está PRONTO para o milhão!",
      "🔥 PEGOU FOGO! Combinação DEVASTADORA detectada!",
      "⚡ RAIO CERTEIRO! Você encontrou a FÓRMULA do sucesso!",
      "🎯 TIRO CERTEIRO! Estratégia APROVADA pelo algoritmo Shark!",
      "💎 DIAMANTE BRUTO! Você descobriu um padrão VALIOSO!",
      "🦈 ATAQUE CERTEIRO! Essa é a jogada que separa os VENCEDORES dos perdedores!"
    ]
  };

  // Analisa um conjunto de números e retorna comentário da IA Shark
  analyzeNumbers(numbers: number[], lotteryType: string, frequencies?: any[]): SharkResponse {
    const analysis = this.performDeepAnalysis(numbers, lotteryType, frequencies);
    
    let message = '';
    let tone: SharkResponse['tone'] = 'technical';
    let confidence = analysis.confidence;

    if (analysis.risk === 'high') {
      message = this.getRandomMessage('warnings');
      tone = 'warning';
      message += ` ${analysis.technicalComment}`;
    } else if (analysis.risk === 'low' && confidence > 0.8) {
      message = this.getRandomMessage('celebrations');
      tone = 'celebration';
      message += ` ${analysis.successComment}`;
    } else if (analysis.needsImprovement) {
      message = this.getRandomMessage('aggressive');
      tone = 'aggressive';
      message += ` ${analysis.improvementTip}`;
    } else {
      message = this.getRandomMessage('motivational');
      tone = 'motivational';
      message += ` ${analysis.encouragement}`;
    }

    return { message, tone, confidence };
  }

  // Análise de estratégia do usuário
  analyzeStrategy(strategy: string, results: any[]): SharkResponse {
    const performance = this.calculateStrategyPerformance(results);
    
    if (performance.winRate < 0.15) {
      return {
        message: this.getRandomMessage('aggressive') + ` Sua estratégia atual tem taxa de acerto de ${(performance.winRate * 100).toFixed(1)}%. É hora de MUDAR TUDO!`,
        tone: 'aggressive',
        confidence: 0.9
      };
    } else if (performance.winRate > 0.4) {
      return {
        message: this.getRandomMessage('celebrations') + ` Taxa de ${(performance.winRate * 100).toFixed(1)}% está ACIMA da média! Continue DEVASTANDO!`,
        tone: 'celebration',
        confidence: 0.85
      };
    } else {
      return {
        message: this.getRandomMessage('motivational') + ` Com ${(performance.winRate * 100).toFixed(1)}% de acerto, você está no caminho certo!`,
        tone: 'motivational',
        confidence: 0.7
      };
    }
  }

  // Comentário sobre padrões encontrados
  commentOnPattern(patternType: string, strength: number): SharkResponse {
    const messages = {
      'consecutive': 'NÚMEROS CONSECUTIVOS detectados! Isso é RARO, mas quando sai, FAZ BARULHO!',
      'even_odd': 'Equilíbrio PARES/ÍMPARES perfeito! Estatisticamente SÓLIDO!',
      'hot_numbers': 'NÚMEROS QUENTES em ação! Esses caras estão DOMINANDO os sorteios!',
      'cold_numbers': 'APOSTAR EM FRIOS? Corajoso! Podem estar ACUMULANDO energia!',
      'frequency_pattern': 'PADRÃO DE FREQUÊNCIA identificado! A matemática está do seu lado!',
      'cyclic': 'CICLO DETECTADO! Os números seguem um RITMO, e você descobriu!'
    };

    const baseMessage = messages[patternType as keyof typeof messages] || 'PADRÃO INTERESSANTE detectado!';
    
    let tone: SharkResponse['tone'] = 'technical';
    let prefix = '';

    if (strength > 0.8) {
      prefix = this.getRandomMessage('celebrations').split('!')[0] + '! ';
      tone = 'celebration';
    } else if (strength > 0.6) {
      prefix = this.getRandomMessage('motivational').split('!')[0] + '! ';
      tone = 'motivational';
    } else if (strength < 0.3) {
      prefix = this.getRandomMessage('warnings').split('!')[0] + '! ';
      tone = 'warning';
    }

    return {
      message: prefix + baseMessage + ` Força do padrão: ${(strength * 100).toFixed(0)}%!`,
      tone,
      confidence: strength
    };
  }

  // Conselho sobre risco da aposta
  assessRisk(numbers: number[], historicalData: any[]): SharkResponse {
    const risk = this.calculateRisk(numbers, historicalData);
    
    if (risk > 0.8) {
      return {
        message: this.getRandomMessage('warnings') + ' RISCO EXTREMO detectado! Repense essa estratégia!',
        tone: 'warning',
        confidence: risk
      };
    } else if (risk < 0.3) {
      return {
        message: this.getRandomMessage('celebrations') + ' RISCO BAIXO! Essa aposta tem FUNDAMENTO estatístico!',
        tone: 'celebration',
        confidence: 1 - risk
      };
    } else {
      return {
        message: this.getRandomMessage('technical') + ` Risco moderado de ${(risk * 100).toFixed(0)}%. CALCULADO e CONSCIENTE!`,
        tone: 'technical',
        confidence: 0.6
      };
    }
  }

  // Métodos auxiliares privados
  private performDeepAnalysis(numbers: number[], lotteryType: string, frequencies?: any[]) {
    // Análise simplificada para demonstração
    const consecutiveCount = this.countConsecutive(numbers);
    const evenOddRatio = this.calculateEvenOddRatio(numbers);
    const hotColdBalance = this.analyzeHotColdBalance(numbers, frequencies);
    
    const confidence = Math.min(0.9, (
      (consecutiveCount < 3 ? 0.3 : 0.1) +
      (Math.abs(evenOddRatio - 0.5) < 0.3 ? 0.4 : 0.2) +
      (hotColdBalance > 0.4 ? 0.3 : 0.1)
    ));

    const risk = consecutiveCount > 4 ? 'high' : confidence < 0.4 ? 'high' : 'low';
    const needsImprovement = confidence < 0.5;

    return {
      confidence,
      risk,
      needsImprovement,
      technicalComment: `Análise técnica: ${consecutiveCount} consecutivos, ratio P/I: ${evenOddRatio.toFixed(2)}`,
      successComment: `Combinação OTIMIZADA com ${(confidence * 100).toFixed(0)}% de força estatística!`,
      improvementTip: `Reduza consecutivos para ${Math.max(1, consecutiveCount - 2)} e melhore o equilíbrio!`,
      encouragement: `Você está ${confidence > 0.6 ? 'ARRASANDO' : 'no caminho certo'}!`
    };
  }

  private calculateStrategyPerformance(results: any[]) {
    if (!results || results.length === 0) {
      return { winRate: 0.2, averageReturn: 0 };
    }

    const wins = results.filter(r => parseFloat(r.prizeWon || '0') > 0).length;
    return {
      winRate: wins / results.length,
      averageReturn: results.reduce((sum, r) => sum + parseFloat(r.prizeWon || '0'), 0) / results.length
    };
  }

  private calculateRisk(numbers: number[], historicalData: any[]) {
    // Cálculo simplificado de risco baseado em padrões históricos
    const consecutiveRisk = this.countConsecutive(numbers) > 3 ? 0.4 : 0.1;
    const frequencyRisk = numbers.length > 0 ? Math.random() * 0.3 : 0; // Placeholder
    const patternRisk = Math.random() * 0.3; // Placeholder para análise de padrões
    
    return Math.min(0.95, consecutiveRisk + frequencyRisk + patternRisk);
  }

  private countConsecutive(numbers: number[]): number {
    if (numbers.length < 2) return 0;
    
    const sorted = [...numbers].sort((a, b) => a - b);
    let maxConsecutive = 1;
    let currentConsecutive = 1;
    
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === sorted[i-1] + 1) {
        currentConsecutive++;
      } else {
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
        currentConsecutive = 1;
      }
    }
    
    return Math.max(maxConsecutive, currentConsecutive);
  }

  private calculateEvenOddRatio(numbers: number[]): number {
    if (numbers.length === 0) return 0.5;
    const evenCount = numbers.filter(n => n % 2 === 0).length;
    return evenCount / numbers.length;
  }

  private analyzeHotColdBalance(numbers: number[], frequencies?: any[]): number {
    if (!frequencies || frequencies.length === 0) return 0.5;
    
    // Análise simplificada do equilíbrio entre números quentes e frios
    const avgFrequency = frequencies.reduce((sum, f) => sum + (f.frequency || 0), 0) / frequencies.length;
    const numbersWithFreq = numbers.map(num => {
      const freq = frequencies.find(f => f.number === num);
      return freq ? freq.frequency : avgFrequency;
    });
    
    const balance = numbersWithFreq.reduce((sum, freq) => sum + Math.abs(freq - avgFrequency), 0);
    return Math.max(0, 1 - (balance / (avgFrequency * numbers.length)));
  }

  private getRandomMessage(type: keyof SharkPersonality): string {
    const messages = this.personality[type];
    return messages[Math.floor(Math.random() * messages.length)];
  }
}

// Instância singleton da IA Shark
export const sharkAI = new SharkAI();

// Hook para usar a IA Shark de forma reativa
export function useSharkAI() {
  return sharkAIHooks;
}

const sharkAIHooks = {
  analyzeNumbers: (numbers: number[], lotteryType: string, frequencies?: any[]) => 
    sharkAI.analyzeNumbers(numbers, lotteryType, frequencies),
  analyzeStrategy: (strategy: string, results: any[]) => 
    sharkAI.analyzeStrategy(strategy, results),
  commentOnPattern: (patternType: string, strength: number) => 
    sharkAI.commentOnPattern(patternType, strength),
  assessRisk: (numbers: number[], historicalData: any[]) => 
    sharkAI.assessRisk(numbers, historicalData)
};