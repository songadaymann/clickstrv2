/**
 * Game state and configuration types
 */

/** Network configuration for Ethereum chains */
export interface NetworkConfig {
  readonly chainId: number;
  readonly chainName: string;
  readonly rpcUrl: string;
  readonly contractAddress: string;
  readonly tokenAddress: string;
  readonly nftContractAddress: string;
  readonly turnstileSiteKey: string;
}

/** Full application configuration */
export interface AppConfig extends NetworkConfig {
  readonly minBatchSize: number;
  readonly maxBatchSize: number;
  readonly walletConnectProjectId: string;
  readonly apiUrl: string;
  readonly subgraphUrl: string;
}

/** Game statistics from smart contract */
export interface GameStats {
  poolRemaining: bigint;
  currentEpoch: number;
  totalEpochs: number;
  gameStartTime: number;
  gameEndTime: number;
  difficulty: bigint;
  started: boolean;
  ended: boolean;
}

/** Epoch information from smart contract */
export interface EpochInfo {
  epoch: number;
  epochStartTime: number;
  epochEndTime: number;
  totalClicks: number;
  currentLeader: string;
  leaderClicks: number;
  distributed: bigint;
  burned: bigint;
}

/** User's lifetime statistics from smart contract */
export interface UserLifetimeStats {
  totalClicks: number;
  totalEarned: bigint;
  totalBurned: bigint;
  epochsWon: number;
}

/** Mining state for the current click */
export type MiningState = 'idle' | 'mining' | 'found';

/** Connection state for wallet */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'wrong-network';

/** Wallet provider type */
export type WalletType = 'metamask' | 'walletconnect' | 'rainbow' | 'rabby' | 'coinbase';

/** Click that has been mined but not yet submitted */
export interface PendingClick {
  nonce: bigint;
  minedAt: number;
}

/** Persisted state for localStorage recovery */
export interface PersistedState {
  address: string;
  epoch: number;
  validClicks: number;
  pendingNonces: string[]; // BigInt serialized as string
  serverClicksPending: number;
  savedAt: number;
}
