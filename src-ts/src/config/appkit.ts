/**
 * Reown AppKit configuration for wallet connections
 */

import { createAppKit } from '@reown/appkit';
import { Ethers5Adapter } from '@reown/appkit-adapter-ethers5';
import { sepolia, mainnet } from '@reown/appkit/networks';
import type { AppKitNetwork } from '@reown/appkit/networks';
import { CONFIG, CURRENT_NETWORK } from './network.ts';

// Select network based on current config
const networks: [AppKitNetwork, ...AppKitNetwork[]] =
  CURRENT_NETWORK === 'mainnet' ? [mainnet, sepolia] : [sepolia, mainnet];

// Metadata for the wallet modal
const metadata = {
  name: 'Clickstr',
  description: 'Proof-of-work clicker game on Ethereum',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://clickstr.fun',
  icons: ['/favicon.png'],
};

// Featured wallet IDs (from WalletConnect Explorer)
const FEATURED_WALLETS = [
  'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
  '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369', // Rainbow
  '7674bb4e353bf52886768a3ddc2a4562ce2f4191c80831291218ebd90f5f5e26', // Rabby
  'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa', // Coinbase
];

// Create the AppKit instance
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const appKit = createAppKit({
  adapters: [new Ethers5Adapter()] as any,
  networks,
  metadata,
  projectId: CONFIG.walletConnectProjectId,
  featuredWalletIds: FEATURED_WALLETS,
  features: {
    analytics: false,
    email: false,
    socials: false,
  },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#00ffff',
    '--w3m-color-mix': '#0a0a1a',
    '--w3m-color-mix-strength': 40,
    '--w3m-border-radius-master': '2px',
    '--w3m-font-family': '"Press Start 2P", monospace',
  },
});

// Re-export for convenience
export { appKit as modal };
