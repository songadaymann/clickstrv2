/**
 * State management exports
 */

export { GameState, gameState } from './GameState.ts';
export type { GameStateEvent, GameStateListener } from './GameState.ts';

export {
  saveClicksToStorage,
  loadClicksFromStorage,
  clearClicksFromStorage,
  getSavedCursor,
  saveCursor,
  createPersistedState,
} from './persistence.ts';
