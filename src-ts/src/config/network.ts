/**
 * Network configuration for EVM chains
 */

import type { NetworkConfig, AppConfig } from '@/types/index.ts';

/** Available network identifiers */
export type NetworkId = 'sepolia' | 'mainnet' | 'base';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const BASE_GAME_ADDRESS =
  import.meta.env.VITE_CLICKSTR_GAME_V2_ADDRESS || ZERO_ADDRESS;

/** Network-specific configurations */
export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  sepolia: {
    chainId: 11155111,
    chainName: 'Sepolia',
    rpcUrl: import.meta.env.VITE_SEPOLIA_RPC_URL || '',
    contractAddress: '0xAce0502aC3DE5BcDa8BAF8499D9e4f2a2c295430', // ClickstrGameV2 Season 1 (6 epochs x 4h = 24h)
    tokenAddress: '0x120E2fCf5b26FC49Fe3d1E7c851346c898619C28', // MockClickToken (V2 test - 1B supply)
    nftContractAddress: '0xDD866DbCbf3120C62e46cdB97183aB3F71999ebd', // ClickstrNFTV2 (fresh registry)
    turnstileSiteKey: '0x4AAAAAACV0UOMmCeG_g2Jr',
    // V2 additional addresses:
    // Registry: 0x8945ad6dbA24C90998175bC007d6B2B81c650a61
    // Treasury: 0x82378b6C7247b02f4b985Aca079a0A85E0D2cbAe
  },
  mainnet: {
    chainId: 1,
    chainName: 'Ethereum',
    rpcUrl: import.meta.env.VITE_ETH_MAINNET_RPC_URL || '',
    contractAddress: '0xf6055889a000dfe93ce3795ebc99d2f44b2282f1', // ClickstrGameV2 Season 3 (3 epochs x 24h = 3 days)
    tokenAddress: '0x7ddbd0c4a0383a0f9611b715809f92c90e1d991d', // $CLICK token via TokenWorks
    nftContractAddress: '0x43693922EE81D4930fDFCB03DEEA6d75e41c05b0', // ClickstrNFTV2 (mainnet)
    turnstileSiteKey: '0x4AAAAAACV0UOMmCeG_g2Jr',
    // V2 infrastructure (mainnet):
    // Registry: 0xDA47fbc8DcBeef8069859416e0fdC2Ac62bDd576
    // Treasury: 0x25e34963231de4451846cBb1A4ACEfa56c81f4e4
  },
  base: {
    chainId: 8453,
    chainName: 'Base',
    rpcUrl: import.meta.env.VITE_BASE_MAINNET_RPC_URL || '',
    // Set via VITE_CLICKSTR_GAME_V2_ADDRESS after Base season deploy
    contractAddress: BASE_GAME_ADDRESS,
    tokenAddress: '0x43f8e5502c57e64659cee77a97aa23adae605b89', // Base $CLICKSTR token
    nftContractAddress: '0x37c4C8817a6F87e6a0984b5e8fd73c9F07f8f849', // Base ClickstrNFTV2
    turnstileSiteKey: '0x4AAAAAACV0UOMmCeG_g2Jr',
    // V2 infrastructure (Base):
    // Registry: 0xf724ede44Bbb2Ccf46cec530c21B14885D441e02
    // Treasury: 0xBBf23Ef49F9e6B74596C931E7A579d99ba401586
  },
} as const;

/**
 * Current active network - set via VITE_NETWORK env var
 * Usage:
 *   VITE_NETWORK=sepolia npm run build   -> builds for Sepolia
 *   VITE_NETWORK=mainnet npm run build   -> builds for Mainnet
 *   VITE_NETWORK=base npm run build      -> builds for Base
 *   npm run build                        -> defaults to Base
 */
export const CURRENT_NETWORK: NetworkId =
  (import.meta.env.VITE_NETWORK as NetworkId) || 'base';

/** Build the full application configuration */
export function buildConfig(networkId: NetworkId = CURRENT_NETWORK): AppConfig {
  const network = NETWORKS[networkId];
  const apiUrl = 'https://mann.cool/api/clickstr-v2';
  const subgraphUrl =
    networkId === 'mainnet'
      ? 'https://api.goldsky.com/api/public/project_cmit79ozucckp01w991mfehjs/subgraphs/clickstr-mainnet/1.0.0/gn'
      : networkId === 'sepolia'
        ? 'https://api.goldsky.com/api/public/project_cmit79ozucckp01w991mfehjs/subgraphs/clickstr-sepolia/1.0.4/gn'
        : ''; // Base V2 uses API + Redis for leaderboards

  return {
    ...network,
    minBatchSize: 50,
    maxBatchSize: 3000,
    walletConnectProjectId: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || '',
    apiUrl,
    subgraphUrl,
  };
}

/** The active configuration */
export const CONFIG: AppConfig = buildConfig(CURRENT_NETWORK);

/** Check if an NFT contract address is configured */
export function hasNftContract(): boolean {
  return CONFIG.nftContractAddress !== '0x...';
}

/** Check if we're on mainnet */
export function isMainnet(): boolean {
  return CURRENT_NETWORK === 'mainnet';
}

/** Get chain ID as hex string for wallet operations */
export function getChainIdHex(): string {
  return '0x' + CONFIG.chainId.toString(16);
}
