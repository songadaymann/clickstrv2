/**
 * Mining WebWorker for proof-of-work computation
 * This file is bundled separately as a WebWorker
 */

// WebWorker global scope type
interface WorkerGlobalScope {
  postMessage: (message: unknown) => void;
  onmessage: ((e: MessageEvent) => void) | null;
  importScripts: (...urls: string[]) => void;
}

// Declare self as WorkerGlobalScope
declare const self: WorkerGlobalScope;

// Import keccak256 from external script (loaded via importScripts)
declare const keccak256: {
  array: (data: Uint8Array) => number[];
};

/** Message types from main thread */
interface StartMessage {
  type: 'START';
  address: string;
  epoch: number;
  chainId: number;
  difficulty: string; // BigInt as string
  challenge?: string; // Server-issued mining challenge (hex string, 32 chars)
}

/** Update challenge without restarting mining */
interface UpdateChallengeMessage {
  type: 'UPDATE_CHALLENGE';
  challenge: string;
}

type IncomingMessage = StartMessage | UpdateChallengeMessage;

/** Message types to main thread */
interface FoundMessage {
  type: 'FOUND';
  nonce: string; // BigInt as string
}

/** State variables */
let userAddress: string;
let currentEpoch: number;
let chainId: number;
let difficultyTarget: bigint;
let nonce: bigint;
let currentChallenge: string | null = null;

/**
 * Pack data for hashing (matches Solidity encoding)
 * Without challenge: address (20 bytes) + nonce (32 bytes) + epoch (32 bytes) + chainId (32 bytes) = 116 bytes
 * With challenge:    + challenge (32 bytes) = 148 bytes
 */
function packData(address: string, nonceVal: bigint, epoch: number, chain: number, challenge: string | null): Uint8Array {
  // Address bytes (20)
  const addrBytes = new Uint8Array(20);
  const addrHex = address.slice(2);
  for (let i = 0; i < 20; i++) {
    addrBytes[i] = parseInt(addrHex.substr(i * 2, 2), 16);
  }

  // Nonce bytes (32) - big endian
  const nonceBytes = new Uint8Array(32);
  let n = nonceVal;
  for (let i = 31; i >= 0; i--) {
    nonceBytes[i] = Number(n & 0xFFn);
    n = n >> 8n;
  }

  // Epoch bytes (32) - big endian
  const epochBytes = new Uint8Array(32);
  let e = BigInt(epoch);
  for (let i = 31; i >= 0; i--) {
    epochBytes[i] = Number(e & 0xFFn);
    e = e >> 8n;
  }

  // ChainId bytes (32) - big endian
  const chainBytes = new Uint8Array(32);
  let c = BigInt(chain);
  for (let i = 31; i >= 0; i--) {
    chainBytes[i] = Number(c & 0xFFn);
    c = c >> 8n;
  }

  if (challenge) {
    // Challenge bytes (32) - hex string padded to 32 bytes (right-padded with zeros)
    const challengeBytes = new Uint8Array(32);
    const challengeHex = challenge.replace(/^0x/, '').padEnd(64, '0');
    for (let i = 0; i < 32; i++) {
      challengeBytes[i] = parseInt(challengeHex.substr(i * 2, 2), 16);
    }

    const packed = new Uint8Array(148);
    packed.set(addrBytes, 0);
    packed.set(nonceBytes, 20);
    packed.set(epochBytes, 52);
    packed.set(chainBytes, 84);
    packed.set(challengeBytes, 116);
    return packed;
  }

  // No challenge: 116 bytes (backwards compatible)
  const packed = new Uint8Array(116);
  packed.set(addrBytes, 0);
  packed.set(nonceBytes, 20);
  packed.set(epochBytes, 52);
  packed.set(chainBytes, 84);

  return packed;
}

/**
 * Convert hash array to BigInt
 */
function hashToBigInt(hash: number[]): bigint {
  let result = 0n;
  for (let i = 0; i < hash.length; i++) {
    result = (result << 8n) | BigInt(hash[i]);
  }
  return result;
}

/**
 * Mine one valid nonce
 * Processes 1000 attempts per iteration to avoid blocking
 */
function mineOne(): void {
  for (let i = 0; i < 1000; i++) {
    const packed = packData(userAddress, nonce, currentEpoch, chainId, currentChallenge);
    const hash = keccak256.array(packed);

    if (hashToBigInt(hash) < difficultyTarget) {
      // Found valid nonce!
      const message: FoundMessage = {
        type: 'FOUND',
        nonce: nonce.toString(),
      };
      self.postMessage(message);
      return;
    }

    nonce++;
  }

  // Continue mining in next iteration
  setTimeout(mineOne, 0);
}

/**
 * Handle messages from main thread
 */
self.onmessage = function(e: MessageEvent<IncomingMessage>) {
  if (e.data.type === 'START') {
    userAddress = e.data.address;
    currentEpoch = e.data.epoch;
    chainId = e.data.chainId;
    difficultyTarget = BigInt(e.data.difficulty);
    currentChallenge = e.data.challenge || null;

    // Start with random nonce
    nonce = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));

    // Start mining
    mineOne();
  } else if (e.data.type === 'UPDATE_CHALLENGE') {
    // Update challenge mid-mining without restarting
    currentChallenge = e.data.challenge;
  }
};

// Load keccak256 library
// Note: In production, this URL should be configurable
self.importScripts('https://cdnjs.cloudflare.com/ajax/libs/js-sha3/0.9.2/sha3.min.js');
