/**
 * Effects exports
 */

// Confetti
export { initConfetti, launchConfetti, stopConfetti, destroyConfetti } from './confetti.ts';

// Disco
export { initDisco, triggerDisco, stopDisco, isDiscoActive, destroyDisco } from './disco.ts';

// Particles
export {
  CURSOR_EFFECTS,
  CURSOR_TO_EFFECT,
  initParticles,
  setParticleEffect,
  getCurrentEffect,
  spawnParticleAtCursor,
  spawnParticle,
  clearParticles,
  destroyParticles,
} from './particles.ts';

// Cursor
export {
  initCursor,
  applyCursor,
  resetCursor,
  getEquippedCursorName,
  equipCursor,
  showTemporaryCursor,
  clearTemporaryCursor,
  destroyCursor,
} from './cursor.ts';

// Sounds
export {
  preloadSounds,
  playButtonDown,
  playButtonUp,
  playMilestoneSound,
  playGlobalMilestoneSound,
  playCashMachineSound,
  destroySounds,
} from './sounds.ts';

// Celebrations
export { celebratePersonalMilestone, celebrateGlobalMilestone } from './celebrations.ts';
