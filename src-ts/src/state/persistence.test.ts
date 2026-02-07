import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  saveClicksToStorage,
  loadClicksFromStorage,
  clearClicksFromStorage,
  getSavedCursor,
  saveCursor,
  createPersistedState,
} from './persistence';
import type { PersistedState } from '@/types/index';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get _store() {
      return store;
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

describe('persistence', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('saveClicksToStorage', () => {
    it('saves state to localStorage', () => {
      const state: PersistedState = {
        address: '0x1234',
        epoch: 1,
        validClicks: 10,
        pendingNonces: ['123', '456'],
        serverClicksPending: 5,
        savedAt: Date.now(),
      };

      saveClicksToStorage(state);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'stupidClicker_pendingClicks',
        JSON.stringify(state)
      );
    });
  });

  describe('loadClicksFromStorage', () => {
    it('returns null when no saved data', () => {
      const result = loadClicksFromStorage('0x1234', 1);
      expect(result).toBeNull();
    });

    it('returns null when address does not match', () => {
      const state: PersistedState = {
        address: '0xABCD',
        epoch: 1,
        validClicks: 10,
        pendingNonces: [],
        serverClicksPending: 0,
        savedAt: Date.now(),
      };
      localStorageMock.setItem('stupidClicker_pendingClicks', JSON.stringify(state));

      const result = loadClicksFromStorage('0x1234', 1);
      expect(result).toBeNull();
    });

    it('returns null and clears when epoch does not match', () => {
      const state: PersistedState = {
        address: '0x1234',
        epoch: 1,
        validClicks: 10,
        pendingNonces: [],
        serverClicksPending: 0,
        savedAt: Date.now(),
      };
      localStorageMock.setItem('stupidClicker_pendingClicks', JSON.stringify(state));

      const result = loadClicksFromStorage('0x1234', 2);
      expect(result).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('stupidClicker_pendingClicks');
    });

    it('returns null and clears when data is too old', () => {
      const threeHoursAgo = Date.now() - 4 * 60 * 60 * 1000; // 4 hours ago
      const state: PersistedState = {
        address: '0x1234',
        epoch: 1,
        validClicks: 10,
        pendingNonces: [],
        serverClicksPending: 0,
        savedAt: threeHoursAgo,
      };
      localStorageMock.setItem('stupidClicker_pendingClicks', JSON.stringify(state));

      const result = loadClicksFromStorage('0x1234', 1);
      expect(result).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('stupidClicker_pendingClicks');
    });

    it('returns data when address, epoch match and not stale', () => {
      const state: PersistedState = {
        address: '0x1234',
        epoch: 1,
        validClicks: 10,
        pendingNonces: ['123'],
        serverClicksPending: 5,
        savedAt: Date.now(),
      };
      localStorageMock.setItem('stupidClicker_pendingClicks', JSON.stringify(state));

      const result = loadClicksFromStorage('0x1234', 1);
      expect(result).not.toBeNull();
      expect(result!.validClicks).toBe(10);
      expect(result!.pendingNonces).toEqual(['123']);
    });

    it('handles case-insensitive address matching', () => {
      const state: PersistedState = {
        address: '0xAbCd1234',
        epoch: 1,
        validClicks: 10,
        pendingNonces: [],
        serverClicksPending: 0,
        savedAt: Date.now(),
      };
      localStorageMock.setItem('stupidClicker_pendingClicks', JSON.stringify(state));

      const result = loadClicksFromStorage('0xabcd1234', 1);
      expect(result).not.toBeNull();
    });

    it('returns null on JSON parse error', () => {
      localStorageMock.setItem('stupidClicker_pendingClicks', 'invalid json');

      const result = loadClicksFromStorage('0x1234', 1);
      expect(result).toBeNull();
    });
  });

  describe('clearClicksFromStorage', () => {
    it('removes clicks from localStorage', () => {
      localStorageMock.setItem('stupidClicker_pendingClicks', 'data');

      clearClicksFromStorage();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('stupidClicker_pendingClicks');
    });
  });

  describe('getSavedCursor', () => {
    it('returns default when no cursor saved', () => {
      const result = getSavedCursor();
      expect(result).toBe('default');
    });

    it('returns saved cursor', () => {
      localStorageMock.setItem('stupidClicker_cursor', 'gold');

      const result = getSavedCursor();
      expect(result).toBe('gold');
    });
  });

  describe('saveCursor', () => {
    it('saves cursor to localStorage', () => {
      saveCursor('diamond');

      expect(localStorageMock.setItem).toHaveBeenCalledWith('stupidClicker_cursor', 'diamond');
    });
  });

  describe('createPersistedState', () => {
    it('creates a valid persisted state object', () => {
      const nonces = [BigInt(123), BigInt(456)];
      const result = createPersistedState('0x1234', 5, 100, nonces, 50);

      expect(result.address).toBe('0x1234');
      expect(result.epoch).toBe(5);
      expect(result.validClicks).toBe(100);
      expect(result.pendingNonces).toEqual(['123', '456']);
      expect(result.serverClicksPending).toBe(50);
      expect(typeof result.savedAt).toBe('number');
      expect(result.savedAt).toBeLessThanOrEqual(Date.now());
    });

    it('converts bigint nonces to strings', () => {
      const nonces = [BigInt('99999999999999999999')];
      const result = createPersistedState('0x1234', 1, 1, nonces, 0);

      expect(result.pendingNonces).toEqual(['99999999999999999999']);
    });

    it('handles empty nonces array', () => {
      const result = createPersistedState('0x1234', 1, 0, [], 0);

      expect(result.pendingNonces).toEqual([]);
    });
  });
});
