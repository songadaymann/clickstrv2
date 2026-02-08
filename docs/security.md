# Clickstr V2 Security

Last updated: 2026-02-08

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

## Operational Checklist
- Do not store the attestation private key in frontend or build-time envs.
- Disable secrets on preview deployments.
- Log only redacted errors in the API.
- Rotate the attestation signer on any suspected leak.
- Monitor for abnormal claim volume and anomaly spikes per epoch.
- [x] Sanitize all user-supplied data before HTML rendering (escapeHtml).
- [x] Remove sensitive console.log statements from production code.
- [x] Validate API-returned contract address against local config.
- [ ] Rotate admin secret (was exposed in session context).
- [ ] Deploy new contract with all security fixes before mainnet.
