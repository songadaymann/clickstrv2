# Clickstr V2 Base Migration

Last updated: 2026-02-13 (late)

## Goal

Move Clickstr V2 operations from Ethereum mainnet to Base while preserving:
- token balances (via airdrop),
- NFT ownership/claim history (via migration mint),
- registry click + earnings history (via seeding import).

## Contracts and Keys

### Base addresses (deployed)
- Base $CLICKSTR token: `0x43f8e5502c57e64659cee77a97aa23adae605b89`
- Base ClickRegistry: `0xf724ede44Bbb2Ccf46cec530c21B14885D441e02`
- Base ClickstrTreasury: `0xBBf23Ef49F9e6B74596C931E7A579d99ba401586`
- Base ClickstrNFTV2: `0x37c4C8817a6F87e6a0984b5e8fd73c9F07f8f849`

### Keys that must hold Base ETH
- Main deployer / infra owner (`MAINNET_PRIVATE_KEY`): `0x73468BD5fDD81b6e0c583bB5bb38534684c8DFe0`
  - Deploys and owns Base registry + treasury
  - Sends Base token airdrop
  - Runs registry import txs
- NFT deployer / NFT owner (`NFT_DEPLOYER_KEY`): `0xf55E4fac663ad8db80284620F97D95391ab002EF`
  - Deployed and owns Base NFT contract
  - Runs NFT claimer migration txs and closes migration mode

Notes:
- Attestation signer stays unchanged and does not need Base ETH for signing-only flow.
- Registry and NFT have different owners, so import execution is two-pass (registry pass + NFT pass).

## Completed This Round

### 1) Migration-safe contract updates
- `contracts/ClickRegistry.sol`
  - Added chunked import support:
    - `seedHistoricalClicksBatch(...)`
    - `seedHistoricalEarningsBatch(...)`
    - `finalizeHistoricalSeeding(season)`
  - Added lock state to prevent accidental reseeding after finalization:
    - `historicalBatchSeeding`
    - `historicalSeedingFinalized`
- `contracts/ClickstrNFTV2.sol`
  - Added migration mode:
    - `migrationOpen` (starts `true`)
    - `migrateClaims(users, tiers)` for owner-imported claim minting
    - `finalizeMigration()` to permanently close import mode
  - Blocked normal `claim`/`claimBatch` while migration is open.
  - Added global milestone conflict guard during imports.

### 2) Base deploy + verify
- Deployed registry + treasury on Base:
  - Script: `scripts/deploy-base-registry-treasury.js`
  - Record: `base/deployment-v2-base-registry-treasury.json`
- Deployed NFT on Base:
  - Script: `scripts/deploy-base-nft.js`
  - Record: `base/deployment-v2-base-nft.json`
- All three contracts verified on BaseScan.

### 3) Token airdrop completed
- Script: `scripts/airdrop-base-token.js` (`npm run airdrop:base`)
- Input prepared from holder CSV with protocol contracts excluded.
- Final run:
  - Recipients: `144`
  - Sent: `3,880,214,217.3889367 $CLICKSTR`
  - Sender: `0x73468BD5fDD81b6e0c583bB5bb38534684c8DFe0`
  - Ending balance: `419,785,782.6110633 $CLICKSTR`
  - Log: `cache/base-airdrop-log-2026-02-13T19-53-11-706Z.jsonl`

### 4) Mainnet snapshot + registry import completed
- Snapshot created:
  - File: `cache/base-migration-snapshot.json`
  - Snapshot block: `24450255`
  - Last mainnet click/earning event: block `24449757`
- Registry import completed on Base for seasons 2 and 3:
  - `seedHistoricalClicksBatch` s2: `0x5495562c793e18770a181ec44677f43ca38fcad533bded563d0de4c3bc402c15`
  - `seedHistoricalEarningsBatch` s2: `0xdf5e29d9ebb7fdb2b979f49fe3bc17ec5409ec304d4260ad461c82437154027d`
  - `finalizeHistoricalSeeding` s2: `0x98c4438abd75abbe532a92192d661be74739d9782e7cc8d6b0a42b503f88a4a9`
  - `seedHistoricalClicksBatch` s3: `0x563330b9dd032cdd99aaab7d78fbd06076da8e3dfd86eb7f8209bde3578c9d6b`
  - `seedHistoricalEarningsBatch` s3: `0x4e05224396f29fe2c1dd0200234f92e6b6825426ccd70fd55c43a62949aef2e2`
  - `finalizeHistoricalSeeding` s3: `0xfa043dfc7216a858f6988de873a416db6c5a1f1ee308180d966a4eff86238026`

### 5) NFT migration import + close completed
- NFT claimer migration imported in 5 batches:
  - `0xdfe5bae5087de66901cd9d8605ad99260268d7380cfea3d6e8b6453200314453`
  - `0xdff6ba756797c79c131417f511236433bfdc531a5b2305a483afa7efc1a49b30`
  - `0x19294e7d0dfab40acdcc148e49342ccc09909bc9a4885c06a2079fd20e13f39b`
  - `0x5bb3e4048f522a042cea291335e99fb4917f3d74ab5556fd5daa8391f65087e5`
  - `0x13be3920d5688339ecfd0d40f256f948d36bd1f72528978238e9ab0350621913`
- Migration mode finalized:
  - `finalizeMigration`: `0xec44fe79f8867c881d2b2cd920c4d87a6394e89bf41b84f1d5ff93f543fa4d23`
- Validation result:
  - `cache/base-post-import-validation.json`
  - Snapshot/global totals match on-chain
  - NFT claim pairs migrated: `699/699`

### 6) Base NFT metadata URI fixed
- Updated Base NFT `baseURI` to include `/clickstr-metadata/`
  - tx: `0xfdc4d33c4fcb7303a23e4f80234c60f4517ea96684ea905530b109fc786952e8`
- Metadata now resolves (example `uri(202)`).

## Remaining Work (Execution Order)

### 1) Snapshot source mainnet state (after game end)
Status: completed.

Use:
- `scripts/snapshot-mainnet-migration.js` (`npm run snapshot:migration`)

Inputs:
- source RPC (Ethereum mainnet),
- source registry address,
- source NFT address,
- snapshot block.

Output:
- JSON snapshot with:
  - per-season click/earnings import buckets,
  - global totals,
  - NFT claimer+tier pairs.

Example:
```bash
SOURCE_RPC_URL=$ETH_MAINNET_RPC_URL \
SOURCE_REGISTRY_ADDRESS=0xDA47fbc8DcBeef8069859416e0fdC2Ac62bDd576 \
SOURCE_NFT_ADDRESS=0x43693922EE81D4930fDFCB03DEEA6d75e41c05b0 \
SNAPSHOT_BLOCK=<MAINNET_BLOCK_AFTER_GAME_END> \
OUT_FILE=cache/base-migration-snapshot.json \
npm run snapshot:migration
```

### 2) Import registry history into Base registry (main deployer key)
Status: completed (seasons 2 and 3).

Use:
- `scripts/import-base-migration.js` (`npm run import:migration:base`)

Pass A (registry only):
- `TARGET_PRIVATE_KEY=MAINNET_PRIVATE_KEY`
- `SKIP_NFT=true`
- run dry-run first, then live.

Dry run:
```bash
SNAPSHOT_FILE=cache/base-migration-snapshot.json \
TARGET_RPC_URL=$BASE_MAINNET_RPC_URL \
TARGET_PRIVATE_KEY=$MAINNET_PRIVATE_KEY \
TARGET_REGISTRY_ADDRESS=0xf724ede44Bbb2Ccf46cec530c21B14885D441e02 \
TARGET_NFT_ADDRESS=0x37c4C8817a6F87e6a0984b5e8fd73c9F07f8f849 \
SKIP_NFT=true \
DRY_RUN=true \
npm run import:migration:base
```

Live:
```bash
SNAPSHOT_FILE=cache/base-migration-snapshot.json \
TARGET_RPC_URL=$BASE_MAINNET_RPC_URL \
TARGET_PRIVATE_KEY=$MAINNET_PRIVATE_KEY \
TARGET_REGISTRY_ADDRESS=0xf724ede44Bbb2Ccf46cec530c21B14885D441e02 \
TARGET_NFT_ADDRESS=0x37c4C8817a6F87e6a0984b5e8fd73c9F07f8f849 \
SKIP_NFT=true \
DRY_RUN=false \
npm run import:migration:base
```

### 3) Import NFT claimers into Base NFT (NFT owner key)
Status: completed and migration window closed.

Pass B (NFT only):
- `TARGET_PRIVATE_KEY=NFT_DEPLOYER_KEY`
- `SKIP_REGISTRY=true`
- run dry-run first, then live.
- set `FINALIZE_NFT_MIGRATION=true` only after validation.

Dry run:
```bash
SNAPSHOT_FILE=cache/base-migration-snapshot.json \
TARGET_RPC_URL=$BASE_MAINNET_RPC_URL \
TARGET_PRIVATE_KEY=$NFT_DEPLOYER_KEY \
TARGET_REGISTRY_ADDRESS=0xf724ede44Bbb2Ccf46cec530c21B14885D441e02 \
TARGET_NFT_ADDRESS=0x37c4C8817a6F87e6a0984b5e8fd73c9F07f8f849 \
SKIP_REGISTRY=true \
FINALIZE_NFT_MIGRATION=false \
DRY_RUN=true \
npm run import:migration:base
```

Live (import only):
```bash
SNAPSHOT_FILE=cache/base-migration-snapshot.json \
TARGET_RPC_URL=$BASE_MAINNET_RPC_URL \
TARGET_PRIVATE_KEY=$NFT_DEPLOYER_KEY \
TARGET_REGISTRY_ADDRESS=0xf724ede44Bbb2Ccf46cec530c21B14885D441e02 \
TARGET_NFT_ADDRESS=0x37c4C8817a6F87e6a0984b5e8fd73c9F07f8f849 \
SKIP_REGISTRY=true \
FINALIZE_NFT_MIGRATION=false \
DRY_RUN=false \
npm run import:migration:base
```

Live (close migration window after validation):
```bash
SNAPSHOT_FILE=cache/base-migration-snapshot.json \
TARGET_RPC_URL=$BASE_MAINNET_RPC_URL \
TARGET_PRIVATE_KEY=$NFT_DEPLOYER_KEY \
TARGET_REGISTRY_ADDRESS=0xf724ede44Bbb2Ccf46cec530c21B14885D441e02 \
TARGET_NFT_ADDRESS=0x37c4C8817a6F87e6a0984b5e8fd73c9F07f8f849 \
SKIP_REGISTRY=true \
FINALIZE_NFT_MIGRATION=true \
DRY_RUN=false \
npm run import:migration:base
```

### 4) Post-import validation
Status: completed.

- Compare snapshot global totals vs Base registry:
  - `globalTotalClicks`
  - `globalTotalEarned`
- Spot-check multiple user addresses for:
  - `totalClicks`
  - `totalEarned`
  - per-season values
- Spot-check migrated NFT tiers, especially global tiers (200-499).

### 5) Frontend + server network cutover to Base
Status: in progress.

- Replace chain and contract references from Ethereum mainnet to Base where applicable.
- Update Vercel env vars on both projects:
  - frontend (clickstrv2)
  - server (`mann-dot-cool`)
- Ensure API + client both point at the Base game/registry/NFT addresses and Base RPC.
- Completed:
  - frontend network config now supports `VITE_NETWORK=base` and Base chain `8453`
  - server API chain selector now supports Base (`CHAIN_ID=8453`)
  - Vercel env vars updated for both projects (dev/preview/prod) to Base RPC + Base registry/NFT
  - game env vars now set to Base Season 4 game:
    - `CLICKSTR_GAME_V2_ADDRESS=0x64AB5E65B752B881d384f9b4611DD06D01609094`
    - `VITE_CLICKSTR_GAME_V2_ADDRESS=0x64AB5E65B752B881d384f9b4611DD06D01609094`
- Remaining:
  - deploy/redeploy frontend and API with updated envs (if not already deployed from latest state).

### 6) Deploy first Base season game and launch
Status: completed.

- Base Season 4 game deployed and started:
  - Game: `0x64AB5E65B752B881d384f9b4611DD06D01609094`
  - Config: `6` epochs x `4h` (`24h`), pool `100000000` CLICK
  - Start: `2026-02-13T22:23:57Z`
  - End: `2026-02-14T22:23:57Z`
- Deployment record:
  - `base/deployment-v2-base-season4.json`
- Ready script:
  - `npm run deploy:base:season:24h`
  - Defaults:
    - season pool: `100000000` CLICK
    - season length: `24h` (`SEASON_EPOCHS=6`, `SEASON_DURATION=14400`)
    - season number: auto (`registry.totalSeasons() + 1`) unless `SEASON_NUMBER` provided
  - Optional overrides:
    - `START_GAME=false` (deploy + authorize but do not start)
    - `FUND_TREASURY=true` (auto-fund shortfall from deployer token balance)
    - `SEASON_NUMBER`, `SEASON_EPOCHS`, `SEASON_DURATION`, `SEASON_POOL`

## Useful Files
- `base/deployment-v2-base-registry-treasury.json`
- `base/deployment-v2-base-nft.json`
- `scripts/snapshot-mainnet-migration.js`
- `scripts/import-base-migration.js`
- `scripts/airdrop-base-token.js`
