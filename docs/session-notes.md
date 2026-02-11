# Clickstr V2 Session Notes (Consolidated)

Last updated: 2026-02-11

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

## Mobile Fixes, Epoch Countdown, Between-Games Flow & Mainnet Prep (Feb 9, 2026)

**Safari mining fix:**
Blob workers can't use `importScripts()` in Safari (opaque origin blocks cross-origin fetches). Added `preloadSha3()` which fetches the sha3 library in the main thread at startup and inlines it into the worker blob. Falls back to `importScripts` on Chrome/Firefox if preload hasn't completed. Clicks now work in Safari.

**Mobile wallet connection:**
MetaMask deep-linking from regular mobile browsers (Safari/Chrome) wasn't working because `clickstr.fun` wasn't added to the Reown Cloud project's allowed domains. Fixed in the dashboard (not a code change).

**Epoch countdown timer:**
Added a live countdown to the global stats panel showing time remaining in the current epoch. Rearranged the panel layout: epoch countdown + clicking now on the second row, pool moved to the third row. Countdown ticks every second, computed from `gameStartTime + currentEpoch * epochDuration`. Added `gameStartTime`/`gameEndTime` to `GameState`.

**Between-games click flow (V2):**
The V2 claim button was always running the full 3-step flow (submit to server, get attestation signature, call contract). Between games steps 2-3 would fail since there's no active game contract. Fixed `handleV2Claim()` to detect `!isGameActive` after the server submit succeeds and return early — clicks are recorded, milestones/NFTs still trigger, but no on-chain token claim is attempted. Button label switches from "Claim" to "Submit" when game is inactive.

**Mainnet migration checklist:**
Added a comprehensive "Sepolia to Mainnet Migration" section to `docs/deployment.md` covering all 10 areas that need updating: the hard-coded `IS_V2` checks, API URL routing, contract addresses, subgraph URLs, games config, Vercel env vars (frontend + server), Hardhat flags, AppKit config, and Turnstile.

## Between-Games Click Fix, Finalize Epochs UI & Modal Polish (Feb 9, 2026)

**Between-games clicks were failing ("No valid nonces")** — two bugs found and fixed:

1. **Server `gameEnded` not derived from time** — The on-chain `gameEnded` flag only flips when someone calls `endGame()` after the 72h grace period. Between the last epoch ending and that call, the server's `getGameState()` returned `gameEnded: false`, so it thought the game was still active. It validated nonces against epoch 6 and adjusted difficulty, while the frontend correctly mined with epoch 0 and `MAX_DIFFICULTY_TARGET`. Fixed by computing `effectiveGameEnded` from `gameStartTime + totalEpochs * epochDuration` in `getGameState()`. Deployed to `mann.cool`.

2. **Frontend `MAX_DIFFICULTY_TARGET` mismatch** — The frontend used `2^255 - 1` (~50% hash pass rate) while the server used `(2^256 - 1) / 1000` (~0.1% pass rate). Even with matching epochs, most frontend-mined nonces would fail server verification. Fixed in `mining.ts` to use the same `MAX_UINT256 / 1000n` formula. Only affects between-games mining (active games use server-synced difficulty).

**Finalize Epochs UI:**
The contract's `finalizeEpoch()` must be called for each elapsed epoch to settle on-chain accounting (winner bonus, unclaimed burns, finalizer reward). Previously there was no UI for this. Added:
- `finalizeEpoch` and `epochFinalized` to the V2 contract ABI (`contracts.ts`)
- `finalizeElapsedEpochs()` and `getUnfinalizedEpochCount()` service functions (`contracts.ts`)
- A gold "Finalize Epochs (N)" banner in the game status panel that appears when unfinalized epochs exist. Clicking it calls `finalizeEpoch()` for each one sequentially. Caller earns a 0.1% finalizer reward.

**NFT claim modal polish:**
- Background changed from near-black overlay (`rgba(0,0,0,0.95)`) to semi-transparent (`rgba(0,0,0,0.4)`) so the game stays visible.
- Added an X close button in the top-right corner.

## Leaderboard Redesign & Mint Modal Fix (Feb 9, 2026)

Removed the bot-vs-human leaderboard concept (V2 is human-only). Replaced the two-tab "Humans / On-Chain" toggle with three tabs: **Epoch**, **Clicks** (all-time), and **Earned** (all-time tokens).

**Server (`mann-dot-cool/api/clickstr-v2.js`):**
- Added two new Redis sorted sets: `clickstr:v2:leaderboard:alltime` and `clickstr:v2:leaderboard:earned`.
- Leaderboard endpoint accepts `?type=epoch|alltime|earned` query param.
- Click handler writes to alltime sorted set on every click submission.
- User stats handler lazily populates both alltime and earned sorted sets from Redis totals and on-chain registry data (fire-and-forget).
- Admin reset and per-user reset clean up the new keys.
- Note: Wallets that clicked before this change won't appear on alltime/earned until they reconnect (triggers the lazy backfill via stats fetch).

**Frontend (`clickstrv2`):**
- HTML: 3 toggle buttons (Epoch / Clicks / Earned).
- `fetchV2Leaderboard()` accepts a `type` param, passes it to the API.
- `MergedLeaderboardEntry` gained `totalEarned?: string` field.
- Earned tab displays token amounts (wei-to-token conversion via `formatWeiAsTokens()`) in gold color.
- Rankings modal ("See All Rankings") updated with matching 3-tab layout for V2.
- Removed all bot indicators (🤖) from leaderboard rendering.

**Mint modal z-index fix:**
- Added `--z-modal-top: 50001` CSS variable.
- `#claim-modal` now uses the higher z-index so the individual NFT mint modal renders above the collection modal on mobile.

## Mainnet Launch — Season 2 Soft Launch (Feb 10, 2026)

Migrated the entire stack from Sepolia to Ethereum mainnet for a 1-day soft launch beta.

**Infrastructure deployment (permanent contracts):**
Deployed Treasury, Registry, and NFT contracts to mainnet using a new infra-only deploy script (`scripts/deploy-v2-infra.js`). These are permanent — only game contracts change per season.

- ClickRegistry: `0xDA47fbc8DcBeef8069859416e0fdC2Ac62bDd576`
- ClickstrTreasury: `0x25e34963231de4451846cBb1A4ACEfa56c81f4e4`
- ClickstrNFTV2: `0x43693922EE81D4930fDFCB03DEEA6d75e41c05b0`
- All verified on Etherscan. Deployment record saved to `mainnet/deployment-v2-infra.json`.

**TokenWorks allowlisting:**
Treasury was allowlisted by Adam (TokenWorks whitelist manager) so it can transfer $CLICK tokens. Treasury is the only contract that calls `safeTransfer`, so this is a one-time operation — no further allowlisting needed for future seasons.

**Treasury funding:** 1,000,000 CLICK tokens transferred to the Treasury.

**Sepolia-to-mainnet migration (systematic, following `docs/deployment.md` checklist):**
- `main.ts`: `IS_V2 = true` (was `CURRENT_NETWORK === 'sepolia'`)
- `contracts.ts`: `IS_V2 = true` (same)
- `network.ts`: API URL unconditionally set to `/api/clickstr-v2`; mainnet contract addresses updated
- `games.ts`: Season 1 set to `isActive: false`; Season 2 added with `isActive: true`
- Vercel env vars updated on both `mann.cool` (server) and `clickstr.fun` (frontend)
- AppKit and Turnstile: no code changes needed (already support mainnet)

**Game Season 2 deployment:**
Deployed `ClickstrGameV2` on mainnet via Hardhat console (worked around ethers.js BAD_DATA bug with Node.js v23.11.0 by polling for tx receipts instead of using `waitForDeployment()`).

- ClickstrGameV2 (Season 2): `0xACBA29C4a55D69c4631CAf68376AEe78f7A59f6F`
- Parameters: 6 epochs × 4 hours = 24 hours, 1M CLICK pool
- Authorized in registry and treasury
- NFT contract set, tier bonuses configured (2%, 3%, 5%, 7%, 10%)
- Game started on-chain
- Verified on Etherscan

**Build fix:** Removed unused `CURRENT_NETWORK` imports from `main.ts` and `contracts.ts` that caused TypeScript `noUnusedLocals` errors after the IS_V2 change.

**Full mainnet readiness audit:** Verified all files (network.ts, games.ts, main.ts, contracts.ts, index.html) have correct mainnet addresses and no Sepolia references remain in active code paths.

**Redis admin reset:** Wiped 50 Redis keys (all V2 leaderboards, difficulty, epoch data) for clean mainnet start.

**Click-to-copy leaderboard feature:**
Added click-to-copy address functionality to both the sidebar leaderboard (`.leaderboard-name`) and the full rankings modal (`.rankings-name`). Clicking a player name copies their full address to clipboard with a toast notification. Added `cursor: pointer` and hover glow styles. Also applied missing `escapeHtml()` to rankings modal entries (XSS fix).

## Season 3 Launch & Bug Fixes (Feb 10, 2026)

**Season 3 deployment (3 days, 3M CLICK):**
- ClickstrGameV2 Season 3: `0xf6055889a000dfe93ce3795ebc99d2f44b2282f1`
- 3 epochs x 24h = 3 days, 3M CLICK pool, reuses existing mainnet infra
- Deploy script crashed mid-way due to ethers.js/Node v23 BAD_DATA bug (same as Season 2). Contract deployed successfully but setup steps didn't run. Wrote `scripts/finish-season3-setup.js` to complete authorization, NFT bonuses, and game start.
- Verified on Etherscan (auto-verified from matching bytecode).

**NFT base URI fix:**
- NFT metadata was returning 404 — baseURI was `ipfs://QmP7.../` but files are at `ipfs://QmP7.../clickstr-metadata/`.
- Called `setBaseURI` on mainnet NFT contract to add the missing path segment. One transaction, done.

**Mint modal race condition fix:**
- NFT mint modal was popping up mid-claim (after server submit but before on-chain tx), stealing focus from wallet prompts and causing claims to fail repeatedly.
- Fix: added `deferMintModal` flag. During the claim flow, achievement toasts still show immediately but the mint modal is queued and only displayed after the full claim flow (wallet signature + on-chain tx) completes. All exit paths (success, failure, early return) call `processDeferredMintModals()`.

**Admin reset safety warnings:**
- Added prominent warnings around all Redis admin reset references (deploy script output, deployment docs, SKILL.md) to prevent accidental point wipes between seasons.

**Removed bot section from help modal:**
- V2 is human-only; removed the "Scripts Welcome" section that linked to the now-irrelevant bot.html page.

**External bot analysis:**
- Community member published `clickstr-bot` on GitHub — offline PoW miner + localStorage injection.
- Bot can inflate leaderboard (clicks accepted by server via real browser Turnstile) and was able to claim tokens on-chain.
- Attack vector: pass Turnstile once in real browser, then mine nonces offline and POST directly to API from same IP. Session is keyed by address + IP, not browser, so any process on the same machine can submit.

## Bot Flagging, Rate Limiting & Hardening (Feb 10, 2026)

**Server (`mann-dot-cool/api/clickstr-v2.js`):**
- Added `FLAGGED_BOT_ADDRESSES` set with 5 known bot addresses. `isFlaggedBot()` helper.
- All POST actions (clicks, claims, heartbeats) return 403 for flagged addresses.
- Leaderboard endpoint filters bots from epoch/alltime/earned tabs; new `type=bots` shows only flagged addresses.
- Bot data backfilled into alltime sorted set on bots tab request (reads `V2_TOTAL_CLICKS_KEY` per bot address).
- Per-address rate limiting: 300 valid nonces per 60s sliding window (Redis counter with TTL). Configurable via `RATE_LIMIT_MAX_NONCES` env var. Partial batches accepted near limit; 429 when exhausted.
- Removed `CLICKS_BEFORE_VERIFICATION` (500-click Turnstile re-verification cap) — caused UX friction for real players, ineffective against bots that pass Turnstile via real browser. Session expiry (1h) and IP binding remain.

**Frontend (`clickstrv2`):**
- Added 4th "Bots" toggle button to leaderboard panel.
- `V2LeaderboardType` extended with `'bots'`.
- Bot tab entries show robot emoji instead of milestone cursor icon.
- Existing CSS applies automatically to the new button.

**Flagged bot addresses:**
- `0xd3a954764ee75f1df4142d853e70d2b7e5884d89`
- `0xdad91ea7b6acf1cedf3f374dfb73ffc1a5ae75e5`
- `0x74ac3770e1c8c1580ad04e98657da2975df6c689`
- `0x736f54a30eb7ba91a0f3486bbd7cb1dea338b6da`
- `0x455da13a80afe335f51bb4593421d81b8f86fc89`

## Batch Size Increase, Admin Dashboard & Attested-Clicks Difficulty (Feb 11, 2026)

**Batch size increase (500 -> 3000):**
Raised the max clicks per submission from 500 to 3000 across the entire stack:
- Frontend: `network.ts` maxBatchSize, `index.html` tooltip text
- Server: rate limit default (`RATE_LIMIT_MAX_NONCES`), hard batch cap
- Docs: `security.md`, `bot.html`, `session-notes.md`

**Admin dashboard (`admin.html` + server endpoints):**
Built a comprehensive admin dashboard for monitoring game health. Server-side data collection layer captures point-in-time snapshots every 5 minutes (difficulty, active users, click velocity, bot/human ratios, epoch progress, global earned). Event logging tracks difficulty changes and claim attestations.

- `?dashboard=true&range=24h|7d|30d` — full dashboard response (currentState, epochs, timeseries, difficulty/claim history)
- `?history=snapshots|difficulty|claims&from=TS&to=TS` — targeted historical queries
- Vercel cron job triggers snapshot capture every 5 min
- Frontend: standalone HTML page with Chart.js — metric cards, time-series charts (clicks, users, velocity, difficulty, bot ratio), epoch table, claim/difficulty event logs, auto-refresh every 30s

**Critical design fix — attested-clicks-based difficulty:**
Discovered that the difficulty system was fundamentally broken. It targeted 1M raw clicks per epoch, but bots inflated raw clicks (70% of all clicks, 3.1M in epoch 1) without claiming tokens. Only 42K $CLICK was actually claimed. Difficulty was punishing real players while tokens sat undistributed.

Fix: switched difficulty adjustment from raw clicks to **attested clicks** — only clicks that were included in a claim attestation request count toward the difficulty target. This makes bots that mine without claiming invisible to the difficulty algorithm.

- New Redis key `V2_EPOCH_ATTESTED_KEY(epoch)` tracks attested clicks per epoch
- Incremented in the claim attestation handler (with delta handling for incremental claims)
- `adjustDifficultyIfNeeded()` reads attested clicks instead of raw clicks for Bitcoin-style adjustment
- Dashboard and difficulty endpoints return both raw and attested metrics
- Admin dashboard updated to show attested vs raw clicks in cards, epoch table, and difficulty events

**Current state after deploy:** Epoch 1 has 3.14M raw clicks but 0 attested (counter tracks going forward only). Difficulty is at minimum. Next epoch transition will see low attested clicks and keep difficulty low — exactly the desired behavior.

## Admin Dashboard Full Addresses & All-Clickers Table (Feb 11, 2026)

**Full ETH addresses in admin dashboard:**
Replaced truncated `shortAddr()` display with full addresses in claim event entries so they can be copied directly.

**All Clickers table:**
Added a new "All Clickers" section at the bottom of `admin.html` — a sortable table showing every address that has clicked, their total API clicks, and total CLICKSTR earned. Data fetched from the alltime and earned leaderboard APIs (limit=9999). Columns are sortable (click header to toggle). Addresses are click-to-copy with toast notification. Added `.addr` CSS with `word-break: break-all` for address wrapping.

**Files changed:**
- `src-ts/admin.html` — full addresses, All Clickers section (CSS, HTML, JS)

## Server-Issued Mining Challenges (Feb 11, 2026)

Implemented the short-lived mining challenge system described in `docs/security.md` to structurally prevent offline PoW pre-computation. Bots could previously mine nonces offline since all hash inputs (address, epoch, chainId) were publicly known and long-lived. Now the server issues a random challenge token with a 30-second TTL that must be included in the PoW hash.

**How it works:**
1. Frontend requests a challenge before mining: `GET ?challenge=true&address=0x...`
2. Server generates a random 16-byte hex token, stores it in Redis with 35s TTL
3. Challenge is included as `bytes32` (right-padded zeros) in the packed hash: `keccak256(address || nonce || epoch || chainId || challenge)` — 148 bytes total (was 116)
4. On click submission, server validates that the submitted challenge matches what it issued
5. Challenge auto-refreshes 5 seconds before expiry via a timer; the active worker receives an `UPDATE_CHALLENGE` message (no restart needed, no mining progress lost)

**Server changes (`mann-dot-cool/api/clickstr-v2.js`):**
- Added config: `MINING_CHALLENGE_TTL_SECONDS = 30`, `MINING_CHALLENGE_RATE_LIMIT_MS = 500`
- Added Redis keys: `clickstr:v2:mining-challenge:{addr}` (challenge storage), `clickstr:v2:mining-challenge-rate:{addr}` (rate limit)
- New GET endpoint: `?challenge=true&address=0x...` — generates random 16-byte hex token, stores in Redis with 35s TTL, returns challenge + timestamps
- Updated `verifyNonce()` to accept optional `challenge` param — encodes as `bytes32` via viem's `encodePacked`
- Updated POST handler to extract `miningChallenge` from body, validate against Redis, pass to `verifyNonce()`
- **Grace period**: Server tries verification with challenge first, then falls back to without-challenge (allows old clients during rollout). Marked with TODO for removal.

**Frontend changes (`clickstrv2/src-ts/`):**
- `types/api.ts`: Added `MiningChallengeResponse` interface
- `types/index.ts`: Re-exported new type
- `services/api.ts`: Added `fetchMiningChallenge(address)` function; updated `submitClicksV2()` to accept and send `miningChallenge` param
- `services/mining.ts`: Major rewrite — added challenge state management (`currentMiningChallenge`, `challengeExpiresAt`, `challengeRefreshTimer`), `refreshChallenge()` with auto-scheduling, `getMiningChallenge()` exported getter, `startMining()` changed from sync to `async` (fetches challenge before creating worker). Both worker variants (inline sha3 for Safari, importScripts fallback) updated with challenge logic.
- `services/index.ts`: Exported `getMiningChallenge`
- `workers/miningWorker.ts`: Added `UPDATE_CHALLENGE` message handler, `currentChallenge` state, challenge encoding in `packData()`
- `main.ts`: Imports `getMiningChallenge`, passes it to all 3 `submitClicksV2()` call sites (`handleV2Submit`, `maybeAutoSubmit`, `handleV2Claim`), `startMining()` call changed to `void startMining(onClickMined)` (now async)

**Build:** TypeScript type-check and Vite production build both passed cleanly.

## Open Items
- Test claims with NFT bonuses end-to-end.
- Rotate the admin secret (was exposed in session context).
- Clean up any incorrect Redis achievements from the pre-fix `syncAchievements` behavior.
- Remove mining challenge grace period on server after frontend rollout confirms all clients send challenges.
- Bots can create new addresses to evade the flagged list — monitor for new suspicious patterns.
- Monitor attested clicks accumulation as players claim — verify difficulty adjusts correctly at epoch boundaries.

## Bot Penetration Test (Feb 8, 2026)

Built two bots (`bot/`) to attack the game's anti-bot defenses.

- **Level 1 (token replay)**: Node.js miner + raw API submission. PoW was trivially replicated (~90K H/s), but a real Turnstile token copied from the browser was rejected when replayed from a different process. Tokens are session/IP-bound.
- **Level 2 (headless browser)**: Puppeteer + stealth plugin on live clickstr.fun. Turnstile detected the automated browser and refused to load the challenge iframe. Both headless and visible modes failed.
- **Conclusion**: Turnstile is the real defense (not PoW). It blocks token replay and headless browsers. Only remaining theoretical risk is paid solver services.

Full details in `docs/security.md`.

## Fresh Sepolia Deploy - 24h Game (Feb 8, 2026)

Deployed for bot testing. Redis reset (26 keys). Same parameters as previous deploy.

**Contracts:**
- ClickRegistry: `0x8945ad6dbA24C90998175bC007d6B2B81c650a61`
- ClickstrGameV2: `0xAce0502aC3DE5BcDa8BAF8499D9e4f2a2c295430`
- ClickstrNFTV2: `0xDD866DbCbf3120C62e46cdB97183aB3F71999ebd`
- ClickstrTreasury (existing): `0x82378b6C7247b02f4b985Aca079a0A85E0D2cbAe`

**Game window:**
- Start: 2026-02-08T16:56:12.000Z
- End: 2026-02-09T16:56:12.000Z

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

## Auto-Submit, Click Cap & Global Stats Improvements (Feb 11, 2026)

**Problem:** A user accumulated 107K pending nonces without submitting. By the time they tried to claim, difficulty had changed and the server rejected all nonces with "No valid nonces" (400). Their clicks were lost.

**Auto-submit (`maybeAutoSubmit`):**
When `pendingNonces` reaches `maxBatchSize` (3000) and a Turnstile token is present, the frontend now automatically submits the batch to the server in the background. This is off-chain only (step 1 of the claim flow) — the on-chain token claim remains manual. The server response syncs the difficulty target, so subsequent nonces are mined at the correct difficulty. Achievements from the auto-submit are still processed.

**Hard click cap:**
If auto-submit can't fire (e.g. no Turnstile token yet), a hard cap stops mining at `maxBatchSize`. The main button dims to 40% opacity and stops responding to clicks. The claim button text changes to "Claim to keep clicking!" (or "Submit to keep clicking!" between games) and pulses. After submitting, clicking resumes normally. In practice most users never see this — auto-submit handles it silently.

**Changes:**
- `main.ts`: Added `isAutoSubmitting` flag, `maybeAutoSubmit()` function called from `onClickMined()`, hard cap check in `pressDown()`, button dimming and label change in `updateSubmitButton()`
- `network.ts`: `maxBatchSize` = 3000 (increased from 500, enforced as a cap)

**Bot click deduction from global stats (server):**
The `?activeUsers=true` endpoint now subtracts flagged bot address clicks from `globalClicks`. Previously the "All-Time" counter in the game status panel included bot clicks. Server fetches each bot's `clickstr:v2:total:{address}` and subtracts the sum.

**Global earned & All-Time toggle:**
- Server: The `activeUsers` response now includes `globalEarned` (wei string) — sum of all scores in the earned leaderboard, excluding bots.
- Frontend: The "All-Time" header in the game status panel is now clickable. Tapping toggles between "All-Time" (global click count) and "Earned" (global tokens earned with `$C` suffix). Added `formatWeiSplit()` utility for split value/suffix formatting of wei strings.
- New type field: `globalEarned?: string` on `ActiveUsersResponse`

**Files changed (frontend):**
- `src-ts/src/main.ts` — auto-submit, hard cap, alltime toggle
- `src-ts/index.html` — clickable alltime-toggle element
- `src-ts/src/utils/formatting.ts` — `formatWeiSplit()`
- `src-ts/src/utils/index.ts` — export `formatWeiSplit`
- `src-ts/src/types/api.ts` — `globalEarned` field

**Files changed (server @ mann.cool):**
- `api/clickstr-v2.js` — bot deduction + globalEarned in activeUsers handler

## Previous Sepolia Deploy (Feb 6, 2026)

**Contracts (superseded):**
- ClickRegistry: `0x714b1CceBae8bD92a5C62cde310139b87e468d66`
- ClickstrGameV2: `0x9dECc3bEE4AD20f5fB7CeB279cDF3258ecBBbe80`
- ClickstrNFTV2: `0x444d348Ec176d0a18765Fe4867A234F2AE8FdD4F`

**Game window (expired):**
- Start: 2026-02-06T21:45:12.000Z
- End: 2026-02-06T22:45:12.000Z
