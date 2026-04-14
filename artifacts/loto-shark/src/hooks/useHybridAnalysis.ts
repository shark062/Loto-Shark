
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export function useHybridScore(lotteryId: string) {
  return useQuery({
    queryKey: [`/api/analysis/hybrid-score/${lotteryId}`],
    enabled: !!lotteryId,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

export function useBacktest() {
  return useMutation({
    mutationFn: async ({ 
      lotteryId, 
      strategyName, 
      windowSize 
    }: { 
      lotteryId: string; 
      strategyName: string; 
      windowSize?: number 
    }) => {
      const response = await apiRequest('POST', '/api/analysis/backtest', {
        lotteryId,
        strategyName,
        windowSize
      });
      return response.json();
    },
  });
}

export function useMultiTemporal(lotteryId: string, number: number) {
  return useQuery({
    queryKey: [`/api/analysis/multi-temporal/${lotteryId}/${number}`],
    enabled: !!lotteryId && !!number,
  });
}

export function useHiddenPatterns(lotteryId: string) {
  return useQuery({
    queryKey: [`/api/analysis/hidden-patterns/${lotteryId}`],
    enabled: !!lotteryId,
    staleTime: 10 * 60 * 1000, // 10 minutos
  });
}
