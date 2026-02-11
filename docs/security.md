# Clickstr V2 Security

Last updated: 2026-02-11

## Trust Model
V2 trades on-chain proof validation for off-chain validation with on-chain settlement. The server is trusted for:
- Click counts included in attestations
- Turnstile enforcement
- PoW verification and dedup
- Availability of signatures for claims

The chain enforces:
- Signature verification tied to address, epoch, season, contract, and chainId
- Claim deduplication and incremental claim math
- 50/50 distribution and burns through the treasury
- Append-only click totals in the registry

## Keys and Roles
- Deployer or owner key. Controls registry and treasury authorization and game setup.
- Attestation signer key. Hot key used by the server to sign claims.
- NFT signer key. Signs NFT claim messages if using ClickstrNFTV2.

## High-Risk Areas and Mitigations
- Attestation signer compromise can drain the pool. Use strict secrets hygiene, rotate keys, and consider KMS.
- Claim front-running. Require a wallet-signed challenge before issuing a claim signature.
- Turnstile bypass. Bind sessions to address and hashed IP, enforce TTL, and re-verify after large click counts.
- Epoch finalization griefing. Disallow claims after finalization and communicate claim deadlines in the UI.
- Treasury overcommit across seasons. Use per-season allowances and revoke ended seasons.

## Flat Budget Audit (Feb 8, 2026)

Security review of the flat per-epoch budget change (`seasonPool / TOTAL_EPOCHS`). Two issues were found and fixed, two were informational only.

### [FIXED] Pool over-commitment from bonuses (was MEDIUM)

**Problem:** The flat budget allocates `seasonPool / TOTAL_EPOCHS` per epoch, summing to exactly `seasonPool`. But NFT bonuses (up to 50%), winner bonuses (10% of distributed), and finalizer rewards all draw from `poolRemaining` on top of the base budget. Worst case: ~155% of pool committed across all epochs. Later epochs could see claims revert due to underflow on `poolRemaining`.

**Fix:** Epoch budget is now `min(seasonPool / TOTAL_EPOCHS, poolRemaining / remainingEpochs)`. When the pool is healthy, you get the flat amount. If bonuses have depleted the pool, later epochs gracefully degrade instead of reverting. Applied in both `_calculateReward()` and `_finalizeEpochInternal()`.

### [FIXED] Soft overflow path bypassed per-claim safety cap (was MEDIUM)

**Problem:** When an epoch's budget is exhausted (`remaining == 0`), `_calculateReward` falls into a soft overflow path that returns `(poolRemaining * clickCount) / (1_000_000 * 10)` and skips the `poolRemaining / 10` safety cap applied in the normal path. With `MAX_CLICKS_PER_CLAIM = 100M`, a single claim could theoretically request 10x the pool (reverting on underflow, but still bypassing the intended cap). The flat budget model makes hitting `remaining == 0` more likely since budgets don't decay.

**Fix:** Added the same `poolRemaining / 10` safety cap to the soft overflow return path.

### [INFO] `seasonPool` is mutable, not immutable

`seasonPool` is a regular state variable, not `immutable`. It can't be `immutable` because it's set in `startGame()`, not the constructor. The `GameAlreadyStarted` guard in `startGame()` prevents a second write. No exploit path.

### [INFO] Integer division rounding loss

`seasonPool / TOTAL_EPOCHS` truncates. For 1,000,001 / 6, the last 5 tokens are never budgeted. Negligible for any real deployment (tokens have 18 decimals).

### [INFO] Epoch duration guard restored

The constructor guard `_epochDuration >= 2 minutes` (a testnet convenience) was restored to `_epochDuration >= 1 hours` for mainnet safety.

## Frontend Security Audit (Feb 8, 2026)

Review of the TypeScript frontend for XSS, information leakage, and claim flow hardening. Six issues found and fixed.

### [FIXED] XSS via leaderboard names (was CRITICAL)

**Problem:** `renderLeaderboard()` built HTML via template literals and injected user-supplied names from the API (server name, ENS) directly into `innerHTML`. A malicious name like `<img src=x onerror="...">` would execute in every player's browser.

**Fix:** Added `escapeHtml()` utility (`utils/dom.ts`) and applied it to all user-supplied strings interpolated into leaderboard HTML: display names, addresses, milestone cursor names. The ENS update path already used `textContent` and was safe.

### [FIXED] Sensitive data logged to console (was HIGH)

**Problem:** Wallet addresses, attestation challenges, API responses containing signatures, nonce values, and ENS lookup addresses were logged via `console.log`. On shared machines or during screenshares this leaks claim flow internals.

**Fix:** Removed all `console.log` calls that included addresses, challenges, signatures, nonces, or full API responses from `main.ts`, `api.ts`, `mining.ts`, `ens.ts`, and `persistence.ts`. Only non-sensitive status messages remain.

### [FIXED] Multi-tab claim race condition (was HIGH)

**Problem:** `v2IsClaimingInProgress` only guards a single tab. Two browser tabs could fire duplicate claim transactions for the same epoch (the second would revert, wasting gas).

**Fix:** Added a `localStorage`-based claim lock (`clickstr_claim_lock`) with a 2-minute TTL. `acquireClaimLock(epoch)` is checked before any claim attempt; `releaseClaimLock()` is called in the `finally` block. Both `handleV2ClaimSingle` and `handleV2ClaimAll` use the lock.

### [FIXED] Unvalidated contract address from API (was MEDIUM)

**Problem:** `claimV2Reward()` used the contract address returned by the API to construct an `ethers.Contract`. A compromised API could point the user at a malicious contract.

**Fix:** `claimV2Reward()` now compares the API-returned address against `CONFIG.contractAddress` (case-insensitive) and throws before signing if they don't match.

### [FIXED] Wallet challenge not request-bound (was MEDIUM)

**Problem:** The wallet signature challenge from the API was signed blindly. A compromised server could issue a generic challenge replayable in other contexts.

**Fix:** Before signing, the client now checks that the challenge string contains the user's address (hex, case-insensitive). If not, the claim is refused with an error.

### [FIXED] fetchRewardParams division edge case (was LOW)

**Problem:** `remainingEpochs = totalEpochs - currentEpoch + 1` could evaluate to `0n` if the game had ended (`currentEpoch > totalEpochs`). The existing `> 0n` ternary returned `0n` for `fairBudget` which made the reward display show zero during the grace period.

**Fix:** Clamped `remainingEpochs` to `>= 1n` so the budget calculation always produces a meaningful value.

## Bot Penetration Test (Feb 8, 2026)

Built two bots to test whether the Turnstile + PoW defense can be defeated by an automated attacker. Code in `bot/`.

### Level 1: Token Replay (`bot/click-bot.mjs`)

Node.js script that mines PoW nonces and submits them to the API with a manually-copied Turnstile token.

- **PoW**: Trivially replicated. 50 valid nonces in ~0.5s at ~90K H/s in pure JS. No GPU needed. PoW alone is not a meaningful bot deterrent.
- **Token replay**: **BLOCKED**. A real Turnstile token copied from the browser was rejected by the server (`"Verification failed"`). Tokens are bound to the originating session/IP and cannot be replayed from a different process.

### Level 2: Headless Browser (`bot/headless-bot.mjs`)

Puppeteer + stealth plugin loads the live site, dismisses the welcome modal, injects a Turnstile widget programmatically, and attempts to auto-solve.

- **Stealth evasion**: Used `puppeteer-extra-plugin-stealth`, `--disable-blink-features=AutomationControlled`, `ignoreDefaultArgs: ['--enable-automation']`, custom user agent, and custom window size.
- **Result**: **BLOCKED**. Turnstile's `render()` call created the hidden input element but the challenge iframe never loaded. Cloudflare's JS-level fingerprinting detected the automated browser. Tested both headless and visible modes — both failed identically.

### Conclusions

- PoW is not a bot barrier; it exists for rate-limiting and is trivially solvable outside the browser.
- **Turnstile is the real defense** and it held against both attack vectors.
- Tokens are non-transferable (can't be replayed from another process).
- Headless browsers (even with stealth plugins) are detected at the challenge level.
- **Remaining theoretical risk**: paid Turnstile solver services (CapSolver, 2Captcha) that use human farms or heavily patched browsers. Not tested.

## Bot Flagging & Rate Limiting (Feb 10, 2026)

Community member published an offline PoW miner that injects valid nonces directly via API calls, bypassing the browser UI entirely. The attack works because:

1. User visits the site once, passes Turnstile (establishes a 1-hour session keyed by address + IP)
2. Offline miner runs on the same machine, mining nonces against the public PoW algorithm
3. Miner POSTs nonces to `/api/clickstr-v2` from the same IP — server sees a valid session and accepts them
4. Bots were able to claim tokens on-chain (wallet signature + contract call)

### [FIXED] Bot flagging and leaderboard filtering

**Problem:** 5 addresses identified as bots were inflating leaderboards and claiming tokens.

**Fix:**
- Added `FLAGGED_BOT_ADDRESSES` set to server with 5 known bot addresses
- Flagged addresses are blocked from all POST actions (clicks, claims, heartbeats) — returns 403
- Filtered from epoch/alltime/earned leaderboard tabs
- New `type=bots` leaderboard endpoint surfaces bot data in a dedicated "Bots" tab with backfill from Redis totals
- Frontend: 4th "Bots" toggle button on leaderboard, robot emoji icon for bot entries

### [FIXED] Per-address rate limiting

**Problem:** No per-address throughput cap. An offline miner could submit thousands of nonces per minute via API, far exceeding human-plausible rates.

**Fix:** Added a sliding-window rate limiter (Redis counter with TTL). Default: 300 valid nonces per 60-second window per address. Configurable via `RATE_LIMIT_MAX_NONCES` env var. Partial batches accepted when near the limit. Returns 429 with `retryAfterSeconds` when exhausted. A legitimate in-browser player (batches of 50-3000 on button click) will never hit this limit.

### [REMOVED] Click-count re-verification cap

The `CLICKS_BEFORE_VERIFICATION` (500-click) cap forced Turnstile re-verification every 500 clicks. Removed because it caused UX friction for legitimate players without meaningfully stopping bots (they pass Turnstile via a real browser anyway). Session expiry (1 hour) and IP binding remain as re-verification triggers.

### Remaining risks
- Bots can create new addresses to evade the flagged list
- Rate limit of 300/min is tunable but bots can adapt to stay just under it

## Server-Issued Mining Challenges (Feb 11, 2026)

Structurally prevents offline PoW pre-computation. Previously, all hash inputs (address, epoch, chainId) were publicly known and long-lived, so a bot could mine millions of nonces offline and batch-submit them. Now the server issues a random challenge token with a 30-second TTL that must be included in the PoW hash.

### How it works

1. Frontend requests a challenge: `GET ?challenge=true&address=0x...`
2. Server generates a random 16-byte hex token, stores in Redis with 35s TTL
3. Challenge included as `bytes32` (right-padded zeros) in the packed hash: `keccak256(address || nonce || epoch || chainId || challenge)` (148 bytes, was 116)
4. On click submission, server validates: challenge must be present, must match Redis, must not be expired
5. Challenge auto-refreshes 5 seconds before expiry (hot-swapped to the active worker, no mining restart)

### What it prevents

- **Offline pre-computation**: Nonces mined without a challenge (or with an expired one) are rejected. Mining must happen in real-time within 30-second windows.
- **Batch stockpiling**: A bot can no longer mine for hours and submit in bulk. Each batch must use a challenge that was issued within the last 30 seconds.

### What it does NOT prevent

- **Real-time bot mining**: A bot that fetches challenges and mines in 30-second windows can still operate. The challenge reduces the attack to "mine at the same speed as a legitimate client," which is the intended outcome.
- **Multiple addresses**: Spinning up N wallets with N challenge streams. Each gets its own rate limit bucket.
- **Browser-based bots**: A bot running inside a real browser with Turnstile can fetch challenges normally.

### Grace period (REMOVED Feb 11, 2026)

Initially deployed with a grace period that accepted nonces with or without a challenge (fallback for old clients). After confirming all clients send challenges via server-side logging, the grace period was removed. Submissions without a valid challenge now return 400.

## Automated Bot Detection (Proposed)

Scoring system to identify likely bot addresses based on behavioral signals, replacing the current manual flagging approach.

### Detection signals and scoring

| Signal | Points | Rationale |
|--------|--------|-----------|
| Sustained >300 clicks/min for 10+ min | +3 | Human max is ~180/min (3 clicks/sec). Consistently hitting rate limit ceiling indicates automation. |
| Never appeared in active users list | +2 | No browser heartbeat means no real browser session. The address submits clicks via direct API calls. |
| >50K clicks with 0 tokens earned | +2 | Mining without claiming suggests automated farming or testing. Legitimate players claim periodically. |
| No gap >5 min in a 6+ hour window | +1 | Humans take breaks, check phones, eat. Bots submit continuously. |
| Shares IP with a flagged bot address | +1 | Bot operators often run multiple addresses from the same machine. |
| Submission intervals have <5% variance | +1 | Bots submit on a timer with near-zero jitter. Humans are bursty and irregular. |

### Actions by score

| Score | Action |
|-------|--------|
| >= 5 | **Auto-flag**: address blocked immediately (403 on all POSTs), moved to Bots tab. Logged to admin dashboard. |
| 3-4 | **Suspicious**: highlighted in admin dashboard with score breakdown. Not blocked until manual review. |
| 1-2 | **Low risk**: no action, but score tracked and visible in admin dashboard. |

### Implementation plan

**Data collection (Redis):**
- Per-address click timestamps: store last N submission times for interval variance calculation
- Per-address session presence: track whether address has ever sent a heartbeat
- Per-address continuous mining windows: track longest gap-free mining stretch
- IP-to-address mapping: associate addresses with IPs seen during Turnstile sessions

**Scoring runs:**
- Trigger scoring on each click submission (lightweight: check 2-3 Redis keys)
- Full scoring sweep via cron (every 5 min with dashboard snapshots): compute all signals for all active addresses

**Admin dashboard integration:**
- New "Suspicious" section showing addresses with score >= 3
- Per-address detail view with signal breakdown
- One-click flag/unflag from dashboard

### Tuning considerations

- Thresholds should be adjusted based on observed human behavior at different difficulty levels. At minimum difficulty, legitimate players mine faster.
- The rate limit (currently 300/60s) acts as a natural ceiling. If lowered, the click velocity signal threshold should be adjusted accordingly.
- New signals can be added over time (e.g., challenge fetch frequency, submission size patterns, time-of-day distribution).

## Operational Checklist
- Do not store the attestation private key in frontend or build-time envs.
- Disable secrets on preview deployments.
- Log only redacted errors in the API.
- Rotate the attestation signer on any suspected leak.
- Monitor for abnormal claim volume and anomaly spikes per epoch.
- [x] Sanitize all user-supplied data before HTML rendering (escapeHtml).
- [x] Remove sensitive console.log statements from production code.
- [x] Validate API-returned contract address against local config.
- [x] Bot flagging and leaderboard filtering deployed.
- [x] Per-address rate limiting deployed.
- [x] Server-issued mining challenges deployed (30s TTL, required for all submissions).
- [x] Mining challenge grace period removed (no-challenge submissions rejected).
- [x] Bot wave 3 flagged (0xc1e9...31cd, 230K clicks).
- [ ] Rotate admin secret (was exposed in session context).
- [ ] Deploy new contract with all security fixes before mainnet.
- [ ] Implement automated bot detection scoring system (see proposal above).
