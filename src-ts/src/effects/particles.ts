/**
 * Cursor particle effects
 */

import type { ParticleEffect, ParticleEffectType } from '@/types/index.ts';

/** Particle effect configurations */
export const CURSOR_EFFECTS: Record<ParticleEffectType, ParticleEffect> = {
  // Flames
  'flame-orange': { particle: 'particle-flame-orange', interval: 40, size: [10, 18], duration: 800 },
  'flame-blue': { particle: 'particle-flame-blue', interval: 40, size: [10, 18], duration: 800 },
  'flame-white': { particle: 'particle-flame-white', interval: 35, size: [10, 20], duration: 700 },
  'flame-red': { particle: 'particle-flame-red', interval: 45, size: [10, 18], duration: 800 },

  // Smoke
  'smoke-green': { particle: 'particle-smoke-green', interval: 50, size: [8, 16], duration: 1000 },

  // Sparkles
  'sparkle-gold': { particle: 'particle-sparkle-gold', interval: 80, size: [6, 12], duration: 600 },
  'sparkle-silver': { particle: 'particle-sparkle-silver', interval: 80, size: [6, 12], duration: 600 },
  'sparkle-rainbow': { particle: 'particle-sparkle-rainbow', interval: 60, size: [8, 14], duration: 1000 },

  // Glows
  'glow-white': { particle: 'particle-glow-white', interval: 100, size: [12, 20], duration: 1200 },
  'glow-pink': { particle: 'particle-glow-pink', interval: 80, size: [10, 18], duration: 1000 },

  // Special
  matrix: { particle: 'particle-matrix', interval: 30, size: [3, 6], duration: 1500 },
  glitch: { particle: 'particle-glitch', interval: 60, size: [8, 16], duration: 500 },
  lava: { particle: 'particle-lava', interval: 60, size: [10, 18], duration: 1200 },
  rasta: { particle: 'particle-rasta', interval: 70, size: [8, 14], duration: 1000 },
  dragon: { particle: 'particle-dragon', interval: 45, size: [10, 18], duration: 900 },
} as const;

/** Map cursor IDs to their effects */
export const CURSOR_TO_EFFECT: Partial<Record<string, ParticleEffectType>> = {
  // Streak flames (tiers 101-103)
  'orange-flame': 'flame-orange', // 101 - Week Warrior
  'blue-flame': 'flame-blue', // 102 - Month Master
  'white-flame': 'flame-white', // 103 - Perfect Attendance

  // Meme cursors with effects (tier 500+)
  'smoke-green': 'smoke-green', // 501 - Blaze It (420)
  'demon-red': 'flame-red', // 502 - Devil's Click (666)
  'casino-gold': 'sparkle-gold', // 503 - Lucky 7s (777)
  'matrix-green': 'matrix', // 504 - Elite (1337)
  'silver-sparkle': 'sparkle-silver', // 522 - Make a Wish (11111)
  'white-glow': 'glow-white', // 523 - Six Ones (111111)
  'gold-sparkle': 'sparkle-gold', // 526 - Slot Machine God (777777)
  'glitch-purple': 'glitch', // 532 - One Away (999999)
  lava: 'lava', // 510 - Maximum Evil (666666)
  rasta: 'rasta', // 509 - Double Blaze (420420)
  'hot-pink': 'glow-pink', // 511 - Nice Nice Nice (696969)
  dragon: 'dragon', // 529 - Fortune (888888)

  // High-tier personal milestones
  prismatic: 'sparkle-rainbow', // 11 - Transcendent (500K)
  god: 'sparkle-gold', // 12 - Click God (1M) - golden aura
} as const;

/** Particle container element */
let container: HTMLElement | null = null;

/** Current effect type */
let currentEffect: ParticleEffectType | null = null;

/** Last particle spawn time */
let lastSpawnTime = 0;

/**
 * Initialize particles with container element
 */
export function initParticles(element: HTMLElement): void {
  container = element;
}

/**
 * Set the current particle effect
 */
export function setParticleEffect(cursorId: string | null): void {
  if (!cursorId) {
    currentEffect = null;
    return;
  }

  currentEffect = CURSOR_TO_EFFECT[cursorId] ?? null;
}

/**
 * Get the current effect type
 */
export function getCurrentEffect(): ParticleEffectType | null {
  return currentEffect;
}

/**
 * Spawn a particle at the given position (called on mouse move)
 */
export function spawnParticleAtCursor(x: number, y: number): void {
  if (!container || !currentEffect) return;

  const effect = CURSOR_EFFECTS[currentEffect];
  if (!effect) return;

  const now = Date.now();
  if (now - lastSpawnTime < effect.interval) return;
  lastSpawnTime = now;

  spawnParticle(x, y, effect);
}

/**
 * Spawn a particle with given effect
 */
export function spawnParticle(x: number, y: number, effect: ParticleEffect): void {
  if (!container) return;

  const particle = document.createElement('div');
  particle.className = `cursor-particle ${effect.particle}`;

  // Random size within range
  const size = effect.size[0] + Math.random() * (effect.size[1] - effect.size[0]);
  particle.style.width = size + 'px';
  particle.style.height = size + 'px';

  // Slight random offset for organic feel
  const offsetX = (Math.random() - 0.5) * 10;
  const offsetY = (Math.random() - 0.5) * 10;
  particle.style.left = x + offsetX + 'px';
  particle.style.top = y + offsetY + 'px';

  // Set CSS variables for floatAway animation direction
  const dx = (Math.random() - 0.5) * 40;
  const dy = -20 - Math.random() * 30; // Mostly upward
  particle.style.setProperty('--dx', dx + 'px');
  particle.style.setProperty('--dy', dy + 'px');

  container.appendChild(particle);

  // Remove particle after animation completes
  setTimeout(() => {
    particle.remove();
  }, effect.duration);
}

/**
 * Clear all particles
 */
export function clearParticles(): void {
  if (container) {
    container.innerHTML = '';
  }
}

/**
 * Clean up particles resources
 */
export function destroyParticles(): void {
  clearParticles();
  container = null;
  currentEffect = null;
}
