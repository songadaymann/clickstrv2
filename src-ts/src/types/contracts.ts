/**
 * Smart contract types and ABI definitions
 */

/** Clickstr contract ABI */
export const CLICKSTR_ABI = [
  'function submitClicks(uint256[] calldata nonces) external',
  'function getCurrentEpochInfo() external view returns (uint256 epoch, uint256 epochStartTime_, uint256 epochEndTime_, uint256 totalClicks, address currentLeader, uint256 leaderClicks, uint256 distributed, uint256 burned)',
  'function getGameStats() external view returns (uint256 poolRemaining_, uint256 currentEpoch_, uint256 totalEpochs_, uint256 gameStartTime_, uint256 gameEndTime_, uint256 difficulty_, bool started_, bool ended_)',
  'function getDifficultyTarget() external view returns (uint256)',
  'function getUserLifetimeStats(address user) external view returns (uint256 totalClicks, uint256 totalEarned, uint256 totalBurned, uint256 epochsWon_)',
  'function TARGET_CLICKS_PER_EPOCH() external view returns (uint256)',
  'function DAILY_EMISSION_RATE() external view returns (uint256)',
] as const;

/** ClickstrNFT contract ABI */
export const NFT_CONTRACT_ABI = [
  'function claim(uint256 tier, bytes calldata signature) external',
  'function canClaim(address user, uint256 tier) external view returns (bool)',
  'function claimed(address user, uint256 tier) external view returns (bool)',
  'function balanceOf(address owner) external view returns (uint256)',
] as const;

/** ClickstrGameV2 contract ABI */
export const CLICKSTR_V2_ABI = [
  'function claimReward(uint256 epoch, uint256 clickCount, bytes calldata signature) external',
  'function claimMultipleEpochs(uint256[] calldata epochs, uint256[] calldata clickCounts, bytes[] calldata signatures) external',
  'function claimed(address user, uint256 epoch) external view returns (bool)',
  'function getClaimedClicks(address user, uint256 epoch) external view returns (uint256)',
  'function getCurrentEpochInfo() external view returns (uint256 epoch, uint256 epochStartTime_, uint256 epochEndTime_, uint256 totalClicks, address currentLeader, uint256 leaderClicks, uint256 distributed, uint256 burned)',
  'function getGameStats() external view returns (uint256 poolRemaining_, uint256 currentEpoch_, uint256 totalEpochs_, uint256 gameStartTime_, uint256 gameEndTime_, uint256 seasonNumber_, bool started_, bool ended_)',
  'function getUserStats(address user) external view returns (uint256 totalClicks_, uint256 totalEarned_, uint256 epochsWon_)',
  'function hasClaimed(address user, uint256 epoch) external view returns (bool)',
] as const;

/** Type for contract ABI */
export type ContractABI = readonly string[];

/** Raw game stats tuple from contract */
export type RawGameStats = [
  bigint, // poolRemaining
  bigint, // currentEpoch
  bigint, // totalEpochs
  bigint, // gameStartTime
  bigint, // gameEndTime
  bigint, // difficulty
  boolean, // started
  boolean, // ended
];

/** Raw epoch info tuple from contract */
export type RawEpochInfo = [
  bigint, // epoch
  bigint, // epochStartTime
  bigint, // epochEndTime
  bigint, // totalClicks
  string, // currentLeader
  bigint, // leaderClicks
  bigint, // distributed
  bigint, // burned
];

/** Raw user lifetime stats tuple from contract */
export type RawUserLifetimeStats = [
  bigint, // totalClicks
  bigint, // totalEarned
  bigint, // totalBurned
  bigint, // epochsWon
];
