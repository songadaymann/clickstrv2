/**
 * Smart contract interaction service
 */

import { ethers } from 'ethers';
import { CONFIG, hasNftContract, CURRENT_NETWORK } from '@/config/index.ts';
import { CLICKSTR_ABI, NFT_CONTRACT_ABI, CLICKSTR_V2_ABI } from '@/types/index.ts';

/** Whether we're using V2 contracts (Sepolia test) */
const IS_V2 = CURRENT_NETWORK === 'sepolia';
import type { GameStats, EpochInfo, UserLifetimeStats } from '@/types/index.ts';
import { getSigner } from './wallet.ts';
import { gameState } from '@/state/index.ts';

/** Contract instances */
let gameContract: ethers.Contract | null = null;
let nftContract: ethers.Contract | null = null;

/**
 * Initialize contracts with current signer
 */
export function initializeContracts(): void {
  const signer = getSigner();
  if (!signer) {
    console.error('[Contracts] No signer available');
    return;
  }

  // Use V2 ABI for Sepolia test deployment
  const gameAbi = IS_V2 ? CLICKSTR_V2_ABI : CLICKSTR_ABI;
  gameContract = new ethers.Contract(CONFIG.contractAddress, gameAbi, signer);

  if (hasNftContract()) {
    nftContract = new ethers.Contract(CONFIG.nftContractAddress, NFT_CONTRACT_ABI, signer);
  }
}

/**
 * Get the game contract instance
 */
export function getGameContract(): ethers.Contract | null {
  return gameContract;
}

/**
 * Get the NFT contract instance
 */
export function getNftContract(): ethers.Contract | null {
  return nftContract;
}

/**
 * Fetch game stats from the contract
 */
export async function fetchGameStats(): Promise<GameStats | null> {
  if (!gameContract) {
    console.error('[Contracts] Game contract not initialized');
    return null;
  }

  try {
    const stats = await gameContract.getGameStats();

    if (IS_V2) {
      // V2 returns seasonNumber_ instead of difficulty_
      // Difficulty comes from server in V2
      return {
        poolRemaining: stats.poolRemaining_.toBigInt(),
        currentEpoch: stats.currentEpoch_.toNumber(),
        totalEpochs: stats.totalEpochs_.toNumber(),
        gameStartTime: stats.gameStartTime_.toNumber(),
        gameEndTime: stats.gameEndTime_.toNumber(),
        difficulty: BigInt(0), // V2 doesn't have on-chain difficulty
        started: stats.started_,
        ended: stats.ended_,
      };
    }

    return {
      poolRemaining: stats.poolRemaining_.toBigInt(),
      currentEpoch: stats.currentEpoch_.toNumber(),
      totalEpochs: stats.totalEpochs_.toNumber(),
      gameStartTime: stats.gameStartTime_.toNumber(),
      gameEndTime: stats.gameEndTime_.toNumber(),
      difficulty: stats.difficulty_.toBigInt(),
      started: stats.started_,
      ended: stats.ended_,
    };
  } catch (error) {
    console.error('[Contracts] Error fetching game stats:', error);
    return null;
  }
}

/**
 * Fetch the current difficulty target
 * Note: V2 doesn't have on-chain difficulty - it comes from the server
 */
export async function fetchDifficultyTarget(): Promise<bigint | null> {
  if (!gameContract) {
    console.error('[Contracts] Game contract not initialized');
    return null;
  }

  // V2: fetch difficulty from server (dynamic, adjusts per epoch)
  if (IS_V2) {
    try {
      const { fetchV2Difficulty } = await import('./api.ts');
      const result = await fetchV2Difficulty();
      if (result.success && result.difficultyTarget) {
        return BigInt(result.difficultyTarget);
      }
    } catch (error) {
      console.error('[Contracts] Error fetching V2 difficulty from server:', error);
    }
    // Fallback to default if server is unreachable
    return BigInt('0x00ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
  }

  try {
    const difficulty = await gameContract.getDifficultyTarget();
    return difficulty.toBigInt();
  } catch (error) {
    console.error('[Contracts] Error fetching difficulty:', error);
    return null;
  }
}

/**
 * Fetch reward calculation parameters from contract
 * V2 uses a flat per-epoch budget capped by pool reality:
 *   epochBudget = min(seasonPool / totalEpochs, poolRemaining / remainingEpochs)
 * Returns targetClicksPerEpoch and epochBudget for display calculations
 */
export async function fetchRewardParams(): Promise<{ targetClicksPerEpoch: bigint; epochBudget: bigint } | null> {
  if (!gameContract) {
    console.error('[Contracts] Game contract not initialized');
    return null;
  }

  // V2: flat per-epoch budget, capped by fair share of remaining pool
  // Matches contract logic: min(seasonPool/TOTAL_EPOCHS, poolRemaining/remainingEpochs)
  if (IS_V2) {
    try {
      const [pool, totalEpochs, epochDuration, poolRemainingRaw] = await Promise.all([
        gameContract.seasonPool(),
        gameContract.TOTAL_EPOCHS(),
        gameContract.EPOCH_DURATION(),
        gameContract.poolRemaining(),
      ]);
      const seasonPoolWei: bigint = BigInt(pool.toString());
      const epochsBig: bigint = BigInt(totalEpochs.toString());
      const poolRemainingWei: bigint = BigInt(poolRemainingRaw.toString());
      const epochDurationSec = Number(epochDuration.toString());
      const targetClicks = BigInt(Math.floor(1_000_000 * epochDurationSec / 86400));

      // Flat budget
      const flatBudget = seasonPoolWei / epochsBig;

      // Fair budget based on remaining pool and remaining epochs
      // Clamp to >= 1 to avoid division by zero when game has ended or epoch > totalEpochs
      const currentEpoch = BigInt(gameState.currentEpoch || 1);
      const rawRemaining = epochsBig - currentEpoch + 1n;
      const remainingEpochs = rawRemaining > 0n ? rawRemaining : 1n;
      const fairBudget = poolRemainingWei / remainingEpochs;

      // Use the lesser of the two (matches contract)
      const epochBudget = flatBudget < fairBudget ? flatBudget : fairBudget;

      return {
        targetClicksPerEpoch: targetClicks,
        epochBudget,
      };
    } catch {
      // Fallback
      return {
        targetClicksPerEpoch: BigInt(1_000_000),
        epochBudget: BigInt(0),
      };
    }
  }

  // V1 path (legacy) — compute epochBudget from emission rate and pool
  try {
    const [targetClicks, emissionRate] = await Promise.all([
      gameContract.TARGET_CLICKS_PER_EPOCH(),
      gameContract.DAILY_EMISSION_RATE(),
    ]);
    // Approximate epoch budget using poolRemaining * emissionRate / 10000
    const poolWei = BigInt(Math.floor(gameState.poolRemaining * 1e18));
    const budget = (poolWei * emissionRate.toBigInt()) / 10000n;
    return {
      targetClicksPerEpoch: targetClicks.toBigInt(),
      epochBudget: budget,
    };
  } catch (error) {
    console.error('[Contracts] Error fetching reward params:', error);
    return null;
  }
}

/**
 * Fetch current epoch info
 */
export async function fetchEpochInfo(): Promise<EpochInfo | null> {
  if (!gameContract) {
    console.error('[Contracts] Game contract not initialized');
    return null;
  }

  try {
    const info = await gameContract.getCurrentEpochInfo();

    return {
      epoch: info.epoch.toNumber(),
      epochStartTime: info.epochStartTime_.toNumber(),
      epochEndTime: info.epochEndTime_.toNumber(),
      totalClicks: info.totalClicks.toNumber(),
      currentLeader: info.currentLeader,
      leaderClicks: info.leaderClicks.toNumber(),
      distributed: info.distributed.toBigInt(),
      burned: info.burned.toBigInt(),
    };
  } catch (error) {
    console.error('[Contracts] Error fetching epoch info:', error);
    return null;
  }
}

/**
 * Fetch user lifetime stats
 */
export async function fetchUserStats(address: string): Promise<UserLifetimeStats | null> {
  if (!gameContract) {
    console.error('[Contracts] Game contract not initialized');
    return null;
  }

  try {
    if (IS_V2) {
      // V2 uses getUserStats with different return values (no totalBurned)
      const stats = await gameContract.getUserStats(address);
      return {
        totalClicks: stats.totalClicks_.toNumber(),
        totalEarned: stats.totalEarned_.toBigInt(),
        totalBurned: BigInt(0), // V2 doesn't track per-user burns
        epochsWon: stats.epochsWon_.toNumber(),
      };
    }

    const stats = await gameContract.getUserLifetimeStats(address);
    return {
      totalClicks: stats.totalClicks.toNumber(),
      totalEarned: stats.totalEarned.toBigInt(),
      totalBurned: stats.totalBurned.toBigInt(),
      epochsWon: stats.epochsWon_.toNumber(),
    };
  } catch (error) {
    console.error('[Contracts] Error fetching user stats:', error);
    return null;
  }
}

/**
 * Submit clicks to the contract
 * @returns Transaction receipt on success, null on failure
 */
export async function submitClicks(
  nonces: bigint[]
): Promise<ethers.providers.TransactionReceipt | null> {
  if (!gameContract) {
    console.error('[Contracts] Game contract not initialized');
    return null;
  }

  try {
    const tx = await gameContract.submitClicks(nonces);
    const receipt = await tx.wait();
    return receipt;
  } catch (error) {
    console.error('[Contracts] Error submitting clicks:', error);
    throw error; // Re-throw so caller can handle
  }
}

/**
 * Check if an NFT tier has been claimed by a user
 */
export async function checkNftClaimed(address: string, tier: number): Promise<boolean> {
  if (!nftContract) {
    return false;
  }

  try {
    return await nftContract.claimed(address, tier);
  } catch (error) {
    console.error('[Contracts] Error checking claimed status:', error);
    return false;
  }
}

/**
 * Claim an NFT
 * @returns Transaction receipt on success
 */
export async function claimNft(
  tier: number,
  signature: string
): Promise<ethers.providers.TransactionReceipt> {
  if (!nftContract) {
    throw new Error('NFT contract not initialized');
  }

  const tx = await nftContract.claim(tier, signature);
  return await tx.wait();
}

/**
 * Compute time-based epoch from wall-clock time.
 * Mirrors the contract's _checkAndAdvanceEpoch logic and the server's getGameState().
 * The on-chain currentEpoch only advances when someone transacts, so with short epochs
 * it can become stale. This derives the real epoch from gameStartTime + epochDuration.
 */
function computeEffectiveEpoch(gameStats: GameStats): number {
  if (!gameStats.started || gameStats.ended) {
    return gameStats.currentEpoch;
  }

  const now = Math.floor(Date.now() / 1000);
  if (gameStats.gameStartTime <= 0 || gameStats.totalEpochs <= 0) {
    return gameStats.currentEpoch;
  }

  // epochDuration = (gameEndTime - gameStartTime) / totalEpochs
  const totalDuration = gameStats.gameEndTime - gameStats.gameStartTime;
  if (totalDuration <= 0) {
    return gameStats.currentEpoch;
  }
  const epochDuration = totalDuration / gameStats.totalEpochs;

  const epochsSinceStart = Math.floor((now - gameStats.gameStartTime) / epochDuration);
  const targetEpoch = Math.min(epochsSinceStart + 1, gameStats.totalEpochs);

  // Use whichever is higher — on-chain might catch up, time-based is ahead
  return Math.max(targetEpoch, gameStats.currentEpoch);
}

/**
 * Fetch and update game data in state
 */
export async function refreshGameData(): Promise<boolean> {
  const [gameStats, difficulty] = await Promise.all([fetchGameStats(), fetchDifficultyTarget()]);

  if (!gameStats || difficulty === null) {
    gameState.setGameActive(false);
    return false;
  }

  // Use time-based epoch to avoid stale on-chain value
  const effectiveEpoch = IS_V2 ? computeEffectiveEpoch(gameStats) : gameStats.currentEpoch;
  gameState.setEpochInfo(effectiveEpoch, gameStats.totalEpochs);
  gameState.setDifficulty(difficulty);
  gameState.setGameTiming(gameStats.gameStartTime, gameStats.gameEndTime);
  gameState.setPoolRemaining(
    parseFloat(ethers.utils.formatEther(gameStats.poolRemaining.toString()))
  );

  // Check if game is currently active
  const now = Math.floor(Date.now() / 1000);
  const isActive = gameStats.started && !gameStats.ended && now < gameStats.gameEndTime;
  gameState.setGameActive(isActive);

  if (!gameStats.started) {
    console.log('[Contracts] Game not started');
    return false;
  }

  if (gameStats.ended || now >= gameStats.gameEndTime) {
    console.log('[Contracts] Game ended');
    return false;
  }

  return true;
}

/**
 * Fetch and update user stats in state
 * Note: For V2, lifetime stats come from the API (via ClickRegistry).
 * This function is mainly for V1 compatibility.
 * allTimeClicks comes from API (server stats) to track frontend clicks for NFT rewards.
 */
export async function refreshUserStats(): Promise<void> {
  // In V2, lifetime earned comes from the API/registry, not the per-season contract
  // Skip this for V2 - stats are fetched via fetchV2Stats in onConnected
  if (IS_V2) return;

  const address = gameState.userAddress;
  if (!address) return;

  const stats = await fetchUserStats(address);
  if (!stats) return;

  const earned = parseFloat(ethers.utils.formatEther(stats.totalEarned.toString()));
  // Only update earned tokens from contract - allTimeClicks comes from API
  gameState.setTotalEarned(earned);
}

/**
 * Claim V2 token rewards for an epoch
 * @param contractAddress The V2 game contract address (from API response)
 * @param epoch The epoch to claim
 * @param clickCount The number of clicks attested by server
 * @param signature The server signature
 * @returns Transaction receipt on success
 */
export async function claimV2Reward(
  contractAddress: string,
  epoch: number,
  clickCount: number,
  signature: string
): Promise<ethers.providers.TransactionReceipt> {
  const signer = getSigner();
  if (!signer) {
    throw new Error('Wallet not connected');
  }

  // Security: validate contract address matches our known config to prevent
  // a compromised API from redirecting transactions to a malicious contract
  const expectedAddress = CONFIG.contractAddress.toLowerCase();
  if (contractAddress.toLowerCase() !== expectedAddress) {
    throw new Error(
      `Contract address mismatch: API returned ${contractAddress}, expected ${expectedAddress}`
    );
  }

  const v2Contract = new ethers.Contract(contractAddress, CLICKSTR_V2_ABI, signer);
  const tx = await v2Contract.claimReward(epoch, clickCount, signature);
  return await tx.wait();
}

/**
 * Check if user has claimed V2 reward for an epoch (boolean)
 */
export async function checkV2Claimed(
  contractAddress: string,
  userAddress: string,
  epoch: number
): Promise<boolean> {
  const signer = getSigner();
  if (!signer) {
    return false;
  }

  try {
    const v2Contract = new ethers.Contract(contractAddress, CLICKSTR_V2_ABI, signer);
    return await v2Contract.hasClaimed(userAddress, epoch);
  } catch (error) {
    console.error('[Contracts] Error checking V2 claimed status:', error);
    return false;
  }
}

/**
 * Get number of clicks already claimed for an epoch (for incremental claims)
 */
export async function getV2ClaimedClicks(
  contractAddress: string,
  userAddress: string,
  epoch: number
): Promise<number> {
  const signer = getSigner();
  if (!signer) {
    return 0;
  }

  try {
    const v2Contract = new ethers.Contract(contractAddress, CLICKSTR_V2_ABI, signer);
    const claimed = await v2Contract.getClaimedClicks(userAddress, epoch);
    return claimed.toNumber();
  } catch (error) {
    console.error('[Contracts] Error getting V2 claimed clicks:', error);
    return 0;
  }
}
