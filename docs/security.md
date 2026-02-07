# Clickstr V2 Security

Last updated: 2026-02-06

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

## Operational Checklist
- Do not store the attestation private key in frontend or build-time envs.
- Disable secrets on preview deployments.
- Log only redacted errors in the API.
- Rotate the attestation signer on any suspected leak.
- Monitor for abnormal claim volume and anomaly spikes per epoch.
