import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CyberpunkEffectsProps {
  intensity?: 'low' | 'medium' | 'high';
  glitchActive?: boolean;
  matrixRain?: boolean;
  scanLines?: boolean;
  className?: string;
}

// Componente de efeito Matrix Rain
const MatrixRain = ({ active }: { active: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789SHARK💎⭐🪙';
    const charArray = chars.split('');
    const fontSize = 14;
    const columns = canvas.width / fontSize;
    const drops: number[] = [];

    for (let x = 0; x < columns; x++) {
      drops[x] = 1;
    }

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = 'rgba(0, 255, 255, 0.8)';
      ctx.font = fontSize + 'px monospace';

      for (let i = 0; i < drops.length; i++) {
        const text = charArray[Math.floor(Math.random() * charArray.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    const interval = setInterval(draw, 35);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-10 opacity-20"
      style={{ background: 'transparent' }}
    />
  );
};

// Componente de linhas de scan
const ScanLines = ({ active }: { active: boolean }) => {
  if (!active) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-20 opacity-30">
      <div
        className="w-full h-full"
        style={{
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 255, 255, 0.03) 2px,
            rgba(0, 255, 255, 0.03) 4px
          )`
        }}
      />
    </div>
  );
};

// Componente de efeito glitch
const GlitchOverlay = ({ active }: { active: boolean }) => {
  const [glitchFrame, setGlitchFrame] = useState(0);

  useEffect(() => {
    if (!active) return;

    const interval = setInterval(() => {
      setGlitchFrame(prev => (prev + 1) % 10);
    }, 100);

    return () => clearInterval(interval);
  }, [active]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-30 mix-blend-multiply">
      <div
        className="w-full h-full opacity-20"
        style={{
          background: `
            linear-gradient(
              ${glitchFrame * 36}deg,
              transparent 70%,
              rgba(255, 0, 100, 0.1) 70.5%,
              rgba(255, 0, 100, 0.1) 71%,
              transparent 71.5%
            ),
            linear-gradient(
              ${(glitchFrame * -23) % 360}deg,
              transparent 85%,
              rgba(0, 255, 255, 0.1) 85.5%,
              rgba(0, 255, 255, 0.1) 86%,
              transparent 86.5%
            )
          `,
          transform: `translateX(${Math.sin(glitchFrame * 0.5) * 2}px)`
        }}
      />
    </div>
  );
};

// Componente principal
export default function CyberpunkEffects({
  intensity = 'medium',
  glitchActive = false,
  matrixRain = true,
  scanLines = true,
  className = ''
}: CyberpunkEffectsProps) {
  const [currentIntensity, setCurrentIntensity] = useState(intensity);

  const getIntensitySettings = (level: string) => {
    switch (level) {
      case 'high':
        return {
          matrixActive: matrixRain,
          scanActive: scanLines,
          glitchActive: glitchActive,
          particleCount: 100
        };
      case 'medium':
        return {
          matrixActive: matrixRain && Math.random() > 0.3,
          scanActive: scanLines,
          glitchActive: glitchActive && Math.random() > 0.7,
          particleCount: 50
        };
      case 'low':
      default:
        return {
          matrixActive: false,
          scanActive: scanLines && Math.random() > 0.5,
          glitchActive: false,
          particleCount: 20
        };
    }
  };

  const settings = getIntensitySettings(currentIntensity);

  return (
    <div className={className}>
      <MatrixRain active={settings.matrixActive} />
      <ScanLines active={settings.scanActive} />
      <GlitchOverlay active={settings.glitchActive} />
    </div>
  );
}

// Hook para controlar efeitos cyberpunk
export function useCyberpunkEffects() {
  const [intensity, setIntensity] = useState<'low' | 'medium' | 'high'>('medium');
  const [glitchActive, setGlitchActive] = useState(false);
  const [matrixRain, setMatrixRain] = useState(true);
  const [scanLines, setScanLines] = useState(true);

  const triggerGlitch = (duration = 2000) => {
    setGlitchActive(true);
    setTimeout(() => setGlitchActive(false), duration);
  };

  const activateSharkMode = () => {
    setIntensity('high');
    setGlitchActive(true);
    setMatrixRain(true);
    setScanLines(true);
    
    // Volta ao normal após 5 segundos
    setTimeout(() => {
      setIntensity('medium');
      setGlitchActive(false);
    }, 5000);
  };

  return {
    intensity,
    glitchActive,
    matrixRain,
    scanLines,
    setIntensity,
    setGlitchActive,
    setMatrixRain,
    setScanLines,
    triggerGlitch,
    activateSharkMode
  };
}