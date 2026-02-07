/**
 * Wallet connection service using Reown AppKit
 */

import { ethers } from 'ethers';
import { appKit } from '@/config/appkit.ts';
import { CONFIG, getChainIdHex } from '@/config/index.ts';
import { gameState } from '@/state/index.ts';

/** Provider and signer instances */
let provider: ethers.providers.Web3Provider | null = null;
let signer: ethers.Signer | null = null;

/** Track if we've set up the subscription */
let subscriptionInitialized = false;

/**
 * Initialize AppKit subscriptions
 * Must be called once at app startup
 */
export function initWalletSubscriptions(): void {
  if (subscriptionInitialized) return;
  subscriptionInitialized = true;

  // Subscribe to account state changes
  appKit.subscribeAccount((accountState) => {
    const { address, isConnected } = accountState;
    const chainId = appKit.getChainId();

    if (isConnected && address) {
      // Check if on correct chain
      if (chainId !== CONFIG.chainId) {
        gameState.setWrongNetwork();
        return;
      }

      // Get the wallet provider from AppKit
      const walletProvider = appKit.getWalletProvider();
      if (walletProvider) {
        try {
          provider = new ethers.providers.Web3Provider(walletProvider as ethers.providers.ExternalProvider);
          signer = provider.getSigner();
          gameState.setConnected(address);
        } catch (error) {
          console.error('Failed to create provider:', error);
          gameState.setDisconnected();
        }
      }
    } else {
      // Disconnected
      provider = null;
      signer = null;
      gameState.setDisconnected();
    }
  });

  // Also subscribe to network changes
  appKit.subscribeNetwork((networkState) => {
    const { chainId } = networkState;
    const account = appKit.getAccount();

    if (account?.isConnected && chainId !== CONFIG.chainId) {
      gameState.setWrongNetwork();
    } else if (account?.isConnected && account.address && chainId === CONFIG.chainId) {
      // Reconnect with correct chain
      const walletProvider = appKit.getWalletProvider();
      if (walletProvider) {
        try {
          provider = new ethers.providers.Web3Provider(walletProvider as ethers.providers.ExternalProvider);
          signer = provider.getSigner();
          gameState.setConnected(account.address);
        } catch (error) {
          console.error('Failed to create provider on network change:', error);
        }
      }
    }
  });
}

/**
 * Get the current provider
 */
export function getProvider(): ethers.providers.Web3Provider | null {
  return provider;
}

/**
 * Get the current signer
 */
export function getSigner(): ethers.Signer | null {
  return signer;
}

/**
 * Open the wallet connection modal
 */
export async function openConnectModal(): Promise<void> {
  gameState.setConnecting();
  await appKit.open();
}

/**
 * Connect wallet (opens modal)
 * Kept for backwards compatibility - just opens the modal
 */
export async function connect(): Promise<boolean> {
  try {
    gameState.setConnecting();
    await appKit.open();
    // Connection state will be handled by subscription
    return true;
  } catch (error) {
    console.error('Connect error:', error);
    gameState.setDisconnected();
    return false;
  }
}

/**
 * Disconnect the wallet
 */
export async function disconnect(): Promise<void> {
  try {
    await appKit.disconnect();
  } catch {
    // Ignore disconnect errors
  }

  provider = null;
  signer = null;
  gameState.setDisconnected();
}

/**
 * Switch to the correct network
 */
export async function switchNetwork(): Promise<boolean> {
  try {
    const walletProvider = appKit.getWalletProvider() as ethers.providers.ExternalProvider;
    if (!walletProvider || !walletProvider.request) return false;

    await walletProvider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: getChainIdHex() }],
    });
    return true;
  } catch (error) {
    console.error('Failed to switch network:', error);
    return false;
  }
}

/**
 * Check if wallet is connected
 */
export function isConnected(): boolean {
  const account = appKit.getAccount();
  return account?.isConnected ?? false;
}

/**
 * Get connected address
 */
export function getAddress(): string | undefined {
  const account = appKit.getAccount();
  return account?.address;
}

/**
 * Check if MetaMask is available (kept for backwards compatibility)
 */
export function hasMetaMask(): boolean {
  return typeof (window as any).ethereum !== 'undefined';
}

// Legacy exports for backwards compatibility
export const connectWithMetaMask = connect;
export const connectWithWalletConnect = connect;
