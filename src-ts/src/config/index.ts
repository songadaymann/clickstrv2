/**
 * Configuration exports
 */

export {
  CONFIG,
  NETWORKS,
  CURRENT_NETWORK,
  buildConfig,
  hasNftContract,
  isMainnet,
  getChainIdHex,
} from './network.ts';

export type { NetworkId } from './network.ts';

export {
  MILESTONE_INFO,
  MILESTONE_ID_TO_TIER,
  PERSONAL_MILESTONE_THRESHOLDS,
  getHighestMilestone,
  getMilestoneInfo,
  isGlobalMilestone,
  isHiddenMilestone,
  isStreakMilestone,
  isPersonalMilestone,
} from './milestones.ts';

export {
  COLLECTION_SLOTS,
  GLOBAL_ONE_OF_ONE_TIERS,
  findSlotByTier,
  findSlotByCursor,
  getSlotsWithCursors,
} from './collection.ts';

export {
  GAMES,
  getCurrentGame,
  getGameById,
  getCompletedGames,
  getAllGames,
} from './games.ts';

export type { GameConfig } from './games.ts';
