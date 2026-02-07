/**
 * Service exports
 */

// API service
export {
  fetchServerStats,
  checkVerificationStatus,
  recordClicksToServer,
  recordOnChainSubmission,
  fetchFrontendLeaderboard,
  fetchContractLeaderboard,
  fetchGlobalStats,
  mergeLeaderboards,
  fetchGlobalLeaderboard,
  fetchGameLeaderboard,
  fetchMatrixLeaderboard,
  getClaimSignature,
  confirmClaim,
  requestV2ClaimSignature,
  fetchV2ClaimableEpochs,
  submitClicksV2,
  fetchV2Stats,
  sendHeartbeat,
  sendHeartbeatV2,
  fetchActiveUsers,
  fetchActiveUsersV2,
  fetchV2Leaderboard,
  fetchRecentBotActivity,
  syncAchievements,
} from './api.ts';

// Wallet service
export {
  getProvider,
  getSigner,
  connect,
  connectWithMetaMask,
  connectWithWalletConnect,
  disconnect,
  hasMetaMask,
  initWalletSubscriptions,
  openConnectModal,
  isConnected,
  getAddress,
  switchNetwork,
} from './wallet.ts';

// Contract service
export {
  initializeContracts,
  getGameContract,
  getNftContract,
  fetchGameStats,
  fetchDifficultyTarget,
  fetchRewardParams,
  fetchEpochInfo,
  fetchUserStats,
  submitClicks,
  checkNftClaimed,
  claimNft,
  claimV2Reward,
  checkV2Claimed,
  getV2ClaimedClicks,
  refreshGameData,
  refreshUserStats,
} from './contracts.ts';

// Mining service
export { startMining, terminateMining, isMining } from './mining.ts';

// ENS service
export {
  lookupEns,
  batchLookupEns,
  getCachedEns,
  hasCachedEns,
  clearEnsCache,
} from './ens.ts';
