
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export function useMetaReasoningAnalysis(lotteryId: string) {
  return useQuery({
    queryKey: [`/api/meta-reasoning/analyze/${lotteryId}`],
    enabled: !!lotteryId,
    staleTime: 10 * 60 * 1000, // 10 minutos
  });
}

export function useOptimalCombination(lotteryId: string) {
  return useQuery({
    queryKey: [`/api/meta-reasoning/optimal-combination/${lotteryId}`],
    enabled: !!lotteryId,
    staleTime: 15 * 60 * 1000, // 15 minutos
  });
}

export function useProcessFeedback() {
  return useMutation({
    mutationFn: async ({ 
      lotteryId, 
      contestNumber, 
      actualNumbers 
    }: { 
      lotteryId: string; 
      contestNumber: number; 
      actualNumbers: number[] 
    }) => {
      const response = await apiRequest('POST', '/api/meta-reasoning/feedback', {
        lotteryId,
        contestNumber,
        actualNumbers
      });
      return response.json();
    },
  });
}
