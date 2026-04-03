import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface NeonCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: "primary" | "secondary" | "accent" | "none";
}

export function NeonCard({ children, className, glowColor = "none" }: NeonCardProps) {
  const glows = {
    primary: "border-primary/30 shadow-[0_0_20px_-5px_rgba(0,255,255,0.15)]",
    secondary: "border-secondary/30 shadow-[0_0_20px_-5px_rgba(157,0,255,0.15)]",
    accent: "border-accent/30 shadow-[0_0_20px_-5px_rgba(255,0,255,0.15)]",
    none: "border-white/10"
  };

  return (
    <div className={cn(
      "bg-card/50 backdrop-blur-md border border-white/10 rounded-2xl p-6 relative overflow-hidden group transition-all duration-300",
      glows[glowColor],
      className
    )}>
      {/* Scanline effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent bg-[length:100%_4px] pointer-events-none" />
      
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-white/20 group-hover:border-primary/50 transition-colors" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-white/20 group-hover:border-primary/50 transition-colors" />
      
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
