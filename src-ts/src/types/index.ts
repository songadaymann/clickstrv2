/**
 * Central type exports
 */

// Game types
export type {
  NetworkConfig,
  AppConfig,
  GameStats,
  EpochInfo,
  UserLifetimeStats,
  MiningState,
  ConnectionState,
  WalletType,
  PendingClick,
  PersistedState,
} from './game.ts';

// NFT types
export type {
  MilestoneTierCategory,
  MilestoneInfo,
  PersonalMilestoneThreshold,
  CollectionSlot,
  GlobalOneOfOneTier,
  NftItem,
  UnlockedAchievement,
  MilestoneId,
  ClaimState,
} from './nft.ts';

// API types
export type {
  ServerStatsResponse,
  LeaderboardEntry,
  LeaderboardResponse,
  SubgraphUser,
  SubgraphUsersResponse,
  SubgraphGlobalStatsResponse,
  NewMilestone,
  RecordClicksResponse,
  ClaimSignatureRequest,
  ClaimSignatureResponse,
  V2ClaimSignatureResponse,
  VerificationResponse,
  MergedLeaderboardEntry,
  MatrixLeaderboardEntry,
  ActiveUsersResponse,
  HeartbeatResponse,
  V2ClaimableEpoch,
  V2ClaimableEpochsResponse,
  V2SubmitClicksResponse,
  V2GameState,
  V2StatsResponse,
} from './api.ts';

// Effects types
export type {
  ParticleEffect,
  ParticleEffectType,
  ConfettiParticle,
  CursorConfig,
} from './effects.ts';

// Contract types
export {
  CLICKSTR_ABI,
  NFT_CONTRACT_ABI,
  CLICKSTR_V2_ABI,
} from './contracts.ts';

export type {
  ContractABI,
  RawGameStats,
  RawEpochInfo,
  RawUserLifetimeStats,
} from './contracts.ts';
