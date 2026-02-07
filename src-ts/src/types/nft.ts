/**
 * NFT and milestone types
 */

/** Milestone tier categories */
export type MilestoneTierCategory =
  | 'personal'    // 1-12: Click count milestones
  | 'streak'      // 101-105: Daily streak achievements
  | 'global'      // 200-229: Global 1/1 milestones
  | 'hidden';     // 500+: Hidden/meme number achievements

/** Milestone display information */
export interface MilestoneInfo {
  readonly name: string;
  readonly emoji: string;
  readonly desc: string;
}

/** Personal milestone threshold with cursor info */
export interface PersonalMilestoneThreshold {
  readonly tier: number;
  readonly clicks: number;
  readonly cursor: string;
  readonly name: string;
}

/** Collection slot for cursor/NFT */
export interface CollectionSlot {
  readonly tier: number;
  readonly name: string;
  readonly cursor: string | null; // null for global 1/1s that don't have cursors
}

/** Global 1/1 trophy information */
export interface GlobalOneOfOneTier {
  readonly tier: number;
  readonly name: string;
  readonly globalClick: number;
}

/** NFT item state in the UI */
export interface NftItem {
  id: string;
  tier: number;
  type: MilestoneTierCategory;
  claimed: boolean;
}

/** Achievement unlocked from server */
export interface UnlockedAchievement {
  id: string;
  name: string;
  tier?: number;
  type: 'personal' | 'global' | 'hidden' | 'streak' | 'epoch';
  cosmetic?: string;
  days?: number; // For streak achievements
}

/** Milestone ID to tier mapping key - matches API milestone IDs */
export type MilestoneId =
  // Personal (1-12)
  | 'first-timer' | 'getting-started' | 'warming-up' | 'dedicated'
  | 'serious-clicker' | 'obsessed' | 'no-sleep' | 'touch-grass'
  | 'legend' | 'ascended' | 'transcendent' | 'click-god'
  // Streak/Epoch (101-105)
  | 'week-warrior' | 'month-master' | 'perfect-attendance'
  | 'day-one-og' | 'final-day'
  // Global 1/1s (200-213)
  | 'global-1' | 'global-10' | 'global-100' | 'global-1000' | 'global-10000'
  | 'global-100000' | 'global-1000000' | 'global-10000000' | 'global-100000000'
  | 'global-1000000000' | 'global-10000000000' | 'global-100000000000'
  | 'global-1000000000000' | 'global-10000000000000'
  // Hidden global 1/1s (220-229)
  | 'global-69' | 'global-420' | 'global-666' | 'global-777' | 'global-1337'
  | 'global-42069' | 'global-69420' | 'global-8008135' | 'global-8675309' | 'global-42'
  // Personal Hidden - Meme (500-511)
  | 'nice' | 'blaze-it' | 'devils-click' | 'lucky-7s' | 'elite'
  | 'calculator-word' | 'perfect-number' | 'ultra-nice' | 'old-school'
  | 'double-blaze' | 'maximum-evil' | 'nice-nice-nice'
  // Personal Hidden - Ones (520-523)
  | 'triple-ones' | 'quad-ones' | 'make-a-wish' | 'six-ones'
  // Personal Hidden - Sevens (524-526)
  | 'jackpot' | 'mega-jackpot' | 'slot-machine-god'
  // Personal Hidden - Eights (527-529)
  | 'prosperity' | 'very-lucky' | 'fortune'
  // Personal Hidden - Nines (530-532)
  | 'so-close' | 'edge-lord' | 'one-away'
  // Personal Hidden - Palindromes (540-545)
  | 'binary-palindrome' | 'bookends' | 'symmetric'
  | 'counting-palindrome' | 'mirror-mirror' | 'the-mountain'
  // Personal Hidden - Math (560-566)
  | 'fine-structure' | 'pi-day' | 'golden' | 'eulers-click'
  | 'more-pi' | 'pi-squared' | 'full-pi'
  // Personal Hidden - Powers of 2 (580-588)
  | 'byte' | 'half-k' | 'kilobyte' | 'the-game'
  | 'pow-2-12' | 'pow-2-13' | 'pow-2-14' | 'pow-2-15' | 'pow-2-16'
  // Personal Hidden - Cultural (600-609)
  | 'not-found' | 'server-error' | 'jumbo' | 'emergency' | 'orwellian'
  | 'space-odyssey' | 'end-times' | 'love-you-3000'
  | 'meaning-of-everything' | 'seasons-of-love';

/** Claim modal state */
export interface ClaimState {
  milestoneId: string;
  tier: number;
}
