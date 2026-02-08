#!/usr/bin/env node
/**
 * Clickstr V2 — Anti-Bot Defense Tester
 *
 * Authorized security testing tool. Replicates what a "degen hacker" would
 * build to defeat Turnstile + PoW defenses on the clickstr game.
 *
 * Usage:
 *   node bot/click-bot.mjs --address 0xYOUR_WALLET --token TURNSTILE_TOKEN
 *
 * The Turnstile token must be grabbed manually from the browser (for now).
 * Open clickstr.fun, solve the Turnstile, then grab the token from the
 * network tab (it's the `turnstileToken` field in the POST body).
 */

import { keccak256 } from 'ethereum-cryptography/keccak.js';
import { bytesToHex } from 'ethereum-cryptography/utils.js';

// ── Config ────────────────────────────────────────────────────────────
const API_URL = 'https://mann.cool/api/clickstr-v2';
const CHAIN_ID = 11155111; // Sepolia
const BATCH_SIZE = 50;     // nonces per submission (matches frontend minBatchSize)
const MINE_REPORT_INTERVAL = 100_000; // log hash rate every N hashes

// ── CLI args ──────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--address' || args[i] === '-a') parsed.address = args[++i];
    else if (args[i] === '--token' || args[i] === '-t') parsed.token = args[++i];
    else if (args[i] === '--batches' || args[i] === '-n') parsed.batches = parseInt(args[++i]);
    else if (args[i] === '--batch-size' || args[i] === '-b') parsed.batchSize = parseInt(args[++i]);
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Clickstr V2 Bot — Defense Tester

Usage:
  node bot/click-bot.mjs --address 0x... --token TURNSTILE_TOKEN [options]

Options:
  --address, -a    Wallet address to click as (required)
  --token, -t      Turnstile token from browser (required)
  --batches, -n    Number of batches to submit (default: infinite)
  --batch-size, -b Nonces per batch (default: ${BATCH_SIZE})
  --help, -h       Show this help
      `);
      process.exit(0);
    }
  }
  return parsed;
}

// ── Packing (mirrors the WebWorker exactly) ───────────────────────────
function packData(address, nonce, epoch, chainId) {
  const packed = new Uint8Array(116);

  // address: 20 bytes at offset 0
  const addrHex = address.slice(2);
  for (let i = 0; i < 20; i++) {
    packed[i] = parseInt(addrHex.substr(i * 2, 2), 16);
  }

  // nonce: 32 bytes at offset 20 (big-endian)
  let n = BigInt(nonce);
  for (let i = 51; i >= 20; i--) {
    packed[i] = Number(n & 0xFFn);
    n >>= 8n;
  }

  // epoch: 32 bytes at offset 52 (big-endian)
  let e = BigInt(epoch);
  for (let i = 83; i >= 52; i--) {
    packed[i] = Number(e & 0xFFn);
    e >>= 8n;
  }

  // chainId: 32 bytes at offset 84 (big-endian)
  let c = BigInt(chainId);
  for (let i = 115; i >= 84; i--) {
    packed[i] = Number(c & 0xFFn);
    c >>= 8n;
  }

  return packed;
}

function hashToBigInt(hash) {
  let result = 0n;
  for (let i = 0; i < hash.length; i++) {
    result = (result << 8n) | BigInt(hash[i]);
  }
  return result;
}

// ── Miner ─────────────────────────────────────────────────────────────
function mineNonces(address, epoch, difficultyTarget, count) {
  const target = BigInt(difficultyTarget);
  const nonces = [];
  let nonce = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
  let attempts = 0;
  const startTime = Date.now();
  let lastReport = startTime;

  while (nonces.length < count) {
    const packed = packData(address, nonce, epoch, CHAIN_ID);
    const hash = keccak256(packed);

    if (hashToBigInt(hash) < target) {
      nonces.push(nonce.toString());
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      process.stdout.write(`\r  [mine] found ${nonces.length}/${count} nonces (${attempts} hashes, ${elapsed}s)`);
    }

    nonce++;
    attempts++;

    // Periodic hash rate report
    if (attempts % MINE_REPORT_INTERVAL === 0) {
      const now = Date.now();
      const windowSecs = (now - lastReport) / 1000;
      const rate = Math.round(MINE_REPORT_INTERVAL / windowSecs);
      process.stdout.write(`\r  [mine] ${nonces.length}/${count} nonces | ${rate.toLocaleString()} H/s | ${attempts.toLocaleString()} total hashes  `);
      lastReport = now;
    }
  }

  const totalSecs = (Date.now() - startTime) / 1000;
  const avgRate = Math.round(attempts / totalSecs);
  console.log(`\n  [mine] done: ${count} nonces in ${totalSecs.toFixed(1)}s (${avgRate.toLocaleString()} H/s avg, ${attempts.toLocaleString()} hashes)`);
  return nonces;
}

// ── API helpers ───────────────────────────────────────────────────────
async function fetchDifficulty() {
  const res = await fetch(`${API_URL}?difficulty=true`);
  if (!res.ok) throw new Error(`difficulty fetch failed: ${res.status}`);
  return await res.json();
}

async function submitNonces(address, nonces, turnstileToken) {
  const body = { address, nonces };
  if (turnstileToken) body.turnstileToken = turnstileToken;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return { status: res.status, data };
}

async function fetchStats(address) {
  const res = await fetch(`${API_URL}?address=${address}`);
  if (!res.ok) return null;
  return await res.json();
}

// ── Main loop ─────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs();

  if (!args.address) {
    console.error('error: --address is required');
    process.exit(1);
  }
  if (!args.token) {
    console.error('error: --token is required (grab from browser network tab)');
    process.exit(1);
  }

  const batchSize = args.batchSize || BATCH_SIZE;
  const maxBatches = args.batches || Infinity;
  let turnstileToken = args.token;

  console.log('=== Clickstr V2 Bot — Defense Tester ===');
  console.log(`  address:    ${args.address}`);
  console.log(`  chain:      Sepolia (${CHAIN_ID})`);
  console.log(`  batch size: ${batchSize}`);
  console.log(`  batches:    ${maxBatches === Infinity ? 'unlimited (Ctrl+C to stop)' : maxBatches}`);
  console.log(`  token:      ${turnstileToken.slice(0, 20)}...`);
  console.log('');

  // Fetch difficulty
  console.log('[1] Fetching difficulty...');
  const diff = await fetchDifficulty();
  if (!diff.success || !diff.difficultyTarget) {
    console.error('  failed to get difficulty:', diff);
    process.exit(1);
  }
  console.log(`  epoch:      ${diff.epoch}`);
  console.log(`  difficulty: ${diff.difficultyTarget.slice(0, 20)}...`);
  console.log(`  target clicks/epoch: ${diff.targetClicksPerEpoch?.toLocaleString() ?? '?'}`);
  console.log(`  current epoch clicks: ${diff.currentEpochClicks?.toLocaleString() ?? '?'}`);
  console.log(`  game active: ${diff.gameActive}`);
  console.log('');

  // Pre-run stats
  console.log('[2] Fetching pre-run stats...');
  const preStats = await fetchStats(args.address);
  const preClicks = preStats?.lifetimeClicks ?? preStats?.totalClicks ?? 0;
  console.log(`  clicks before: ${preClicks.toLocaleString()}`);
  console.log('');

  // Main loop
  let totalSubmitted = 0;
  let totalAccepted = 0;
  let totalRejected = 0;
  let turnstileFailures = 0;
  let batchNum = 0;
  const loopStart = Date.now();

  for (batchNum = 1; batchNum <= maxBatches; batchNum++) {
    console.log(`[batch ${batchNum}] Mining ${batchSize} nonces...`);

    // Re-fetch difficulty every 10 batches (epoch might change)
    if (batchNum > 1 && batchNum % 10 === 1) {
      console.log('  (refreshing difficulty...)');
      const newDiff = await fetchDifficulty();
      if (newDiff.success && newDiff.difficultyTarget) {
        if (newDiff.difficultyTarget !== diff.difficultyTarget) {
          console.log(`  difficulty changed: ${newDiff.difficultyTarget.slice(0, 20)}...`);
          diff.difficultyTarget = newDiff.difficultyTarget;
        }
        if (newDiff.epoch !== diff.epoch) {
          console.log(`  epoch changed: ${diff.epoch} -> ${newDiff.epoch}`);
          diff.epoch = newDiff.epoch;
        }
      }
    }

    const nonces = mineNonces(args.address, diff.epoch, diff.difficultyTarget, batchSize);

    console.log(`  submitting ${nonces.length} nonces...`);
    const result = await submitNonces(args.address, nonces, turnstileToken);

    if (result.status === 403) {
      console.log(`  !! 403 REJECTED — requiresVerification: ${result.data.requiresVerification}`);
      console.log(`  !! Turnstile token is dead. Server response:`, JSON.stringify(result.data));
      turnstileFailures++;

      if (turnstileFailures >= 3) {
        console.log('\n  !!! 3 consecutive Turnstile failures — token is burnt.');
        console.log('  !!! Get a new token from the browser and restart.');
        break;
      }
      continue;
    }

    turnstileFailures = 0; // reset on success

    if (result.data.success) {
      const accepted = result.data.acceptedNonces ?? result.data.accepted ?? nonces.length;
      const rejected = result.data.rejectedNonces ?? result.data.rejected ?? 0;
      totalSubmitted += nonces.length;
      totalAccepted += accepted;
      totalRejected += rejected;
      console.log(`  OK — accepted: ${accepted}, rejected: ${rejected}, total clicks: ${result.data.totalClicks ?? '?'}`);
    } else {
      console.log(`  FAILED:`, JSON.stringify(result.data));
      totalRejected += nonces.length;
    }

    // Brief stats
    const elapsed = ((Date.now() - loopStart) / 1000).toFixed(0);
    const rate = (totalAccepted / (elapsed / 60)).toFixed(1);
    console.log(`  [running] ${totalAccepted} accepted / ${totalRejected} rejected / ${elapsed}s elapsed / ~${rate} clicks/min`);
    console.log('');
  }

  // Final report
  console.log('=== FINAL REPORT ===');
  const totalElapsed = ((Date.now() - loopStart) / 1000).toFixed(1);
  console.log(`  batches attempted: ${batchNum - 1}`);
  console.log(`  nonces submitted:  ${totalSubmitted}`);
  console.log(`  accepted:          ${totalAccepted}`);
  console.log(`  rejected:          ${totalRejected}`);
  console.log(`  turnstile failures: ${turnstileFailures}`);
  console.log(`  total time:        ${totalElapsed}s`);
  console.log(`  click rate:        ${(totalAccepted / (totalElapsed / 60)).toFixed(1)} clicks/min`);

  // Post-run stats
  const postStats = await fetchStats(args.address);
  const postClicks = postStats?.lifetimeClicks ?? postStats?.totalClicks ?? 0;
  console.log(`  clicks before:     ${preClicks.toLocaleString()}`);
  console.log(`  clicks after:      ${postClicks.toLocaleString()}`);
  console.log(`  delta:             ${(postClicks - preClicks).toLocaleString()}`);
  console.log('');

  if (totalAccepted > 0 && turnstileFailures === 0) {
    console.log('VERDICT: Bot clicks were ACCEPTED. Turnstile did NOT block automated submissions.');
    console.log('         The PoW was the only real barrier, and it was trivially replicated.');
  } else if (turnstileFailures > 0 && totalAccepted > 0) {
    console.log('VERDICT: Bot got SOME clicks through before Turnstile expired.');
    console.log('         Token reuse window is limited but exploitable.');
  } else {
    console.log('VERDICT: Bot was BLOCKED. Turnstile or server validation stopped all clicks.');
  }
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
