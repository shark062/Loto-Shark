import { cn } from "@/lib/utils";

interface NumberBallProps {
  number: number;
  className?: string;
  variant?: "default" | "hot" | "cold" | "selected";
  size?: "sm" | "md" | "lg";
}

export function NumberBall({ number, className, variant = "default", size = "md" }: NumberBallProps) {
  const variants = {
    default: "bg-black/40 border-white/10 text-white/80",
    hot: "bg-destructive/20 border-destructive text-destructive shadow-[0_0_10px_rgba(255,0,0,0.3)]",
    cold: "bg-primary/20 border-primary text-primary shadow-[0_0_10px_rgba(0,255,255,0.3)]",
    selected: "bg-accent border-accent text-white shadow-[0_0_15px_rgba(255,0,255,0.5)] animate-pulse",
  };

  const sizes = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base font-bold",
  };

  return (
    <div className={cn(
      "rounded-full flex items-center justify-center border font-mono transition-all duration-300 select-none",
      variants[variant],
      sizes[size],
      className
    )}>
      {number.toString().padStart(2, '0')}
    </div>
  );
}
