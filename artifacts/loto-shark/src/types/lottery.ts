export interface LotteryType {
  id: string;
  name: string;
  displayName: string;
  emoji: string;
  minNumbers: number;
  maxNumbers: number;
  totalNumbers: number;
  drawDays: string[];
  drawTime: string;
  isActive: boolean;
}

export interface LotteryDraw {
  id: number;
  lotteryId: string;
  contestNumber: number;
  drawnNumbers: number[];
  drawDate: string;
  prizeAmount: string;
  nextContestNumber?: number;
  nextDrawDate?: string;
  estimatedPrize?: string;
  winners?: {
    category: string;
    count: number;
    prize: string;
  }[];
}

export interface NextDrawInfo {
  contestNumber: number;
  drawDate: string;
  drawTime: string;
  timeRemaining: {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  };
  estimatedPrize: string;
}

export interface NumberFrequency {
  number: number;
  frequency: number;
  percentage: number;
  temperature: 'hot' | 'warm' | 'cold';
  lastDrawn?: string;
  isHot?: boolean;
  isCold?: boolean;
}

export interface UserStats {
  totalGames: number;
  totalChecked: number;
  wins: number;
  winRate: number;
  totalPrize: number;
}
