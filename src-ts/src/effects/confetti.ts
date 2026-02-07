/**
 * Confetti celebration effect
 */

import type { ConfettiParticle } from '@/types/index.ts';

/** Confetti colors */
const COLORS = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffd700', '#ff6600'];

/** Canvas and context */
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;

/** Active particles */
let particles: ConfettiParticle[] = [];

/** Animation frame ID */
let animationId: number | null = null;

/**
 * Initialize confetti with a canvas element
 */
export function initConfetti(canvasElement: HTMLCanvasElement): void {
  canvas = canvasElement;
  ctx = canvas.getContext('2d');
  resizeCanvas();

  // Listen for window resize
  window.addEventListener('resize', resizeCanvas);
}

/**
 * Resize canvas to match window
 */
function resizeCanvas(): void {
  if (canvas) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
}

/**
 * Create a single confetti particle
 */
function createParticle(): ConfettiParticle {
  if (!canvas) {
    throw new Error('Canvas not initialized');
  }

  return {
    x: Math.random() * canvas.width,
    y: -20,
    size: Math.random() * 10 + 5,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    speedY: Math.random() * 3 + 2,
    speedX: (Math.random() - 0.5) * 4,
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 10,
    shape: Math.random() > 0.5 ? 'rect' : 'circle',
  };
}

/**
 * Animate confetti particles
 */
function animate(): void {
  if (!ctx || !canvas) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Remove particles that have fallen off screen
  particles = particles.filter(p => p.y < canvas!.height + 20);

  // Update and draw particles
  for (const p of particles) {
    p.y += p.speedY;
    p.x += p.speedX;
    p.rotation += p.rotationSpeed;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate((p.rotation * Math.PI) / 180);
    ctx.fillStyle = p.color;

    if (p.shape === 'rect') {
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (particles.length > 0) {
    animationId = requestAnimationFrame(animate);
  } else {
    animationId = null;
  }
}

/**
 * Launch confetti effect
 * @param duration Duration in milliseconds (default 3000)
 */
export function launchConfetti(duration = 3000): void {
  if (!canvas || !ctx) {
    console.warn('[Confetti] Not initialized');
    return;
  }

  // Ensure canvas has dimensions
  if (canvas.width === 0 || canvas.height === 0) {
    resizeCanvas();
  }

  // Add initial burst
  for (let i = 0; i < 20; i++) {
    particles.push(createParticle());
  }

  // Add particles over time
  const particleInterval = setInterval(() => {
    for (let i = 0; i < 5; i++) {
      particles.push(createParticle());
    }
  }, 50);

  // Stop adding after duration
  setTimeout(() => clearInterval(particleInterval), duration);

  // Start animation if not running
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  animate();
}

/**
 * Stop confetti immediately
 */
export function stopConfetti(): void {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  particles = [];

  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

/**
 * Clean up confetti resources
 */
export function destroyConfetti(): void {
  stopConfetti();
  window.removeEventListener('resize', resizeCanvas);
  canvas = null;
  ctx = null;
}
