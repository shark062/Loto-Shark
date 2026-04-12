import { useState, useEffect } from "react"; // Added useEffect import
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ExternalLink, ShoppingCart, Smartphone, Globe } from "lucide-react";

// Assuming useBettingPlatform hook exists and is imported
// import { useBettingPlatform } from "@/hooks/useBettingPlatform"; 

interface BettingPlatformIntegrationProps {
  lotteryId: string;
  games: Array<{ numbers: number[]; contestNumber?: number }>;
  onSuccess?: () => void;
}

interface Platform {
  id: string;
  name: string;
  authRequired: boolean;
}

export default function BettingPlatformIntegration({
  lotteryId,
  games,
  onSuccess
}: BettingPlatformIntegrationProps) {
  const [loading, setLoading] = useState(false);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const { toast } = useToast();

  // Fetch platforms when the component mounts
  useEffect(() => { // Changed useState to useEffect for side effects
    fetchPlatforms();
  }, []); // Empty dependency array ensures it runs only once on mount

  const fetchPlatforms = async () => {
    try {
      // Using apiRequest for consistency, assuming it handles base URL and errors appropriately
      const response = await apiRequest('GET', `/api/betting-platforms?lotteryId=${lotteryId}`);
      const data = await response.json();
      setPlatforms(data);
    } catch (error) {
      console.error('Error fetching platforms:', error);
      toast({
        title: "Erro ao carregar plataformas",
        description: "Não foi possível buscar as plataformas de aposta. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const addToCart = async (platformId: string) => {
    setLoading(true);
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
        // Abre a URL em nova aba
        window.open(data.cartUrl, '_blank', 'noopener,noreferrer');

        toast({
          title: "🎯 Sucesso!",
          description: `Seus jogos foram adicionados ao carrinho do ${platformId === 'superjogo' ? 'Lotogiro' : platformId === 'caixa' ? 'Loterias Caixa' : 'Lottoland'}`,
        });

        if (onSuccess) onSuccess();
      } else {
        toast({
          title: "Erro ao adicionar ao carrinho",
          description: data.message || "Ocorreu um erro inesperado. Tente novamente.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar ao carrinho. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Conditional rendering based on loading and platform availability
  if (loading) { // Renamed from isLoading to loading for consistency with state variable
    return (
      <Card className="neon-border bg-black/20 backdrop-blur-sm">
        <CardContent className="p-6 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Processando sua solicitação...</p>
        </CardContent>
      </Card>
    );
  }

  if (!platforms || platforms.length === 0) {
    // Render a message if no platforms are available or an error occurred during fetch
    return (
      <Card className="neon-border bg-black/20 backdrop-blur-sm">
        <CardContent className="p-6 text-center">
          <p className="text-sm text-muted-foreground">Nenhuma plataforma de aposta disponível no momento.</p>
        </CardContent>
      </Card>
    );
  }

  if (!games || games.length === 0) {
    return null; // No games to bet on
  }

  return (
    <Card className="neon-border bg-black/20 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-accent flex items-center">
          <ShoppingCart className="h-5 w-5 mr-2" />
          Apostar em Plataformas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Adicione seus jogos gerados diretamente ao carrinho de compras das plataformas parceiras:
        </p>

        <div className="grid gap-3">
          {/* Lotogiro */}
          <Card className="bg-black/30 border-primary/30 hover:border-primary/50 transition-all">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-neon-green to-primary flex items-center justify-center">
                    <Globe className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">Lotogiro</h4>
                    <p className="text-xs text-muted-foreground">Plataforma brasileira de loterias</p>
                  </div>
                </div>
                <Button
                  onClick={() => addToCart('superjogo')}
                  disabled={loading}
                  className="bg-primary hover:bg-primary/90"
                  size="sm"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Loterias Caixa */}
          <Card className="bg-black/30 border-accent/30 hover:border-accent/50 transition-all">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-accent to-secondary flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground flex items-center">
                      Loterias Caixa
                      <Badge variant="outline" className="ml-2 text-xs">Oficial</Badge>
                    </h4>
                    <p className="text-xs text-muted-foreground">Site oficial da Caixa Econômica</p>
                  </div>
                </div>
                <Button
                  onClick={() => addToCart('caixa')}
                  disabled={loading}
                  className="bg-accent hover:bg-accent/90"
                  size="sm"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Lottoland */}
          <Card className="bg-black/30 border-secondary/30 hover:border-secondary/50 transition-all">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-secondary to-neon-purple flex items-center justify-center">
                    <Smartphone className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">Lottoland</h4>
                    <p className="text-xs text-muted-foreground">Apostas internacionais</p>
                  </div>
                </div>
                <Button
                  onClick={() => addToCart('lottoland')}
                  disabled={loading}
                  className="bg-secondary hover:bg-secondary/90"
                  size="sm"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-xs text-muted-foreground bg-black/20 p-3 rounded-lg border border-border/30">
          <p className="font-medium mb-1">ℹ️ Como funciona:</p>
          <ul className="space-y-1 ml-4">
            <li>• Clique em "Adicionar" na plataforma desejada</li>
            <li>• Uma nova aba será aberta com seus jogos no carrinho</li>
            <li>• Complete sua compra diretamente na plataforma escolhida</li>
            <li>• Algumas plataformas podem exigir login/cadastro</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}