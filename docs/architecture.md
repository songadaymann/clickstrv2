# Clickstr V2 Architecture

## Goals
1. Reduce gas costs by moving proof validation off-chain.
2. Keep a permanent on-chain record of all clicks.
3. Enforce human-only play via Turnstile and server attestation.
4. Make seasons independent with a permanent registry and treasury.

## Components
- Browser (clickstr.fun) mines proofs in a WebWorker and submits to the server.
- Server (mann.cool) validates Turnstile and PoW, tracks clicks in Redis, and signs attestations.
- ClickRegistry is the permanent on-chain record of clicks across all seasons.
- ClickstrTreasury holds all $CLICK and enforces the 50/50 distribution and burn.
- ClickstrGameV2 is deployed per season and handles epochs, rewards, and winner logic.
- ClickstrNFT (existing) uses ClickRegistry for eligibility checks.

## User Flow

### Clicking (off-chain)
1. User connects wallet and passes Turnstile.
2. WebWorker mines PoW nonces for each click.
3. Frontend POSTs nonces to `/api/clickstr-v2`.
4. Server validates Turnstile, verifies PoW, dedups nonces, and updates Redis.
5. Frontend displays updated stats and leaderboard data.

### Claiming (on-chain)
1. Frontend requests a claim signature from `/api/clickstr-v2`.
2. Server requires a wallet-signed challenge to bind the claim to the user.
3. Server returns an attestation signature with the total click count for the epoch.
4. Frontend calls `claimReward(epoch, clickCount, signature)` on ClickstrGameV2.
5. Contract verifies the signature, computes the delta vs prior claims, and records clicks.
6. ClickstrTreasury disburses the reward and burns the matching amount.

## Signature Format
The server signs a hash of:
- user address
- epoch
- clickCount (total for the epoch)
- season number
- game contract address
- chainId

## Key Mechanics
- 50/50 split on every distribution: half to user, half to burn address.
- Epochs with a winner bonus and finalizer reward.
- Incremental claims are allowed. The server signs totals, and the contract pays the delta.
- NFT tier bonuses apply on top of the user share and are capped to avoid draining the pool.

## NFT Bonus Levels

Holding achievement NFTs grants a bonus on top of the user's 50% share. Bonuses are additive and capped.

| Tier | Milestone | Clicks Required | Bonus |
|------|-----------|-----------------|-------|
| 4 | 1K Club | 1,000 | 2% |
| 6 | 10K Club | 10,000 | 3% |
| 8 | 50K Club | 50,000 | 5% |
| 9 | 100K Club | 100,000 | 7% |
| 11 | 500K Club | 500,000 | 10% |

Max possible bonus: 27% if all tiers are held.

## Contract Roles
- ClickRegistry is append-only. Only authorized game contracts can write.
- ClickstrTreasury is allowlisted once by TokenWorks and then authorizes seasons.
- ClickstrGameV2 is the per-season contract and the only on-chain entry point for rewards.
