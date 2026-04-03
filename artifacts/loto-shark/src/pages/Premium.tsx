import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Check, Crown, Zap, BarChart3, TrendingUp, Sparkles } from 'lucide-react';

export default function Premium() {
  const { toast } = useToast();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    },
  });

  const handleUpgrade = async (months: number) => {
    setLoadingPlan(`${months}m`);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ months }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      localStorage.setItem('user', JSON.stringify(data.user));

      toast({
        title: 'Sucesso!',
        description: `Parabéns! Você agora é Premium por ${months} mês(es)`,
      });

      window.location.reload();
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Falha ao fazer upgrade',
        variant: 'destructive',
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  const isPremium = user?.role === 'PREMIUM';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />

      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold neon-text text-primary mb-4 flex items-center justify-center">
            <Crown className="h-10 w-10 mr-3 text-neon-gold" />
            Planos Premium
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {isPremium ? '✨ Você é Premium!' : 'Desbloqueie recursos avançados de análise e previsão'}
          </p>
        </div>

        {/* Current Plan */}
        {isPremium && (
          <Card className="bg-gradient-to-r from-neon-gold/20 to-primary/20 border-neon-gold/50 mb-8">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-neon-gold mb-1">Status Premium Ativo</h3>
                  <p className="text-muted-foreground">
                    {user?.subscriptionExpires
                      ? `Válido até ${new Date(user.subscriptionExpires).toLocaleDateString('pt-BR')}`
                      : 'Acesso vitalício'}
                  </p>
                </div>
                <Badge className="bg-neon-gold text-black text-lg px-4 py-2">
                  <Check className="h-4 w-4 mr-2" />
                  Ativo
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Free Plan */}
          <Card className="bg-black/20 border-border/50">
            <CardHeader>
              <CardTitle>Plano Free</CardTitle>
              <CardDescription>Análise básica</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="text-3xl font-bold text-primary">R$ 0</div>
                <p className="text-sm text-muted-foreground">para sempre</p>
              </div>

              <ul className="space-y-3">
                {[
                  'Frequência simples',
                  '1 jogo inteligente/dia',
                  'Sem simulação',
                  'Sem exportação',
                ].map((feature) => (
                  <li key={feature} className="flex items-start">
                    <div className="h-5 w-5 rounded-full bg-muted mr-3 mt-0.5 flex items-center justify-center">
                      <Check className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button disabled variant="outline" className="w-full">
                {isPremium ? 'Plano Atual' : 'Selecionado'}
              </Button>
            </CardContent>
          </Card>

          {/* Monthly Plan */}
          <Card className="bg-black/20 border-primary/50 ring-2 ring-primary/30">
            <CardHeader>
              <Badge className="w-fit bg-primary/20 text-primary mb-2">Mais Popular</Badge>
              <CardTitle>Plano Mensal</CardTitle>
              <CardDescription>Renovação automática</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="text-3xl font-bold text-primary">R$ 29</div>
                <p className="text-sm text-muted-foreground">/mês</p>
              </div>

              <ul className="space-y-3">
                {[
                  'Estatísticas avançadas',
                  'Gerador ilimitado',
                  'Simulações',
                  'Exportação CSV',
                  'Histórico salvo',
                ].map((feature) => (
                  <li key={feature} className="flex items-start">
                    <Check className="h-5 w-5 text-neon-green mr-3 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleUpgrade(1)}
                disabled={loadingPlan === '1m' || isPremium}
                className="w-full bg-primary hover:bg-primary/90"
              >
                <Zap className="h-4 w-4 mr-2" />
                {loadingPlan === '1m' ? 'Processando...' : 'Assinar Agora'}
              </Button>
            </CardContent>
          </Card>

          {/* Lifetime Plan */}
          <Card className="bg-black/20 border-neon-gold/50">
            <CardHeader>
              <Badge className="w-fit bg-neon-gold/20 text-neon-gold mb-2">Melhor Valor</Badge>
              <CardTitle>Acesso Vitalício</CardTitle>
              <CardDescription>Sem renovação</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="text-3xl font-bold text-neon-gold">R$ 199</div>
                <p className="text-sm text-muted-foreground">uma vez</p>
              </div>

              <ul className="space-y-3">
                {[
                  'Tudo do Premium',
                  'Acesso perpétuo',
                  'Sem renovação',
                  'Suporte prioritário',
                  'Atualizações futuras',
                ].map((feature) => (
                  <li key={feature} className="flex items-start">
                    <Check className="h-5 w-5 text-neon-gold mr-3 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleUpgrade(1000)}
                disabled={loadingPlan === '1000m' || isPremium}
                className="w-full bg-neon-gold hover:bg-neon-gold/90 text-black"
              >
                <Crown className="h-4 w-4 mr-2" />
                {loadingPlan === '1000m' ? 'Processando...' : 'Comprar'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Features Comparison */}
        <Card className="bg-black/20 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2 text-primary" />
              Comparação de Recursos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/50">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold">Recurso</th>
                    <th className="text-center py-3 px-4 font-semibold">Free</th>
                    <th className="text-center py-3 px-4 font-semibold">Premium</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Frequência de números', true, true],
                    ['Heatmap de frequência', true, true],
                    ['Geração de jogos', true, true],
                    ['Análise por período', false, true],
                    ['Simulações avançadas', false, true],
                    ['Exportação de dados', false, true],
                    ['Histórico completo', false, true],
                    ['API access', false, true],
                  ].map(([feature, free, premium]) => (
                    <tr key={String(feature)} className="border-b border-border/30">
                      <td className="py-3 px-4">{feature}</td>
                      <td className="text-center py-3 px-4">
                        {free ? (
                          <Check className="h-5 w-5 text-neon-green mx-auto" />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="text-center py-3 px-4">
                        {premium ? (
                          <Check className="h-5 w-5 text-neon-gold mx-auto" />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        {!isPremium && (
          <div className="mt-12 text-center p-8 bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg border border-primary/20">
            <h3 className="text-2xl font-bold mb-3">Pronto para evoluir?</h3>
            <p className="text-muted-foreground mb-6">
              Desbloqueie análises profissionais e simulações avançadas
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Button
                onClick={() => handleUpgrade(1)}
                className="bg-primary hover:bg-primary/90"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Assinar Premium
              </Button>
              <Button
                onClick={() => handleUpgrade(1000)}
                variant="outline"
                className="border-neon-gold text-neon-gold"
              >
                <Crown className="h-4 w-4 mr-2" />
                Acesso Vitalício
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
