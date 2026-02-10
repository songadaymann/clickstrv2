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

**WARNING**: V2 mode is currently hard-coded to `CURRENT_NETWORK === 'sepolia'`
in two files. Setting `VITE_NETWORK=mainnet` alone will NOT enable V2 on mainnet.
See the **Sepolia to Mainnet Migration** section below for the full checklist.

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

1. (Optional — **Sepolia/test only**) Reset Redis data so no old achievements or clicks show up:
   - **WARNING: This WIPES ALL player points, leaderboards, and milestones. Do NOT use on mainnet between seasons — players' accumulated clicks carry over.**
   - `POST /api/clickstr-admin-reset` with `{"secret":"<CLICKSTR_ADMIN_SECRET>"}` (no address = reset all).
   - The body key is `secret` (not `adminSecret`). The value must match the `CLICKSTR_ADMIN_SECRET` env var on the server.
   - To reset a single user, add `"address":"0x..."` to the body.
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

## Sepolia to Mainnet Migration

When moving V2 from Sepolia to Mainnet, every item below must be addressed.
Items marked **CRITICAL** will silently break V2 if missed.

### 1. Code changes (CRITICAL)

These are hard-coded checks that gate all V2 logic. If you only change the
env var to `mainnet`, the app will fall back to V1 contract calls and break.

| File | Line | Current | Change to |
|------|------|---------|-----------|
| `src-ts/src/main.ts` | 18 | `const IS_V2 = CURRENT_NETWORK === 'sepolia';` | `const IS_V2 = true;` (or a proper config flag) |
| `src-ts/src/services/contracts.ts` | 10 | `const IS_V2 = CURRENT_NETWORK === 'sepolia';` | `const IS_V2 = true;` (must match main.ts) |

A cleaner long-term fix: add a `VITE_V2_ENABLED=true` env var, or derive
IS_V2 from the contract ABI / season config instead of the network name.

### 2. API URL routing (CRITICAL)

`src-ts/src/config/network.ts` line 48-50 routes the API based on network:
```typescript
const apiUrl = networkId === 'sepolia'
  ? 'https://mann.cool/api/clickstr-v2'
  : 'https://mann.cool/api/clickstr';
```

On mainnet this sends all requests to the V1 API endpoint. Change to:
```typescript
const apiUrl = 'https://mann.cool/api/clickstr-v2';
```
Or use a `VITE_API_URL` env var.

### 3. Contract addresses

`src-ts/src/config/network.ts` lines 24-32 — the `mainnet` block currently
has V1 addresses. Replace with the new V2 deployment addresses:
```
contractAddress    -> new ClickstrGameV2 on mainnet
tokenAddress       -> $CLICK mainnet token (probably unchanged)
nftContractAddress -> new ClickstrNFTV2 on mainnet
```
Also add V2 registry and treasury addresses as comments (like the Sepolia
block does on lines 20-22).

### 4. Subgraph URL

`src-ts/src/config/network.ts` lines 58-60 — the mainnet subgraph URL
currently points to the V1 subgraph. Deploy a V2 subgraph on mainnet and
update the URL, or remove if V2 doesn't use a subgraph.

### 5. Games config

`src-ts/src/config/games.ts` — add a new entry for the mainnet V2 season
with `isActive: true` and the correct contract address and subgraph URL.
Set previous seasons to `isActive: false`.

### 6. Vercel env vars — clickstr.fun (frontend)

| Variable | Sepolia value | Mainnet value |
|----------|--------------|---------------|
| `VITE_NETWORK` | `sepolia` | `mainnet` |
| `VITE_ETH_MAINNET_RPC_URL` | (can be empty) | Alchemy/Infura mainnet URL |
| `VITE_SEPOLIA_RPC_URL` | Alchemy Sepolia URL | (can be empty) |
| `VITE_WALLET_CONNECT_PROJECT_ID` | same | same |

### 7. Vercel env vars — mann.cool (server)

| Variable | Sepolia value | Mainnet value |
|----------|--------------|---------------|
| `CHAIN_ID` | `11155111` | `1` |
| `RPC_URL` | Sepolia RPC | Mainnet RPC |
| `CLICKSTR_GAME_V2_ADDRESS` | Sepolia game address | New mainnet game address |
| `CLICKSTR_REGISTRY_ADDRESS` | Sepolia registry | New mainnet registry |
| `NFT_CONTRACT_ADDRESS` | Sepolia NFT | New mainnet NFT |
| `ATTESTATION_SIGNER_PRIVATE_KEY` | same or rotate | same or rotate |
| `NFT_SIGNER_PRIVATE_KEY` | same or rotate | same or rotate |

### 8. Hardhat deployment

Change `--network sepolia` to `--network mainnet` in all deploy commands:
```
npx hardhat run scripts/deploy-v2.js --network mainnet
npx hardhat run scripts/deploy-v2-season.js --network mainnet
```

Ensure `.env` has `MAINNET_PRIVATE_KEY` and `ETH_MAINNET_RPC_URL` set.

### 9. AppKit wallet config

`src-ts/src/config/appkit.ts` lines 12-13 — auto-selects based on
`CURRENT_NETWORK`. No change needed; setting `VITE_NETWORK=mainnet` is
enough for this file.

### 10. Turnstile

The Cloudflare Turnstile site key is currently shared between Sepolia and
mainnet (`network.ts` lines 19, 31). No change needed unless you want
separate widgets per environment.

### Migration order

1. Deploy contracts on mainnet (`--network mainnet`)
2. Verify contracts on Etherscan
3. Update code (steps 1-5 above) and push
4. Update Vercel env vars for mann.cool (step 7)
5. Update Vercel env vars for clickstr.fun (step 6)
6. Redeploy both Vercel projects
7. Test: connect wallet, click, submit, claim, mint NFT
8. Monitor logs for any V1 fallback behavior
