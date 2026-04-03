import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from './use-toast';

interface Game {
  numbers: number[];
  contestNumber?: number;
}

interface UseBettingPlatformReturn {
  addToCart: (platformId: string, lotteryId: string, games: Game[]) => Promise<void>;
  loading: boolean;
  error: Error | null;
}

export function useBettingPlatform(lotteryId: string) {
  const { toast } = useToast();

  const { data: platforms = [], isLoading } = useQuery({
    queryKey: ['/api/betting-platforms', lotteryId],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/betting-platforms?lotteryId=${lotteryId}`);
        if (!response.ok) {
          console.error('Failed to fetch platforms:', response.statusText);
          return [];
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('Error fetching betting platforms:', error);
        return [];
      }
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const generateCartUrl = async (platformId: string, games: Array<{numbers: number[]}>) => {
    try {
      if (!platformId || !games || games.length === 0) {
        throw new Error('Dados inválidos para geração de URL');
      }

      const response = await fetch('/api/betting-platforms/cart-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platformId, games }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate cart URL');
      }

      const data = await response.json();

      if (!data.success || !data.cartUrl) {
        throw new Error('URL inválida retornada');
      }

      return data.cartUrl;
    } catch (error) {
      console.error('Error generating cart URL:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível gerar o link da plataforma',
        variant: 'destructive',
      });
      return null;
    }
  };

  const openInPlatform = async (platformId: string, games: Array<{numbers: number[]}>) => {
    try {
      if (!platformId) {
        throw new Error('Plataforma não selecionada');
      }

      if (!games || games.length === 0) {
        throw new Error('Nenhum jogo para apostar');
      }

      const url = await generateCartUrl(platformId, games);

      if (!url) {
        throw new Error('Não foi possível gerar URL da plataforma');
      }

      window.open(url, '_blank', 'noopener,noreferrer');

      toast({
        title: 'Redirecionando',
        description: 'Abrindo plataforma de apostas...',
      });
    } catch (error) {
      console.error('Error opening platform:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível abrir a plataforma',
        variant: 'destructive',
      });
    }
  };

  const addToCart = async (platformId: string, lotteryId: string, games: Game[]) => {
    setLoading(true);
    setError(null);

    try {
      const cartItems = games.map(game => ({
        lotteryId,
        numbers: game.numbers,
        contestNumber: game.contestNumber
      }));

      const response = await apiRequest('POST', '/api/betting-platforms/cart-url', {
        platformId,
        games: cartItems
      });

      const data = await response.json();

      if (data.success) {
        // Detecta se é mobile para usar deeplink
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const urlToOpen = (isMobile && data.deepLink) ? data.deepLink : data.cartUrl;

        // Abre em nova aba
        window.open(urlToOpen, '_blank', 'noopener,noreferrer');

        // Feedback de sucesso
        const platformNames: Record<string, string> = {
          superjogo: 'Lotogiro',
          caixa: 'Loterias Caixa',
          lottoland: 'Lottoland'
        };

        toast({
          title: "🎯 Jogos Adicionados!",
          description: `Seus ${games.length} jogo(s) foram adicionados ao carrinho do ${platformNames[platformId] || platformId}`,
        });

        // Analytics (opcional)
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'add_to_cart', {
            platform: platformId,
            lottery: lotteryId,
            games_count: games.length
          });
        }
      } else {
        throw new Error(data.error || 'Falha ao gerar URL do carrinho');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(err instanceof Error ? err : new Error(errorMessage));

      toast({
        title: "Erro ao Adicionar",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    addToCart,
    loading,
    error,
    platforms,
    isLoadingPlatforms: isLoading,
    openInPlatform
  };
}