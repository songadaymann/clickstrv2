# Clickstr V2 Session Notes (Consolidated)

Last updated: 2026-02-07

This is a trimmed, V2-only summary of progress. V1 content intentionally omitted.

## Summary
- V2 architecture implemented: off-chain PoW validation with on-chain settlement.
- Turnstile enforced for human-only play.
- Incremental claims supported (server signs total clicks, contract pays delta).
- ClickRegistry and ClickstrTreasury introduced for permanent records and season autonomy.
- NFT tier bonus system ported to V2.

## Major Fixes and Changes
- Added wallet-signed challenge before issuing claim signatures (prevents front-running and claim DoS).
- Epoch derivation fixed to be time-based and server-aligned (prevents stale epoch reverts).
- Difficulty tracking made season-aware with admin reset controls.
- ClickRegistry and Treasury authorization flows verified and used.
- NFT bonus burn ratio fix applied in `ClickstrGameV2.sol` (requires new season deploy to take effect).
- `syncAchievements` fixed to only award global 1/1 milestones to the actual triggering user.

## Recent V2 Test Seasons
- Short-epoch test seasons were deployed to validate incremental claims, registry earnings tracking, and difficulty controls.
- Season 7 used the old NFT bonus burn logic; claims without NFT bonuses worked, bonus claims reverted.
- A new season deploy is required to activate the NFT bonus burn fix.

## Open Items
- Deploy Season 8 with the NFT bonus burn ratio fix.
- Test claims with NFT bonuses end-to-end.
- Restore `_epochDuration >= 1 hours` guard before mainnet V2.
- Rotate the admin secret (was exposed in session context).
- Clean up any incorrect Redis achievements from the pre-fix `syncAchievements` behavior.
- After Vercel deploy, run V2 admin reset-all to zero global/epoch totals.

## Current Round (Feb 7, 2026)
- Added V2 admin reset-all path to wipe V2 + shared Redis keys (global clicks, epoch totals, leaderboards, milestones).
- Hardened admin actions in `clickstr-v2` to allow reset without an address.
- Clickstr API changes pushed to `mann-dot-cool` for V2 testing.
- Global admin reset executed via `/api/clickstr-admin-reset` — 17 Redis keys wiped.
- Fresh Sepolia deploy completed (see below).
- Frontend config updated with new contract addresses.
- Pending: update mann.cool Vercel env vars with new contract addresses, then redeploy.

## Fresh Sepolia Deploy - 24h Game (Feb 7, 2026 - evening)

Deployed a clean V2 stack on Sepolia while keeping the existing treasury.
Redis global + individual counts reset via admin API (3 keys deleted). Difficulty reset to default.

**Parameters:**
- Season: 1
- Epochs: 6
- Epoch duration: 14,400 seconds (4 hours)
- Pool: 1,000,000 CLICK
- Fresh registry + NFT, existing treasury

**Contracts:**
- ClickRegistry: `0xEfd58d7aA328561606451c69D86202330a9E8d4D`
- ClickstrGameV2: `0x3Ad5468Dd1eDBe7da14F993b4ab1d9Fe331873f1`
- ClickstrNFTV2: `0x43D37A412A9Bca7274242F26cccfa8d4B0025213`
- ClickstrTreasury (existing): `0x82378b6C7247b02f4b985Aca079a0A85E0D2cbAe`
- MockClickToken: `0x120E2fCf5b26FC49Fe3d1E7c851346c898619C28`

**Game window:**
- Start: 2026-02-07T12:07:24.000Z
- End: 2026-02-08T12:07:24.000Z

**Vercel env vars to update (mann.cool):**
- `CLICKSTR_GAME_V2_ADDRESS=0x3Ad5468Dd1eDBe7da14F993b4ab1d9Fe331873f1`
- `CLICKSTR_REGISTRY_ADDRESS=0xEfd58d7aA328561606451c69D86202330a9E8d4D`
- `NFT_CONTRACT_ADDRESS=0x43D37A412A9Bca7274242F26cccfa8d4B0025213`

## Previous Sepolia Deploy - 1h test (Feb 7, 2026 - morning, expired)

**Contracts (superseded):**
- ClickRegistry: `0xE6f58df1f1BB081527FF0f2F3709d107453cf80c`
- ClickstrGameV2: `0x00b52736Fa203D3588488e712C1fDEC09Ac51F5C`
- ClickstrNFTV2: `0x7398752533c146BEcb66A49A170844F430Bf3511`

**Game window (expired):**
- Start: 2026-02-07T11:04:12.000Z
- End: 2026-02-07T12:04:12.000Z

## Previous Sepolia Deploy (Feb 6, 2026)

**Contracts (superseded):**
- ClickRegistry: `0x714b1CceBae8bD92a5C62cde310139b87e468d66`
- ClickstrGameV2: `0x9dECc3bEE4AD20f5fB7CeB279cDF3258ecBBbe80`
- ClickstrNFTV2: `0x444d348Ec176d0a18765Fe4867A234F2AE8FdD4F`

**Game window (expired):**
- Start: 2026-02-06T21:45:12.000Z
- End: 2026-02-06T22:45:12.000Z
