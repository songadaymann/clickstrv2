/**
 * API response types
 */

import type { UnlockedAchievement } from './nft.ts';

/** Server stats response */
export interface ServerStatsResponse {
  success: boolean;
  totalClicks?: number;
  name?: string;
  rank?: number;
  globalClicks?: number;
  milestones?: {
    unlocked: string[];
  };
  achievements?: {
    unlocked: string[];
  };
  streak?: {
    current: number;
    longest: number;
    totalDays?: number;
  };
  needsVerification?: boolean;
}

/** Leaderboard entry from server */
export interface LeaderboardEntry {
  address: string;
  name?: string | null;
  totalClicks: number;
}

/** Frontend leaderboard response */
export interface LeaderboardResponse {
  success: boolean;
  leaderboard: LeaderboardEntry[];
}

/** Subgraph user data */
export interface SubgraphUser {
  id: string;
  totalClicks: string;
  totalReward?: string;
}

/** Subgraph users response */
export interface SubgraphUsersResponse {
  data: {
    users: SubgraphUser[];
  };
}

/** Subgraph global stats response */
export interface SubgraphGlobalStatsResponse {
  data: {
    globalStats: {
      totalClicks: string;
    } | null;
  };
}

/** New milestone from server */
export interface NewMilestone {
  id: string;
  name: string;
  tier?: number;
  cosmetic?: string;
}

/** Record clicks response */
export interface RecordClicksResponse {
  success: boolean;
  requiresVerification?: boolean;
  rank?: number;
  globalClicks?: number;
  newMilestones?: NewMilestone[];
  newAchievements?: UnlockedAchievement[];
}

/** Claim signature request */
export interface ClaimSignatureRequest {
  address: string;
  tier: number;
  action?: 'confirm';
  txHash?: string;
}

/** Claim signature response */
export interface ClaimSignatureResponse {
  signature: string;
  tier: number;
  error?: string;
}

/** V2 claim attestation response */
export interface V2ClaimSignatureResponse {
  success?: boolean;
  signature?: string;
  epoch?: number;
  clickCount?: number;
  seasonNumber?: number;
  contractAddress?: string;
  chainId?: number;
  claimData?: {
    functionName: string;
    args: [number, number, string];
  };
  requiresVerification?: boolean;
  requiresSignature?: boolean;
  challenge?: string;
  expiresAt?: number;
  note?: string;
  error?: string;
  reason?: string;
}

/** Verification status response */
export interface VerificationResponse {
  success: boolean;
  needsVerification?: boolean;
}

/** Merged leaderboard entry (frontend + contract data) */
export interface MergedLeaderboardEntry {
  address: string;
  name: string | null;
  totalClicks: number;
  frontendClicks: number;
  rank?: number;
  isHuman: boolean;
}

/** Matrix leaderboard entry (combines on-chain + human clicks) */
export interface MatrixLeaderboardEntry {
  address: string;
  name: string | null;
  onChainClicks: number;
  humanClicks: number;
  rank: number;
}

/** Active users response from heartbeat API */
export interface ActiveUsersResponse {
  success: boolean;
  activeHumans: number;
  activeBots: number;
  globalClicks?: number;
}

/** Heartbeat response */
export interface HeartbeatResponse {
  success: boolean;
}

/** V2 claimable epoch info */
export interface V2ClaimableEpoch {
  epoch: number;
  clicks: number;
  claimed: boolean;
  estimatedReward?: string;
}

/** V2 claimable epochs response */
export interface V2ClaimableEpochsResponse {
  success: boolean;
  claimableEpochs?: V2ClaimableEpoch[];
  currentEpoch?: number;
  seasonNumber?: number;
  error?: string;
}

/** V2 submit clicks response */
export interface V2SubmitClicksResponse {
  success: boolean;
  validClicks?: number;
  invalidClicks?: number;
  epochClicks?: number | null;
  seasonClicks?: number;
  lifetimeClicks?: number;
  globalClicks?: number;
  epoch?: number | null;
  difficultyTarget?: string;
  rank?: number | null;
  gameActive?: boolean;
  requiresVerification?: boolean;
  newMilestones?: Array<{ id: string; name: string; tier: number }>;
  newAchievements?: Array<{ id: string; name: string; tier: number; type: string }>;
  nextMilestone?: { id: string; name: string; clicks: number } | null;
  error?: string;
}

/** V2 game state from API */
export interface V2GameState {
  currentEpoch: number;
  seasonNumber: number;
  totalEpochs: number;
  gameStarted: boolean;
  gameEnded: boolean;
}

/** V2 stats response */
export interface V2StatsResponse {
  success: boolean;
  address?: string;
  currentEpochClicks?: number;
  seasonClicks?: number;
  lifetimeClicks?: number;
  registryClicks?: number;
  lifetimeEarned?: string; // In wei, as string to avoid precision loss
  rank?: number | null;
  milestones?: string[];
  achievements?: string[];
  difficultyTarget?: string;
  gameState?: V2GameState;
  error?: string;
}
