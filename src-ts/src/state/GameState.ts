/**
 * Central game state management
 */

import type {
  ConnectionState,
  MiningState,
  ServerStatsResponse,
  ClaimState,
} from '@/types/index.ts';
import {
  saveClicksToStorage,
  loadClicksFromStorage,
  clearClicksFromStorage,
  createPersistedState,
  getSavedCursor,
  saveCursor,
} from './persistence.ts';

/** Event types that can be emitted by GameState */
export type GameStateEvent =
  | 'connectionChanged'
  | 'miningChanged'
  | 'clicksChanged'
  | 'statsChanged'
  | 'epochChanged'
  | 'cursorChanged'
  | 'claimsChanged';

/** Event listener callback */
export type GameStateListener = (event: GameStateEvent) => void;

/**
 * Central state management for the game
 * Provides reactive updates via event listeners
 */
export class GameState {
  // Connection state
  private _connectionState: ConnectionState = 'disconnected';
  private _userAddress: string | null = null;

  // Mining state
  private _miningState: MiningState = 'idle';
  private _difficultyTarget: bigint = 0n;
  private _currentEpoch = 0;
  private _totalEpochs = 0;
  private _isGameActive = false;

  // Click state
  private _validClicks = 0;
  private _pendingNonces: bigint[] = [];
  private _serverClicksPending = 0;

  // Stats
  private _allTimeClicks = 0;
  private _totalEarned = 0;
  private _poolRemaining = 0;
  private _globalClicks = 0;
  private _playerRank: number | null = null;
  private _serverStats: ServerStatsResponse | null = null;

  // NFT state
  private _claimedOnChain: Set<number> = new Set();
  private _pendingClaim: ClaimState | null = null;
  private _claimQueue: ClaimState[] = [];

  // Cursor state
  private _equippedCursor: string;

  // Event listeners
  private listeners: Set<GameStateListener> = new Set();

  constructor() {
    this._equippedCursor = getSavedCursor();
  }

  // ============ Event System ============

  /** Subscribe to state changes */
  subscribe(listener: GameStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Emit an event to all listeners */
  private emit(event: GameStateEvent): void {
    this.listeners.forEach(listener => listener(event));
  }

  // ============ Connection State ============

  get connectionState(): ConnectionState {
    return this._connectionState;
  }

  get userAddress(): string | null {
    return this._userAddress;
  }

  get isConnected(): boolean {
    return this._connectionState === 'connected';
  }

  setConnected(address: string): void {
    this._userAddress = address;
    this._connectionState = 'connected';
    this.emit('connectionChanged');
  }

  setConnecting(): void {
    this._connectionState = 'connecting';
    this.emit('connectionChanged');
  }

  setWrongNetwork(): void {
    this._connectionState = 'wrong-network';
    this.emit('connectionChanged');
  }

  setDisconnected(): void {
    this._connectionState = 'disconnected';
    this._userAddress = null;
    this.emit('connectionChanged');
  }

  // ============ Mining State ============

  get miningState(): MiningState {
    return this._miningState;
  }

  get isMining(): boolean {
    return this._miningState === 'mining';
  }

  get difficultyTarget(): bigint {
    return this._difficultyTarget;
  }

  get currentEpoch(): number {
    return this._currentEpoch;
  }

  get totalEpochs(): number {
    return this._totalEpochs;
  }

  setMining(): void {
    this._miningState = 'mining';
    this.emit('miningChanged');
  }

  setMiningComplete(): void {
    this._miningState = 'idle';
    this.emit('miningChanged');
  }

  setDifficulty(target: bigint): void {
    this._difficultyTarget = target;
  }

  setEpochInfo(current: number, total: number): void {
    const changed = this._currentEpoch !== current;
    this._currentEpoch = current;
    this._totalEpochs = total;
    if (changed) {
      this.emit('epochChanged');
    }
  }

  get isGameActive(): boolean {
    return this._isGameActive;
  }

  setGameActive(active: boolean): void {
    this._isGameActive = active;
    this.emit('statsChanged');
  }

  // ============ Click State ============

  get validClicks(): number {
    return this._validClicks;
  }

  get pendingNonces(): readonly bigint[] {
    return this._pendingNonces;
  }

  get serverClicksPending(): number {
    return this._serverClicksPending;
  }

  /** Add a successfully mined click */
  addClick(nonce: bigint): void {
    this._pendingNonces.push(nonce);
    this._validClicks++;
    this._serverClicksPending++;
    this.emit('clicksChanged');
    this.saveToStorage();
  }

  /** Clear clicks after successful submission */
  clearSubmittedClicks(count: number): void {
    this._pendingNonces = this._pendingNonces.slice(count);
    this._validClicks = this._pendingNonces.length;
    this.emit('clicksChanged');

    if (this._validClicks === 0) {
      clearClicksFromStorage();
    } else {
      this.saveToStorage();
    }
  }

  /** Mark server clicks as recorded */
  markServerClicksRecorded(count: number): void {
    this._serverClicksPending = Math.max(0, this._serverClicksPending - count);
  }

  /** Try to restore clicks from localStorage */
  tryRestoreFromStorage(): boolean {
    if (!this._userAddress) return false;

    const saved = loadClicksFromStorage(this._userAddress, this._currentEpoch);
    if (!saved) return false;

    this._validClicks = saved.validClicks;
    this._pendingNonces = saved.pendingNonces.map(n => BigInt(n));
    this._serverClicksPending = saved.serverClicksPending;
    this.emit('clicksChanged');

    return true;
  }

  /** Save current state to localStorage */
  private saveToStorage(): void {
    if (!this._userAddress) return;

    const state = createPersistedState(
      this._userAddress,
      this._currentEpoch,
      this._validClicks,
      this._pendingNonces,
      this._serverClicksPending
    );
    saveClicksToStorage(state);
  }

  // ============ Stats ============

  get allTimeClicks(): number {
    return this._allTimeClicks;
  }

  get totalEarned(): number {
    return this._totalEarned;
  }

  get poolRemaining(): number {
    return this._poolRemaining;
  }

  get globalClicks(): number {
    return this._globalClicks;
  }

  get playerRank(): number | null {
    return this._playerRank;
  }

  get serverStats(): ServerStatsResponse | null {
    return this._serverStats;
  }

  setUserStats(clicks: number, earned: number): void {
    this._allTimeClicks = clicks;
    this._totalEarned = earned;
    this.emit('statsChanged');
  }

  /** Update only total earned (from contract) - doesn't touch allTimeClicks */
  setTotalEarned(earned: number): void {
    this._totalEarned = earned;
    this.emit('statsChanged');
  }

  /** Update only allTimeClicks (from API) */
  setAllTimeClicks(clicks: number): void {
    this._allTimeClicks = clicks;
    this.emit('statsChanged');
  }

  setPoolRemaining(pool: number): void {
    this._poolRemaining = pool;
    this.emit('statsChanged');
  }

  setGlobalClicks(clicks: number): void {
    this._globalClicks = clicks;
    this.emit('statsChanged');
  }

  setPlayerRank(rank: number | null): void {
    this._playerRank = rank;
    this.emit('statsChanged');
  }

  setServerStats(stats: ServerStatsResponse): void {
    this._serverStats = stats;
    if (stats.rank !== undefined) {
      this._playerRank = stats.rank;
    }
    if (stats.globalClicks !== undefined) {
      this._globalClicks = stats.globalClicks;
    }
    // Use server's totalClicks for "Your Total Clicks" display
    // This tracks all frontend clicks, even between seasons (for NFT rewards)
    if (stats.totalClicks !== undefined) {
      this._allTimeClicks = stats.totalClicks;
    }
    this.emit('statsChanged');
  }

  // ============ NFT State ============

  get claimedOnChain(): ReadonlySet<number> {
    return this._claimedOnChain;
  }

  get pendingClaim(): ClaimState | null {
    return this._pendingClaim;
  }

  get claimQueue(): readonly ClaimState[] {
    return this._claimQueue;
  }

  markClaimed(tier: number): void {
    this._claimedOnChain.add(tier);
    this.emit('claimsChanged');
  }

  isClaimed(tier: number): boolean {
    return this._claimedOnChain.has(tier);
  }

  setPendingClaim(claim: ClaimState | null): void {
    this._pendingClaim = claim;
    this.emit('claimsChanged');
  }

  addToClaimQueue(...claims: ClaimState[]): void {
    this._claimQueue.push(...claims);
    this.emit('claimsChanged');
  }

  shiftClaimQueue(): ClaimState | undefined {
    const claim = this._claimQueue.shift();
    if (claim) {
      this.emit('claimsChanged');
    }
    return claim;
  }

  // ============ Cursor State ============

  get equippedCursor(): string {
    return this._equippedCursor;
  }

  equipCursor(cursorId: string): void {
    this._equippedCursor = cursorId;
    saveCursor(cursorId);
    this.emit('cursorChanged');
  }

  // ============ Reset ============

  /** Reset all state (on disconnect) */
  reset(): void {
    this._miningState = 'idle';
    // Don't reset clicks - they can be recovered
    // Don't reset cursor - it persists across sessions
  }
}

/** Singleton instance */
export const gameState = new GameState();
