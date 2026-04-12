import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, Brain, Shield, TrendingUp, DollarSign } from "lucide-react";

export default function Landing() {
  const features = [
    {
      icon: <Brain className="h-8 w-8 text-secondary" />,
      title: "IA Avançada",
      description: "Análise inteligente com ChatGPT para maximizar suas chances"
    },
    {
      icon: <TrendingUp className="h-8 w-8 text-neon-green" />,
      title: "Dados Reais",
      description: "Informações oficiais da Loterias Caixa em tempo real"
    },
    {
      icon: <Zap className="h-8 w-8 text-accent" />,
      title: "Gerador Inteligente",
      description: "Estratégias baseadas em padrões e frequências"
    },
    {
      icon: <Shield className="h-8 w-8 text-primary" />,
      title: "Segurança Total",
      description: "Criptografia avançada e dados protegidos"
    }
  ];

  const lotteries = [
    { name: "Mega-Sena", icon: "💎", color: "text-neon-green" },
    { name: "Lotofácil", icon: "⭐", color: "text-neon-purple" },
    { name: "Quina", icon: "🪙", color: "text-neon-pink" },
    { name: "Lotomania", icon: "♾️", color: "text-primary" },
    { name: "Dupla Sena", icon: "👑", color: "text-accent" },
    { name: "+Milionária", icon: "➕", color: "text-neon-gold" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 cyber-grid opacity-10"></div>
        
        <div className="container mx-auto px-4 text-center relative z-10">
          {/* Logo and Title */}
          <div className="flex items-center justify-center space-x-4 mb-8">
            <div className="w-20 h-20 bg-black/20">
              <span className="text-4xl">🦈</span>
            </div>
            <div>
              <h1 className="text-6xl md:text-8xl font-bold neon-text text-primary mb-2">
                Shark Loterias 💵
              </h1>
              <p className="text-xl text-muted-foreground font-mono">
                Powered by Shark062
              </p>
            </div>
          </div>

          {/* Subtitle */}
          <div className="max-w-4xl mx-auto mb-12">
            <h2 className="text-2xl md:text-4xl font-bold text-foreground mb-6">
              🤖 Inteligência Artificial para 
              <span className="text-secondary neon-text"> Maximizar </span>
              suas Chances!
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Análise avançada de todas as modalidades da loteria federal usando IA, 
              dados oficiais em tempo real e estratégias inteligentes para 
              <span className="text-neon-green font-semibold"> aumentar sua assertividade</span>.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button
              onClick={() => window.location.href = '/api/login'}
              size="lg"
              className="bg-black/20"
              data-testid="login-button"
            >
              <Zap className="h-6 w-6 mr-2" />
              COMEÇAR AGORA
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-secondary text-secondary hover:bg-black/20 px-8 py-4 text-xl"
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              data-testid="learn-more-button"
            >
              <Brain className="h-6 w-6 mr-2" />
              Saber Mais
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold text-neon-green neon-text">8</div>
              <div className="text-sm text-muted-foreground">Modalidades</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-accent neon-text">24/7</div>
              <div className="text-sm text-muted-foreground">Análise</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-secondary neon-text">AI</div>
              <div className="text-sm text-muted-foreground">Powered</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary neon-text">100%</div>
              <div className="text-sm text-muted-foreground">Oficial</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-black/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-primary neon-text mb-4">
              Funcionalidades Avançadas
            </h3>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Tecnologia de ponta para análise e geração de jogos inteligentes
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="neon-border bg-black/20 backdrop-blur-sm transition-all duration-300">
                <CardContent className="p-6 text-center">
                  <div className="mb-4 flex justify-center">
                    {feature.icon}
                  </div>
                  <h4 className="text-xl font-bold text-foreground mb-2">
                    {feature.title}
                  </h4>
                  <p className="text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Supported Lotteries */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-primary neon-text mb-4">
              Todas as Modalidades Suportadas
            </h3>
            <p className="text-xl text-muted-foreground">
              Análise completa de todas as loterias federais
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {[
              { name: 'Mega-Sena', icon: '💎', color: 'text-neon-green' },
              { name: 'Lotofácil', icon: '⭐', color: 'text-neon-purple' },
              { name: 'Quina', icon: '🪙', color: 'text-neon-pink' },
              { name: 'Lotomania', icon: '♾️', color: 'text-neon-cyan' },
              { name: 'Dupla Sena', icon: '👑', color: 'text-neon-gold' },
              { name: 'Super Sete', icon: '🚀', color: 'text-secondary' },
              { name: '+Milionária', icon: '➕', color: 'text-accent' },
              { name: 'Timemania', icon: '🎁', color: 'text-destructive' },
              { name: 'Dia de Sorte', icon: '🌟', color: 'text-primary' },
              { name: 'Loteca', icon: '⚽', color: 'text-muted-foreground' },
            ].map((lottery, index) => (
              <Card key={index} className="neon-border bg-black/20 hover:bg-black/20 transition-all duration-300 group">
                <CardContent className="p-6 text-center">
                  <div className="text-4xl mb-3 group-hover:animate-pulse">
                    {lottery.icon}
                  </div>
                  <h4 className={`font-bold ${lottery.color} text-sm`}>
                    {lottery.name}
                  </h4>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-20 bg-black/20">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <h3 className="text-4xl font-bold text-foreground mb-6">
              Pronto para 
              <span className="text-primary neon-text"> Maximizar </span>
              suas Chances?
            </h3>
            <p className="text-xl text-muted-foreground mb-8">
              Junte-se aos usuários que já estão usando IA para melhorar seus resultados nas loterias!
            </p>
            
            <Button
              onClick={() => window.location.href = '/api/login'}
              size="lg"
              className="bg-black/20"
              data-testid="cta-login-button"
            >
              <DollarSign className="h-8 w-8 mr-3" />
              ENTRAR E COMEÇAR
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-black/20 backdrop-blur-sm py-12">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-black/20">
              <span className="text-sm">🦈</span>
            </div>
            <span className="font-bold text-primary neon-text">Powered by Shark062</span>
          </div>
          
          <div className="max-w-2xl mx-auto mb-6">
            <p className="text-sm text-muted-foreground mb-2">
              🤖 <span className="text-secondary">Shark Loterias</span> utiliza inteligência artificial avançada para analisar padrões, 
              aprender continuamente e maximizar suas chances de acerto nas loterias federais.
            </p>
            <p className="text-xs text-muted-foreground opacity-75">
              ⚠️ Disclaimer: Este aplicativo não garante prêmios. Jogue com responsabilidade. 
              Não nos responsabilizamos por perdas financeiras.
            </p>
          </div>

          <div className="flex items-center justify-center space-x-6 text-xs text-muted-foreground">
            <span className="flex items-center space-x-1">
              <Shield className="h-4 w-4 text-primary" />
              <span>Criptografia Avançada</span>
            </span>
            <span className="flex items-center space-x-1">
              <Zap className="h-4 w-4 text-neon-green" />
              <span>Dados Oficiais Caixa</span>
            </span>
            <span className="flex items-center space-x-1">
              <Brain className="h-4 w-4 text-secondary" />
              <span>IA Powered</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
