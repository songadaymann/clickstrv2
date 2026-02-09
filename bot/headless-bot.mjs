#!/usr/bin/env node
/**
 * Clickstr V2 — Headless Browser Bot (Level 2 Attack)
 *
 * Escalation from click-bot.mjs: instead of requiring a manually-pasted
 * Turnstile token, this bot runs a headless (stealth) Chromium instance
 * that auto-solves Turnstile and feeds fresh tokens to the miner.
 *
 * Tests whether Turnstile can distinguish a headless browser from a real user.
 *
 * Usage:
 *   node bot/headless-bot.mjs --address 0xYOUR_WALLET [--batches 10] [--visible]
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { keccak256 } from 'ethereum-cryptography/keccak.js';

puppeteer.use(StealthPlugin());

// ── Config ────────────────────────────────────────────────────────────
const API_URL = 'https://mann.cool/api/clickstr-v2';
const CHAIN_ID = 11155111;
const BATCH_SIZE = 50;
const TOKEN_REFRESH_MS = 240_000; // re-solve Turnstile every 4 min (before 5 min expiry)
const SITE_URL = 'https://clickstr.fun';

// ── CLI args ──────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--address' || args[i] === '-a') parsed.address = args[++i];
    else if (args[i] === '--batches' || args[i] === '-n') parsed.batches = parseInt(args[++i]);
    else if (args[i] === '--batch-size' || args[i] === '-b') parsed.batchSize = parseInt(args[++i]);
    else if (args[i] === '--visible' || args[i] === '-v') parsed.visible = true;
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Clickstr V2 Headless Bot — Level 2 Defense Tester

Usage:
  node bot/headless-bot.mjs --address 0x... [options]

Options:
  --address, -a     Wallet address to click as (required)
  --batches, -n     Number of batches to submit (default: infinite)
  --batch-size, -b  Nonces per batch (default: ${BATCH_SIZE})
  --visible, -v     Show browser window (default: headless)
  --help, -h        Show this help
      `);
      process.exit(0);
    }
  }
  return parsed;
}

// ── PoW Miner (same as click-bot.mjs) ────────────────────────────────
function packData(address, nonce, epoch, chainId) {
  const packed = new Uint8Array(116);
  const addrHex = address.slice(2);
  for (let i = 0; i < 20; i++) packed[i] = parseInt(addrHex.substr(i * 2, 2), 16);
  let n = BigInt(nonce);
  for (let i = 51; i >= 20; i--) { packed[i] = Number(n & 0xFFn); n >>= 8n; }
  let e = BigInt(epoch);
  for (let i = 83; i >= 52; i--) { packed[i] = Number(e & 0xFFn); e >>= 8n; }
  let c = BigInt(chainId);
  for (let i = 115; i >= 84; i--) { packed[i] = Number(c & 0xFFn); c >>= 8n; }
  return packed;
}

function hashToBigInt(hash) {
  let result = 0n;
  for (let i = 0; i < hash.length; i++) result = (result << 8n) | BigInt(hash[i]);
  return result;
}

function mineNonces(address, epoch, difficultyTarget, count) {
  const target = BigInt(difficultyTarget);
  const nonces = [];
  let nonce = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
  let attempts = 0;
  const startTime = Date.now();

  while (nonces.length < count) {
    const packed = packData(address, nonce, epoch, CHAIN_ID);
    const hash = keccak256(packed);
    if (hashToBigInt(hash) < target) {
      nonces.push(nonce.toString());
    }
    nonce++;
    attempts++;
  }

  const totalSecs = (Date.now() - startTime) / 1000;
  const avgRate = Math.round(attempts / totalSecs);
  console.log(`  [mine] ${count} nonces in ${totalSecs.toFixed(1)}s (${avgRate.toLocaleString()} H/s, ${attempts.toLocaleString()} hashes)`);
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
  return { status: res.status, data: await res.json() };
}

async function fetchStats(address) {
  const res = await fetch(`${API_URL}?address=${address}`);
  if (!res.ok) return null;
  return await res.json();
}

// ── Turnstile token manager ──────────────────────────────────────────
class TurnstileManager {
  constructor(page) {
    this.page = page;
    this.lastTokenTime = 0;
  }

  /**
   * Inject a hook that captures Turnstile tokens from the live site.
   * The real site renders Turnstile with a callback; we monkey-patch
   * the turnstile API to intercept tokens, and also poll the hidden
   * input/textarea that Turnstile populates.
   */
  async inject() {
    await this.page.evaluate(() => {
      window.__botToken = null;
      window.__botTokenTime = 0;
      window.__botSolveCount = 0;

      // Method 1: Poll for Turnstile's hidden response input
      // Turnstile writes the token to an input[name="cf-turnstile-response"]
      // or a textarea inside the widget iframe. We poll for it.
      setInterval(() => {
        // Check for response input (rendered mode)
        const input = document.querySelector('input[name="cf-turnstile-response"]');
        if (input && input.value && input.value !== window.__botToken) {
          window.__botToken = input.value;
          window.__botTokenTime = Date.now();
          window.__botSolveCount++;
        }
        // Also check any textarea (some Turnstile versions)
        const ta = document.querySelector('textarea[name="cf-turnstile-response"]');
        if (ta && ta.value && ta.value !== window.__botToken) {
          window.__botToken = ta.value;
          window.__botTokenTime = Date.now();
          window.__botSolveCount++;
        }
      }, 500);

      // Method 2: Intercept the global turnstile callback if the app
      // stores the token somewhere we can read
      const origFetch = window.fetch;
      window.fetch = function(...args) {
        // Sniff outgoing POST requests to the clickstr API for turnstileToken
        if (args[1]?.method === 'POST' && args[1]?.body) {
          try {
            const body = JSON.parse(args[1].body);
            if (body.turnstileToken) {
              window.__botToken = body.turnstileToken;
              window.__botTokenTime = Date.now();
              window.__botSolveCount++;
            }
          } catch {}
        }
        return origFetch.apply(this, args);
      };
    });
  }

  async waitForToken(timeoutMs = 30_000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const token = await this.page.evaluate(() => window.__botToken);
      if (token) {
        this.lastTokenTime = Date.now();
        return token;
      }
      await new Promise(r => setTimeout(r, 500));
    }
    return null;
  }

  async getToken() {
    // If token is stale (>4 min), reset the widget and re-solve
    const age = Date.now() - this.lastTokenTime;
    if (age > TOKEN_REFRESH_MS) {
      console.log('  [turnstile] Token stale, resetting widget...');
      await this.page.evaluate(() => {
        window.__botToken = null;
        if (typeof turnstile !== 'undefined') {
          turnstile.reset();
        }
      });
      return await this.waitForToken();
    }

    const token = await this.page.evaluate(() => window.__botToken);
    return token;
  }

  async forceRefresh() {
    console.log('  [turnstile] Forcing refresh after 403...');
    await this.page.evaluate(() => {
      window.__botToken = null;
      if (typeof turnstile !== 'undefined') {
        turnstile.reset();
      }
    });
    return await this.waitForToken();
  }

  async debugStatus() {
    return await this.page.evaluate(() => {
      const input = document.querySelector('input[name="cf-turnstile-response"]');
      const iframe = document.querySelector('iframe[src*="turnstile"]');
      const widget = document.querySelector('.cf-turnstile');
      return {
        hasInput: !!input,
        inputValue: input?.value?.slice(0, 20) ?? null,
        hasIframe: !!iframe,
        hasWidget: !!widget,
        botToken: window.__botToken?.slice(0, 20) ?? null,
        solveCount: window.__botSolveCount,
      };
    });
  }
}

// ── Main ──────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs();
  if (!args.address) {
    console.error('error: --address is required');
    process.exit(1);
  }

  const batchSize = args.batchSize || BATCH_SIZE;
  const maxBatches = args.batches || Infinity;
  const headless = !args.visible;

  console.log('=== Clickstr V2 Headless Bot — Level 2 Attack ===');
  console.log(`  address:    ${args.address}`);
  console.log(`  chain:      Sepolia (${CHAIN_ID})`);
  console.log(`  batch size: ${batchSize}`);
  console.log(`  batches:    ${maxBatches === Infinity ? 'unlimited (Ctrl+C to stop)' : maxBatches}`);
  console.log(`  headless:   ${headless}`);
  console.log('');

  // Launch browser
  console.log('[1] Launching browser...');
  const browser = await puppeteer.launch({
    headless: headless ? 'new' : false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,720',
      // Try to look more like a real browser
      '--disable-extensions-except=',
      '--enable-features=NetworkService,NetworkServiceInProcess',
    ],
    // Skip default DevTools protocol flags that leak automation
    ignoreDefaultArgs: ['--enable-automation'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  );

  // Navigate to the live site (for domain context — Turnstile validates origin)
  console.log(`[2] Loading ${SITE_URL}...`);
  await page.goto(SITE_URL, { waitUntil: 'networkidle2', timeout: 30_000 });

  // Dismiss the welcome modal if present
  console.log('[3] Dismissing welcome modal...');
  try {
    await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button')];
      const gotIt = buttons.find(b => b.textContent?.trim().toUpperCase().includes('GOT IT'));
      if (gotIt) gotIt.click();
    });
    await new Promise(r => setTimeout(r, 1000));
    console.log('  done');
  } catch {
    console.log('  no modal found, continuing');
  }

  // Inject token capture hooks
  const turnstile = new TurnstileManager(page);
  await turnstile.inject();

  // Programmatically render a Turnstile widget on the page
  // An attacker knows the site key (it's in the public JS bundle)
  // and can render the widget themselves on the legitimate domain
  console.log('[4] Injecting Turnstile widget...');
  await page.evaluate((sitekey) => {
    // Create a container for our widget
    const div = document.createElement('div');
    div.id = 'bot-turnstile';
    document.body.appendChild(div);

    // Wait for the Turnstile API to load (it's already in the page's scripts)
    function tryRender() {
      if (typeof turnstile !== 'undefined') {
        turnstile.render('#bot-turnstile', {
          sitekey,
          callback: (token) => {
            window.__botToken = token;
            window.__botTokenTime = Date.now();
            window.__botSolveCount++;
          },
          'expired-callback': () => {
            window.__botToken = null;
          },
        });
      } else {
        setTimeout(tryRender, 500);
      }
    }
    tryRender();
  }, '0x4AAAAAACV0UOMmCeG_g2Jr');

  // Debug
  await new Promise(r => setTimeout(r, 2000));
  console.log('[5] Checking Turnstile status...');
  const status = await turnstile.debugStatus();
  console.log('  debug:', JSON.stringify(status));

  // Wait for Turnstile to solve
  console.log('[6] Waiting for Turnstile to solve (60s timeout)...');
  const initialToken = await turnstile.waitForToken(60_000);
  if (!initialToken) {
    const finalStatus = await turnstile.debugStatus();
    console.error('  FAILED: Turnstile did not solve within 60s.');
    console.error('  final debug:', JSON.stringify(finalStatus));

    // Take screenshot for analysis
    await page.screenshot({ path: '/tmp/turnstile-fail.png', fullPage: true });
    console.log('  screenshot saved to /tmp/turnstile-fail.png');

    // Check if Turnstile rendered at all vs detected bot
    if (!finalStatus.hasIframe && !finalStatus.hasWidget) {
      console.log('\nVERDICT: Turnstile API never loaded. The site may block script injection.');
    } else {
      console.log('\nVERDICT: Headless browser was DETECTED by Turnstile. Attack blocked at token acquisition.');
    }

    await browser.close();
    process.exit(1);
  }

  const solveCount = await page.evaluate(() => window.__botSolveCount);
  console.log(`  Turnstile solved! (solve #${solveCount}, token: ${initialToken.slice(0, 25)}...)`);
  console.log('');

  // Fetch difficulty
  console.log('[5] Fetching difficulty...');
  const diff = await fetchDifficulty();
  if (!diff.success) {
    console.error('  failed:', diff);
    await browser.close();
    server.close();
    process.exit(1);
  }
  console.log(`  epoch: ${diff.epoch}, difficulty: ${diff.difficultyTarget.slice(0, 20)}...`);
  console.log(`  target clicks/epoch: ${diff.targetClicksPerEpoch?.toLocaleString() ?? '?'}`);
  console.log('');

  // Pre-run stats
  const preStats = await fetchStats(args.address);
  const preClicks = preStats?.lifetimeClicks ?? preStats?.totalClicks ?? 0;
  console.log(`[6] Clicks before: ${preClicks.toLocaleString()}`);
  console.log('');

  // Main loop
  let totalAccepted = 0;
  let totalRejected = 0;
  let turnstileRefreshes = 0;
  let turnstileFailures = 0;
  let batchNum = 0;
  const loopStart = Date.now();

  for (batchNum = 1; batchNum <= maxBatches; batchNum++) {
    console.log(`[batch ${batchNum}] Mining ${batchSize} nonces...`);

    // Refresh difficulty every 10 batches
    if (batchNum > 1 && batchNum % 10 === 1) {
      const newDiff = await fetchDifficulty();
      if (newDiff.success && newDiff.difficultyTarget) {
        if (newDiff.epoch !== diff.epoch) {
          console.log(`  epoch changed: ${diff.epoch} -> ${newDiff.epoch}`);
          diff.epoch = newDiff.epoch;
        }
        diff.difficultyTarget = newDiff.difficultyTarget;
      }
    }

    const nonces = mineNonces(args.address, diff.epoch, diff.difficultyTarget, batchSize);

    // Get a fresh-ish Turnstile token
    let token = await turnstile.getToken();
    if (!token) {
      console.log('  [turnstile] No token available, waiting...');
      token = await turnstile.waitForToken(30_000);
      if (!token) {
        console.error('  FAILED: Could not get Turnstile token. Stopping.');
        break;
      }
    }

    console.log(`  submitting with token (age: ${((Date.now() - turnstile.lastTokenTime) / 1000).toFixed(0)}s)...`);
    const result = await submitNonces(args.address, nonces, token);

    if (result.status === 403) {
      console.log(`  !! 403 — ${JSON.stringify(result.data)}`);
      turnstileRefreshes++;

      // Force a fresh token
      const newToken = await turnstile.forceRefresh();
      if (!newToken) {
        turnstileFailures++;
        if (turnstileFailures >= 3) {
          console.log('  !!! 3 consecutive Turnstile refresh failures. Stopping.');
          break;
        }
        continue;
      }
      turnstileFailures = 0;

      // Retry with fresh token
      console.log('  retrying with fresh token...');
      const retry = await submitNonces(args.address, nonces, newToken);
      if (retry.status === 403) {
        console.log(`  !! still 403 after refresh: ${JSON.stringify(retry.data)}`);
        turnstileFailures++;
        continue;
      }
      // Process retry result
      if (retry.data.success) {
        const accepted = retry.data.acceptedNonces ?? retry.data.accepted ?? nonces.length;
        totalAccepted += accepted;
        console.log(`  OK (after refresh) — accepted: ${accepted}, total: ${retry.data.totalClicks ?? '?'}`);
      }
      continue;
    }

    turnstileFailures = 0;

    if (result.data.success) {
      const accepted = result.data.acceptedNonces ?? result.data.accepted ?? nonces.length;
      const rejected = result.data.rejectedNonces ?? result.data.rejected ?? 0;
      totalAccepted += accepted;
      totalRejected += rejected;
      console.log(`  OK — accepted: ${accepted}, rejected: ${rejected}, total: ${result.data.totalClicks ?? '?'}`);
    } else {
      console.log(`  FAILED: ${JSON.stringify(result.data)}`);
      totalRejected += nonces.length;
    }

    const elapsed = ((Date.now() - loopStart) / 1000).toFixed(0);
    const rate = (totalAccepted / (elapsed / 60)).toFixed(1);
    console.log(`  [running] ${totalAccepted} accepted / ${totalRejected} rejected / ${elapsed}s / ~${rate} clicks/min`);
    console.log('');
  }

  // Final report
  const totalElapsed = ((Date.now() - loopStart) / 1000).toFixed(1);
  const postStats = await fetchStats(args.address);
  const postClicks = postStats?.lifetimeClicks ?? postStats?.totalClicks ?? 0;

  console.log('=== FINAL REPORT ===');
  console.log(`  batches attempted:    ${batchNum - 1}`);
  console.log(`  accepted:             ${totalAccepted}`);
  console.log(`  rejected:             ${totalRejected}`);
  console.log(`  turnstile refreshes:  ${turnstileRefreshes}`);
  console.log(`  turnstile failures:   ${turnstileFailures}`);
  console.log(`  total time:           ${totalElapsed}s`);
  console.log(`  click rate:           ${(totalAccepted / (totalElapsed / 60)).toFixed(1)} clicks/min`);
  console.log(`  clicks before:        ${preClicks.toLocaleString()}`);
  console.log(`  clicks after:         ${postClicks.toLocaleString()}`);
  console.log(`  delta:                ${(postClicks - preClicks).toLocaleString()}`);
  console.log('');

  if (totalAccepted > 0) {
    console.log('VERDICT: HEADLESS BOT SUCCEEDED. Turnstile did NOT detect the automated browser.');
    console.log(`         ${totalAccepted} fake clicks injected at ${(totalAccepted / (totalElapsed / 60)).toFixed(1)} clicks/min.`);
    console.log('         This is a critical vulnerability — the Turnstile + PoW defense is bypassable.');
  } else if (turnstileRefreshes > 0 && turnstileFailures === 0) {
    console.log('VERDICT: Turnstile tokens expired but were successfully refreshed.');
    console.log('         The bot was blocked by server-side validation, not Turnstile itself.');
  } else {
    console.log('VERDICT: Bot was BLOCKED. Either Turnstile detected headless, or server rejected all clicks.');
  }

  await browser.close();
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
