
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export function useHeatmap(lotteryId: string) {
  return useQuery({
    queryKey: [`/api/analysis/heatmap/${lotteryId}`],
    enabled: !!lotteryId,
  });
}

export function useSequenceAnalysis(lotteryId: string, minLength: number = 3) {
  return useQuery({
    queryKey: [`/api/analysis/sequences/${lotteryId}`, { minLength }],
    enabled: !!lotteryId,
  });
}

export function useTrioAnalysis(lotteryId: string, minFrequency: number = 3) {
  return useQuery({
    queryKey: [`/api/analysis/trios/${lotteryId}`, { minFrequency }],
    enabled: !!lotteryId,
  });
}

export function useDispersionMetrics(lotteryId: string) {
  return useQuery({
    queryKey: [`/api/analysis/dispersion/${lotteryId}`],
    enabled: !!lotteryId,
  });
}

export function useDelayAnalysis(lotteryId: string) {
  return useQuery({
    queryKey: [`/api/analysis/delays/${lotteryId}`],
    enabled: !!lotteryId,
  });
}

export function useFilterNumbers() {
  return useMutation({
    mutationFn: async ({ numbers, criteria }: { numbers: number[]; criteria: any }) => {
      const response = await apiRequest('POST', '/api/analysis/filter', { numbers, criteria });
      return response.json();
    },
  });
}

export function useLotteryComparison(lottery1?: string, lottery2?: string) {
  return useQuery({
    queryKey: [`/api/analysis/compare`, { lottery1, lottery2 }],
    enabled: !!lottery1 && !!lottery2,
  });
}

export function useSimulateBets() {
  return useMutation({
    mutationFn: async ({ lotteryId, strategy, betCount }: { 
      lotteryId: string; 
      strategy: string; 
      betCount: number 
    }) => {
      const response = await apiRequest('POST', '/api/analysis/simulate', { 
        lotteryId, 
        strategy, 
        betCount 
      });
      return response.json();
    },
  });
}

export function useAnalysisReport(lotteryId: string) {
  return useQuery({
    queryKey: [`/api/analysis/report/${lotteryId}`],
    enabled: !!lotteryId,
  });
}
