/**
 * ENS Resolution Service
 * Resolves Ethereum addresses to ENS names with caching
 */

import { ethers } from 'ethers';

/** Cache for ENS lookups: address -> { name, timestamp } */
const ensCache = new Map<string, { name: string | null; timestamp: number }>();

/** Cache duration: 5 minutes */
const CACHE_DURATION_MS = 5 * 60 * 1000;

/** Batch queue for ENS lookups */
let pendingLookups: Map<string, Promise<string | null>> = new Map();

/** Cached mainnet provider instance */
let mainnetProvider: ethers.providers.JsonRpcProvider | null = null;

/**
 * Get a mainnet provider for ENS resolution
 * ENS only works on mainnet, regardless of what network we're on
 */
function getMainnetProvider(): ethers.providers.JsonRpcProvider {
  if (mainnetProvider) return mainnetProvider;

  // Use Alchemy mainnet RPC if available, fallback to public RPC
  const rpcUrl = import.meta.env.VITE_ETH_MAINNET_RPC_URL || 'https://eth.llamarpc.com';
  console.log('[ENS] Mainnet RPC URL:', rpcUrl.includes('alchemy') ? 'Alchemy (configured)' : rpcUrl);
  mainnetProvider = new ethers.providers.JsonRpcProvider(rpcUrl);
  return mainnetProvider;
}

/**
 * Look up ENS name for an address
 * Returns cached result if available, otherwise fetches from mainnet
 */
export async function lookupEns(address: string): Promise<string | null> {
  const addrLower = address.toLowerCase();

  // Check cache first
  const cached = ensCache.get(addrLower);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
    return cached.name;
  }

  // Check if already in flight
  const pending = pendingLookups.get(addrLower);
  if (pending) {
    return pending;
  }

  // Create new lookup promise
  const lookupPromise = (async (): Promise<string | null> => {
    try {
      const provider = getMainnetProvider();
      console.log('[ENS] Looking up address:', address);
      const name = await provider.lookupAddress(address);
      console.log('[ENS] Resolved:', address, '->', name || '(no ENS)');

      // Cache the result (even if null)
      ensCache.set(addrLower, { name, timestamp: Date.now() });

      return name;
    } catch (error) {
      console.warn(`[ENS] Lookup failed for ${address}:`, error);
      // Cache the failure to avoid repeated failed lookups
      ensCache.set(addrLower, { name: null, timestamp: Date.now() });
      return null;
    } finally {
      // Remove from pending
      pendingLookups.delete(addrLower);
    }
  })();

  // Store in pending
  pendingLookups.set(addrLower, lookupPromise);

  return lookupPromise;
}

/**
 * Batch resolve multiple addresses to ENS names
 * Returns a map of address -> name (or null if no ENS)
 */
export async function batchLookupEns(addresses: string[]): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();

  // Filter to unique addresses
  const uniqueAddresses = [...new Set(addresses.map(a => a.toLowerCase()))];

  // Lookup all in parallel
  const lookupPromises = uniqueAddresses.map(async (addr) => {
    const name = await lookupEns(addr);
    results.set(addr, name);
  });

  await Promise.all(lookupPromises);

  return results;
}

/**
 * Get ENS name from cache only (no network request)
 * Useful for synchronous rendering
 */
export function getCachedEns(address: string): string | null {
  const addrLower = address.toLowerCase();
  const cached = ensCache.get(addrLower);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
    return cached.name;
  }

  return null;
}

/**
 * Check if we have a cached ENS result for an address
 */
export function hasCachedEns(address: string): boolean {
  const addrLower = address.toLowerCase();
  const cached = ensCache.get(addrLower);
  return !!cached && Date.now() - cached.timestamp < CACHE_DURATION_MS;
}

/**
 * Clear the ENS cache
 */
export function clearEnsCache(): void {
  ensCache.clear();
}
