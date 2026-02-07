/**
 * Disco light overlay effect
 */

/** Disco overlay element */
let overlay: HTMLElement | null = null;

/** Current timeout ID */
let timeoutId: ReturnType<typeof setTimeout> | null = null;

/**
 * Initialize disco effect with overlay element
 */
export function initDisco(element: HTMLElement): void {
  overlay = element;
}

/**
 * Trigger disco light effect
 * @param duration Duration in milliseconds (default 11000)
 */
export function triggerDisco(duration = 11000): void {
  if (!overlay) {
    console.warn('[Disco] Not initialized');
    return;
  }

  // Clear any existing timeout
  if (timeoutId) {
    clearTimeout(timeoutId);
  }

  // Activate the effect
  overlay.classList.add('active');

  // Deactivate after duration
  timeoutId = setTimeout(() => {
    if (overlay) {
      overlay.classList.remove('active');
    }
    timeoutId = null;
  }, duration);
}

/**
 * Stop disco effect immediately
 */
export function stopDisco(): void {
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }

  if (overlay) {
    overlay.classList.remove('active');
  }
}

/**
 * Check if disco is currently active
 */
export function isDiscoActive(): boolean {
  return overlay?.classList.contains('active') ?? false;
}

/**
 * Clean up disco resources
 */
export function destroyDisco(): void {
  stopDisco();
  overlay = null;
}
