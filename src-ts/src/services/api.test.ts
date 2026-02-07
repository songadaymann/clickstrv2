import { describe, it, expect } from 'vitest';
import { mergeLeaderboards } from './api';
import type { LeaderboardEntry, SubgraphUser } from '@/types/index';

describe('api', () => {
  describe('mergeLeaderboards', () => {
    it('returns empty array when both inputs are empty', () => {
      const result = mergeLeaderboards([], []);
      expect(result).toEqual([]);
    });

    it('returns empty when only frontend data but no contract data', () => {
      const frontendData: LeaderboardEntry[] = [
        { address: '0x1234', totalClicks: 100, name: 'Alice' },
      ];
      const contractData: SubgraphUser[] = [];

      const result = mergeLeaderboards(frontendData, contractData);
      // No contract clicks means totalClicks = 0, so filtered out
      expect(result).toEqual([]);
    });

    it('returns bots when only contract data (no frontend)', () => {
      const frontendData: LeaderboardEntry[] = [];
      const contractData: SubgraphUser[] = [
        { id: '0x1234', totalClicks: '500', totalReward: '0' },
      ];

      const result = mergeLeaderboards(frontendData, contractData);
      expect(result).toHaveLength(1);
      expect(result[0].address).toBe('0x1234');
      expect(result[0].totalClicks).toBe(500);
      expect(result[0].isHuman).toBe(false);
      expect(result[0].rank).toBe(1);
    });

    it('marks users as human when they have frontend activity', () => {
      const frontendData: LeaderboardEntry[] = [
        { address: '0x1234', totalClicks: 100, name: 'Alice' },
      ];
      const contractData: SubgraphUser[] = [
        { id: '0x1234', totalClicks: '500', totalReward: '0' },
      ];

      const result = mergeLeaderboards(frontendData, contractData);
      expect(result).toHaveLength(1);
      expect(result[0].isHuman).toBe(true);
      expect(result[0].name).toBe('Alice');
      expect(result[0].totalClicks).toBe(500); // Contract data is authoritative
      expect(result[0].frontendClicks).toBe(100);
    });

    it('handles case-insensitive address matching', () => {
      const frontendData: LeaderboardEntry[] = [
        { address: '0xAbCd1234', totalClicks: 100, name: 'Alice' },
      ];
      const contractData: SubgraphUser[] = [
        { id: '0xabcd1234', totalClicks: '500', totalReward: '0' },
      ];

      const result = mergeLeaderboards(frontendData, contractData);
      expect(result).toHaveLength(1);
      expect(result[0].isHuman).toBe(true);
      expect(result[0].name).toBe('Alice');
    });

    it('sorts by totalClicks descending', () => {
      const frontendData: LeaderboardEntry[] = [];
      const contractData: SubgraphUser[] = [
        { id: '0x1111', totalClicks: '100', totalReward: '0' },
        { id: '0x2222', totalClicks: '500', totalReward: '0' },
        { id: '0x3333', totalClicks: '250', totalReward: '0' },
      ];

      const result = mergeLeaderboards(frontendData, contractData);
      expect(result).toHaveLength(3);
      expect(result[0].address).toBe('0x2222');
      expect(result[0].totalClicks).toBe(500);
      expect(result[1].address).toBe('0x3333');
      expect(result[1].totalClicks).toBe(250);
      expect(result[2].address).toBe('0x1111');
      expect(result[2].totalClicks).toBe(100);
    });

    it('assigns correct rank numbers', () => {
      const frontendData: LeaderboardEntry[] = [];
      const contractData: SubgraphUser[] = [
        { id: '0x1111', totalClicks: '300', totalReward: '0' },
        { id: '0x2222', totalClicks: '200', totalReward: '0' },
        { id: '0x3333', totalClicks: '100', totalReward: '0' },
      ];

      const result = mergeLeaderboards(frontendData, contractData);
      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(2);
      expect(result[2].rank).toBe(3);
    });

    it('respects limit parameter', () => {
      const frontendData: LeaderboardEntry[] = [];
      const contractData: SubgraphUser[] = [
        { id: '0x1111', totalClicks: '100', totalReward: '0' },
        { id: '0x2222', totalClicks: '200', totalReward: '0' },
        { id: '0x3333', totalClicks: '300', totalReward: '0' },
        { id: '0x4444', totalClicks: '400', totalReward: '0' },
        { id: '0x5555', totalClicks: '500', totalReward: '0' },
      ];

      const result = mergeLeaderboards(frontendData, contractData, 3);
      expect(result).toHaveLength(3);
      expect(result[0].totalClicks).toBe(500);
      expect(result[2].totalClicks).toBe(300);
    });

    it('filters out entries with zero on-chain clicks', () => {
      const frontendData: LeaderboardEntry[] = [
        { address: '0x1234', totalClicks: 100, name: 'Alice' },
      ];
      const contractData: SubgraphUser[] = [
        { id: '0x1234', totalClicks: '0', totalReward: '0' },
        { id: '0x5678', totalClicks: '500', totalReward: '0' },
      ];

      const result = mergeLeaderboards(frontendData, contractData);
      expect(result).toHaveLength(1);
      expect(result[0].address).toBe('0x5678');
    });

    it('preserves name from frontend data', () => {
      const frontendData: LeaderboardEntry[] = [
        { address: '0x1234', totalClicks: 50, name: 'Bob' },
      ];
      const contractData: SubgraphUser[] = [
        { id: '0x1234', totalClicks: '1000', totalReward: '0' },
      ];

      const result = mergeLeaderboards(frontendData, contractData);
      expect(result[0].name).toBe('Bob');
    });

    it('handles null/undefined names', () => {
      const frontendData: LeaderboardEntry[] = [
        { address: '0x1234', totalClicks: 50, name: null },
      ];
      const contractData: SubgraphUser[] = [
        { id: '0x1234', totalClicks: '1000', totalReward: '0' },
      ];

      const result = mergeLeaderboards(frontendData, contractData);
      expect(result[0].name).toBeNull();
    });

    it('skips entries with missing addresses', () => {
      const frontendData: LeaderboardEntry[] = [
        { address: '', totalClicks: 100, name: 'NoAddr' },
        { address: '0x1234', totalClicks: 50, name: 'Valid' },
      ];
      const contractData: SubgraphUser[] = [
        { id: '0x1234', totalClicks: '500', totalReward: '0' },
      ];

      const result = mergeLeaderboards(frontendData, contractData);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Valid');
    });

    it('handles mixed human and bot entries', () => {
      const frontendData: LeaderboardEntry[] = [
        { address: '0x1111', totalClicks: 100, name: 'Human1' },
        { address: '0x2222', totalClicks: 50, name: 'Human2' },
      ];
      const contractData: SubgraphUser[] = [
        { id: '0x1111', totalClicks: '500', totalReward: '0' },
        { id: '0x2222', totalClicks: '300', totalReward: '0' },
        { id: '0x3333', totalClicks: '400', totalReward: '0' }, // Bot
      ];

      const result = mergeLeaderboards(frontendData, contractData);
      expect(result).toHaveLength(3);

      // Check sorted order: 500, 400, 300
      expect(result[0].address).toBe('0x1111');
      expect(result[0].isHuman).toBe(true);

      expect(result[1].address).toBe('0x3333');
      expect(result[1].isHuman).toBe(false);

      expect(result[2].address).toBe('0x2222');
      expect(result[2].isHuman).toBe(true);
    });

    it('uses default limit of 10', () => {
      const frontendData: LeaderboardEntry[] = [];
      const contractData: SubgraphUser[] = Array.from({ length: 15 }, (_, i) => ({
        id: `0x${i.toString().padStart(4, '0')}`,
        totalClicks: String((15 - i) * 100),
        totalReward: '0',
      }));

      const result = mergeLeaderboards(frontendData, contractData);
      expect(result).toHaveLength(10);
    });
  });
});
