import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Menu,
  Flame,
  Dice6,
  Trophy,
  Brain,
  Info,
  Home,
  Zap,
  History,
  BarChart3,
  Settings,
  User,
  TrendingUp,
  Activity,
  Target
} from "lucide-react";

export default function Navigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location] = useLocation();

  // Hide body scroll when menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  const navItems = [
    {
      href: "/",
      label: "Página Inicial",
      icon: Home,
      emoji: "🏠",
      description: "Painel principal com visão geral"
    },
    {
      href: "/heat-map",
      label: "Mapa de Calor",
      icon: Flame,
      emoji: "🔥❄️♨️",
      description: "Análise de números quentes e frios"
    },
    {
      href: "/generator",
      label: "Gerador",
      icon: Dice6,
      emoji: "🔮",
      description: "Gerar jogos inteligentes"
    },
    {
      href: "/results",
      label: "Resultados",
      icon: Trophy,
      emoji: "📊",
      description: "Histórico de sorteios e prêmios"
    },
    {
      href: "/ai-analysis",
      label: "IA Análises",
      icon: Brain,
      emoji: "🤖",
      description: "Análises avançadas com inteligência artificial"
    },
    {
      href: "/ai-metrics",
      label: "Métricas IA",
      icon: BarChart3,
      color: "from-blue-500 to-cyan-500",
      description: "Performance dos modelos Multi-IA",
      tooltip: "Dashboard de métricas avançadas"
    },
    {
      href: "/ai-providers",
      label: "Provedores IA",
      icon: Settings,
      emoji: "🔑",
      description: "Configurar chaves de API e modelos de IA"
    },
    {
      href: "/information",
      label: "Informações",
      icon: Info,
      emoji: "📚",
      description: "Guia completo das modalidades"
    }
  ];

  const quickActions = [
    {
      action: () => window.location.href = "/generator",
      label: "Gerar Jogos Rápido",
      icon: Zap,
      variant: "primary" as const,
      tooltip: "Gerar jogos com IA instantaneamente"
    },
    {
      action: () => window.location.href = "/results",
      label: "Ver Resultados",
      icon: History,
      variant: "secondary" as const,
      tooltip: "Verificar últimos resultados"
    },
    {
      action: () => window.location.href = "/heat-map",
      label: "Análise Rápida",
      icon: TrendingUp,
      variant: "outline" as const,
      tooltip: "Visualizar tendências dos números"
    },
  ];

  return (
    <>
      {/* Header */}
      <header className="relative z-50 bg-transparent text-white">
        <div className="container mx-auto px-6 py-2 relative">
          <div className="flex items-center justify-between">
            {/* Logo Esquerda */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center">
                <img src="/logo.png" alt="Loto Shark" style={{height:'44px',width:'auto',objectFit:'contain'}} />
              </Link>
            </div>

            {/* Navigation Buttons - Desktop */}
            <div className="hidden lg:flex items-center space-x-6">
              <Button
                variant="ghost"
                className="text-white hover:bg-white/20 font-medium px-6 py-3 text-sm"
                onClick={() => window.location.href = "/ai-analysis"}
                data-testid="nav-analysis"
              >
                ANÁLISE
              </Button>
              <Button
                variant="ghost"
                className="text-white hover:bg-white/20 font-medium px-6 py-3 text-sm"
                onClick={() => window.location.href = "/generator"}
                data-testid="nav-play"
              >
                JOGAR
              </Button>
              <Button
                variant="ghost"
                className="text-white hover:bg-white/20 font-medium px-6 py-3 text-sm"
                onClick={() => window.location.href = "/results"}
                data-testid="nav-results"
              >
                RESULTADOS
              </Button>
            </div>

            {/* Menu Button - Top Right */}
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                data-testid="menu-toggle"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Secondary Navigation Bar - Desktop Only */}
          <div className="hidden lg:flex items-center justify-between mt-2 pt-2 border-t border-border/30">
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <div className="flex items-center space-x-1 bg-neon-green/10 text-neon-green px-2 py-1 rounded-full border border-neon-green/30">
                <div className="w-1.5 h-1.5 bg-neon-green rounded-full"></div>
                <span className="font-mono">Dados Oficiais Caixa</span>
              </div>
              <div className="flex items-center space-x-1 bg-white/[0.07] backdrop-blur-md text-secondary px-2 py-1 rounded-full border border-secondary/30">
                <Brain className="w-3 h-3" />
                <span className="font-mono">IA Ativa</span>
              </div>
              <div className="flex items-center space-x-1 bg-white/[0.07] backdrop-blur-md text-accent px-2 py-1 rounded-full border border-accent/30">
                <BarChart3 className="w-3 h-3" />
                <span className="font-mono">Análise em Tempo Real</span>
              </div>
            </div>

            {/* Current Page Info */}
            <div className="text-xs text-muted-foreground">
              {navItems.find(item => item.href === location)?.description || "Navegação principal"}
            </div>
          </div>
        </div>
      </header>

      {/* Full Screen Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-950/75 z-[60] backdrop-blur-xl"
          data-testid="menu-overlay"
        >
          <div className="container mx-auto px-4 py-8 h-full overflow-y-auto">
            {/* Menu Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/20 rounded-3xl flex items-center justify-center border border-primary/50">
                  <img src="/logo.png" alt="Loto Shark" style={{height:'32px',width:'auto',objectFit:'contain'}} />
                </div>
                <div>
                  <h2 className="text-lg font-bold neon-text text-primary">Shark Loterias</h2>
                  <p className="text-xs text-foreground/70">Menu Principal</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-white hover:text-primary text-2xl font-bold rounded-3xl"
                data-testid="menu-close-button"
              >
                ✕
              </Button>
            </div>

            {/* Navigation Menu */}
            <nav className="space-y-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between p-4 rounded-3xl group ${
                      isActive
                        ? "text-primary bg-primary/20 border border-primary/50"
                        : "text-foreground/80 hover:text-primary hover:bg-primary/10 border border-foreground/10 hover:border-primary/30"
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    data-testid={`nav-link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-10 h-10 rounded-3xl flex items-center justify-center border ${
                        isActive
                          ? 'bg-primary/30 text-primary border-primary/50'
                          : 'bg-foreground/10 text-foreground/70 border-foreground/20 group-hover:bg-primary/20 group-hover:text-primary group-hover:border-primary/40'
                      }`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-medium text-lg">{item.label}</div>
                        <div className="text-xs opacity-70">{item.description}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{item.emoji}</span>
                      <span className="text-xs">→</span>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Quick Actions - Desktop Only */}
      <div className="hidden lg:block fixed top-32 right-6 z-40">
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground text-center mb-2 font-mono">
            ⚡ Ações Rápidas
          </div>
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Button
                key={index}
                onClick={action.action}
                variant={action.variant === "primary" ? "default" : action.variant as any}
                size="sm"
                className={`w-full shadow-lg group relative rounded-2xl ${
                  action.variant === "primary"
                    ? "bg-white/[0.07]"
                    : action.variant === "secondary"
                    ? "bg-white/[0.07]"
                    : "border-2 border-dashed border-primary/30 hover:border-primary hover:bg-white/[0.07]"
                }`}
                data-testid={`quick-action-${action.label.toLowerCase().replace(/\s+/g, '-')}`}
                title={action.tooltip}
              >
                <Icon className="h-4 w-4 mr-2" />
                {action.label}

                {/* Tooltip */}
                <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-card border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap backdrop-blur-sm">
                  {action.tooltip}
                  <div className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-border/50"></div>
                </div>
              </Button>
            );
          })}

          {/* Status Indicator */}
          <div className="mt-4 p-3 bg-white/[0.07] border border-white/10 rounded-2xl backdrop-blur-md">
            <div className="text-xs text-center space-y-1">
              <div className="flex items-center justify-center space-x-1 text-neon-green">
                <div className="w-2 h-2 bg-neon-green rounded-full"></div>
                <span>Sistema Online</span>
              </div>
              <div className="text-muted-foreground">
                IA Ativa • Dados Atualizados
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}