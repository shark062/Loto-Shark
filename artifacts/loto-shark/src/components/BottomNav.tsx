import { useLocation, Link } from "wouter";
import { Home, Zap, Target, BarChart3, User } from "lucide-react";

const navItems = [
  { href: "/",           label: "Início",      icon: Home     },
  { href: "/generator",  label: "Gerar",       icon: Zap      },
  { href: "/strategies", label: "Estratégias", icon: Target   },
  { href: "/statistics", label: "Estatísticas",icon: BarChart3 },
  { href: "/profile",    label: "Perfil",      icon: User     },
];

export default function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
      <div
        className="border-t border-white/10 flex items-stretch"
        style={{
          background: "rgba(5,5,20,0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = location === href || (href !== "/" && location.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center flex-1 py-2 gap-0.5 text-[10px] font-medium transition-all duration-200 relative"
            >
              <div className={`relative flex items-center justify-center transition-all duration-200 ${active ? "scale-110" : ""}`}>
                {active && (
                  <span className="absolute inset-0 rounded-full bg-primary/20 scale-150 blur-sm" />
                )}
                <Icon
                  className={`h-5 w-5 relative z-10 transition-colors duration-200 ${active ? "text-primary" : "text-muted-foreground"}`}
                  strokeWidth={active ? 2.5 : 1.8}
                />
              </div>
              <span className={`transition-colors duration-200 ${active ? "text-primary" : "text-muted-foreground"}`}>
                {label}
              </span>
              {active && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-primary rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
