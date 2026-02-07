/**
 * Sound effect management
 */

/** Preloaded audio elements */
let soundDown: HTMLAudioElement | null = null;
let soundUp: HTMLAudioElement | null = null;
let soundMilestone: HTMLAudioElement | null = null;
let soundGlobalMilestone: HTMLAudioElement | null = null;
let soundCashMachine: HTMLAudioElement | null = null;

/** Whether sounds are loaded */
let isLoaded = false;

/**
 * Preload all sound effects
 */
export function preloadSounds(): void {
  if (isLoaded) return;

  soundDown = new Audio('button-down.mp3');
  soundUp = new Audio('button-up.mp3');
  soundMilestone = new Audio('sounds/zeldasound.mp3');
  soundGlobalMilestone = new Audio('sounds/globalMilestone.mp3');
  soundCashMachine = new Audio('sounds/Cash Machine.mp3');

  // Set preload hint
  soundDown.preload = 'auto';
  soundUp.preload = 'auto';
  soundMilestone.preload = 'auto';
  soundGlobalMilestone.preload = 'auto';
  soundCashMachine.preload = 'auto';

  isLoaded = true;
}

/**
 * Play button down sound
 */
export function playButtonDown(): void {
  if (soundDown) {
    // Clone to allow overlapping sounds
    soundDown.cloneNode(true) as HTMLAudioElement;
    (soundDown.cloneNode() as HTMLAudioElement).play().catch(() => {
      // Ignore autoplay errors
    });
  }
}

/**
 * Play button up sound
 */
export function playButtonUp(): void {
  if (soundUp) {
    (soundUp.cloneNode() as HTMLAudioElement).play().catch(() => {
      // Ignore autoplay errors
    });
  }
}

/**
 * Play milestone achievement sound
 */
export function playMilestoneSound(): void {
  if (soundMilestone) {
    (soundMilestone.cloneNode() as HTMLAudioElement).play().catch(() => {
      // Ignore autoplay errors
    });
  }
}

/**
 * Play global milestone achievement sound
 */
export function playGlobalMilestoneSound(): void {
  if (soundGlobalMilestone) {
    (soundGlobalMilestone.cloneNode() as HTMLAudioElement).play().catch(() => {
      // Ignore autoplay errors
    });
  }
}

/**
 * Play cash machine sound (for successful token claims)
 */
export function playCashMachineSound(): void {
  if (soundCashMachine) {
    (soundCashMachine.cloneNode() as HTMLAudioElement).play().catch(() => {
      // Ignore autoplay errors
    });
  }
}

/**
 * Clean up sound resources
 */
export function destroySounds(): void {
  soundDown = null;
  soundUp = null;
  soundMilestone = null;
  soundGlobalMilestone = null;
  soundCashMachine = null;
  isLoaded = false;
}
