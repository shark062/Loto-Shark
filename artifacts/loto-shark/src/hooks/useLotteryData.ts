import { useQuery } from "@tanstack/react-query";
import type { LotteryType, LotteryDraw, NextDrawInfo, NumberFrequency, UserStats } from "@/types/lottery";

export function useLotteryTypes() {
  return useQuery<LotteryType[]>({
    queryKey: ["/api/lotteries"],
    staleTime: 30 * 1000, // 30 seconds for fresh data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

export function useLotteryDraws(lotteryId?: string, limit = 10) {
  return useQuery<LotteryDraw[]>({
    queryKey: ["/api/lotteries", lotteryId, "draws", `limit=${limit}`],
    enabled: !!lotteryId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useNextDrawInfo(lotteryId?: string) {
  return useQuery<NextDrawInfo>({
    queryKey: ["/api/lotteries", lotteryId, "next-draw"],
    enabled: !!lotteryId,
    refetchInterval: 60 * 1000, // Refetch every 60 seconds (countdown calculated client-side)
    staleTime: 55 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

export function useNumberFrequencies(lotteryId?: string) {
  return useQuery<NumberFrequency[]>({
    queryKey: ["/api/lotteries", lotteryId, "frequency"],
    enabled: !!lotteryId,
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: true,
    select: (data: any) => {
      // API pode retornar array direto ou { frequencies, meta }
      const arr = Array.isArray(data) ? data : (data?.frequencies ?? []);
      return arr as NumberFrequency[];
    },
  });
}

export function useFrequencyAnalysis(lotteryId?: string) {
  return useQuery<{ frequencies: NumberFrequency[]; meta: any }>({
    queryKey: ["/api/lotteries", lotteryId, "frequency"],
    enabled: !!lotteryId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    select: (data: any) => {
      if (Array.isArray(data)) return { frequencies: data, meta: {} };
      return { frequencies: data?.frequencies ?? [], meta: data?.meta ?? {} };
    },
  });
}

export function useUserStats() {
  return useQuery<UserStats>({
    queryKey: ["/api/users/stats"],
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export interface LotteryPrizeTier {
  tier: number;
  name: string;
  winners: number;
  prizeAmount: number;
  prizeFormatted: string;
  isAccumulated: boolean;
}

export interface LotteryPrizes {
  lotteryId: string;
  contestNumber: number;
  nextContest: number;
  drawDate: string | null;
  accumulated: boolean;
  estimatedPrize: number;
  estimatedPrizeFormatted: string;
  prizes: LotteryPrizeTier[];
}

export function useLotteryPrizes(lotteryId?: string) {
  return useQuery<LotteryPrizes>({
    queryKey: ["/api/lotteries", lotteryId, "prizes"],
    enabled: !!lotteryId,
    staleTime: 0,
    refetchInterval: 2 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: 2,
  });
}


