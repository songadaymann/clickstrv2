import { describe, it, expect } from 'vitest';
import {
  getHighestMilestone,
  getMilestoneInfo,
  isGlobalMilestone,
  isHiddenMilestone,
  isStreakMilestone,
  isPersonalMilestone,
  MILESTONE_INFO,
  MILESTONE_ID_TO_TIER,
  PERSONAL_MILESTONE_THRESHOLDS,
} from './milestones';

describe('milestones', () => {
  describe('getHighestMilestone', () => {
    it('returns null for 0 clicks', () => {
      expect(getHighestMilestone(0)).toBeNull();
    });

    it('returns First Timer (tier 1) for 1 click', () => {
      const result = getHighestMilestone(1);
      expect(result).not.toBeNull();
      expect(result!.tier).toBe(1);
      expect(result!.name).toBe('First Timer');
      expect(result!.cursor).toBe('white');
    });

    it('returns Getting Started (tier 2) for 100 clicks', () => {
      const result = getHighestMilestone(100);
      expect(result).not.toBeNull();
      expect(result!.tier).toBe(2);
      expect(result!.name).toBe('Getting Started');
    });

    it('returns correct milestone for exactly threshold values', () => {
      // Test each threshold
      const thresholds = [
        { clicks: 1, tier: 1 },
        { clicks: 100, tier: 2 },
        { clicks: 500, tier: 3 },
        { clicks: 1000, tier: 4 },
        { clicks: 5000, tier: 5 },
        { clicks: 10000, tier: 6 },
        { clicks: 25000, tier: 7 },
        { clicks: 50000, tier: 8 },
        { clicks: 100000, tier: 9 },
        { clicks: 250000, tier: 10 },
        { clicks: 500000, tier: 11 },
        { clicks: 1000000, tier: 12 },
      ];

      for (const { clicks, tier } of thresholds) {
        const result = getHighestMilestone(clicks);
        expect(result).not.toBeNull();
        expect(result!.tier).toBe(tier);
      }
    });

    it('returns lower milestone when between thresholds', () => {
      // 99 clicks should still be tier 1 (not tier 2)
      const result = getHighestMilestone(99);
      expect(result).not.toBeNull();
      expect(result!.tier).toBe(1);
    });

    it('returns Click God (tier 12) for very high click counts', () => {
      const result = getHighestMilestone(10000000);
      expect(result).not.toBeNull();
      expect(result!.tier).toBe(12);
      expect(result!.name).toBe('Click God');
    });
  });

  describe('getMilestoneInfo', () => {
    it('returns correct info for personal milestones', () => {
      const info = getMilestoneInfo(1);
      expect(info.name).toBe('First Timer');
      expect(info.emoji).toBe('👆');
      expect(info.desc).toBe('1 click');
    });

    it('returns correct info for global milestones', () => {
      const info = getMilestoneInfo(200);
      expect(info.name).toBe('The First Click');
      expect(info.emoji).toBe('1️⃣');
    });

    it('returns correct info for hidden milestones', () => {
      const info = getMilestoneInfo(500);
      expect(info.name).toBe('Nice');
      expect(info.desc).toBe('Your 69th click');
    });

    it('returns fallback for unknown tier', () => {
      const info = getMilestoneInfo(9999);
      expect(info.name).toBe('Tier 9999');
      expect(info.emoji).toBe('🎖️');
      expect(info.desc).toBe('Achievement');
    });
  });

  describe('isGlobalMilestone', () => {
    it('returns true for global milestone tiers (200-499)', () => {
      expect(isGlobalMilestone(200)).toBe(true);
      expect(isGlobalMilestone(213)).toBe(true);
      expect(isGlobalMilestone(220)).toBe(true);
      expect(isGlobalMilestone(229)).toBe(true);
    });

    it('returns false for personal milestones', () => {
      expect(isGlobalMilestone(1)).toBe(false);
      expect(isGlobalMilestone(12)).toBe(false);
    });

    it('returns false for hidden milestones (500+)', () => {
      expect(isGlobalMilestone(500)).toBe(false);
      expect(isGlobalMilestone(600)).toBe(false);
    });

    it('returns false for streak milestones', () => {
      expect(isGlobalMilestone(101)).toBe(false);
      expect(isGlobalMilestone(105)).toBe(false);
    });
  });

  describe('isHiddenMilestone', () => {
    it('returns true for hidden milestone tiers (500+)', () => {
      expect(isHiddenMilestone(500)).toBe(true);
      expect(isHiddenMilestone(511)).toBe(true);
      expect(isHiddenMilestone(600)).toBe(true);
      expect(isHiddenMilestone(609)).toBe(true);
    });

    it('returns false for personal milestones', () => {
      expect(isHiddenMilestone(1)).toBe(false);
      expect(isHiddenMilestone(12)).toBe(false);
    });

    it('returns false for global milestones', () => {
      expect(isHiddenMilestone(200)).toBe(false);
      expect(isHiddenMilestone(229)).toBe(false);
    });
  });

  describe('isStreakMilestone', () => {
    it('returns true for streak milestone tiers (101-105)', () => {
      expect(isStreakMilestone(101)).toBe(true);
      expect(isStreakMilestone(102)).toBe(true);
      expect(isStreakMilestone(103)).toBe(true);
      expect(isStreakMilestone(104)).toBe(true);
      expect(isStreakMilestone(105)).toBe(true);
    });

    it('returns false for personal milestones', () => {
      expect(isStreakMilestone(1)).toBe(false);
      expect(isStreakMilestone(12)).toBe(false);
    });

    it('returns false for global milestones', () => {
      expect(isStreakMilestone(200)).toBe(false);
    });

    it('returns false for boundary values', () => {
      expect(isStreakMilestone(100)).toBe(false);
      expect(isStreakMilestone(106)).toBe(false);
    });
  });

  describe('isPersonalMilestone', () => {
    it('returns true for personal milestone tiers (1-12)', () => {
      for (let i = 1; i <= 12; i++) {
        expect(isPersonalMilestone(i)).toBe(true);
      }
    });

    it('returns false for tier 0', () => {
      expect(isPersonalMilestone(0)).toBe(false);
    });

    it('returns false for tier 13+', () => {
      expect(isPersonalMilestone(13)).toBe(false);
      expect(isPersonalMilestone(101)).toBe(false);
      expect(isPersonalMilestone(200)).toBe(false);
    });
  });

  describe('MILESTONE_ID_TO_TIER', () => {
    it('maps personal milestone IDs correctly', () => {
      expect(MILESTONE_ID_TO_TIER['first-timer']).toBe(1);
      expect(MILESTONE_ID_TO_TIER['click-god']).toBe(12);
    });

    it('maps global milestone IDs correctly', () => {
      expect(MILESTONE_ID_TO_TIER['global-1']).toBe(200);
      expect(MILESTONE_ID_TO_TIER['global-1000000']).toBe(206);
    });

    it('maps hidden milestone IDs correctly', () => {
      expect(MILESTONE_ID_TO_TIER['nice']).toBe(500);
      expect(MILESTONE_ID_TO_TIER['blaze-it']).toBe(501);
    });
  });

  describe('PERSONAL_MILESTONE_THRESHOLDS', () => {
    it('is sorted from highest to lowest clicks', () => {
      for (let i = 0; i < PERSONAL_MILESTONE_THRESHOLDS.length - 1; i++) {
        expect(PERSONAL_MILESTONE_THRESHOLDS[i].clicks).toBeGreaterThan(
          PERSONAL_MILESTONE_THRESHOLDS[i + 1].clicks
        );
      }
    });

    it('has 12 personal milestones', () => {
      expect(PERSONAL_MILESTONE_THRESHOLDS).toHaveLength(12);
    });

    it('each milestone has required properties', () => {
      for (const milestone of PERSONAL_MILESTONE_THRESHOLDS) {
        expect(milestone).toHaveProperty('tier');
        expect(milestone).toHaveProperty('clicks');
        expect(milestone).toHaveProperty('cursor');
        expect(milestone).toHaveProperty('name');
        expect(typeof milestone.tier).toBe('number');
        expect(typeof milestone.clicks).toBe('number');
        expect(typeof milestone.cursor).toBe('string');
        expect(typeof milestone.name).toBe('string');
      }
    });
  });

  describe('MILESTONE_INFO', () => {
    it('has info for all personal milestones (1-12)', () => {
      for (let i = 1; i <= 12; i++) {
        expect(MILESTONE_INFO[i]).toBeDefined();
        expect(MILESTONE_INFO[i].name).toBeTruthy();
        expect(MILESTONE_INFO[i].emoji).toBeTruthy();
      }
    });

    it('has info for all streak milestones (101-105)', () => {
      for (let i = 101; i <= 105; i++) {
        expect(MILESTONE_INFO[i]).toBeDefined();
      }
    });

    it('has info for main global milestones (200-213)', () => {
      for (let i = 200; i <= 213; i++) {
        expect(MILESTONE_INFO[i]).toBeDefined();
      }
    });

    it('has info for hidden global milestones (220-229)', () => {
      for (let i = 220; i <= 229; i++) {
        expect(MILESTONE_INFO[i]).toBeDefined();
      }
    });
  });
});
