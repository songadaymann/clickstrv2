/**
 * Custom cursor management
 */

import { gameState } from '@/state/index.ts';
import { findSlotByCursor } from '@/config/index.ts';
import { setParticleEffect, spawnParticleAtCursor, clearParticles } from './particles.ts';

/** Custom cursor element */
let cursorElement: HTMLElement | null = null;
let cursorImg: HTMLImageElement | null = null;

/** Mouse move handler reference */
let mouseMoveHandler: ((e: MouseEvent) => void) | null = null;

/** Whether we're on a touch device (mobile) */
let isTouchDevice = false;

/** Temporary cursor ID (for previews like welcome modal) */
let temporaryCursor: string | null = null;

/**
 * Check if the device is a touch device (mobile/tablet)
 */
function checkIsTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Initialize custom cursor
 */
export function initCursor(element: HTMLElement): void {
  cursorElement = element;
  cursorImg = element.querySelector('img');

  // Detect touch device - don't use custom cursors on mobile
  isTouchDevice = checkIsTouchDevice();

  if (isTouchDevice) {
    // On mobile/touch devices, keep the cursor hidden and don't apply custom cursors
    if (cursorElement) {
      cursorElement.style.display = 'none';
    }
    return;
  }

  // Apply saved cursor (desktop only)
  const savedCursor = gameState.equippedCursor;
  if (savedCursor && savedCursor !== 'default') {
    applyCursor(savedCursor);
  }

  // Set up mouse tracking (desktop only)
  mouseMoveHandler = (e: MouseEvent) => {
    // Track cursor if we have an equipped cursor OR a temporary cursor
    const hasActiveCursor = gameState.equippedCursor !== 'default' || temporaryCursor;
    if (cursorElement && hasActiveCursor) {
      cursorElement.style.left = e.clientX + 'px';
      cursorElement.style.top = e.clientY + 'px';

      // Spawn particles if cursor has effect
      spawnParticleAtCursor(e.clientX, e.clientY);
    }
  };

  document.addEventListener('mousemove', mouseMoveHandler);
}

/**
 * Apply a cursor by ID
 */
export function applyCursor(cursorId: string): void {
  // Find the slot with this cursor (used for particle effects)
  findSlotByCursor(cursorId);

  // Clear any existing particle effect
  clearParticles();
  setParticleEffect(null);

  // On mobile/touch devices, don't show custom cursor visuals
  // but still save the equipped cursor to state (for showing in collection modal)
  if (isTouchDevice) {
    gameState.equipCursor(cursorId);
    return;
  }

  if (cursorId && cursorId !== 'default') {
    // Use custom cursor element that follows mouse
    if (cursorImg) {
      cursorImg.src = `cursors/${cursorId}.png`;
    }
    if (cursorElement) {
      cursorElement.style.display = 'block';
    }
    document.body.classList.add('custom-cursor-active');

    // Set particle effect if this cursor has one
    setParticleEffect(cursorId);
  } else {
    // Reset to default cursor
    if (cursorElement) {
      cursorElement.style.display = 'none';
    }
    document.body.classList.remove('custom-cursor-active');
  }

  // Update state
  gameState.equipCursor(cursorId);
}

/**
 * Reset to default cursor
 */
export function resetCursor(): void {
  applyCursor('default');
}

/**
 * Get the name of the currently equipped cursor
 */
export function getEquippedCursorName(): string {
  const cursorId = gameState.equippedCursor;
  if (!cursorId || cursorId === 'default') {
    return 'Default';
  }

  const slot = findSlotByCursor(cursorId);
  return slot?.name ?? cursorId;
}

/**
 * Equip a cursor with toast notification
 * @param cursorId The cursor ID to equip
 * @param showToast Callback to show toast notification
 */
export function equipCursor(
  cursorId: string,
  showToast?: (title: string, desc: string) => void
): void {
  applyCursor(cursorId);

  if (showToast) {
    showToast('Cursor Equipped!', `Now using: ${getEquippedCursorName()}`);
  }
}

/**
 * Temporarily show a cursor without saving to state
 * Used for previews like the welcome modal
 */
export function showTemporaryCursor(cursorId: string): void {
  // On mobile/touch devices, don't show custom cursor visuals
  if (isTouchDevice) return;

  if (cursorId && cursorId !== 'default') {
    temporaryCursor = cursorId;

    if (cursorImg) {
      cursorImg.src = `cursors/${cursorId}.png`;
    }
    if (cursorElement) {
      cursorElement.style.display = 'block';
    }
    document.body.classList.add('custom-cursor-active');

    // Set particle effect for the temp cursor
    setParticleEffect(cursorId);
  }
}

/**
 * Clear temporary cursor and restore saved cursor (or default)
 */
export function clearTemporaryCursor(): void {
  // On mobile/touch devices, nothing to do
  if (isTouchDevice) return;

  // Clear temporary cursor tracking
  temporaryCursor = null;

  // Clear particles
  clearParticles();
  setParticleEffect(null);

  // Restore the user's actual equipped cursor
  const savedCursor = gameState.equippedCursor;
  if (savedCursor && savedCursor !== 'default') {
    if (cursorImg) {
      cursorImg.src = `cursors/${savedCursor}.png`;
    }
    if (cursorElement) {
      cursorElement.style.display = 'block';
    }
    document.body.classList.add('custom-cursor-active');
    setParticleEffect(savedCursor);
  } else {
    if (cursorElement) {
      cursorElement.style.display = 'none';
    }
    document.body.classList.remove('custom-cursor-active');
  }
}

/**
 * Clean up cursor resources
 */
export function destroyCursor(): void {
  if (mouseMoveHandler) {
    document.removeEventListener('mousemove', mouseMoveHandler);
    mouseMoveHandler = null;
  }

  cursorElement = null;
  cursorImg = null;
}
