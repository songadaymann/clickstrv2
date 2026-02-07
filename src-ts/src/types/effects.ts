/**
 * Visual effects types
 */

/** Particle effect configuration */
export interface ParticleEffect {
  readonly particle: string; // CSS class name
  readonly interval: number; // ms between spawns
  readonly size: readonly [number, number]; // [min, max] px
  readonly duration: number; // animation length ms
}

/** All available particle effect types */
export type ParticleEffectType =
  // Flames
  | 'flame-orange'
  | 'flame-blue'
  | 'flame-white'
  | 'flame-red'
  // Smoke
  | 'smoke-green'
  // Sparkles
  | 'sparkle-gold'
  | 'sparkle-silver'
  | 'sparkle-rainbow'
  // Glows
  | 'glow-white'
  | 'glow-pink'
  // Special
  | 'matrix'
  | 'glitch'
  | 'lava'
  | 'rasta'
  | 'dragon';

/** Confetti particle state */
export interface ConfettiParticle {
  x: number;
  y: number;
  size: number;
  color: string;
  speedY: number;
  speedX: number;
  rotation: number;
  rotationSpeed: number;
  shape: 'rect' | 'circle';
}

/** Cursor configuration with effect mapping */
export interface CursorConfig {
  readonly id: string;
  readonly effect?: ParticleEffectType;
}
