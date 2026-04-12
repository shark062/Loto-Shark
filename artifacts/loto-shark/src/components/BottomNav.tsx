import { useLocation, Link } from "wouter";
import { Home, Dice6, Flame, History, BarChart3 } from "lucide-react";

const navItems = [
  { href: "/",           label: "Início",    icon: Home      },
  { href: "/generator",  label: "Jogar",     icon: Dice6     },
  { href: "/heat-map",   label: "Calor",     icon: Flame     },
  { href: "/results",    label: "Resultados",icon: History   },
  { href: "/ai-analysis",label: "Análise",   icon: BarChart3 },
];

export default function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
      {/* glass bar */}
      <div
        className="border-t border-white/10 flex items-stretch"
        style={{
          background: "rgba(5,5,20,0.88)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = location === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center flex-1 py-2 gap-0.5 text-[10px] font-medium transition-colors ${
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon
                className={`h-5 w-5 transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
                strokeWidth={active ? 2.5 : 1.8}
              />
              <span>{label}</span>
              {active && (
                <span className="absolute bottom-0 w-8 h-0.5 bg-primary rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
