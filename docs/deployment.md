# Clickstr V2 Deployment

## Prereqs
- Node.js 18+
- Hardhat
- RPC access for the target network
- $CLICK tokens available for treasury funding

## Roles and Keys
- Deployer key. Deploys contracts and owns registry and treasury.
- Attestation signer key. Hot key used by the server to sign claims.
- NFT signer key. Signs NFT claims if you deploy or use ClickstrNFTV2.

Keep the attestation signer separate from the deployer key.

## Environment Variables

### Local `.env` (clickstrv2 repo)
Copy your deployment env into the new repo so `hardhat` and scripts work locally:
`/Users/jonathanmann/SongADAO Dropbox/Jonathan Mann/projects/games/stupid-clicker/clickstrv2/.env`

### Contract Deployment (Hardhat)
```
CLICK_TOKEN_ADDRESS=0x...
ATTESTATION_SIGNER=0x...
NFT_SIGNER_ADDRESS=0x...
NFT_BASE_URI=ipfs://...
SEASON_NUMBER=2
SEASON_EPOCHS=3
SEASON_DURATION=86400
SEASON_POOL=3000000
TREASURY_INITIAL=3000000
SKIP_TREASURY=false
SKIP_REGISTRY=false
TREASURY_ADDRESS=0x...
REGISTRY_ADDRESS=0x...
SEED_S1_DATA=false
S1_USERS=0x...,0x...
S1_CLICKS=123,456
S1_EARNINGS=12.5,0.75
```

### New Season Deployment
```
REGISTRY_ADDRESS=0x...
TREASURY_ADDRESS=0x...
ATTESTATION_SIGNER=0x...
SEASON_NUMBER=3
SEASON_EPOCHS=3
SEASON_DURATION=86400
SEASON_POOL=3000000
NFT_CONTRACT_ADDRESS=0x...
FUND_TREASURY=false
CLICK_TOKEN_ADDRESS=0x...
```

### Server (mann.cool)
```
TURNSTILE_SECRET_KEY=...
TURNSTILE_IP_SALT=...
ATTESTATION_SIGNER_PRIVATE_KEY=0x...
NFT_SIGNER_PRIVATE_KEY=0x...
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
CLICKSTR_ADMIN_SECRET=...
CLICKSTR_GAME_V2_ADDRESS=0x...
CLICKSTR_REGISTRY_ADDRESS=0x...
NFT_CONTRACT_ADDRESS=0x...
CHAIN_ID=11155111
RPC_URL=https://...
POW_DIFFICULTY_TARGET=0x00ffffffff...
CLICKSTR_ELIGIBLE_ENABLED=false
```

### Frontend (clickstr.fun)
```
VITE_NETWORK=mainnet
VITE_ETH_MAINNET_RPC_URL=...
VITE_SEPOLIA_RPC_URL=...
VITE_WALLET_CONNECT_PROJECT_ID=...
```

Note: V2 mode is currently hard-coded to `CURRENT_NETWORK === 'sepolia'` in
`/Users/jonathanmann/SongADAO Dropbox/Jonathan Mann/projects/games/stupid-clicker/clickstrv2/src-ts/src/main.ts`.
If you deploy V2 on mainnet, update that logic or it will keep running the V1 flow.

## Deploy the V2 Infrastructure
This is a one-time deployment for registry and treasury plus the first season.

```
CLICK_TOKEN_ADDRESS=0x... ATTESTATION_SIGNER=0x... NFT_SIGNER_ADDRESS=0x... \
NFT_BASE_URI=ipfs://... SEASON_POOL=3000000 \
  npx hardhat run scripts/deploy-v2.js --network sepolia
```

What this does:
- Deploys ClickRegistry (unless SKIP_REGISTRY=true)
- Deploys ClickstrTreasury (unless SKIP_TREASURY=true)
- Funds the treasury
- Deploys ClickstrGameV2
- Authorizes the game in registry and treasury
- Optionally seeds Season 1 clicks and earnings (if `SEED_S1_DATA=true`)
- Deploys ClickstrNFTV2 and sets tier bonuses

Notes on seeding:
- `S1_EARNINGS` should be in whole tokens (decimals allowed) and is converted to wei internally.
- `S1_USERS`, `S1_CLICKS`, and `S1_EARNINGS` must be the same length and in the same order.

## Fresh Sepolia Deploy (Keep Treasury)
Use this when you want a clean slate on Sepolia but keep the existing treasury.

1. (Optional but recommended) Reset Redis data so no old achievements or clicks show up:
   - Call `/api/clickstr-admin-reset` with your admin secret (no address = reset all).
2. Make sure the existing treasury has enough tokens for the new season pool.

Example env for a short test season:
```
CLICK_TOKEN_ADDRESS=0x...           # MockClickToken on Sepolia
TREASURY_ADDRESS=0x...              # Existing ClickstrTreasury (keep this)
SKIP_TREASURY=true
SKIP_REGISTRY=false                # Deploy a brand-new registry
SEED_S1_DATA=false                  # Fresh start

ATTESTATION_SIGNER=0x...
NFT_SIGNER_ADDRESS=0x...
NFT_BASE_URI=ipfs://...

SEASON_NUMBER=1                     # New registry = new season numbering
SEASON_EPOCHS=6
SEASON_DURATION=600                 # 10 minutes (min is 2 minutes)
SEASON_POOL=10000                   # Small pool for testing
```

Run:
```
CLICK_TOKEN_ADDRESS=0x... TREASURY_ADDRESS=0x... SKIP_TREASURY=true \
ATTESTATION_SIGNER=0x... NFT_SIGNER_ADDRESS=0x... NFT_BASE_URI=ipfs://... \
SEASON_NUMBER=1 SEASON_EPOCHS=6 SEASON_DURATION=600 SEASON_POOL=10000 \
  npx hardhat run scripts/deploy-v2.js --network sepolia
```

Post-deploy (Sepolia):
- Update mann.cool env:
  - `CLICKSTR_GAME_V2_ADDRESS`
  - `CLICKSTR_REGISTRY_ADDRESS`
  - `NFT_CONTRACT_ADDRESS` (new NFT)
- Update frontend config (sepolia) with new game + NFT addresses.

## Deploy a New Season
For later seasons, use the season-only script.

```
REGISTRY_ADDRESS=0x... TREASURY_ADDRESS=0x... ATTESTATION_SIGNER=0x... \
SEASON_NUMBER=3 SEASON_POOL=5000000 \
  npx hardhat run scripts/deploy-v2-season.js --network sepolia
```

What this does:
- Deploys a new ClickstrGameV2
- Authorizes the game in registry and treasury
- Optionally sets the NFT bonus contract
- Starts the season

## Verify Contracts
Use Etherscan verification after deploy.

```
npx hardhat verify --network mainnet <REGISTRY_ADDRESS>

npx hardhat verify --network mainnet <TREASURY_ADDRESS> <CLICK_TOKEN_ADDRESS>

npx hardhat verify --network mainnet <GAME_ADDRESS> \
  <REGISTRY_ADDRESS> <TREASURY_ADDRESS> <SEASON_NUMBER> <SEASON_EPOCHS> \
  <SEASON_DURATION> <ATTESTATION_SIGNER>
```

## Turnstile Setup
- Site key and secret key must be from the same Cloudflare widget.
- Add clickstr.fun, www.clickstr.fun, and localhost to allowed domains.
- Store the secret key only on the server.
- Test keys only work when paired together.

## Post-Deploy Checklist
- Update frontend network config with new contract addresses.
- Update server config with the new game address and chain ID.
- Confirm Turnstile verification and claim signature issuance.
- Run a small live test before announcing a new season.

## Vercel Env Checklist

Update these after every deploy:

### mann.cool (API)
- `CLICKSTR_GAME_V2_ADDRESS`
- `CLICKSTR_REGISTRY_ADDRESS`
- `NFT_CONTRACT_ADDRESS`
- `ATTESTATION_SIGNER_PRIVATE_KEY`
- `NFT_SIGNER_PRIVATE_KEY`
- `CLICKSTR_ADMIN_SECRET` (needed for admin reset + difficulty actions)
- `CHAIN_ID`
- `RPC_URL`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `TURNSTILE_SECRET_KEY`
- `TURNSTILE_IP_SALT` (optional but recommended)
- `POW_DIFFICULTY_TARGET` (optional override)
- `CLICKSTR_ELIGIBLE_ENABLED` (only if you want to enable the legacy airdrop endpoint)

### clickstr.fun (frontend)
- `VITE_NETWORK`
- `VITE_ETH_MAINNET_RPC_URL`
- `VITE_SEPOLIA_RPC_URL`
- `VITE_WALLET_CONNECT_PROJECT_ID`

## NFT Bonus Levels

If you set up the bonus tiers in the game contract, these are the default levels:

| Tier | Milestone | Clicks Required | Bonus |
|------|-----------|-----------------|-------|
| 4 | 1K Club | 1,000 | 2% |
| 6 | 10K Club | 10,000 | 3% |
| 8 | 50K Club | 50,000 | 5% |
| 9 | 100K Club | 100,000 | 7% |
| 11 | 500K Club | 500,000 | 10% |

Max possible bonus: 27% if all tiers are held.
