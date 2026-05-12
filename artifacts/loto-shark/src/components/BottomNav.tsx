import { useLocation, Link } from "wouter";
import { Home, Zap, Target, BarChart3, User } from "lucide-react";

const navItems = [
  { href: "/",           label: "Início",       icon: Home      },
  { href: "/generator",  label: "Gerar",        icon: Zap       },
  { href: "/strategies", label: "Estratégias",  icon: Target    },
  { href: "/statistics", label: "Estatísticas", icon: BarChart3 },
  { href: "/profile",    label: "Perfil",       icon: User      },
];

const NAV_BG    = "#07091A";
const NAV_BORDER = "rgba(255,255,255,0.08)";
const ACTIVE_COLOR = "#00D2FF";
const INACTIVE_COLOR = "#5A6A80";
const INDICATOR_COLOR = "#00D2FF";

export default function BottomNav() {
  const [location] = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
      role="navigation"
      aria-label="Navegação principal"
    >
      <div
        style={{
          background: NAV_BG,
          borderTop: `1px solid ${NAV_BORDER}`,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          display: "flex",
          alignItems: "stretch",
          /* Blur seguro — fallback sólido para browsers que não suportam */
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === "/"
            ? location === "/"
            : location === href || location.startsWith(href + "/");

          return (
            <Link
              key={href}
              href={href}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                paddingTop: "10px",
                paddingBottom: "10px",
                gap: "3px",
                position: "relative",
                textDecoration: "none",
                transition: "opacity 0.15s ease",
                cursor: "pointer",
                userSelect: "none",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {/* Indicador ativo — barra no topo */}
              {active && (
                <span
                  style={{
                    position: "absolute",
                    top: 0,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "24px",
                    height: "2px",
                    background: INDICATOR_COLOR,
                    borderRadius: "0 0 4px 4px",
                  }}
                />
              )}

              {/* Ícone */}
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "28px",
                  height: "28px",
                  borderRadius: "8px",
                  background: active ? "rgba(0,210,255,0.12)" : "transparent",
                  transition: "background 0.15s ease",
                }}
              >
                <Icon
                  style={{
                    width: "18px",
                    height: "18px",
                    color: active ? ACTIVE_COLOR : INACTIVE_COLOR,
                    strokeWidth: active ? 2.5 : 1.8,
                    transition: "color 0.15s ease, stroke-width 0.15s ease",
                  }}
                />
              </span>

              {/* Texto */}
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: active ? 600 : 400,
                  color: active ? ACTIVE_COLOR : INACTIVE_COLOR,
                  lineHeight: 1,
                  letterSpacing: "0.01em",
                  transition: "color 0.15s ease",
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
