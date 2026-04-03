
export class SoundEffects {
  private context: AudioContext | null = null;
  private enabled: boolean = false;

  constructor() {
    // Sound effects disabled
  }

  // Métodos vazios para manter compatibilidade
  enableSounds() {
    this.enabled = false;
  }

  disableSounds() {
    this.enabled = false;
  }

  playWinSound() {
    // No sound
  }

  playClickSound() {
    // No sound
  }

  playNotificationSound() {
    // No sound
  }

  playErrorSound() {
    // No sound
  }

  playSuccessSound() {
    // No sound
  }

  playAnalysisCompleteSound() {
    // No sound
  }

  playSharkModeSound() {
    // No sound
  }

  playNumberSelectSound() {
    // No sound
  }

  playGenerateSound() {
    // No sound
  }

  stopAllSounds() {
    // No sounds to stop
  }

  setVolume(volume: number) {
    // No volume to set
  }
}

export const soundEffects = new SoundEffects();

// Exportações adicionais para compatibilidade
export const cyberpunkSound = {
  play: () => {}, // No sound
  stop: () => {}, // No sound
  setVolume: (volume: number) => {} // No volume to set
};

export const playWinSound = () => {}; // No sound
export const playClickSound = () => {}; // No sound
export const playNotificationSound = () => {}; // No sound
export const playErrorSound = () => {}; // No sound
export const playSuccessSound = () => {}; // No sound
export const playAnalysisCompleteSound = () => {}; // No sound
export const playSharkModeSound = () => {}; // No sound
export const playNumberSelectSound = () => {}; // No sound
export const playGenerateSound = () => {}; // No sound
