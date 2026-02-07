/**
 * Collection slots and cursor configuration
 */

import type { CollectionSlot, GlobalOneOfOneTier } from '@/types/index.ts';

/** All collection slots from milestones-v2.csv (95 total) */
export const COLLECTION_SLOTS: readonly CollectionSlot[] = [
  // Personal milestones (1-12)
  { tier: 1, name: 'First Timer', cursor: 'white' },
  { tier: 2, name: 'Getting Started', cursor: 'gray' },
  { tier: 3, name: 'Warming Up', cursor: 'brown' },
  { tier: 4, name: 'Dedicated', cursor: 'bronze' },
  { tier: 5, name: 'Serious Clicker', cursor: 'silver' },
  { tier: 6, name: 'Obsessed', cursor: 'gold' },
  { tier: 7, name: 'No Sleep', cursor: 'rose-gold' },
  { tier: 8, name: 'Touch Grass', cursor: 'platinum' },
  { tier: 9, name: 'Legend', cursor: 'diamond' },
  { tier: 10, name: 'Ascended', cursor: 'holographic' },
  { tier: 11, name: 'Transcendent', cursor: 'prismatic' },
  { tier: 12, name: 'Click God', cursor: 'god' },

  // Streak/Epoch (101-105)
  { tier: 101, name: 'Week Warrior', cursor: 'orange-flame' },
  { tier: 102, name: 'Month Master', cursor: 'blue-flame' },
  { tier: 103, name: 'Perfect Attendance', cursor: 'white-flame' },
  { tier: 104, name: 'Day One OG', cursor: 'vintage' },
  { tier: 105, name: 'The Final Day', cursor: 'sunset' },

  // Global 1/1s (200-209) - no cursors, NFT only
  { tier: 200, name: 'The First Click', cursor: null },
  { tier: 201, name: 'The Tenth', cursor: null },
  { tier: 202, name: 'Century', cursor: null },
  { tier: 203, name: 'Thousandaire', cursor: null },
  { tier: 204, name: 'Ten Grand', cursor: null },
  { tier: 205, name: 'The Hundred Thousandth', cursor: null },
  { tier: 206, name: 'The Millionth Click', cursor: null },
  { tier: 207, name: 'Ten Million', cursor: null },
  { tier: 208, name: 'Hundred Million', cursor: null },
  { tier: 209, name: 'Billionaire', cursor: null },

  // Global Hidden 1/1s (220-229) - no cursors, NFT only
  { tier: 220, name: 'Nice', cursor: null },
  { tier: 221, name: 'Blaze It', cursor: null },
  { tier: 222, name: "Devil's Click", cursor: null },
  { tier: 223, name: 'Lucky Sevens', cursor: null },
  { tier: 224, name: 'Elite', cursor: null },
  { tier: 225, name: 'The Perfect Number', cursor: null },
  { tier: 226, name: 'Ultra Nice', cursor: null },
  { tier: 227, name: 'Calculator Masterpiece', cursor: null },
  { tier: 228, name: 'Jenny', cursor: null },
  { tier: 229, name: 'Meaning of Everything', cursor: null },

  // Personal Hidden - Meme numbers (500-511)
  { tier: 500, name: 'Nice', cursor: 'pink' },
  { tier: 501, name: 'Blaze It', cursor: 'smoke-green' },
  { tier: 502, name: "Devil's Click", cursor: 'demon-red' },
  { tier: 503, name: 'Lucky 7s', cursor: 'casino-gold' },
  { tier: 504, name: 'Elite', cursor: 'matrix-green' },
  { tier: 505, name: 'Calculator Word', cursor: 'lcd-green' },
  { tier: 506, name: 'The Perfect Number', cursor: 'vaporwave' },
  { tier: 507, name: 'Ultra Nice', cursor: 'tie-dye' },
  { tier: 508, name: 'Old School', cursor: 'retro-90s' },
  { tier: 509, name: 'Double Blaze', cursor: 'rasta' },
  { tier: 510, name: 'Maximum Evil', cursor: 'lava' },
  { tier: 511, name: 'Nice Nice Nice', cursor: 'hot-pink' },

  // Personal Hidden - Ones family (520-523)
  { tier: 520, name: 'Triple Ones', cursor: 'light-gray' },
  { tier: 521, name: 'Quad Ones', cursor: 'silver-ones' },
  { tier: 522, name: 'Make a Wish', cursor: 'silver-sparkle' },
  { tier: 523, name: 'Six Ones', cursor: 'white-glow' },

  // Personal Hidden - Sevens family (524-526)
  { tier: 524, name: 'Jackpot', cursor: 'gold-7' },
  { tier: 525, name: 'Mega Jackpot', cursor: 'gold-coins' },
  { tier: 526, name: 'Slot Machine God', cursor: 'gold-sparkle' },

  // Personal Hidden - Eights family (527-529)
  { tier: 527, name: 'Prosperity', cursor: 'red-8' },
  { tier: 528, name: 'Very Lucky', cursor: 'red-gold' },
  { tier: 529, name: 'Fortune', cursor: 'dragon' },

  // Personal Hidden - Nines family (530-532)
  { tier: 530, name: 'So Close', cursor: 'light-purple' },
  { tier: 531, name: 'Edge Lord', cursor: 'dark-purple' },
  { tier: 532, name: 'One Away', cursor: 'glitch-purple' },

  // Personal Hidden - Palindromes (540-545)
  { tier: 540, name: 'Binary Palindrome', cursor: 'mirror-chrome' },
  { tier: 541, name: 'Bookends', cursor: 'polished-silver' },
  { tier: 542, name: 'Symmetric', cursor: 'glass' },
  { tier: 543, name: 'Counting Palindrome', cursor: 'frosted-glass' },
  { tier: 544, name: 'Mirror Mirror', cursor: 'full-mirror' },
  { tier: 545, name: 'The Mountain', cursor: 'iridescent' },

  // Personal Hidden - Math (560-566)
  { tier: 560, name: 'Fine Structure', cursor: 'chalk-white' },
  { tier: 561, name: 'Pi Day', cursor: 'blueprint' },
  { tier: 562, name: 'Golden', cursor: 'golden-spiral' },
  { tier: 563, name: "Euler's Click", cursor: 'graph-paper' },
  { tier: 564, name: 'More Pi', cursor: 'blue-pi' },
  { tier: 565, name: 'Pi Squared', cursor: 'glowing-equations' },
  { tier: 566, name: 'Full Pi', cursor: 'cosmic-nebula' },

  // Personal Hidden - Powers of 2 (580-588)
  { tier: 580, name: 'Byte', cursor: 'pcb-green' },
  { tier: 581, name: 'Half K', cursor: 'pcb-led' },
  { tier: 582, name: 'Kilobyte', cursor: 'pcb-traces' },
  { tier: 583, name: 'The Game', cursor: 'pixel-8bit' },
  { tier: 584, name: '2^12', cursor: 'pixel-16bit' },
  { tier: 585, name: '2^13', cursor: 'wireframe' },
  { tier: 586, name: '2^14', cursor: 'low-poly' },
  { tier: 587, name: '2^15', cursor: 'hologram-blue' },
  { tier: 588, name: '2^16', cursor: 'rgb-animated' },

  // Personal Hidden - Cultural (600-609)
  { tier: 600, name: 'Not Found', cursor: 'glitched' },
  { tier: 601, name: 'Server Error', cursor: 'red-warning' },
  { tier: 602, name: 'Jumbo', cursor: 'cloud-white' },
  { tier: 603, name: 'Emergency', cursor: 'ambulance' },
  { tier: 604, name: 'Orwellian', cursor: 'surveillance' },
  { tier: 605, name: 'Space Odyssey', cursor: 'starfield' },
  { tier: 606, name: 'End Times', cursor: 'mayan-stone' },
  { tier: 607, name: 'Love You 3000', cursor: 'iron-man' },
  { tier: 608, name: 'Meaning of Everything', cursor: 'towel' },
  { tier: 609, name: 'Seasons of Love', cursor: 'rainbow-gradient' },
] as const;

/** Global 1/1 trophy tiers with arcade game names (from CSV) */
export const GLOBAL_ONE_OF_ONE_TIERS: readonly GlobalOneOfOneTier[] = [
  // Main global 1/1s (200-213)
  { tier: 200, name: 'Spacewar', globalClick: 1 },
  { tier: 201, name: 'Pong', globalClick: 10 },
  { tier: 202, name: 'Space Invaders', globalClick: 100 },
  { tier: 203, name: 'Asteroids', globalClick: 1000 },
  { tier: 204, name: 'Berzerk', globalClick: 10000 },
  { tier: 205, name: 'Galaxian', globalClick: 100000 },
  { tier: 206, name: 'PacMan', globalClick: 1000000 },
  { tier: 207, name: 'Tempest', globalClick: 10000000 },
  { tier: 208, name: 'Centipede', globalClick: 100000000 },
  { tier: 209, name: 'Donkey Kong', globalClick: 1000000000 },
  { tier: 210, name: 'Frogger', globalClick: 10000000000 },
  { tier: 211, name: 'DigDug', globalClick: 100000000000 },
  { tier: 212, name: 'Joust', globalClick: 1000000000000 },
  { tier: 213, name: 'PolePosition', globalClick: 10000000000000 },
  // Hidden global 1/1s (220-229)
  { tier: 220, name: 'Smash TV', globalClick: 69 },
  { tier: 221, name: 'NBA Jam', globalClick: 420 },
  { tier: 222, name: 'Mortal Kombat', globalClick: 666 },
  { tier: 223, name: 'Jurassic Park', globalClick: 777 },
  { tier: 224, name: 'Area 51', globalClick: 1337 },
  { tier: 225, name: 'TMNT', globalClick: 42069 },
  { tier: 226, name: 'X-Men', globalClick: 69420 },
  { tier: 227, name: 'Street Fighter 2', globalClick: 8008135 },
  { tier: 228, name: 'Virtua Fighter', globalClick: 8675309 },
  { tier: 229, name: "Cruis'n USA", globalClick: 42 },
] as const;

/** Find a collection slot by tier */
export function findSlotByTier(tier: number): CollectionSlot | undefined {
  return COLLECTION_SLOTS.find(s => s.tier === tier);
}

/** Find a collection slot by cursor ID */
export function findSlotByCursor(cursorId: string): CollectionSlot | undefined {
  return COLLECTION_SLOTS.find(s => s.cursor === cursorId);
}

/** Get all slots with cursors (excludes global 1/1s without cursors) */
export function getSlotsWithCursors(): CollectionSlot[] {
  return COLLECTION_SLOTS.filter(s => s.cursor !== null);
}
