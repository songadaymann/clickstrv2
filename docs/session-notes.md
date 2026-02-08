# Clickstr V2 Session Notes (Consolidated)

Last updated: 2026-02-08

This is a trimmed, V2-only summary of progress. V1 content intentionally omitted.

## Summary
- V2 architecture implemented: off-chain PoW validation with on-chain settlement.
- Turnstile enforced for human-only play.
- Incremental claims supported (server signs total clicks, contract pays delta).
- ClickRegistry and ClickstrTreasury introduced for permanent records and season autonomy.
- NFT tier bonus system ported to V2.

## Major Fixes and Changes
- **Flat per-epoch budget** — replaced the 2% decay emission model with `seasonPool / TOTAL_EPOCHS`. See "Flat Budget Change" section below.
- **Security audit of flat budget model** — found and fixed pool over-commitment and soft overflow safety cap bypass. See "Security Audit" section and `docs/security.md`.
- Added wallet-signed challenge before issuing claim signatures (prevents front-running and claim DoS).
- Epoch derivation fixed to be time-based and server-aligned (prevents stale epoch reverts).
- Difficulty tracking made season-aware with admin reset controls.
- ClickRegistry and Treasury authorization flows verified and used.
- NFT bonus burn ratio fix applied in `ClickstrGameV2.sol` (requires new season deploy to take effect).
- `syncAchievements` fixed to only award global 1/1 milestones to the actual triggering user.
- Frontend reward estimate fixed to read `EPOCH_DURATION` from contract (was hardcoded to 1M/day).

## Recent V2 Test Seasons
- Short-epoch test seasons were deployed to validate incremental claims, registry earnings tracking, and difficulty controls.
- Season 7 used the old NFT bonus burn logic; claims without NFT bonuses worked, bonus claims reverted.
- A new season deploy is required to activate the NFT bonus burn fix.

## Flat Budget Change (Feb 7, 2026)

**Problem:** The old model used `epochBudget = poolRemaining * 2%`, which meant:
- Budget decayed each epoch as the pool shrank
- Short seasons (3-7 days) barely distributed any tokens
- Hard to reason about "how much goes out per day"

**New model:** `epochBudget = seasonPool / TOTAL_EPOCHS` (flat, equal per epoch).

- 3-day game with 3M pool = exactly 1M per epoch
- 7-day game with 7M pool = exactly 1M per epoch
- Budget is the same every epoch regardless of what happened before

**How it interacts with difficulty:**
- Difficulty controls how fast users can mine valid nonces (mining speed)
- Few clickers -> difficulty drops -> each person mines faster -> more clicks -> claims more of the budget
- Many clickers -> difficulty rises -> each person mines slower -> clicks spread across more people
- The budget is always the same; difficulty just controls how it's divided

**What happens to unclaimed budget:**
- If fewer clicks than target happen, unclaimed portion is burned at epoch finalization
- This is the same as before — quiet epochs still burn tokens

**Contract changes:**
- Added `seasonPool` (public state var, set in `startGame()`)
- `_calculateReward()`: budget = `min(seasonPool / TOTAL_EPOCHS, poolRemaining / remainingEpochs)` (flat, capped by pool reality)
- `_finalizeEpochInternal()`: same capped budget for unused burn calc
- Soft overflow path now applies `poolRemaining / 10` safety cap
- Removed `DAILY_EMISSION_RATE` constant (no longer needed)
- Restored epoch duration guard to `1 hours`

**Frontend changes:**
- `fetchRewardParams()` reads `seasonPool()`, `poolRemaining()`, `TOTAL_EPOCHS()` from contract, computes `min(flat, fair)` budget
- Reward display uses `epochBudget / targetClicksPerEpoch / 2`
- V2 ABI updated with `seasonPool`, `poolRemaining`, `TOTAL_EPOCHS`, `EPOCH_DURATION`
- Removed bots from global stats panel (V2 is human-only)

**Requires new contract deploy to take effect.** Current running game still uses old logic.

## Open Items
- Deploy new contract with security fixes and test end-to-end.
- Test claims with NFT bonuses end-to-end.
- ~~Restore `_epochDuration >= 1 hours` guard before mainnet V2.~~ Done (Feb 8).
- Rotate the admin secret (was exposed in session context).
- Clean up any incorrect Redis achievements from the pre-fix `syncAchievements` behavior.

## Mint Panel & Collection Modal Fixes (Feb 8, 2026)

- **Mint rewards panel always visible** -- Panel now shows whenever wallet is connected, even with no achievements ("No achievements yet" placeholder). Previously it only appeared after the first unlock.
- **Collection modal overflow fixed** -- Added `overflow: hidden` + `text-overflow: ellipsis` to collection item names and `overflow-y: auto` to the modal content so "????" names and long content no longer escape their containers.
- **Mint buttons in collection grid** -- Unlocked-but-not-minted items now show the cursor preview, name, and a green MINT button (instead of the locked "?" placeholder). Clicking MINT opens the claim modal. New `.unlocked` state has a green dashed border to distinguish from minted and locked items.
- **Mobile mint access** -- Collection modal (accessible via hamburger menu) now contains the MINT buttons, so mobile users can mint without needing the side panel. Added responsive sizing for the buttons at 768px breakpoint.

## Frontend Security Hardening (Feb 8, 2026)

- **XSS fix** -- All user-supplied strings in leaderboard rendering now pass through `escapeHtml()` before HTML interpolation.
- **Console log cleanup** -- Removed logging of addresses, challenges, signatures, nonces, and full API responses across `main.ts`, `api.ts`, `mining.ts`, `ens.ts`, `persistence.ts`.
- **Multi-tab claim lock** -- Added `localStorage`-based lock with 2-min TTL to prevent duplicate claim transactions from multiple tabs.
- **Contract address validation** -- `claimV2Reward()` now checks the API-returned address against `CONFIG.contractAddress` before signing.
- **Challenge binding** -- Client verifies the wallet challenge contains the user's address before signing.
- **Division edge case** -- `fetchRewardParams()` clamps `remainingEpochs` to >= 1 to avoid zero-division after game end.

Full details in `docs/security.md`.

## Security Audit & Frontend Cleanup (Feb 8, 2026)

Audited the flat-budget contract change for security holes. Found and fixed two issues, confirmed two informational. Also updated the frontend global stats panel and reward estimation.

**Contract fixes (`ClickstrGameV2.sol`):**

1. **Pool over-commitment** -- Flat budget didn't account for NFT bonuses, winner bonuses, and finalizer rewards drawing from the same pool. Worst case ~155% of pool committed. Fixed by capping epoch budget: `min(seasonPool / TOTAL_EPOCHS, poolRemaining / remainingEpochs)`. Applied in both `_calculateReward()` and `_finalizeEpochInternal()`.

2. **Soft overflow safety cap bypass** -- When epoch budget was exhausted, the overflow path skipped the `poolRemaining / 10` per-claim cap. A large claim could request far more than intended. Fixed by adding the same cap to the overflow branch.

3. **Epoch duration guard restored** -- Changed `_epochDuration >= 2 minutes` back to `_epochDuration >= 1 hours` for mainnet safety. Removed the TODO comment.

**Frontend changes:**

4. **Reward estimate matches contract** -- `fetchRewardParams()` now reads `poolRemaining()` from the contract and computes `min(flatBudget, poolRemaining / remainingEpochs)`, matching the new contract logic. Added `poolRemaining()` to V2 ABI.

5. **Removed bots from global stats** -- V2 is human-only (Turnstile enforced), so the "bots" counter was removed from the HTML, JS, and imports. "Clicking Now" row now shows "players" instead of "humans / bots".

**API:** No changes needed. Server-side difficulty calculation (`targetClicks = 1M * epochDuration / 86400`) is independent of the budget model and already consistent.

**Full audit details:** See `docs/security.md`.

## Previous Round (Feb 7, 2026)
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
