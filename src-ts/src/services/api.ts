/**
 * Server API service
 */

import { CONFIG } from '@/config/index.ts';
import type {
  ServerStatsResponse,
  LeaderboardResponse,
  RecordClicksResponse,
  VerificationResponse,
  ClaimSignatureResponse,
  SubgraphUsersResponse,
  SubgraphGlobalStatsResponse,
  LeaderboardEntry,
  SubgraphUser,
  MergedLeaderboardEntry,
  MatrixLeaderboardEntry,
  ActiveUsersResponse,
  HeartbeatResponse,
  V2ClaimSignatureResponse,
  V2ClaimableEpochsResponse,
  V2SubmitClicksResponse,
  V2StatsResponse,
  MiningChallengeResponse,
} from '@/types/index.ts';

const CLAIM_SIGNATURE_URL = 'https://mann.cool/api/clickstr-claim-signature';
const V2_CLAIM_URL = 'https://mann.cool/api/clickstr-v2';

/**
 * Fetch user stats from the server
 */
export async function fetchServerStats(address: string): Promise<ServerStatsResponse | null> {
  try {
    const response = await fetch(`${CONFIG.apiUrl}?address=${address}`);
    const data = await response.json() as Record<string, unknown>;

    if (data && typeof data === 'object') {
      // Normalize V2 shape into V1-style ServerStatsResponse
      if (Array.isArray(data.milestones)) {
        data.milestones = { unlocked: data.milestones };
      }
      if (Array.isArray(data.achievements)) {
        data.achievements = { unlocked: data.achievements };
      }
      if (data.totalClicks === undefined && typeof data.lifetimeClicks === 'number') {
        data.totalClicks = data.lifetimeClicks;
      }
    }

    const typed = data as unknown as ServerStatsResponse;
    return typed.success ? typed : null;
  } catch (error) {
    console.error('Server stats error:', error);
    return null;
  }
}

/**
 * Check if user needs Turnstile verification
 */
export async function checkVerificationStatus(address: string): Promise<VerificationResponse> {
  try {
    const response = await fetch(`${CONFIG.apiUrl}?address=${address}&verification=true`);
    return await response.json() as VerificationResponse;
  } catch (error) {
    console.error('Verification check error:', error);
    return { success: false };
  }
}

/**
 * Record clicks to server (with optional Turnstile token and nonces for proof-of-work)
 * @param address User's wallet address
 * @param clicks Number of clicks to record
 * @param turnstileToken Optional Turnstile verification token
 * @param nonces Optional array of nonces as proof-of-work (for off-chain submissions)
 * @param epoch Optional epoch number (required for PoW verification when game is active)
 */
export async function recordClicksToServer(
  address: string,
  clicks: number,
  turnstileToken?: string | null,
  nonces?: string[],
  epoch?: number
): Promise<RecordClicksResponse> {
  try {
    const body: Record<string, unknown> = { address, clicks };
    if (turnstileToken) {
      body.turnstileToken = turnstileToken;
    }
    if (nonces && nonces.length > 0) {
      body.nonces = nonces;
    }
    if (epoch !== undefined) {
      body.epoch = epoch;
    }

    const response = await fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (response.status === 403) {
      const data = await response.json() as RecordClicksResponse;
      if (data.requiresVerification) {
        return { success: false, requiresVerification: true };
      }
    }

    return await response.json() as RecordClicksResponse;
  } catch (error) {
    console.error('Record clicks error:', error);
    return { success: false };
  }
}

/**
 * Record on-chain submission metadata
 */
export async function recordOnChainSubmission(
  address: string,
  onChainClicks: number,
  txHash: string,
  epoch: number
): Promise<void> {
  try {
    await fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address,
        onChainClicks,
        txHash,
        epoch,
      }),
    });
  } catch (error) {
    console.warn('Failed to record on-chain submission:', error);
  }
}

/**
 * Fetch frontend leaderboard
 */
export async function fetchFrontendLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  try {
    const response = await fetch(`${CONFIG.apiUrl}?leaderboard=true&limit=${limit}`);
    if (!response.ok) throw new Error('Failed to fetch frontend leaderboard');

    const data = await response.json() as LeaderboardResponse;
    if (data.success && data.leaderboard) {
      return data.leaderboard;
    }
    return [];
  } catch (error) {
    console.error('Frontend leaderboard fetch error:', error);
    return [];
  }
}

/**
 * Fetch contract leaderboard from subgraph
 */
export async function fetchContractLeaderboard(limit = 50): Promise<SubgraphUser[]> {
  try {
    const response = await fetch(CONFIG.subgraphUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{
          users(first: ${limit}, orderBy: totalClicks, orderDirection: desc) {
            id
            totalClicks
            totalReward
          }
        }`,
      }),
    });

    if (!response.ok) throw new Error('Failed to fetch contract leaderboard');

    const data = await response.json() as SubgraphUsersResponse;
    if (data.data?.users) {
      return data.data.users;
    }
    return [];
  } catch (error) {
    console.error('Contract leaderboard fetch error:', error);
    return [];
  }
}

/**
 * Fetch global stats from subgraph
 */
export async function fetchGlobalStats(): Promise<number> {
  try {
    const response = await fetch(CONFIG.subgraphUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{ globalStats(id: "global") { totalClicks } }`,
      }),
    });

    if (!response.ok) throw new Error('Failed to fetch global stats');

    const data = await response.json() as SubgraphGlobalStatsResponse;
    if (data.data?.globalStats) {
      return parseInt(data.data.globalStats.totalClicks) || 0;
    }
    return 0;
  } catch (error) {
    console.error('Global stats fetch error:', error);
    return 0;
  }
}

/**
 * Merge frontend and contract leaderboards
 * Contract clicks are authoritative, frontend indicates human activity
 */
export function mergeLeaderboards(
  frontendData: LeaderboardEntry[],
  contractData: SubgraphUser[],
  limit = 10
): MergedLeaderboardEntry[] {
  const merged: Record<string, MergedLeaderboardEntry> = {};

  // Add frontend data (marks user as human)
  for (const entry of frontendData) {
    const addr = entry.address?.toLowerCase();
    if (!addr) continue;

    if (!merged[addr]) {
      merged[addr] = {
        address: entry.address,
        name: entry.name ?? null,
        totalClicks: 0,
        frontendClicks: 0,
        isHuman: true,
      };
    }
    merged[addr].frontendClicks = entry.totalClicks || 0;
    if (entry.name) merged[addr].name = entry.name;
  }

  // Add contract data (authoritative click count)
  for (const entry of contractData) {
    const addr = entry.id?.toLowerCase();
    if (!addr) continue;

    if (!merged[addr]) {
      merged[addr] = {
        address: entry.id,
        name: null,
        totalClicks: 0,
        frontendClicks: 0,
        isHuman: false,
      };
    }
    merged[addr].totalClicks = parseInt(entry.totalClicks) || 0;
  }

  // Sort by on-chain clicks and take top N
  // isHuman = true if they have any frontend activity
  return Object.values(merged)
    .filter(entry => entry.totalClicks > 0)
    .sort((a, b) => b.totalClicks - a.totalClicks)
    .slice(0, limit)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
      isHuman: entry.frontendClicks > 0,
    }));
}

/**
 * Fetch global leaderboard (all-time frontend clicks from Redis)
 * This tracks human activity across all games
 */
export async function fetchGlobalLeaderboard(limit = 10): Promise<MergedLeaderboardEntry[]> {
  try {
    const frontendData = await fetchFrontendLeaderboard(limit);

    // For global, frontend clicks ARE the ranking (all humans)
    return frontendData
      .slice(0, limit)
      .map((entry, index) => ({
        address: entry.address,
        name: entry.name ?? null,
        totalClicks: entry.totalClicks || 0,
        frontendClicks: entry.totalClicks || 0,
        rank: index + 1,
        isHuman: true,
      }));
  } catch (error) {
    console.error('Global leaderboard fetch error:', error);
    return [];
  }
}

/**
 * Fetch game-specific leaderboard (on-chain clicks from that game's subgraph)
 */
export async function fetchGameLeaderboard(
  subgraphUrl: string,
  limit = 10
): Promise<MergedLeaderboardEntry[]> {
  try {
    const response = await fetch(subgraphUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{
          users(first: ${limit}, orderBy: totalClicks, orderDirection: desc) {
            id
            totalClicks
            totalReward
          }
        }`,
      }),
    });

    if (!response.ok) throw new Error('Failed to fetch game leaderboard');

    const data = await response.json() as SubgraphUsersResponse;
    if (data.data?.users) {
      // Also fetch frontend data to get names and mark humans
      const frontendData = await fetchFrontendLeaderboard(100);
      const frontendMap = new Map(
        frontendData.map(e => [e.address?.toLowerCase(), e])
      );

      return data.data.users.map((user, index) => {
        const addr = user.id.toLowerCase();
        const frontend = frontendMap.get(addr);
        return {
          address: user.id,
          name: frontend?.name ?? null,
          totalClicks: parseInt(user.totalClicks) || 0,
          frontendClicks: frontend?.totalClicks || 0,
          rank: index + 1,
          isHuman: !!frontend,
        };
      });
    }
    return [];
  } catch (error) {
    console.error('Game leaderboard fetch error:', error);
    return [];
  }
}

/**
 * Fetch matrix leaderboard for a game (combines all players with on-chain + human clicks)
 * Sorted by on-chain clicks (who wins epochs)
 */
export async function fetchMatrixLeaderboard(
  subgraphUrl: string,
  limit = 50
): Promise<MatrixLeaderboardEntry[]> {
  try {
    // Fetch both data sources in parallel
    const [subgraphResponse, frontendData] = await Promise.all([
      fetch(subgraphUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `{
            users(first: ${limit}, orderBy: totalClicks, orderDirection: desc) {
              id
              totalClicks
            }
          }`,
        }),
      }),
      fetchFrontendLeaderboard(limit),
    ]);

    if (!subgraphResponse.ok) throw new Error('Failed to fetch subgraph');

    const subgraphData = await subgraphResponse.json() as SubgraphUsersResponse;
    const onChainUsers = subgraphData.data?.users || [];

    // Build a map of frontend (human) clicks by address
    const frontendMap = new Map(
      frontendData.map(e => [e.address?.toLowerCase(), e])
    );

    // Build a set of all addresses from both sources
    const allAddresses = new Set<string>();
    for (const user of onChainUsers) {
      allAddresses.add(user.id.toLowerCase());
    }
    for (const entry of frontendData) {
      allAddresses.add(entry.address.toLowerCase());
    }

    // Build merged entries
    const entries: MatrixLeaderboardEntry[] = [];
    for (const addr of allAddresses) {
      const onChainUser = onChainUsers.find(u => u.id.toLowerCase() === addr);
      const frontendUser = frontendMap.get(addr);

      entries.push({
        address: onChainUser?.id || frontendUser?.address || addr,
        name: frontendUser?.name ?? null,
        onChainClicks: parseInt(onChainUser?.totalClicks || '0') || 0,
        humanClicks: frontendUser?.totalClicks || 0,
        rank: 0, // Will be set after sorting
      });
    }

    // Sort by on-chain clicks (epoch winner competition)
    entries.sort((a, b) => b.onChainClicks - a.onChainClicks);

    // Assign ranks
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return entries.slice(0, limit);
  } catch (error) {
    console.error('Matrix leaderboard fetch error:', error);
    return [];
  }
}

/**
 * Get NFT claim signature from server
 */
export async function getClaimSignature(
  address: string,
  tier: number
): Promise<ClaimSignatureResponse> {
  const response = await fetch(CLAIM_SIGNATURE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, tier }),
  });

  if (!response.ok) {
    const error = await response.json() as { error?: string };
    throw new Error(error.error ?? 'Failed to get signature');
  }

  return await response.json() as ClaimSignatureResponse;
}

/**
 * Confirm NFT claim with server
 */
export async function confirmClaim(
  address: string,
  tier: number,
  txHash: string
): Promise<void> {
  try {
    await fetch(CLAIM_SIGNATURE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address,
        tier,
        action: 'confirm',
        txHash,
      }),
    });
  } catch (error) {
    // Non-critical - the on-chain claim succeeded
    console.warn('Failed to confirm claim with server:', error);
  }
}

/**
 * Request a V2 claim attestation (with optional Turnstile + wallet signature)
 */
export async function requestV2ClaimSignature(
  address: string,
  epoch: number,
  options?: {
    turnstileToken?: string | null;
    walletSignature?: string | null;
    challenge?: string | null;
  }
): Promise<V2ClaimSignatureResponse> {
  try {
    const body: Record<string, unknown> = {
      address,
      action: 'claim',
      epoch,
    };

    if (options?.turnstileToken) {
      body.turnstileToken = options.turnstileToken;
    }
    if (options?.walletSignature) {
      body.walletSignature = options.walletSignature;
    }
    if (options?.challenge) {
      body.challenge = options.challenge;
    }

    const response = await fetch(V2_CLAIM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json() as V2ClaimSignatureResponse;
    return data;
  } catch (error) {
    console.error('V2 claim signature error:', error);
    return { error: 'Failed to request claim signature' };
  }
}

/**
 * Send heartbeat to server to indicate active frontend session
 */
export async function sendHeartbeat(address: string): Promise<HeartbeatResponse> {
  try {
    const response = await fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address,
        heartbeat: true,
      }),
    });
    return await response.json() as HeartbeatResponse;
  } catch (error) {
    console.warn('Heartbeat failed:', error);
    return { success: false };
  }
}

/**
 * Fetch active users count (humans with frontend open + recent bot activity)
 */
export async function fetchActiveUsers(): Promise<ActiveUsersResponse> {
  try {
    const response = await fetch(`${CONFIG.apiUrl}?activeUsers=true`);
    if (!response.ok) {
      throw new Error('Failed to fetch active users');
    }
    return await response.json() as ActiveUsersResponse;
  } catch (error) {
    console.error('Active users fetch error:', error);
    return { success: false, activeHumans: 0, activeBots: 0 };
  }
}

/**
 * Fetch recent bot activity from subgraph
 * Counts unique addresses that submitted on-chain in the last N minutes
 * but are NOT in the human leaderboard (i.e., they didn't use the frontend with Turnstile)
 */
export async function fetchRecentBotActivity(minutesAgo = 5): Promise<number> {
  try {
    // Get timestamp from N minutes ago
    const cutoffTime = Math.floor(Date.now() / 1000) - (minutesAgo * 60);

    // Fetch both: recent on-chain activity AND human leaderboard
    const [subgraphResponse, humanResponse] = await Promise.all([
      fetch(CONFIG.subgraphUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `{
            clickSubmissions(
              first: 100,
              where: { timestamp_gt: "${cutoffTime}" },
              orderBy: timestamp,
              orderDirection: desc
            ) {
              user { id }
            }
          }`,
        }),
      }),
      fetch(`${CONFIG.apiUrl}?leaderboard=true`),
    ]);

    if (!subgraphResponse.ok) throw new Error('Failed to fetch recent activity');

    const subgraphData = await subgraphResponse.json() as {
      data?: {
        clickSubmissions?: Array<{ user: { id: string } }>;
      };
    };

    // Get set of human addresses from the leaderboard
    const humanAddresses = new Set<string>();
    if (humanResponse.ok) {
      const humanData = await humanResponse.json() as {
        leaderboard?: Array<{ address: string }>;
      };
      if (humanData.leaderboard) {
        humanData.leaderboard.forEach(entry => {
          humanAddresses.add(entry.address.toLowerCase());
        });
      }
    }

    if (subgraphData.data?.clickSubmissions) {
      // Get unique addresses from recent on-chain activity
      const recentOnChainAddresses = new Set(
        subgraphData.data.clickSubmissions.map(s => s.user.id.toLowerCase())
      );

      // Count only those NOT in human leaderboard (true bots)
      let botCount = 0;
      recentOnChainAddresses.forEach(addr => {
        if (!humanAddresses.has(addr)) {
          botCount++;
        }
      });

      return botCount;
    }
    return 0;
  } catch (error) {
    console.error('Recent bot activity fetch error:', error);
    return 0;
  }
}

/** Response from sync achievements endpoint */
export interface SyncAchievementsResponse {
  success: boolean;
  address?: string;
  totalClicks?: number;
  globalClicks?: number;
  newMilestones?: Array<{ id: string; name: string; tier: number }>;
  newAchievements?: Array<{ id: string; name: string; tier: number; type: string }>;
  newGlobalMilestones?: Array<{ id: string; name: string; tier: number; globalClick: number; type: string }>;
  message?: string;
}

/**
 * Sync achievements - retroactively grant any missing achievements
 * based on current total clicks (useful for achievements added after user played)
 */
export async function syncAchievements(address: string): Promise<SyncAchievementsResponse> {
  try {
    const response = await fetch(`${CONFIG.apiUrl}?address=${address}&syncAchievements=true`);
    if (!response.ok) {
      throw new Error('Failed to sync achievements');
    }
    return await response.json() as SyncAchievementsResponse;
  } catch (error) {
    console.error('Sync achievements error:', error);
    return { success: false };
  }
}

/**
 * Fetch V2 claimable epochs for a user
 */
export async function fetchV2ClaimableEpochs(address: string): Promise<V2ClaimableEpochsResponse> {
  try {
    const response = await fetch(`${V2_CLAIM_URL}?claimable=true&address=${address}`);
    if (!response.ok) {
      throw new Error('Failed to fetch claimable epochs');
    }
    return await response.json() as V2ClaimableEpochsResponse;
  } catch (error) {
    console.error('V2 claimable epochs fetch error:', error);
    return { success: false, error: 'Failed to fetch claimable epochs' };
  }
}

/**
 * Fetch a mining challenge from the server.
 * The challenge is a short-lived token that must be included in the PoW hash
 * to prove nonces were mined in real-time (prevents offline pre-computation).
 */
export async function fetchMiningChallenge(
  address: string,
  turnstileToken?: string | null
): Promise<MiningChallengeResponse> {
  try {
    const params = new URLSearchParams({
      challenge: 'true',
      address,
    });
    if (turnstileToken) {
      params.set('turnstileToken', turnstileToken);
    }
    const response = await fetch(`${V2_CLAIM_URL}?${params.toString()}`);
    if (!response.ok) {
      if (response.status === 403) {
        const body = await response.json() as MiningChallengeResponse;
        if (body.requiresVerification) {
          const verificationResponse: MiningChallengeResponse = {
            success: false,
            requiresVerification: true,
          };
          if (body.reason) {
            verificationResponse.reason = body.reason;
          }
          return verificationResponse;
        }
      }
      if (response.status === 429) {
        return { success: false, error: 'Rate limited' };
      }
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json() as MiningChallengeResponse;
  } catch (error) {
    console.error('Mining challenge fetch error:', error);
    return { success: false, error: 'Failed to fetch mining challenge' };
  }
}

/** Nonce paired with the challenge it was mined under */
interface NonceChallengePayload {
  nonce: string;
  challenge: string | null;
}

/**
 * Submit clicks to V2 API (off-chain with PoW validation)
 * Each nonce carries the challenge it was mined with, so the server can
 * verify each one independently (prevents stale-challenge rejections).
 */
export async function submitClicksV2(
  address: string,
  nonces: NonceChallengePayload[],
  turnstileToken?: string | null,
): Promise<V2SubmitClicksResponse> {
  try {
    const body: Record<string, unknown> = {
      address,
      nonces, // array of { nonce: string, challenge: string | null }
    };

    if (turnstileToken) {
      body.turnstileToken = turnstileToken;
    }

    // Sensitive data (address, nonces) intentionally not logged

    const response = await fetch(V2_CLAIM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const result = await response.json() as V2SubmitClicksResponse;

    if (response.status === 403 && result.requiresVerification) {
      return { success: false, requiresVerification: true };
    }

    return result;
  } catch (error) {
    console.error('V2 submit clicks error:', error);
    return { success: false, error: 'Failed to submit clicks' };
  }
}

/**
 * Fetch V2 stats for a user
 */
export async function fetchV2Stats(address: string): Promise<V2StatsResponse> {
  try {
    const response = await fetch(`${V2_CLAIM_URL}?address=${address}`);
    if (!response.ok) {
      throw new Error('Failed to fetch V2 stats');
    }
    return await response.json() as V2StatsResponse;
  } catch (error) {
    console.error('V2 stats fetch error:', error);
    return { success: false, error: 'Failed to fetch stats' };
  }
}

/**
 * Send heartbeat to V2 API
 */
export async function sendHeartbeatV2(address: string): Promise<HeartbeatResponse> {
  try {
    const response = await fetch(V2_CLAIM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address,
        heartbeat: true,
      }),
    });
    return await response.json() as HeartbeatResponse;
  } catch (error) {
    console.warn('V2 Heartbeat failed:', error);
    return { success: false };
  }
}

/**
 * V2 leaderboard types
 */
export type V2LeaderboardType = 'epoch' | 'alltime' | 'earned' | 'bots';

/**
 * Fetch V2 leaderboard by type
 * - 'epoch': current epoch clicks (default)
 * - 'alltime': all-time total clicks
 * - 'earned': all-time earned tokens
 * - 'bots': flagged bot addresses (all-time clicks)
 * Returns MergedLeaderboardEntry[] for compatibility with existing leaderboard rendering
 */
export async function fetchV2Leaderboard(limit = 50, type: V2LeaderboardType = 'epoch', epoch?: number): Promise<MergedLeaderboardEntry[]> {
  try {
    let url = `${V2_CLAIM_URL}?leaderboard=true&limit=${limit}&type=${type}`;
    if (epoch !== undefined) {
      url += `&epoch=${epoch}`;
    }
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch V2 leaderboard');

    const data = await response.json() as {
      success: boolean;
      leaderboardType?: string;
      leaderboard?: Array<{
        rank: number;
        address: string;
        name?: string | null;
        totalClicks?: number;
        totalEarned?: string; // wei as string
      }>;
    };
    if (data.success && data.leaderboard) {
      // Convert to MergedLeaderboardEntry format
      return data.leaderboard.map((entry) => ({
        address: entry.address,
        name: entry.name ?? null,
        totalClicks: entry.totalClicks ?? 0,
        totalEarned: entry.totalEarned ?? null,
        frontendClicks: entry.totalClicks ?? 0,
        rank: entry.rank,
        isHuman: type !== 'bots', // Bots tab entries are not human
      }));
    }
    return [];
  } catch (error) {
    console.error('V2 leaderboard fetch error:', error);
    return [];
  }
}

/**
 * Fetch active users from V2 API
 */
export async function fetchActiveUsersV2(): Promise<ActiveUsersResponse> {
  try {
    const response = await fetch(`${V2_CLAIM_URL}?activeUsers=true`);
    if (!response.ok) {
      throw new Error('Failed to fetch active users');
    }
    return await response.json() as ActiveUsersResponse;
  } catch (error) {
    console.error('V2 active users fetch error:', error);
    return { success: false, activeHumans: 0, activeBots: 0 };
  }
}

/** Response from V2 difficulty endpoint */
export interface V2DifficultyResponse {
  success: boolean;
  difficultyTarget?: string;
  epoch?: number;
  targetClicksPerEpoch?: number;
  currentEpochClicks?: number;
  gameActive?: boolean;
}

/**
 * Fetch current PoW difficulty from V2 API
 */
export async function fetchV2Difficulty(): Promise<V2DifficultyResponse> {
  try {
    const response = await fetch(`${V2_CLAIM_URL}?difficulty=true`);
    if (!response.ok) {
      throw new Error('Failed to fetch V2 difficulty');
    }
    return await response.json() as V2DifficultyResponse;
  } catch (error) {
    console.error('V2 difficulty fetch error:', error);
    return { success: false };
  }
}
