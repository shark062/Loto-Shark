import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CelebrationAnimationProps {
  isVisible: boolean;
  prizeAmount?: string;
  onComplete?: () => void;
}

interface Confetti {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  rotation: number;
  velocity: { x: number; y: number };
}

export default function CelebrationAnimation({ 
  isVisible, 
  prizeAmount,
  onComplete 
}: CelebrationAnimationProps) {
  const [confetti, setConfetti] = useState<Confetti[]>([]);
  const [show, setShow] = useState(false); // Added state for controlling visibility within the component

  useEffect(() => {
    if (isVisible) {
      // Generate confetti particles
      const particles: Confetti[] = [];
      const colors = ['#00FFFF', '#8B5CF6', '#10F554', '#FF10F0', '#FFD700'];

      for (let i = 0; i < 100; i++) {
        particles.push({
          id: i,
          x: Math.random() * window.innerWidth,
          y: -10,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: Math.random() * 8 + 4,
          rotation: Math.random() * 360,
          velocity: {
            x: (Math.random() - 0.5) * 4,
            y: Math.random() * 3 + 2,
          },
        });
      }

      setConfetti(particles);
      setShow(true); // Set show to true when visible

      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        setShow(false); // Hide the animation
        if (onComplete) {
          onComplete(); // Call the onComplete callback
        }
      }, 5000);

      return () => clearTimeout(timer); // Cleanup the timer
    } else {
      setConfetti([]); // Clear confetti when not visible
      setShow(false); // Ensure show is false when not visible
    }
  }, [isVisible]); // Only isVisible as dependency to prevent infinite loop

  return (
    <AnimatePresence>
      {show && ( // Use the local 'show' state to control rendering
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 pointer-events-none z-50 overflow-hidden"
          data-testid="celebration-animation"
        >
          {/* Confetti Particles */}
          {confetti.map((particle) => (
            <motion.div
              key={particle.id}
              initial={{
                x: particle.x,
                y: particle.y,
                rotate: particle.rotation,
                scale: 0,
              }}
              animate={{
                x: particle.x + particle.velocity.x * 100,
                y: window.innerHeight + 50,
                rotate: particle.rotation + 720,
                scale: 1,
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                ease: "easeOut",
              }}
              className="absolute"
              style={{
                width: particle.size,
                height: particle.size,
                backgroundColor: particle.color,
                borderRadius: Math.random() > 0.5 ? '50%' : '0%',
              }}
            />
          ))}

          {/* Celebration Message */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              transition={{ 
                type: "spring", 
                stiffness: 260, 
                damping: 20,
                delay: 0.2 
              }}
              className="text-center"
            >
              <motion.div
                className="text-8xl mb-4"
              >
                🎉
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-4xl font-bold text-neon-gold neon-text mb-4"
              >
                PARABÉNS!
              </motion.h2>

              {prizeAmount && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="text-2xl font-bold text-neon-green neon-text mb-4"
                >
                  Você ganhou {prizeAmount}!
                </motion.div>
              )}

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="text-lg text-primary mb-6"
              >
                Continue jogando com Shark Loterias!
              </motion.p>

              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.1 }}
                className="flex justify-center space-x-4"
              >
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onComplete}
                  className="bg-black/20"
                  data-testid="celebration-continue-button"
                >
                  🎰 Gerar Novos Jogos
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => window.location.href = '/results'}
                  className="bg-black/20"
                  data-testid="celebration-results-button"
                >
                  📊 Ver Resultados
                </motion.button>
              </motion.div>
            </motion.div>
          </div>

          {/* Background Glow Effect */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-radial from-neon-gold/20 via-transparent to-transparent"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}