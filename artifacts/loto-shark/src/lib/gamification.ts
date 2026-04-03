// Sistema de Gamificação Shark Loterias
// Conquistas, missões, ranking e moeda virtual

import { useState, useEffect } from 'react';
import { cyberpunkSound } from './soundEffects';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  points: number;
  unlocked: boolean;
  unlockedAt?: Date;
  progress: number;
  maxProgress: number;
  category: 'analysis' | 'prediction' | 'usage' | 'special';
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  icon: string;
  type: 'daily' | 'weekly' | 'special';
  reward: number; // SharkCoins
  progress: number;
  maxProgress: number;
  completed: boolean;
  expiresAt?: Date;
  category: string;
}

export interface UserGameStats {
  level: number;
  experience: number;
  sharkCoins: number;
  totalAnalyses: number;
  totalPredictions: number;
  accuracyRate: number;
  streakDays: number;
  achievementsUnlocked: number;
  rank: string;
  totalTimeSpent: number; // em minutos
}

class SharkGamificationEngine {
  private stats: UserGameStats;
  private achievements: Achievement[];
  private missions: Mission[];
  private eventListeners: { [event: string]: Function[] } = {};

  constructor() {
    this.stats = this.loadStats();
    this.achievements = this.initializeAchievements();
    this.missions = this.initializeMissions();
    this.startDailyMissionReset();
  }

  // Estatísticas do usuário
  getStats(): UserGameStats {
    return { ...this.stats };
  }

  // Sistema de XP e Level
  addExperience(points: number, reason: string) {
    this.stats.experience += points;
    const newLevel = this.calculateLevel(this.stats.experience);

    if (newLevel > this.stats.level) {
      this.stats.level = newLevel;
      // Removed: cyberpunkSound.playNotification();
      this.emit('levelUp', { level: newLevel, reason });

      // Recompensa por subir de nível
      this.addSharkCoins(newLevel * 50, `Level ${newLevel} alcançado!`);
    }

    this.emit('experienceGained', { points, reason });
    this.saveStats();
  }

  // Sistema de SharkCoins
  addSharkCoins(amount: number, reason: string) {
    this.stats.sharkCoins += amount;
    this.emit('coinsEarned', { amount, reason });
    this.saveStats();
  }

  spendSharkCoins(amount: number, item: string): boolean {
    if (this.stats.sharkCoins >= amount) {
      this.stats.sharkCoins -= amount;
      this.emit('coinsSpent', { amount, item });
      this.saveStats();
      return true;
    }
    return false;
  }

  // Sistema de Conquistas
  getAchievements(): Achievement[] {
    return [...this.achievements];
  }

  unlockAchievement(achievementId: string): boolean {
    const achievement = this.achievements.find(a => a.id === achievementId);

    if (achievement && !achievement.unlocked) {
      achievement.unlocked = true;
      achievement.unlockedAt = new Date();
      this.stats.achievementsUnlocked++;

      // Recompensas baseadas na raridade
      const coinReward = this.getAchievementReward(achievement.rarity);
      this.addSharkCoins(coinReward, `Conquista: ${achievement.title}`);
      this.addExperience(achievement.points, `Conquista: ${achievement.title}`);

      // Removed: cyberpunkSound.playPatternFound();
      this.emit('achievementUnlocked', achievement);
      this.saveStats();
      return true;
    }
    return false;
  }

  updateAchievementProgress(achievementId: string, progress: number) {
    const achievement = this.achievements.find(a => a.id === achievementId);
    if (achievement && !achievement.unlocked) {
      achievement.progress = Math.min(progress, achievement.maxProgress);

      if (achievement.progress >= achievement.maxProgress) {
        this.unlockAchievement(achievementId);
      }

      this.saveStats();
    }
  }

  // Sistema de Missões
  getMissions(): Mission[] {
    return [...this.missions.filter(m => !this.isMissionExpired(m))];
  }

  completeMission(missionId: string): boolean {
    const mission = this.missions.find(m => m.id === missionId);

    if (mission && !mission.completed && mission.progress >= mission.maxProgress) {
      mission.completed = true;
      this.addSharkCoins(mission.reward, `Missão: ${mission.title}`);
      this.addExperience(mission.reward / 2, `Missão: ${mission.title}`);

      // Removed: cyberpunkSound.playPatternFound();
      this.emit('missionCompleted', mission);
      this.saveStats();
      return true;
    }
    return false;
  }

  updateMissionProgress(missionId: string, progress: number) {
    const mission = this.missions.find(m => m.id === missionId);
    if (mission && !mission.completed && !this.isMissionExpired(mission)) {
      mission.progress = Math.min(progress, mission.maxProgress);

      if (mission.progress >= mission.maxProgress) {
        this.completeMission(missionId);
      }
    }
  }

  // Eventos de gameplay
  onAnalysisPerformed(lotteryType: string, accuracy?: number) {
    this.stats.totalAnalyses++;
    this.addExperience(10, 'Análise realizada');

    // Atualizar missões
    this.updateMissionProgress('daily_analysis', this.getMissionProgress('daily_analysis') + 1);
    this.updateMissionProgress('weekly_analyst', this.getMissionProgress('weekly_analyst') + 1);

    // Atualizar conquistas
    this.updateAchievementProgress('first_analysis', 1);
    this.updateAchievementProgress('analyst_100', this.stats.totalAnalyses);
    this.updateAchievementProgress('analyst_500', this.stats.totalAnalyses);

    if (accuracy && accuracy > 0.8) {
      this.updateAchievementProgress('high_accuracy', this.getAchievementProgress('high_accuracy') + 1);
    }
  }

  onPredictionMade(numbers: number[], lotteryType: string) {
    this.stats.totalPredictions++;
    this.addExperience(15, 'Predição gerada');

    // Missões
    this.updateMissionProgress('daily_predictions', this.getMissionProgress('daily_predictions') + 1);

    // Conquistas especiais
    if (numbers.length >= 15) {
      this.updateAchievementProgress('big_bettor', this.getAchievementProgress('big_bettor') + 1);
    }

    const consecutiveCount = this.countConsecutiveNumbers(numbers);
    if (consecutiveCount >= 4) {
      this.unlockAchievement('consecutive_master');
    }
  }

  onPatternFound(patternType: string, strength: number) {
    this.addExperience(20, `Padrão ${patternType} encontrado`);

    if (strength > 0.9) {
      this.updateAchievementProgress('pattern_master', this.getAchievementProgress('pattern_master') + 1);
    }

    // Conquistas por tipo de padrão
    if (patternType === 'fibonacci') {
      this.unlockAchievement('fibonacci_finder');
    }
  }

  onDailyLogin() {
    const today = new Date().toDateString();
    const lastLogin = localStorage.getItem('shark_last_login');

    if (lastLogin !== today) {
      this.stats.streakDays++;
      this.addExperience(5, 'Login diário');
      this.addSharkCoins(10, 'Login diário');

      // Conquistas de streak
      if (this.stats.streakDays >= 7) {
        this.unlockAchievement('weekly_warrior');
      }
      if (this.stats.streakDays >= 30) {
        this.unlockAchievement('monthly_master');
      }

      localStorage.setItem('shark_last_login', today);
    }
  }

  // Sistema de Ranking
  calculateRank(): string {
    const level = this.stats.level;
    const achievements = this.stats.achievementsUnlocked;
    const accuracy = this.stats.accuracyRate;

    const rankScore = (level * 10) + (achievements * 5) + (accuracy * 100);

    if (rankScore >= 1000) return 'MEGA SHARK';
    if (rankScore >= 750) return 'APEX PREDATOR';
    if (rankScore >= 500) return 'ALPHA SHARK';
    if (rankScore >= 300) return 'HUNTER SHARK';
    if (rankScore >= 150) return 'YOUNG SHARK';
    return 'SHARK PUP';
  }

  // Sistema de eventos
  on(event: string, callback: Function) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  private emit(event: string, data: any) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(callback => callback(data));
    }
  }

  // Métodos auxiliares
  private calculateLevel(experience: number): number {
    return Math.floor(Math.sqrt(experience / 100)) + 1;
  }

  private getAchievementReward(rarity: Achievement['rarity']): number {
    switch (rarity) {
      case 'legendary': return 500;
      case 'epic': return 200;
      case 'rare': return 100;
      case 'common': return 50;
      default: return 25;
    }
  }

  private countConsecutiveNumbers(numbers: number[]): number {
    const sorted = [...numbers].sort((a, b) => a - b);
    let maxConsecutive = 1;
    let current = 1;

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === sorted[i-1] + 1) {
        current++;
        maxConsecutive = Math.max(maxConsecutive, current);
      } else {
        current = 1;
      }
    }

    return maxConsecutive;
  }

  private isMissionExpired(mission: Mission): boolean {
    return mission.expiresAt ? new Date() > mission.expiresAt : false;
  }

  private getMissionProgress(missionId: string): number {
    return this.missions.find(m => m.id === missionId)?.progress || 0;
  }

  private getAchievementProgress(achievementId: string): number {
    return this.achievements.find(a => a.id === achievementId)?.progress || 0;
  }

  private startDailyMissionReset() {
    // Resetar missões diárias à meia-noite
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      this.resetDailyMissions();
      setInterval(() => this.resetDailyMissions(), 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
  }

  private resetDailyMissions() {
    this.missions.filter(m => m.type === 'daily').forEach(mission => {
      mission.progress = 0;
      mission.completed = false;
    });
    this.saveStats();
  }

  private loadStats(): UserGameStats {
    const saved = localStorage.getItem('shark_gamification_stats');
    return saved ? JSON.parse(saved) : {
      level: 1,
      experience: 0,
      sharkCoins: 100, // Começar com algumas moedas
      totalAnalyses: 0,
      totalPredictions: 0,
      accuracyRate: 0,
      streakDays: 0,
      achievementsUnlocked: 0,
      rank: 'SHARK PUP',
      totalTimeSpent: 0
    };
  }

  private saveStats() {
    this.stats.rank = this.calculateRank();
    localStorage.setItem('shark_gamification_stats', JSON.stringify(this.stats));
    localStorage.setItem('shark_achievements', JSON.stringify(this.achievements));
    localStorage.setItem('shark_missions', JSON.stringify(this.missions));
  }

  private initializeAchievements(): Achievement[] {
    const saved = localStorage.getItem('shark_achievements');
    if (saved) return JSON.parse(saved);

    return [
      {
        id: 'first_analysis',
        title: 'Primeiro Mergulho',
        description: 'Realize sua primeira análise',
        icon: '🦈',
        rarity: 'common',
        points: 50,
        unlocked: false,
        progress: 0,
        maxProgress: 1,
        category: 'analysis'
      },
      {
        id: 'analyst_100',
        title: 'Analista Experiente',
        description: 'Complete 100 análises',
        icon: '📊',
        rarity: 'rare',
        points: 200,
        unlocked: false,
        progress: 0,
        maxProgress: 100,
        category: 'analysis'
      },
      {
        id: 'pattern_master',
        title: 'Mestre dos Padrões',
        description: 'Encontre 50 padrões de alta qualidade',
        icon: '🔍',
        rarity: 'epic',
        points: 500,
        unlocked: false,
        progress: 0,
        maxProgress: 50,
        category: 'analysis'
      },
      {
        id: 'consecutive_master',
        title: 'Sequencial Supremo',
        description: 'Gere uma sequência com 4+ números consecutivos',
        icon: '🔢',
        rarity: 'rare',
        points: 300,
        unlocked: false,
        progress: 0,
        maxProgress: 1,
        category: 'prediction'
      },
      {
        id: 'weekly_warrior',
        title: 'Guerreiro Semanal',
        description: 'Faça login por 7 dias consecutivos',
        icon: '🗓️',
        rarity: 'common',
        points: 150,
        unlocked: false,
        progress: 0,
        maxProgress: 7,
        category: 'usage'
      },
      {
        id: 'shark_legend',
        title: 'Lenda Shark',
        description: 'Alcance o nível 50',
        icon: '👑',
        rarity: 'legendary',
        points: 2000,
        unlocked: false,
        progress: 0,
        maxProgress: 50,
        category: 'special'
      }
    ];
  }

  private initializeMissions(): Mission[] {
    const saved = localStorage.getItem('shark_missions');
    if (saved) return JSON.parse(saved);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    return [
      {
        id: 'daily_analysis',
        title: 'Análises Diárias',
        description: 'Realize 5 análises hoje',
        icon: '🎯',
        type: 'daily',
        reward: 50,
        progress: 0,
        maxProgress: 5,
        completed: false,
        expiresAt: tomorrow,
        category: 'analysis'
      },
      {
        id: 'daily_predictions',
        title: 'Palpites Diários',
        description: 'Gere 3 predições hoje',
        icon: '🔮',
        type: 'daily',
        reward: 30,
        progress: 0,
        maxProgress: 3,
        completed: false,
        expiresAt: tomorrow,
        category: 'prediction'
      },
      {
        id: 'weekly_analyst',
        title: 'Analista Semanal',
        description: 'Complete 25 análises esta semana',
        icon: '📈',
        type: 'weekly',
        reward: 200,
        progress: 0,
        maxProgress: 25,
        completed: false,
        expiresAt: nextWeek,
        category: 'analysis'
      }
    ];
  }
}

// Instância singleton
export const sharkGamification = new SharkGamificationEngine();

// Hook para usar gamificação
export function useSharkGamification() {
  const [stats, setStats] = useState(sharkGamification.getStats());
  const [achievements, setAchievements] = useState(sharkGamification.getAchievements());
  const [missions, setMissions] = useState(sharkGamification.getMissions());

  useEffect(() => {
    const updateStats = () => setStats(sharkGamification.getStats());
    const updateAchievements = () => setAchievements(sharkGamification.getAchievements());
    const updateMissions = () => setMissions(sharkGamification.getMissions());

    sharkGamification.on('levelUp', updateStats);
    sharkGamification.on('experienceGained', updateStats);
    sharkGamification.on('coinsEarned', updateStats);
    sharkGamification.on('achievementUnlocked', updateAchievements);
    sharkGamification.on('missionCompleted', updateMissions);

    // Login diário
    sharkGamification.onDailyLogin();

    return () => {
      // Cleanup se necessário
    };
  }, []);

  return {
    stats,
    achievements,
    missions,
    onAnalysisPerformed: (type: string, accuracy?: number) => {
      sharkGamification.onAnalysisPerformed(type, accuracy);
      setStats(sharkGamification.getStats());
      setAchievements(sharkGamification.getAchievements());
      setMissions(sharkGamification.getMissions());
    },
    onPredictionMade: (numbers: number[], type: string) => {
      sharkGamification.onPredictionMade(numbers, type);
      setStats(sharkGamification.getStats());
      setAchievements(sharkGamification.getAchievements());
      setMissions(sharkGamification.getMissions());
    },
    onPatternFound: (type: string, strength: number) => {
      sharkGamification.onPatternFound(type, strength);
      setStats(sharkGamification.getStats());
      setAchievements(sharkGamification.getAchievements());
    },
    spendSharkCoins: sharkGamification.spendSharkCoins.bind(sharkGamification),
  };
}