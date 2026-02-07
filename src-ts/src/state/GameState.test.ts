import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from './GameState';
import type { ClaimState } from '@/types/index';

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
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

describe('GameState', () => {
  let gameState: GameState;

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    gameState = new GameState();
  });

  describe('event system', () => {
    it('notifies subscribers when state changes', () => {
      const listener = vi.fn();
      gameState.subscribe(listener);

      gameState.setConnected('0x1234');

      expect(listener).toHaveBeenCalledWith('connectionChanged');
    });

    it('allows unsubscribing', () => {
      const listener = vi.fn();
      const unsubscribe = gameState.subscribe(listener);

      unsubscribe();
      gameState.setConnected('0x1234');

      expect(listener).not.toHaveBeenCalled();
    });

    it('notifies multiple subscribers', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      gameState.subscribe(listener1);
      gameState.subscribe(listener2);
      gameState.setConnected('0x1234');

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });

  describe('connection state', () => {
    it('starts disconnected', () => {
      expect(gameState.connectionState).toBe('disconnected');
      expect(gameState.isConnected).toBe(false);
      expect(gameState.userAddress).toBeNull();
    });

    it('can set connected with address', () => {
      gameState.setConnected('0x1234');

      expect(gameState.connectionState).toBe('connected');
      expect(gameState.isConnected).toBe(true);
      expect(gameState.userAddress).toBe('0x1234');
    });

    it('can set connecting state', () => {
      gameState.setConnecting();

      expect(gameState.connectionState).toBe('connecting');
      expect(gameState.isConnected).toBe(false);
    });

    it('can set wrong-network state', () => {
      gameState.setWrongNetwork();

      expect(gameState.connectionState).toBe('wrong-network');
      expect(gameState.isConnected).toBe(false);
    });

    it('can disconnect and clear address', () => {
      gameState.setConnected('0x1234');
      gameState.setDisconnected();

      expect(gameState.connectionState).toBe('disconnected');
      expect(gameState.userAddress).toBeNull();
    });
  });

  describe('mining state', () => {
    it('starts idle', () => {
      expect(gameState.miningState).toBe('idle');
      expect(gameState.isMining).toBe(false);
    });

    it('can set mining', () => {
      gameState.setMining();

      expect(gameState.miningState).toBe('mining');
      expect(gameState.isMining).toBe(true);
    });

    it('can complete mining', () => {
      gameState.setMining();
      gameState.setMiningComplete();

      expect(gameState.miningState).toBe('idle');
      expect(gameState.isMining).toBe(false);
    });

    it('can set difficulty target', () => {
      gameState.setDifficulty(BigInt('12345'));

      expect(gameState.difficultyTarget).toBe(BigInt('12345'));
    });
  });

  describe('epoch info', () => {
    it('starts at epoch 0', () => {
      expect(gameState.currentEpoch).toBe(0);
      expect(gameState.totalEpochs).toBe(0);
    });

    it('can set epoch info', () => {
      const listener = vi.fn();
      gameState.subscribe(listener);

      gameState.setEpochInfo(5, 12);

      expect(gameState.currentEpoch).toBe(5);
      expect(gameState.totalEpochs).toBe(12);
      expect(listener).toHaveBeenCalledWith('epochChanged');
    });

    it('only emits epochChanged when epoch actually changes', () => {
      gameState.setEpochInfo(5, 12);

      const listener = vi.fn();
      gameState.subscribe(listener);

      gameState.setEpochInfo(5, 12); // Same values

      expect(listener).not.toHaveBeenCalledWith('epochChanged');
    });
  });

  describe('game active state', () => {
    it('starts inactive', () => {
      expect(gameState.isGameActive).toBe(false);
    });

    it('can set active', () => {
      gameState.setGameActive(true);

      expect(gameState.isGameActive).toBe(true);
    });
  });

  describe('click state', () => {
    it('starts with no clicks', () => {
      expect(gameState.validClicks).toBe(0);
      expect(gameState.pendingNonces).toEqual([]);
      expect(gameState.serverClicksPending).toBe(0);
    });

    it('can add clicks', () => {
      gameState.setConnected('0x1234');

      gameState.addClick(BigInt(123));
      gameState.addClick(BigInt(456));

      expect(gameState.validClicks).toBe(2);
      expect(gameState.pendingNonces).toEqual([BigInt(123), BigInt(456)]);
      expect(gameState.serverClicksPending).toBe(2);
    });

    it('emits clicksChanged on addClick', () => {
      gameState.setConnected('0x1234');
      const listener = vi.fn();
      gameState.subscribe(listener);

      gameState.addClick(BigInt(123));

      expect(listener).toHaveBeenCalledWith('clicksChanged');
    });

    it('can clear submitted clicks', () => {
      gameState.setConnected('0x1234');
      gameState.addClick(BigInt(1));
      gameState.addClick(BigInt(2));
      gameState.addClick(BigInt(3));

      gameState.clearSubmittedClicks(2);

      expect(gameState.validClicks).toBe(1);
      expect(gameState.pendingNonces).toEqual([BigInt(3)]);
    });

    it('clears storage when all clicks submitted', () => {
      gameState.setConnected('0x1234');
      gameState.addClick(BigInt(1));

      gameState.clearSubmittedClicks(1);

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('stupidClicker_pendingClicks');
    });

    it('can mark server clicks as recorded', () => {
      gameState.setConnected('0x1234');
      gameState.addClick(BigInt(1));
      gameState.addClick(BigInt(2));

      gameState.markServerClicksRecorded(1);

      expect(gameState.serverClicksPending).toBe(1);
    });

    it('markServerClicksRecorded does not go below 0', () => {
      gameState.markServerClicksRecorded(100);

      expect(gameState.serverClicksPending).toBe(0);
    });
  });

  describe('stats', () => {
    it('starts with zero stats', () => {
      expect(gameState.allTimeClicks).toBe(0);
      expect(gameState.totalEarned).toBe(0);
      expect(gameState.poolRemaining).toBe(0);
      expect(gameState.globalClicks).toBe(0);
      expect(gameState.playerRank).toBeNull();
    });

    it('can set user stats', () => {
      gameState.setUserStats(1000, 500);

      expect(gameState.allTimeClicks).toBe(1000);
      expect(gameState.totalEarned).toBe(500);
    });

    it('can set pool remaining', () => {
      gameState.setPoolRemaining(1000000);

      expect(gameState.poolRemaining).toBe(1000000);
    });

    it('can set global clicks', () => {
      gameState.setGlobalClicks(5000000);

      expect(gameState.globalClicks).toBe(5000000);
    });

    it('can set player rank', () => {
      gameState.setPlayerRank(42);

      expect(gameState.playerRank).toBe(42);
    });

    it('can set server stats and update related fields', () => {
      gameState.setServerStats({
        success: true,
        totalClicks: 5000,
        rank: 10,
        globalClicks: 1000000,
      });

      expect(gameState.allTimeClicks).toBe(5000);
      expect(gameState.playerRank).toBe(10);
      expect(gameState.globalClicks).toBe(1000000);
    });
  });

  describe('NFT state', () => {
    it('starts with no claims', () => {
      expect(gameState.claimedOnChain.size).toBe(0);
      expect(gameState.pendingClaim).toBeNull();
      expect(gameState.claimQueue).toEqual([]);
    });

    it('can mark tier as claimed', () => {
      gameState.markClaimed(5);

      expect(gameState.isClaimed(5)).toBe(true);
      expect(gameState.isClaimed(6)).toBe(false);
    });

    it('can set pending claim', () => {
      const claim: ClaimState = { tier: 5, milestoneId: 'serious-clicker' };
      gameState.setPendingClaim(claim);

      expect(gameState.pendingClaim).toEqual(claim);
    });

    it('can add to claim queue', () => {
      const claim1: ClaimState = { tier: 1, milestoneId: 'first-timer' };
      const claim2: ClaimState = { tier: 2, milestoneId: 'getting-started' };

      gameState.addToClaimQueue(claim1, claim2);

      expect(gameState.claimQueue).toHaveLength(2);
    });

    it('can shift from claim queue', () => {
      const claim1: ClaimState = { tier: 1, milestoneId: 'first-timer' };
      const claim2: ClaimState = { tier: 2, milestoneId: 'getting-started' };
      gameState.addToClaimQueue(claim1, claim2);

      const shifted = gameState.shiftClaimQueue();

      expect(shifted).toEqual(claim1);
      expect(gameState.claimQueue).toHaveLength(1);
    });
  });

  describe('cursor state', () => {
    it('starts with default cursor', () => {
      expect(gameState.equippedCursor).toBe('default');
    });

    it('can equip cursor and saves to storage', () => {
      gameState.equipCursor('gold');

      expect(gameState.equippedCursor).toBe('gold');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('stupidClicker_cursor', 'gold');
    });

    it('emits cursorChanged when equipping', () => {
      const listener = vi.fn();
      gameState.subscribe(listener);

      gameState.equipCursor('diamond');

      expect(listener).toHaveBeenCalledWith('cursorChanged');
    });
  });

  describe('reset', () => {
    it('resets mining state but not clicks', () => {
      gameState.setConnected('0x1234');
      gameState.setMining();
      gameState.addClick(BigInt(123));

      gameState.reset();

      expect(gameState.miningState).toBe('idle');
      expect(gameState.validClicks).toBe(1); // Clicks preserved
    });
  });
});
