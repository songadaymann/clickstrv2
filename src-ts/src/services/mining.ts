/**
 * Mining service for proof-of-work click validation
 */

import { CONFIG } from '@/config/index.ts';
import { gameState } from '@/state/index.ts';
import { fetchMiningChallenge } from '@/services/api.ts';

/** Worker found message */
interface FoundMessage {
  type: 'FOUND';
  nonce: string;
  challenge: string | null;
}

/** Active mining worker instance */
let miningWorker: Worker | null = null;

/** Callback when a valid nonce is found (nonce + the challenge it was mined with) */
let onNonceFound: ((nonce: bigint, challenge: string | null) => void) | null = null;

/** Cached sha3 library source (fetched from CDN in main thread) */
let sha3Source: string | null = null;

const SHA3_CDN_URL = 'https://cdnjs.cloudflare.com/ajax/libs/js-sha3/0.9.2/sha3.min.js';

// =============================================================================
// MINING CHALLENGE STATE
// Server-issued short-lived token included in PoW hash to prevent offline mining
// =============================================================================

/** Current active mining challenge */
let currentMiningChallenge: string | null = null;

/** Expiry timestamp of current challenge (ms) */
let challengeExpiresAt: number = 0;

/** Timer for auto-refreshing the challenge before it expires */
let challengeRefreshTimer: ReturnType<typeof setTimeout> | null = null;

/** How many seconds before expiry to refresh (gives buffer for network latency) */
const CHALLENGE_REFRESH_BUFFER_SECONDS = 5;

/** Callback to read the current Turnstile token from UI state */
let getTurnstileToken: (() => string | null) | null = null;

/** Callback to request Turnstile verification UI when challenge fetch is blocked */
let onChallengeVerificationRequired: (() => void) | null = null;

/**
 * Configure auth callbacks used by mining challenge refresh.
 */
export function configureMiningAuth(options: {
  getTurnstileToken?: () => string | null;
  onVerificationRequired?: () => void;
}): void {
  getTurnstileToken = options.getTurnstileToken || null;
  onChallengeVerificationRequired = options.onVerificationRequired || null;
}

/**
 * Get the current mining challenge (for inclusion in submit requests)
 */
export function getMiningChallenge(): string | null {
  return currentMiningChallenge;
}

/**
 * Fetch a fresh mining challenge from the server and schedule auto-refresh.
 * Returns the challenge string, or null if the fetch failed.
 */
async function refreshChallenge(): Promise<string | null> {
  if (!gameState.userAddress) return null;

  try {
    const turnstileToken = getTurnstileToken ? getTurnstileToken() : null;
    const result = await fetchMiningChallenge(gameState.userAddress, turnstileToken);
    if (result.requiresVerification) {
      if (onChallengeVerificationRequired) {
        onChallengeVerificationRequired();
      }
      return null;
    }
    if (result.success && result.challenge) {
      currentMiningChallenge = result.challenge;
      challengeExpiresAt = result.expiresAt || (Date.now() + (result.ttlSeconds || 30) * 1000);
      const ttlSec = Math.round((challengeExpiresAt - Date.now()) / 1000);
      console.log(`[Mining] Challenge acquired: ${currentMiningChallenge.slice(0, 12)}... (TTL ${ttlSec}s)`);

      // Send updated challenge to active worker (no restart needed)
      if (miningWorker) {
        miningWorker.postMessage({
          type: 'UPDATE_CHALLENGE',
          challenge: currentMiningChallenge,
        });
        console.log('[Mining] Challenge sent to active worker (hot-swap, no restart)');
      }

      // Schedule next refresh before expiry
      scheduleRefresh();

      return currentMiningChallenge;
    }
  } catch (error) {
    console.error('[Mining] Challenge refresh failed:', error);
  }
  return null;
}

/**
 * Schedule the next challenge refresh, timed to fire before the current one expires.
 */
function scheduleRefresh(): void {
  if (challengeRefreshTimer) {
    clearTimeout(challengeRefreshTimer);
    challengeRefreshTimer = null;
  }

  const msUntilExpiry = challengeExpiresAt - Date.now();
  const refreshIn = Math.max(1000, msUntilExpiry - (CHALLENGE_REFRESH_BUFFER_SECONDS * 1000));

  challengeRefreshTimer = setTimeout(async () => {
    // Only refresh if still mining
    if (miningWorker) {
      await refreshChallenge();
    }
  }, refreshIn);
}

/**
 * Stop the challenge refresh timer
 */
function stopChallengeRefresh(): void {
  if (challengeRefreshTimer) {
    clearTimeout(challengeRefreshTimer);
    challengeRefreshTimer = null;
  }
}

/**
 * Preload the sha3 library source from CDN.
 * Must be called from the main thread (not a worker) so the fetch isn't
 * blocked by Safari's opaque-origin restrictions on blob workers.
 * Call once at app startup; the result is cached for all future workers.
 */
export async function preloadSha3(): Promise<void> {
  if (sha3Source) return;
  try {
    const response = await fetch(SHA3_CDN_URL);
    sha3Source = await response.text();
  } catch (error) {
    console.error('[Mining] Failed to preload sha3 library:', error);
  }
}

/**
 * Create inline worker code.
 * The sha3 library is inlined directly into the blob to avoid importScripts(),
 * which Safari blocks in workers created from Blob URLs (opaque origin).
 */
function createWorkerCode(): string {
  if (!sha3Source) {
    // Fallback: use importScripts if preload didn't complete (e.g. CDN was slow).
    // This works in Chrome/Firefox but will fail in Safari.
    console.warn('[Mining] sha3 source not preloaded, falling back to importScripts');
    return createWorkerCodeWithImportScripts();
  }

  return `
    // Inlined sha3 library (preloaded from main thread)
    ${sha3Source}

    let userAddress, currentEpoch, chainId, difficultyTarget, currentChallenge = null;
    let nonce = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));

    function packData(address, nonceVal, epoch, chain, challenge) {
      const addrBytes = new Uint8Array(20);
      const addrHex = address.slice(2);
      for (let i = 0; i < 20; i++) addrBytes[i] = parseInt(addrHex.substr(i * 2, 2), 16);

      const nonceBytes = new Uint8Array(32);
      let n = BigInt(nonceVal);
      for (let i = 31; i >= 0; i--) { nonceBytes[i] = Number(n & 0xFFn); n = n >> 8n; }

      const epochBytes = new Uint8Array(32);
      let e = BigInt(epoch);
      for (let i = 31; i >= 0; i--) { epochBytes[i] = Number(e & 0xFFn); e = e >> 8n; }

      const chainBytes = new Uint8Array(32);
      let c = BigInt(chain);
      for (let i = 31; i >= 0; i--) { chainBytes[i] = Number(c & 0xFFn); c = c >> 8n; }

      if (challenge) {
        const challengeBytes = new Uint8Array(32);
        const challengeHex = challenge.replace(/^0x/, '').padEnd(64, '0');
        for (let i = 0; i < 32; i++) challengeBytes[i] = parseInt(challengeHex.substr(i * 2, 2), 16);

        const packed = new Uint8Array(148);
        packed.set(addrBytes, 0);
        packed.set(nonceBytes, 20);
        packed.set(epochBytes, 52);
        packed.set(chainBytes, 84);
        packed.set(challengeBytes, 116);
        return packed;
      }

      const packed = new Uint8Array(116);
      packed.set(addrBytes, 0);
      packed.set(nonceBytes, 20);
      packed.set(epochBytes, 52);
      packed.set(chainBytes, 84);
      return packed;
    }

    function hashToBigInt(hash) {
      let result = 0n;
      for (let i = 0; i < hash.length; i++) result = (result << 8n) | BigInt(hash[i]);
      return result;
    }

    function mineOne() {
      for (let i = 0; i < 1000; i++) {
        const packed = packData(userAddress, nonce, currentEpoch, chainId, currentChallenge);
        const hash = keccak256.array(packed);
        if (hashToBigInt(hash) < difficultyTarget) {
          self.postMessage({ type: 'FOUND', nonce: nonce.toString(), challenge: currentChallenge });
          return;
        }
        nonce++;
      }
      setTimeout(mineOne, 0);
    }

    self.onmessage = function(e) {
      if (e.data.type === 'START') {
        userAddress = e.data.address;
        currentEpoch = e.data.epoch;
        chainId = e.data.chainId;
        difficultyTarget = BigInt(e.data.difficulty);
        currentChallenge = e.data.challenge || null;
        mineOne();
      } else if (e.data.type === 'UPDATE_CHALLENGE') {
        currentChallenge = e.data.challenge;
      }
    };
  `;
}

/**
 * Fallback worker code using importScripts (works in Chrome/Firefox, not Safari).
 * Only used if preloadSha3() hasn't completed yet.
 */
function createWorkerCodeWithImportScripts(): string {
  return `
    self.importScripts('${SHA3_CDN_URL}');

    let userAddress, currentEpoch, chainId, difficultyTarget, currentChallenge = null;
    let nonce = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));

    function packData(address, nonceVal, epoch, chain, challenge) {
      const addrBytes = new Uint8Array(20);
      const addrHex = address.slice(2);
      for (let i = 0; i < 20; i++) addrBytes[i] = parseInt(addrHex.substr(i * 2, 2), 16);

      const nonceBytes = new Uint8Array(32);
      let n = BigInt(nonceVal);
      for (let i = 31; i >= 0; i--) { nonceBytes[i] = Number(n & 0xFFn); n = n >> 8n; }

      const epochBytes = new Uint8Array(32);
      let e = BigInt(epoch);
      for (let i = 31; i >= 0; i--) { epochBytes[i] = Number(e & 0xFFn); e = e >> 8n; }

      const chainBytes = new Uint8Array(32);
      let c = BigInt(chain);
      for (let i = 31; i >= 0; i--) { chainBytes[i] = Number(c & 0xFFn); c = c >> 8n; }

      if (challenge) {
        const challengeBytes = new Uint8Array(32);
        const challengeHex = challenge.replace(/^0x/, '').padEnd(64, '0');
        for (let i = 0; i < 32; i++) challengeBytes[i] = parseInt(challengeHex.substr(i * 2, 2), 16);

        const packed = new Uint8Array(148);
        packed.set(addrBytes, 0);
        packed.set(nonceBytes, 20);
        packed.set(epochBytes, 52);
        packed.set(chainBytes, 84);
        packed.set(challengeBytes, 116);
        return packed;
      }

      const packed = new Uint8Array(116);
      packed.set(addrBytes, 0);
      packed.set(nonceBytes, 20);
      packed.set(epochBytes, 52);
      packed.set(chainBytes, 84);
      return packed;
    }

    function hashToBigInt(hash) {
      let result = 0n;
      for (let i = 0; i < hash.length; i++) result = (result << 8n) | BigInt(hash[i]);
      return result;
    }

    function mineOne() {
      for (let i = 0; i < 1000; i++) {
        const packed = packData(userAddress, nonce, currentEpoch, chainId, currentChallenge);
        const hash = keccak256.array(packed);
        if (hashToBigInt(hash) < difficultyTarget) {
          self.postMessage({ type: 'FOUND', nonce: nonce.toString(), challenge: currentChallenge });
          return;
        }
        nonce++;
      }
      setTimeout(mineOne, 0);
    }

    self.onmessage = function(e) {
      if (e.data.type === 'START') {
        userAddress = e.data.address;
        currentEpoch = e.data.epoch;
        chainId = e.data.chainId;
        difficultyTarget = BigInt(e.data.difficulty);
        currentChallenge = e.data.challenge || null;
        mineOne();
      } else if (e.data.type === 'UPDATE_CHALLENGE') {
        currentChallenge = e.data.challenge;
      }
    };
  `;
}

// Max difficulty target (easiest) for off-chain mining when no game is active
// Must match server-side: MAX_UINT256 / 1000n (~1/1000 chance)
const MAX_UINT256 = 2n ** 256n - 1n;
const MAX_DIFFICULTY_TARGET = MAX_UINT256 / 1000n;

/**
 * Start mining a single click.
 * Fetches a fresh server challenge before starting the worker.
 * @param onFound Callback when valid nonce is found (receives nonce + challenge it was mined with)
 */
export async function startMining(onFound: (nonce: bigint, challenge: string | null) => void): Promise<void> {
  console.log('[Mining] startMining called');

  if (!gameState.isConnected || !gameState.userAddress) {
    console.error('[Mining] Cannot start: not connected');
    onFound(0n, null); // Call callback to unstick button
    return;
  }

  // When game is active, we need the contract's difficulty
  // When game is inactive, we use max difficulty (easiest) for quick off-chain mining
  const isGameActive = gameState.isGameActive;

  if (isGameActive && gameState.difficultyTarget === 0n) {
    console.error('[Mining] Cannot start: difficulty is 0');
    onFound(0n, null); // Call callback to unstick button
    return;
  }

  if (miningWorker) {
    console.log('[Mining] Terminating existing worker');
    miningWorker.terminate();
    miningWorker = null;
  }

  // Fetch a fresh challenge if we don't have one or it's about to expire
  const needsChallenge = !currentMiningChallenge || (challengeExpiresAt - Date.now() < CHALLENGE_REFRESH_BUFFER_SECONDS * 1000);
  if (needsChallenge) {
    await refreshChallenge();
  }
  if (!currentMiningChallenge || challengeExpiresAt <= Date.now()) {
    console.warn('[Mining] Cannot start: no valid challenge available');
    onFound(0n, null);
    return;
  }

  onNonceFound = onFound;
  gameState.setMining();
  console.log('[Mining] Creating new worker');

  // Create inline worker
  const blob = new Blob([createWorkerCode()], { type: 'application/javascript' });
  miningWorker = new Worker(URL.createObjectURL(blob));

  miningWorker.onmessage = (e: MessageEvent<FoundMessage>) => {
    if (e.data.type === 'FOUND') {
      const nonce = BigInt(e.data.nonce);
      const challenge = e.data.challenge ?? null;
      // Nonce found — hand off to callback with the challenge it was mined under

      // Save callback reference before terminateMining clears it
      const callback = onNonceFound;

      terminateMining();
      gameState.setMiningComplete();

      if (callback) {
        callback(nonce, challenge);
      } else {
        console.warn('[Mining] No callback registered!');
      }
    }
  };

  miningWorker.onerror = (error) => {
    console.error('[Mining] Worker error:', error);
    // Save callback reference before terminateMining clears it
    const callback = onNonceFound;
    terminateMining();
    gameState.setMiningComplete();
    // Call callback with a fallback nonce to unstick the UI
    // The nonce won't be valid but at least the button won't freeze
    if (callback) {
      callback(BigInt(0), null);
    }
  };

  // When game is inactive (between seasons):
  // - Use epoch 0 (matches server-side verification)
  // - Use max difficulty (easiest, since there's no token competition)
  const miningEpoch = isGameActive ? gameState.currentEpoch : 0;
  const miningDifficulty = isGameActive ? gameState.difficultyTarget : MAX_DIFFICULTY_TARGET;

  // Start mining with challenge
  console.log(`[Mining] Starting worker — challenge: ${currentMiningChallenge ? currentMiningChallenge.slice(0, 12) + '...' : 'NONE'}, epoch: ${miningEpoch}`);
  miningWorker.postMessage({
    type: 'START',
    address: gameState.userAddress,
    epoch: miningEpoch,
    chainId: CONFIG.chainId,
    difficulty: miningDifficulty.toString(),
    challenge: currentMiningChallenge || undefined,
  });
}

/**
 * Terminate the mining worker and stop challenge refresh
 */
export function terminateMining(): void {
  if (miningWorker) {
    miningWorker.terminate();
    miningWorker = null;
  }
  onNonceFound = null;
  stopChallengeRefresh();
}

/**
 * Check if currently mining
 */
export function isMining(): boolean {
  return miningWorker !== null;
}
