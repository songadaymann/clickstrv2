/**
 * LocalStorage persistence for click recovery
 */

import type { PersistedState } from '@/types/index.ts';

const STORAGE_KEY = 'stupidClicker_pendingClicks';
const CURSOR_STORAGE_KEY = 'stupidClicker_cursor';

/** Maximum age for saved data (3 hours) */
const MAX_AGE_MS = 3 * 60 * 60 * 1000;

/**
 * Save pending clicks to localStorage
 */
export function saveClicksToStorage(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    console.log(`[Storage] Saved ${state.validClicks} clicks for ${state.address}`);
  } catch (error) {
    console.error('[Storage] Error saving:', error);
  }
}

/**
 * Load pending clicks from localStorage
 * Returns null if data is invalid, stale, or for a different address/epoch
 */
export function loadClicksFromStorage(
  userAddress: string,
  currentEpoch: number
): PersistedState | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;

    const data = JSON.parse(saved) as PersistedState;

    // Validate address matches
    if (data.address?.toLowerCase() !== userAddress.toLowerCase()) {
      console.log('[Storage] Different address, not restoring');
      return null;
    }

    // Validate epoch matches (nonces are epoch-specific)
    if (data.epoch !== currentEpoch) {
      console.log(
        `[Storage] Different epoch (saved: ${data.epoch}, current: ${currentEpoch}), clearing old clicks`
      );
      clearClicksFromStorage();
      return null;
    }

    // Check if data is too old
    if (Date.now() - data.savedAt > MAX_AGE_MS) {
      console.log('[Storage] Saved data too old, clearing');
      clearClicksFromStorage();
      return null;
    }

    console.log(`[Storage] Restored ${data.validClicks} clicks from storage`);
    return data;
  } catch (error) {
    console.error('[Storage] Error loading:', error);
    return null;
  }
}

/**
 * Clear saved clicks from localStorage
 */
export function clearClicksFromStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
  console.log('[Storage] Cleared saved clicks');
}

/**
 * Get the saved cursor ID
 */
export function getSavedCursor(): string {
  return localStorage.getItem(CURSOR_STORAGE_KEY) ?? 'default';
}

/**
 * Save the equipped cursor ID
 */
export function saveCursor(cursorId: string): void {
  localStorage.setItem(CURSOR_STORAGE_KEY, cursorId);
}

/**
 * Create a persisted state object from current game state
 */
export function createPersistedState(
  address: string,
  epoch: number,
  validClicks: number,
  pendingNonces: bigint[],
  serverClicksPending: number
): PersistedState {
  return {
    address,
    epoch,
    validClicks,
    pendingNonces: pendingNonces.map(n => n.toString()),
    serverClicksPending,
    savedAt: Date.now(),
  };
}
