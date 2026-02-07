/**
 * Milestone and achievement configuration
 */

import type {
  MilestoneInfo,
  PersonalMilestoneThreshold,
  MilestoneId,
} from '@/types/index.ts';

/** Milestone metadata for display (tier -> info) - matches milestones-v2.csv */
export const MILESTONE_INFO: Record<number, MilestoneInfo> = {
  // Personal milestones (1-12)
  1: { name: 'First Timer', emoji: '👆', desc: '1 click' },
  2: { name: 'Getting Started', emoji: '🌱', desc: '100 clicks' },
  3: { name: 'Warming Up', emoji: '🔥', desc: '500 clicks' },
  4: { name: 'Dedicated', emoji: '💪', desc: '1,000 clicks' },
  5: { name: 'Serious Clicker', emoji: '🎯', desc: '5,000 clicks' },
  6: { name: 'Obsessed', emoji: '😵', desc: '10,000 clicks' },
  7: { name: 'No Sleep', emoji: '🌙', desc: '25,000 clicks' },
  8: { name: 'Touch Grass', emoji: '🌿', desc: '50,000 clicks' },
  9: { name: 'Legend', emoji: '🏆', desc: '100,000 clicks' },
  10: { name: 'Ascended', emoji: '👼', desc: '250,000 clicks' },
  11: { name: 'Transcendent', emoji: '✨', desc: '500,000 clicks' },
  12: { name: 'Click God', emoji: '🌟', desc: '1,000,000 clicks' },

  // Streak/Epoch achievements (101-105)
  101: { name: 'Week Warrior', emoji: '📅', desc: '7 day streak' },
  102: { name: 'Month Master', emoji: '🗓️', desc: '30 day streak' },
  103: { name: 'Perfect Attendance', emoji: '🎓', desc: '90 day streak' },
  104: { name: 'Day One OG', emoji: '🥇', desc: 'Epoch 1 participant' },
  105: { name: 'The Final Day', emoji: '🏁', desc: 'Final epoch participant' },

  // Global 1/1 milestones (200-213)
  200: { name: 'The First Click', emoji: '1️⃣', desc: 'Global click #1' },
  201: { name: 'The Tenth', emoji: '🔟', desc: 'Global click #10' },
  202: { name: 'Century', emoji: '💯', desc: 'Global click #100' },
  203: { name: 'Thousandaire', emoji: '🎰', desc: 'Global click #1,000' },
  204: { name: 'Ten Grand', emoji: '💰', desc: 'Global click #10,000' },
  205: { name: 'The Hundred Thousandth', emoji: '🎊', desc: 'Global click #100,000' },
  206: { name: 'The Millionth Click', emoji: '🎉', desc: 'Global click #1,000,000' },
  207: { name: 'Ten Million', emoji: '🚀', desc: 'Global click #10,000,000' },
  208: { name: 'Hundred Million', emoji: '⏳', desc: 'Global click #100,000,000' },
  209: { name: 'Billionaire', emoji: '💎', desc: 'Global click #1,000,000,000' },
  210: { name: 'Ten Billion', emoji: '🌍', desc: 'Global click #10,000,000,000' },
  211: { name: 'One Hundred Billion', emoji: '🌌', desc: 'Global click #100,000,000,000' },
  212: { name: 'One Trillion', emoji: '🪐', desc: 'Global click #1,000,000,000,000' },
  213: { name: 'Ten Trillion', emoji: '🌠', desc: 'Global click #10,000,000,000,000' },

  // Hidden global 1/1s (220-229)
  220: { name: 'Nice', emoji: '😏', desc: 'Global click #69' },
  221: { name: 'Blaze It', emoji: '🌿', desc: 'Global click #420' },
  222: { name: "Devil's Click", emoji: '😈', desc: 'Global click #666' },
  223: { name: 'Lucky Sevens', emoji: '🎰', desc: 'Global click #777' },
  224: { name: 'Elite', emoji: '💻', desc: 'Global click #1337' },
  225: { name: 'The Perfect Number', emoji: '🎯', desc: 'Global click #42069' },
  226: { name: 'Ultra Nice', emoji: '😎', desc: 'Global click #69420' },
  227: { name: 'Calculator Masterpiece', emoji: '🔢', desc: 'Global click #8008135' },
  228: { name: 'Jenny', emoji: '📞', desc: 'Global click #8675309' },
  229: { name: 'Meaning of Everything', emoji: '🌌', desc: 'Global click #42' },

  // Personal Hidden - Meme numbers (500-511)
  500: { name: 'Nice', emoji: '😏', desc: 'Your 69th click' },
  501: { name: 'Blaze It', emoji: '🌿', desc: 'Your 420th click' },
  502: { name: "Devil's Click", emoji: '😈', desc: 'Your 666th click' },
  503: { name: 'Lucky 7s', emoji: '🎰', desc: 'Your 777th click' },
  504: { name: 'Elite', emoji: '💻', desc: 'Your 1337th click' },
  505: { name: 'Calculator Word', emoji: '🔢', desc: 'Your 8008th click' },
  506: { name: 'The Perfect Number', emoji: '🎯', desc: 'Your 42069th click' },
  507: { name: 'Ultra Nice', emoji: '😎', desc: 'Your 69420th click' },
  508: { name: 'Old School', emoji: '📟', desc: 'Your 80085th click' },
  509: { name: 'Double Blaze', emoji: '🔥', desc: 'Your 420420th click' },
  510: { name: 'Maximum Evil', emoji: '👿', desc: 'Your 666666th click' },
  511: { name: 'Nice Nice Nice', emoji: '🤩', desc: 'Your 696969th click' },

  // Personal Hidden - Ones family (520-523)
  520: { name: 'Triple Ones', emoji: '1️⃣', desc: 'Your 111th click' },
  521: { name: 'Quad Ones', emoji: '1️⃣', desc: 'Your 1111th click' },
  522: { name: 'Make a Wish', emoji: '🌟', desc: 'Your 11111th click' },
  523: { name: 'Six Ones', emoji: '✨', desc: 'Your 111111th click' },

  // Personal Hidden - Sevens family (524-526)
  524: { name: 'Jackpot', emoji: '🎰', desc: 'Your 7777th click' },
  525: { name: 'Mega Jackpot', emoji: '💰', desc: 'Your 77777th click' },
  526: { name: 'Slot Machine God', emoji: '🤑', desc: 'Your 777777th click' },

  // Personal Hidden - Eights family (527-529)
  527: { name: 'Prosperity', emoji: '🧧', desc: 'Your 888th click' },
  528: { name: 'Very Lucky', emoji: '🍀', desc: 'Your 8888th click' },
  529: { name: 'Fortune', emoji: '🐉', desc: 'Your 888888th click' },

  // Personal Hidden - Nines family (530-532)
  530: { name: 'So Close', emoji: '😬', desc: 'Your 999th click' },
  531: { name: 'Edge Lord', emoji: '🖤', desc: 'Your 9999th click' },
  532: { name: 'One Away', emoji: '😰', desc: 'Your 999999th click' },

  // Personal Hidden - Palindromes (540-545)
  540: { name: 'Binary Palindrome', emoji: '🔄', desc: 'Your 101st click' },
  541: { name: 'Bookends', emoji: '📚', desc: 'Your 1001st click' },
  542: { name: 'Symmetric', emoji: '⚖️', desc: 'Your 10001st click' },
  543: { name: 'Counting Palindrome', emoji: '🔢', desc: 'Your 12321st click' },
  544: { name: 'Mirror Mirror', emoji: '🪞', desc: 'Your 123321st click' },
  545: { name: 'The Mountain', emoji: '⛰️', desc: 'Your 1234321st click' },

  // Personal Hidden - Math (560-566)
  560: { name: 'Fine Structure', emoji: '⚛️', desc: 'Your 137th click' },
  561: { name: 'Pi Day', emoji: '🥧', desc: 'Your 314th click' },
  562: { name: 'Golden', emoji: '🌀', desc: 'Your 1618th click' },
  563: { name: "Euler's Click", emoji: '📐', desc: 'Your 2718th click' },
  564: { name: 'More Pi', emoji: '🥧', desc: 'Your 3141st click' },
  565: { name: 'Pi Squared', emoji: '🎂', desc: 'Your 31415th click' },
  566: { name: 'Full Pi', emoji: '🌌', desc: 'Your 314159th click' },

  // Personal Hidden - Powers of 2 (580-588)
  580: { name: 'Byte', emoji: '💾', desc: 'Your 256th click' },
  581: { name: 'Half K', emoji: '💿', desc: 'Your 512th click' },
  582: { name: 'Kilobyte', emoji: '📀', desc: 'Your 1024th click' },
  583: { name: 'The Game', emoji: '🎮', desc: 'Your 2048th click' },
  584: { name: '2^12', emoji: '🖥️', desc: 'Your 4096th click' },
  585: { name: '2^13', emoji: '🖥️', desc: 'Your 8192nd click' },
  586: { name: '2^14', emoji: '🖥️', desc: 'Your 16384th click' },
  587: { name: '2^15', emoji: '🖥️', desc: 'Your 32768th click' },
  588: { name: '2^16', emoji: '🖥️', desc: 'Your 65536th click' },

  // Personal Hidden - Cultural (600-609)
  600: { name: 'Not Found', emoji: '❓', desc: 'Your 404th click' },
  601: { name: 'Server Error', emoji: '🔴', desc: 'Your 500th click' },
  602: { name: 'Jumbo', emoji: '✈️', desc: 'Your 747th click' },
  603: { name: 'Emergency', emoji: '🚨', desc: 'Your 911th click' },
  604: { name: 'Orwellian', emoji: '👁️', desc: 'Your 1984th click' },
  605: { name: 'Space Odyssey', emoji: '🛸', desc: 'Your 2001st click' },
  606: { name: 'End Times', emoji: '🗿', desc: 'Your 2012th click' },
  607: { name: 'Love You 3000', emoji: '❤️', desc: 'Your 3000th click' },
  608: { name: 'Meaning of Everything', emoji: '🌌', desc: 'Your 42nd click' },
  609: { name: 'Seasons of Love', emoji: '🌈', desc: 'Your 525600th click' },
} as const;

/** Mapping from milestone ID string to tier number - matches API IDs */
export const MILESTONE_ID_TO_TIER: Record<MilestoneId, number> = {
  // Personal (1-12)
  'first-timer': 1,
  'getting-started': 2,
  'warming-up': 3,
  'dedicated': 4,
  'serious-clicker': 5,
  'obsessed': 6,
  'no-sleep': 7,
  'touch-grass': 8,
  'legend': 9,
  'ascended': 10,
  'transcendent': 11,
  'click-god': 12,

  // Streak/Epoch (101-105)
  'week-warrior': 101,
  'month-master': 102,
  'perfect-attendance': 103,
  'day-one-og': 104,
  'final-day': 105,

  // Global 1/1s (200-213)
  'global-1': 200,
  'global-10': 201,
  'global-100': 202,
  'global-1000': 203,
  'global-10000': 204,
  'global-100000': 205,
  'global-1000000': 206,
  'global-10000000': 207,
  'global-100000000': 208,
  'global-1000000000': 209,
  'global-10000000000': 210,
  'global-100000000000': 211,
  'global-1000000000000': 212,
  'global-10000000000000': 213,

  // Hidden global 1/1s (220-229)
  'global-69': 220,
  'global-420': 221,
  'global-666': 222,
  'global-777': 223,
  'global-1337': 224,
  'global-42069': 225,
  'global-69420': 226,
  'global-8008135': 227,
  'global-8675309': 228,
  'global-42': 229,

  // Personal Hidden - Meme (500-511)
  'nice': 500,
  'blaze-it': 501,
  'devils-click': 502,
  'lucky-7s': 503,
  'elite': 504,
  'calculator-word': 505,
  'perfect-number': 506,
  'ultra-nice': 507,
  'old-school': 508,
  'double-blaze': 509,
  'maximum-evil': 510,
  'nice-nice-nice': 511,

  // Personal Hidden - Ones (520-523)
  'triple-ones': 520,
  'quad-ones': 521,
  'make-a-wish': 522,
  'six-ones': 523,

  // Personal Hidden - Sevens (524-526)
  'jackpot': 524,
  'mega-jackpot': 525,
  'slot-machine-god': 526,

  // Personal Hidden - Eights (527-529)
  'prosperity': 527,
  'very-lucky': 528,
  'fortune': 529,

  // Personal Hidden - Nines (530-532)
  'so-close': 530,
  'edge-lord': 531,
  'one-away': 532,

  // Personal Hidden - Palindromes (540-545)
  'binary-palindrome': 540,
  'bookends': 541,
  'symmetric': 542,
  'counting-palindrome': 543,
  'mirror-mirror': 544,
  'the-mountain': 545,

  // Personal Hidden - Math (560-566)
  'fine-structure': 560,
  'pi-day': 561,
  'golden': 562,
  'eulers-click': 563,
  'more-pi': 564,
  'pi-squared': 565,
  'full-pi': 566,

  // Personal Hidden - Powers of 2 (580-588)
  'byte': 580,
  'half-k': 581,
  'kilobyte': 582,
  'the-game': 583,
  'pow-2-12': 584,
  'pow-2-13': 585,
  'pow-2-14': 586,
  'pow-2-15': 587,
  'pow-2-16': 588,

  // Personal Hidden - Cultural (600-609)
  'not-found': 600,
  'server-error': 601,
  'jumbo': 602,
  'emergency': 603,
  'orwellian': 604,
  'space-odyssey': 605,
  'end-times': 606,
  'love-you-3000': 607,
  'meaning-of-everything': 608,
  'seasons-of-love': 609,
} as const;

/** Personal milestone thresholds (sorted high to low for lookup) */
export const PERSONAL_MILESTONE_THRESHOLDS: readonly PersonalMilestoneThreshold[] = [
  { tier: 12, clicks: 1000000, cursor: 'god', name: 'Click God' },
  { tier: 11, clicks: 500000, cursor: 'prismatic', name: 'Transcendent' },
  { tier: 10, clicks: 250000, cursor: 'holographic', name: 'Ascended' },
  { tier: 9, clicks: 100000, cursor: 'diamond', name: 'Legend' },
  { tier: 8, clicks: 50000, cursor: 'platinum', name: 'Touch Grass' },
  { tier: 7, clicks: 25000, cursor: 'rose-gold', name: 'No Sleep' },
  { tier: 6, clicks: 10000, cursor: 'gold', name: 'Obsessed' },
  { tier: 5, clicks: 5000, cursor: 'silver', name: 'Serious Clicker' },
  { tier: 4, clicks: 1000, cursor: 'bronze', name: 'Dedicated' },
  { tier: 3, clicks: 500, cursor: 'brown', name: 'Warming Up' },
  { tier: 2, clicks: 100, cursor: 'gray', name: 'Getting Started' },
  { tier: 1, clicks: 1, cursor: 'white', name: 'First Timer' },
] as const;

/** Get the highest personal milestone for a given click count */
export function getHighestMilestone(clicks: number): PersonalMilestoneThreshold | null {
  for (const milestone of PERSONAL_MILESTONE_THRESHOLDS) {
    if (clicks >= milestone.clicks) {
      return milestone;
    }
  }
  return null;
}

/** Get milestone info by tier, with fallback */
export function getMilestoneInfo(tier: number): MilestoneInfo {
  return MILESTONE_INFO[tier] ?? { name: `Tier ${tier}`, emoji: '🎖️', desc: 'Achievement' };
}

/** Check if a tier is a global 1/1 milestone */
export function isGlobalMilestone(tier: number): boolean {
  return tier >= 200 && tier < 500;
}

/** Check if a tier is a hidden achievement */
export function isHiddenMilestone(tier: number): boolean {
  return tier >= 500;
}

/** Check if a tier is a streak/epoch achievement */
export function isStreakMilestone(tier: number): boolean {
  return tier >= 101 && tier <= 105;
}

/** Check if a tier is a personal milestone */
export function isPersonalMilestone(tier: number): boolean {
  return tier >= 1 && tier <= 12;
}
