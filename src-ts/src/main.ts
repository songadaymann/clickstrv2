/**
 * Stupid Clicker - Main Entry Point
 *
 * This is the TypeScript refactored version of the game.
 * All functionality from the original index.html has been modularized.
 */

// Import styles
import './styles/main.css';

// Import state
import { gameState } from './state/index.ts';

// Import types
import type { MinedNonce } from './types/index.ts';

// Import config
import { CONFIG, hasNftContract, getCurrentGame, getAllGames, type GameConfig } from './config/index.ts';

// V2 is now the primary mode (off-chain validation + on-chain settlement)
const IS_V2 = true;

// Import services
import {
  disconnect,
  initializeContracts,
  refreshGameData,
  refreshUserStats,
  submitClicks,
  fetchServerStats,
  checkVerificationStatus,
  recordClicksToServer,
  recordOnChainSubmission,
  fetchGlobalLeaderboard,
  fetchGameLeaderboard,
  fetchMatrixLeaderboard,
  fetchRewardParams,
  startMining,
  terminateMining,
  sendHeartbeat,
  sendHeartbeatV2,
  fetchActiveUsers,
  fetchActiveUsersV2,
  fetchV2Leaderboard,
  type V2LeaderboardType,
  syncAchievements,
  lookupEns,
  getCachedEns,
  initWalletSubscriptions,
  openConnectModal,
  getSigner,
  requestV2ClaimSignature,
  submitClicksV2,
  fetchV2Stats,
  preloadSha3,
  configureMiningAuth,
  finalizeElapsedEpochs,
  getUnfinalizedEpochCount,
} from './services/index.ts';

// Import effects
import {
  initConfetti,
  initDisco,
  initParticles,
  initCursor,
  preloadSounds,
  playButtonDown,
  playButtonUp,
  playCashMachineSound,
  celebratePersonalMilestone,
  celebrateGlobalMilestone,
  applyCursor,
  resetCursor,
  getEquippedCursorName,
  showTemporaryCursor,
  clearTemporaryCursor,
} from './effects/index.ts';

// Import utilities
import {
  getElement,
  getElementOrNull,
  addClass,
  removeClass,
  toggleClass,
  escapeHtml,
  setText,
  setHtml,
  formatNumber,
  formatTokens,
  formatTokensSplit,
  formatWeiAsTokens,
  formatWeiSplit,
  shortenAddress,
} from './utils/index.ts';

// Import milestones and collection
import {
  getHighestMilestone,
  getMilestoneInfo,
  isGlobalMilestone,
  findSlotByTier,
  MILESTONE_ID_TO_TIER,
  COLLECTION_SLOTS,
  GLOBAL_ONE_OF_ONE_TIERS,
} from './config/index.ts';

// Import contract services for NFT claiming and V2 token claiming
import {
  checkNftClaimed,
  claimNft,
  getClaimSignature,
  confirmClaim,
  fetchV2ClaimableEpochs,
  claimV2Reward,
  getV2ClaimedClicks,
} from './services/index.ts';

import type {
  MergedLeaderboardEntry,
  MatrixLeaderboardEntry,
  UnlockedAchievement,
  ClaimState,
  ServerStatsResponse,
  V2ClaimSignatureResponse,
  V2ClaimableEpoch,
} from './types/index.ts';

// ============ DOM Elements ============
let buttonImg: HTMLImageElement;
let buttonClickZone: HTMLElement;
let connectBtn: HTMLButtonElement;
let submitBtn: HTMLButtonElement;
let submitContainer: HTMLElement;
let claimBtn: HTMLButtonElement;
let claimContainer: HTMLElement;
let epochInfoEl: HTMLElement;
let poolInfoEl: HTMLElement;
let headerAlltimeClicksEl: HTMLElement;
let headerAlltimeSuffixEl: HTMLElement;
let alltimeToggleEl: HTMLElement;
let alltimeLabelEl: HTMLElement;
let arcadeCurrentEl: HTMLElement;
let arcadeAlltimeEl: HTMLElement;
let arcadeEarnedEl: HTMLElement;
let leaderboardPanel: HTMLElement;
let leaderboardListEl: HTMLElement;
// walletModal removed - AppKit handles wallet modal
let helpModal: HTMLElement;
let welcomeModal: HTMLElement;
let claimModal: HTMLElement;
let collectionModal: HTMLElement;
let rankingsModal: HTMLElement;
let v2ClaimModal: HTMLElement;
let v2ClaimList: HTMLElement;
let v2ClaimAllBtn: HTMLButtonElement;
let imageLightbox: HTMLElement;
let achievementToast: HTMLElement;
let achievementNameEl: HTMLElement;
let achievementDescEl: HTMLElement;
let turnstileModal: HTMLElement;

// Global stats panel elements
let activeHumansEl: HTMLElement;
let gameStatusEl: HTMLElement;
let difficultyDisplayEl: HTMLElement;
let rewardPerClickEl: HTMLElement;
let epochCountdownEl: HTMLElement;

// ============ Local State ============
let isPressed = false;
let isMiningClick = false;
let turnstileToken: string | null = null;
let turnstileWidgetId: string | null = null;
let leaderboardData: MergedLeaderboardEntry[] = [];
let claimedOnChain: Set<number> = new Set();
let unlockedTiers: Set<number> = new Set();
let serverStats: ServerStatsResponse | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let leaderboardMode: V2LeaderboardType = 'epoch';
let currentGame: GameConfig | undefined;
let targetClicksPerEpoch: bigint = 0n;
let epochBudget: bigint = 0n;
let epochBudgetUsed: bigint = 0n;
let epochClaimedClicks: bigint = 0n;
let v2ClaimableEpochs: V2ClaimableEpoch[] = [];
let v2IsClaimingInProgress = false;
let deferMintModal = false; // true while claim flow is in progress, prevents mint modal from interrupting wallet prompts
let deferredClaimables: ClaimState[] = []; // achievements queued during claim flow, shown after completion
let isAutoSubmitting = false; // guard against concurrent auto-submits
let alltimeShowEarned = false; // toggle: false = clicks, true = earned
let cachedGlobalEarned: string = '0'; // wei string from server

// Additional DOM elements for NFT/Collection
let nftPanel: HTMLElement;
let nftList: HTMLElement;
let streakStat: HTMLElement;
let streakCurrentEl: HTMLElement;
let collectionGrid: HTMLElement;
let trophySection: HTMLElement;
let trophyTitle: HTMLElement;
let trophyGrid: HTMLElement;
let equippedCursorName: HTMLElement;
let claimNftBtn: HTMLButtonElement;
let claimLaterBtn: HTMLButtonElement;

// Leaderboard toggle elements
let leaderboardToggleEpoch: HTMLButtonElement;
let leaderboardToggleAlltime: HTMLButtonElement;
let leaderboardToggleEarned: HTMLButtonElement;
let leaderboardToggleBots: HTMLButtonElement;

// Rankings modal elements
let rankingsTabsEl: HTMLElement;
let rankingsListEl: HTMLElement;
let rankingsMatrixHeaderEl: HTMLElement;
let rankingsTab = 'epoch'; // V2: 'epoch'|'alltime'|'earned', V1: 'global' or game id

// Finalize epochs elements
let finalizeBanner: HTMLElement;
let finalizeBtn: HTMLButtonElement;
let finalizeCountEl: HTMLElement;

// Lightbox elements
let lightboxImage: HTMLImageElement;
let lightboxName: HTMLElement;
let lightboxClickNum: HTMLElement;

// ============ Preload Images ============
const imgUp = new Image();
const imgDown = new Image();
imgUp.src = 'button-up.jpg';
imgDown.src = 'button-down.jpg';

// ============ Initialization ============

/**
 * Initialize the application
 */
async function init(): Promise<void> {
  // Cache DOM elements
  cacheElements();

  // Initialize wallet subscriptions (must be early to catch connection events)
  initWalletSubscriptions();

  // Preload sha3 library for mining workers (fetched in main thread to avoid
  // Safari's importScripts restriction on blob workers with opaque origins)
  preloadSha3();

  configureMiningAuth({
    getTurnstileToken: () => turnstileToken,
    onVerificationRequired: () => {
      if (!turnstileModal.classList.contains('visible')) {
        showTurnstileModal();
      }
    },
  });

  // Initialize effects
  initEffects();

  // Initialize current game
  currentGame = getCurrentGame();

  // Set up event listeners
  setupEventListeners();

  // Start leaderboard updates
  startLeaderboardUpdates();

  // Start global stats updates (humans + bots clicking now)
  startGlobalStatsUpdates();

  // Subscribe to state changes
  gameState.subscribe(handleStateChange);

  console.log('[App] Initialized');
}

/**
 * Cache DOM element references
 */
function cacheElements(): void {
  buttonImg = getElement<HTMLImageElement>('button-img');
  buttonClickZone = getElement('button-click-zone');
  connectBtn = getElement<HTMLButtonElement>('connect-btn');
  submitBtn = getElement<HTMLButtonElement>('submit-btn');
  submitContainer = getElement('submit-container');
  claimBtn = getElement<HTMLButtonElement>('claim-btn');
  claimContainer = getElement('claim-container');
  epochInfoEl = getElement('epoch-info');
  poolInfoEl = getElement('pool-info');
  headerAlltimeClicksEl = getElement('header-alltime-clicks');
  headerAlltimeSuffixEl = getElement('header-alltime-suffix');
  alltimeToggleEl = getElement('alltime-toggle');
  alltimeLabelEl = getElement('alltime-label');
  arcadeCurrentEl = getElement('arcade-current');
  arcadeAlltimeEl = getElement('arcade-alltime');
  arcadeEarnedEl = getElement('arcade-earned');
  leaderboardPanel = getElement('leaderboard-panel');
  leaderboardListEl = getElement('leaderboard-list');
  // walletModal removed - AppKit handles wallet modal
  helpModal = getElement('help-modal');
  welcomeModal = getElement('welcome-modal');
  turnstileModal = getElement('turnstile-modal');
  claimModal = getElement('claim-modal');
  collectionModal = getElement('collection-modal');
  rankingsModal = getElement('rankings-modal');
  achievementToast = getElement('achievement-toast');
  achievementNameEl = getElement('achievement-name');
  achievementDescEl = getElement('achievement-desc');

  // NFT panel elements
  nftPanel = getElement('nft-panel');
  nftList = getElement('nft-list');

  // Streak stat elements (in bottom alltime stats)
  streakStat = getElement('streak-stat');
  streakCurrentEl = getElement('arcade-streak');

  // Collection modal elements
  collectionGrid = getElement('collection-grid');
  trophySection = getElement('trophy-section');
  trophyTitle = getElement('trophy-title');
  trophyGrid = getElement('trophy-grid');
  equippedCursorName = getElement('equipped-cursor-name');

  // Claim modal buttons
  claimNftBtn = getElement<HTMLButtonElement>('claim-nft-btn');
  claimLaterBtn = getElement<HTMLButtonElement>('claim-later-btn');

  // V2 claim modal elements
  v2ClaimModal = getElement('v2-claim-modal');
  v2ClaimList = getElement('v2-claim-list');
  v2ClaimAllBtn = getElement<HTMLButtonElement>('v2-claim-all-btn');

  // Global stats panel elements
  activeHumansEl = getElement('active-humans');
  gameStatusEl = getElement('game-status');
  difficultyDisplayEl = getElement('difficulty-display');
  rewardPerClickEl = getElement('reward-per-click');
  epochCountdownEl = getElement('epoch-countdown');

  // Leaderboard toggle elements
  leaderboardToggleEpoch = getElement<HTMLButtonElement>('leaderboard-toggle-epoch');
  leaderboardToggleAlltime = getElement<HTMLButtonElement>('leaderboard-toggle-alltime');
  leaderboardToggleEarned = getElement<HTMLButtonElement>('leaderboard-toggle-earned');
  leaderboardToggleBots = getElement<HTMLButtonElement>('leaderboard-toggle-bots');

  // Rankings modal elements
  rankingsTabsEl = getElement('rankings-tabs');
  rankingsListEl = getElement('rankings-list');
  rankingsMatrixHeaderEl = getElement('rankings-matrix-header');

  // Finalize epochs elements
  finalizeBanner = getElement('finalize-banner');
  finalizeBtn = getElement<HTMLButtonElement>('finalize-btn');
  finalizeCountEl = getElement('finalize-count');

  // Lightbox elements
  imageLightbox = getElement('image-lightbox');
  lightboxImage = getElement<HTMLImageElement>('lightbox-image');
  lightboxName = getElement('lightbox-name');
  lightboxClickNum = getElement('lightbox-click-num');
}

/**
 * Initialize all effects
 */
function initEffects(): void {
  // Preload sounds
  preloadSounds();

  // Initialize confetti
  const confettiCanvas = getElementOrNull<HTMLCanvasElement>('confetti-canvas');
  if (confettiCanvas) {
    initConfetti(confettiCanvas);
  }

  // Initialize disco overlay
  const discoOverlay = getElementOrNull('disco-overlay');
  if (discoOverlay) {
    initDisco(discoOverlay);
  }

  // Initialize particles
  const particleContainer = getElementOrNull('cursor-particles');
  if (particleContainer) {
    initParticles(particleContainer);
  }

  // Initialize custom cursor
  const cursorElement = getElementOrNull('custom-cursor');
  if (cursorElement) {
    initCursor(cursorElement);
  }
}

/**
 * Set up all event listeners
 */
function setupEventListeners(): void {
  // Button click events
  buttonClickZone.addEventListener('mousedown', (e) => {
    e.preventDefault();
    pressDown();
  });
  buttonClickZone.addEventListener('mouseup', pressUp);
  buttonClickZone.addEventListener('mouseleave', pressUp);
  buttonClickZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    pressDown();
  });
  buttonClickZone.addEventListener('touchend', pressUp);
  buttonClickZone.addEventListener('touchcancel', pressUp);
  buttonClickZone.addEventListener('contextmenu', (e) => e.preventDefault());

  // Connect button - opens AppKit modal
  connectBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (gameState.isConnected) {
      handleDisconnect();
    } else {
      openConnectModal();
    }
  });

  // Legacy wallet modal listeners removed - AppKit handles its own modal

  // Submit button (V1)
  submitBtn.addEventListener('click', handleSubmit);

  // Claim button (V2) - glowing green, full claim flow
  claimBtn.addEventListener('click', handleV2Claim);

  // All-Time header toggle (clicks <-> earned)
  alltimeToggleEl.addEventListener('click', () => {
    alltimeShowEarned = !alltimeShowEarned;
    refreshAlltimeDisplay();
  });

  // Copy address button
  setupCopyAddressButton();

  // Help modal
  setupHelpModalListeners();

  // Welcome modal (first visit)
  setupWelcomeModalListeners();

  // Mobile menu
  setupMobileMenuListeners();

  // Collection modal
  setupCollectionModalListeners();

  // Claim modal
  setupClaimModalListeners();

  // V2 token claim modal
  setupV2ClaimModalListeners();

  // UI visibility based on mouse position
  setupUIVisibility();

  // Leaderboard toggle
  leaderboardToggleEpoch.addEventListener('click', () => setLeaderboardMode('epoch'));
  leaderboardToggleAlltime.addEventListener('click', () => setLeaderboardMode('alltime'));
  leaderboardToggleEarned.addEventListener('click', () => setLeaderboardMode('earned'));
  leaderboardToggleBots.addEventListener('click', () => setLeaderboardMode('bots'));

  // Lightbox
  setupLightboxListeners();
}

// Wallet modal setup removed - AppKit provides its own modal UI

/** Token contract address for copying */
const TOKEN_ADDRESS = CONFIG.tokenAddress;

/**
 * Set up copy address button(s)
 */
function setupCopyAddressButton(): void {
  const copyBtn = getElementOrNull('copy-address-btn');
  const mobileCopyBtn = getElementOrNull('mobile-menu-copy');

  const handleCopy = async (btn: HTMLElement) => {
    try {
      await navigator.clipboard.writeText(TOKEN_ADDRESS);

      // Visual feedback
      btn.classList.add('copied');
      btn.innerHTML = '&#x2713;'; // Checkmark

      // Show toast
      showAchievementToast('Copied!', 'Token address copied to clipboard');

      // Reset after 2 seconds
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = '&#x2398;'; // Back to copy icon
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  copyBtn?.addEventListener('click', () => handleCopy(copyBtn));
  mobileCopyBtn?.addEventListener('click', () => handleCopy(mobileCopyBtn));
}

/**
 * Set up help modal event listeners
 */
function setupHelpModalListeners(): void {
  const helpBtn = getElementOrNull('help-btn');
  const helpCloseBtn = getElementOrNull('help-close-btn');

  helpBtn?.addEventListener('click', () => showModal(helpModal));
  helpCloseBtn?.addEventListener('click', () => hideModal(helpModal));
  helpModal?.addEventListener('click', (e) => {
    if (e.target === helpModal) hideModal(helpModal);
  });
}

/** Cursor to show during welcome modal - a fun teaser */
const WELCOME_CURSOR = 'gold-sparkle';

/**
 * Set up welcome modal (first visit) event listeners
 */
function setupWelcomeModalListeners(): void {
  const welcomeBtn = getElementOrNull('welcome-btn');

  welcomeBtn?.addEventListener('click', () => {
    hideWelcomeModal();
  });

  // Also close on backdrop click
  welcomeModal?.addEventListener('click', (e) => {
    if (e.target === welcomeModal) {
      hideWelcomeModal();
    }
  });

  // Show on first visit
  checkFirstVisit();
}

/**
 * Hide welcome modal and restore default cursor
 */
function hideWelcomeModal(): void {
  hideModal(welcomeModal);
  clearTemporaryCursor();
  localStorage.setItem('clickstr-welcome-seen', 'true');
}

/**
 * Check if this is the user's first visit and show welcome modal
 */
function checkFirstVisit(): void {
  const hasSeenWelcome = localStorage.getItem('clickstr-welcome-seen');
  if (!hasSeenWelcome) {
    // Small delay to let the page load first
    setTimeout(() => {
      showTemporaryCursor(WELCOME_CURSOR);
      showModal(welcomeModal);
    }, 500);
  }
}

/**
 * Set up mobile menu event listeners
 */
function setupMobileMenuListeners(): void {
  const menuBtn = getElementOrNull('mobile-menu-btn');
  const menu = getElementOrNull('mobile-menu');
  const backdrop = getElementOrNull('mobile-menu-backdrop');

  const openMenu = (): void => {
    menuBtn?.classList.add('open');
    menu?.classList.add('open');
    backdrop?.classList.add('open');
    // Update wallet text when menu opens
    updateMobileWalletText();
  };

  const closeMenu = (): void => {
    menuBtn?.classList.remove('open');
    menu?.classList.remove('open');
    backdrop?.classList.remove('open');
  };

  menuBtn?.addEventListener('click', () => {
    if (menu?.classList.contains('open')) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  backdrop?.addEventListener('click', closeMenu);

  // Menu items
  getElementOrNull('mobile-menu-wallet')?.addEventListener('click', () => {
    closeMenu();
    if (gameState.isConnected) {
      handleDisconnect();
    } else {
      openConnectModal();
    }
  });

  getElementOrNull('mobile-menu-rewards')?.addEventListener('click', () => {
    closeMenu();
    showCollectionModal();
  });

  getElementOrNull('mobile-menu-leaderboard')?.addEventListener('click', () => {
    closeMenu();
    showRankingsModal();
  });

  getElementOrNull('mobile-menu-about')?.addEventListener('click', () => {
    closeMenu();
    showModal(helpModal);
  });
}

/**
 * Update mobile menu wallet text based on connection state
 */
function updateMobileWalletText(): void {
  const walletText = getElementOrNull('mobile-menu-wallet-text');
  if (!walletText) return;

  if (gameState.isConnected && gameState.userAddress) {
    setText(walletText, shortenAddress(gameState.userAddress));
  } else {
    setText(walletText, 'Connect Wallet');
  }
}

/**
 * Set up collection modal event listeners
 */
function setupCollectionModalListeners(): void {
  const seeCollectionBtn = getElementOrNull('see-collection-btn');
  const collectionCloseBtn = getElementOrNull('collection-close-btn');
  const resetCursorBtn = getElementOrNull('reset-cursor-btn');
  const seeRankingsBtn = getElementOrNull('see-rankings-btn');
  const rankingsCloseBtn = getElementOrNull('rankings-close-btn');

  seeCollectionBtn?.addEventListener('click', showCollectionModal);
  collectionCloseBtn?.addEventListener('click', () => hideModal(collectionModal));
  collectionModal?.addEventListener('click', (e) => {
    if (e.target === collectionModal) hideModal(collectionModal);
  });

  // Sync achievements button
  const syncAchievementsBtn = getElementOrNull<HTMLButtonElement>('sync-achievements-btn');
  syncAchievementsBtn?.addEventListener('click', handleSyncAchievements);

  resetCursorBtn?.addEventListener('click', () => {
    resetCursor();
    setText(equippedCursorName, 'Default');
    renderCollectionGrid();
    showAchievementToast('Cursor Reset', 'Using default cursor');
  });

  // Rankings modal
  seeRankingsBtn?.addEventListener('click', showRankingsModal);
  rankingsCloseBtn?.addEventListener('click', () => hideModal(rankingsModal));
  rankingsModal?.addEventListener('click', (e) => {
    if (e.target === rankingsModal) hideModal(rankingsModal);
  });
}

/**
 * Set up claim modal event listeners
 */
function setupClaimModalListeners(): void {
  claimNftBtn?.addEventListener('click', handleClaimNft);
  claimLaterBtn?.addEventListener('click', () => hideModal(claimModal));
  document.getElementById('claim-close-btn')?.addEventListener('click', () => hideModal(claimModal));
  claimModal?.addEventListener('click', (e) => {
    if (e.target === claimModal) hideModal(claimModal);
  });
}

/**
 * Set up V2 token claim modal event listeners
 */
function setupV2ClaimModalListeners(): void {
  // Close button
  const closeBtn = getElementOrNull('v2-claim-close-btn');
  closeBtn?.addEventListener('click', () => hideModal(v2ClaimModal));

  // Click backdrop to close
  v2ClaimModal?.addEventListener('click', (e) => {
    if (e.target === v2ClaimModal) hideModal(v2ClaimModal);
  });

  // Claim All button
  v2ClaimAllBtn?.addEventListener('click', handleV2ClaimAll);
}

/**
 * Show V2 claim modal and load claimable epochs
 * Exported for potential future use - currently claim is triggered directly from submit button
 */
export async function showV2ClaimModal(): Promise<void> {
  if (!gameState.userAddress) {
    console.warn('[V2 Claim] Wallet not connected');
    return;
  }

  showModal(v2ClaimModal);
  setHtml(v2ClaimList, '<li class="v2-claim-loading">Loading claimable epochs...</li>');
  v2ClaimAllBtn.disabled = true;

  // Fetch claimable epochs from API
  const response = await fetchV2ClaimableEpochs(gameState.userAddress);

  if (!response.success || !response.claimableEpochs) {
    setHtml(v2ClaimList, '<li class="v2-claim-empty">No claimable epochs found</li>');
    return;
  }

  v2ClaimableEpochs = response.claimableEpochs.filter(e => !e.claimed && e.clicks > 0);

  if (v2ClaimableEpochs.length === 0) {
    setHtml(v2ClaimList, '<li class="v2-claim-empty">No unclaimed epochs</li>');
    return;
  }

  // Render the list
  renderV2ClaimList();
}

/**
 * Render the V2 claimable epochs list
 */
function renderV2ClaimList(): void {
  if (v2ClaimableEpochs.length === 0) {
    setHtml(v2ClaimList, '<li class="v2-claim-empty">No unclaimed epochs</li>');
    v2ClaimAllBtn.disabled = true;
    return;
  }

  const items = v2ClaimableEpochs.map((epoch, idx) => {
    const reward = epoch.estimatedReward || '~';
    return `
      <li class="v2-claim-item" data-epoch="${epoch.epoch}">
        <span class="v2-claim-epoch">Epoch ${epoch.epoch}</span>
        <span class="v2-claim-clicks">${formatNumber(epoch.clicks)} clicks</span>
        <span class="v2-claim-reward">${reward}</span>
        <button class="v2-claim-item-btn" data-idx="${idx}">Claim</button>
      </li>
    `;
  }).join('');

  setHtml(v2ClaimList, items);
  v2ClaimAllBtn.disabled = v2ClaimableEpochs.length === 0;

  // Add click handlers to individual claim buttons
  v2ClaimList.querySelectorAll('.v2-claim-item-btn').forEach(btn => {
    btn.addEventListener('click', handleV2ClaimSingle);
  });
}

// ---- Multi-tab claim lock (localStorage) ----
const CLAIM_LOCK_KEY = 'clickstr_claim_lock';
const CLAIM_LOCK_TTL_MS = 120_000; // 2 minutes max

function acquireClaimLock(epoch: number): boolean {
  const raw = localStorage.getItem(CLAIM_LOCK_KEY);
  if (raw) {
    try {
      const lock = JSON.parse(raw) as { epoch: number; ts: number };
      if (Date.now() - lock.ts < CLAIM_LOCK_TTL_MS) {
        // Another tab holds a fresh lock
        return false;
      }
    } catch { /* stale or corrupt — ok to overwrite */ }
  }
  localStorage.setItem(CLAIM_LOCK_KEY, JSON.stringify({ epoch, ts: Date.now() }));
  return true;
}

function releaseClaimLock(): void {
  localStorage.removeItem(CLAIM_LOCK_KEY);
}

/**
 * Handle claiming a single epoch
 */
async function handleV2ClaimSingle(e: Event): Promise<void> {
  if (v2IsClaimingInProgress) return;

  const btn = e.target as HTMLButtonElement;
  const idx = parseInt(btn.dataset.idx || '0', 10);
  const epochData = v2ClaimableEpochs[idx];

  if (!epochData) return;

  // Multi-tab guard: prevent duplicate claims from another browser tab
  if (!acquireClaimLock(epochData.epoch)) {
    btn.textContent = 'Busy';
    setTimeout(() => { btn.textContent = 'Claim'; }, 2000);
    return;
  }

  btn.disabled = true;
  btn.textContent = '...';
  v2IsClaimingInProgress = true;

  try {
    // Get attestation signature
    const attestation = await requestV2ClaimAttestation(epochData.epoch);

    if (attestation.error || !attestation.signature || !attestation.contractAddress) {
      console.error('[V2 Claim] Attestation error:', attestation.error || 'Missing data');
      btn.textContent = 'Error';
      setTimeout(() => {
        btn.textContent = 'Claim';
        btn.disabled = false;
      }, 2000);
      v2IsClaimingInProgress = false;
      releaseClaimLock();
      return;
    }

    // Call contract
    const receipt = await claimV2Reward(
      attestation.contractAddress,
      attestation.epoch!,
      attestation.clickCount!,
      attestation.signature
    );

    console.log('[V2 Claim] Success:', receipt.transactionHash);

    // Update UI - mark as claimed
    const listItem = btn.closest('.v2-claim-item');
    if (listItem) {
      listItem.innerHTML = `
        <span class="v2-claim-epoch">Epoch ${epochData.epoch}</span>
        <span class="v2-claim-clicks">${formatNumber(epochData.clicks)} clicks</span>
        <span class="v2-claim-item-claimed">Claimed!</span>
      `;
    }

    // Remove from list
    v2ClaimableEpochs = v2ClaimableEpochs.filter(e => e.epoch !== epochData.epoch);
    v2ClaimAllBtn.disabled = v2ClaimableEpochs.length === 0;

    // Refresh user stats
    refreshUserStats();

  } catch (error) {
    console.error('[V2 Claim] Transaction error:', error);
    btn.textContent = 'Failed';
    setTimeout(() => {
      btn.textContent = 'Claim';
      btn.disabled = false;
    }, 2000);
  } finally {
    v2IsClaimingInProgress = false;
    releaseClaimLock();
  }
}

/**
 * Handle claiming all epochs
 */
async function handleV2ClaimAll(): Promise<void> {
  if (v2IsClaimingInProgress || v2ClaimableEpochs.length === 0) return;

  // Multi-tab guard
  if (!acquireClaimLock(-1)) {
    v2ClaimAllBtn.textContent = 'Busy';
    setTimeout(() => { v2ClaimAllBtn.textContent = 'Claim All'; }, 2000);
    return;
  }

  v2ClaimAllBtn.disabled = true;
  v2ClaimAllBtn.textContent = 'Claiming...';
  v2IsClaimingInProgress = true;

  // For now, claim one at a time (could batch later)
  for (const epoch of [...v2ClaimableEpochs]) {
    try {
      const attestation = await requestV2ClaimAttestation(epoch.epoch);

      if (attestation.error || !attestation.signature || !attestation.contractAddress) {
        console.error(`[V2 Claim] Attestation error for epoch ${epoch.epoch}:`, attestation.error);
        continue;
      }

      await claimV2Reward(
        attestation.contractAddress,
        attestation.epoch!,
        attestation.clickCount!,
        attestation.signature
      );

      // Remove from list
      v2ClaimableEpochs = v2ClaimableEpochs.filter(e => e.epoch !== epoch.epoch);

    } catch (error) {
      console.error(`[V2 Claim] Error claiming epoch ${epoch.epoch}:`, error);
    }
  }

  // Refresh the list
  renderV2ClaimList();
  v2ClaimAllBtn.textContent = 'Claim All';
  v2ClaimAllBtn.disabled = v2ClaimableEpochs.length === 0;

  // Refresh user stats
  refreshUserStats();
  v2IsClaimingInProgress = false;
  releaseClaimLock();
}

/**
 * Set up lightbox event listeners
 */
function setupLightboxListeners(): void {
  const lightboxCloseBtn = getElementOrNull('lightbox-close-btn');

  lightboxCloseBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    hideModal(imageLightbox);
  });

  // Click on backdrop to close
  imageLightbox?.addEventListener('click', (e) => {
    if (e.target === imageLightbox) {
      hideModal(imageLightbox);
    }
  });

  // Prevent clicks on the content from closing
  const lightboxContent = imageLightbox?.querySelector('.lightbox-content');
  lightboxContent?.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

/**
 * Show an image in the lightbox modal
 */
function showImageLightbox(imageSrc: string, name: string, clickNum?: string): void {
  lightboxImage.src = imageSrc;
  setText(lightboxName, name);
  setText(lightboxClickNum, clickNum || '');
  showModal(imageLightbox);
}

/**
 * Set up UI visibility based on mouse/touch position
 */
function setupUIVisibility(): void {
  const uiOverlay = getElementOrNull('ui-overlay');
  if (!uiOverlay) return;

  const EDGE_MARGIN = 400;

  // Check if touch device
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // On mobile, always show UI overlay (don't hide it)
  if (isTouchDevice) {
    removeClass(uiOverlay, 'hidden');
    return;
  }

  // Desktop: show UI when near edges
  document.addEventListener('mousemove', (e) => {
    const nearEdge =
      e.clientX < EDGE_MARGIN ||
      e.clientX > window.innerWidth - EDGE_MARGIN ||
      e.clientY < EDGE_MARGIN ||
      e.clientY > window.innerHeight - EDGE_MARGIN;

    toggleClass(uiOverlay, 'hidden', !nearEdge);
  });

  document.addEventListener('mouseleave', () => {
    removeClass(uiOverlay, 'hidden');
  });
}

// ============ Button Mechanics ============

/** Safety timeout for mining - prevents button from freezing if worker hangs */
let miningTimeout: ReturnType<typeof setTimeout> | null = null;

function pressDown(): void {
  if (isPressed || isMiningClick) {
    console.log(`[Button] pressDown BLOCKED - isPressed=${isPressed}, isMiningClick=${isMiningClick}`);
    return;
  }
  console.log('[Button] pressDown - setting isPressed=true, showing down image');
  isPressed = true;
  buttonDownTime = Date.now();
  buttonImg.src = 'button-down.jpg';
  playButtonDown();

  if (gameState.isConnected) {
    // Block mining if pending nonces are at the batch cap — force user to submit first
    if (gameState.pendingNonces.length >= CONFIG.maxBatchSize) {
      console.log('[Button] pressDown BLOCKED - pending nonces at cap, submit first');
      isPressed = false;
      buttonImg.src = 'button-up.jpg';
      // Pulse the claim/submit button to draw attention
      addClass(claimBtn, 'has-clicks');
      return;
    }

    isMiningClick = true;
    console.log('[Button] Starting mining...');
    void startMining(onClickMined);

    // Safety timeout: if mining takes more than 10 seconds, something is wrong
    miningTimeout = setTimeout(() => {
      if (isMiningClick) {
        console.warn('[Mining] Timeout - resetting button state');
        terminateMining();
        onClickMined(0n, null); // Reset UI without adding click
      }
    }, 10000);
  }
}

function pressUp(): void {
  console.log(`[Button] pressUp called - isConnected=${gameState.isConnected}, isPressed=${isPressed}`);
  if (!gameState.isConnected && isPressed) {
    isPressed = false;
    buttonImg.src = 'button-up.jpg';
    playButtonUp();
    console.log('[Button] pressUp - reset button (not connected)');
  }
}

/** Minimum time (ms) to show button in down state for visual feedback */
const MIN_DOWN_TIME_MS = 50;

/** Timestamp when button was pressed down */
let buttonDownTime = 0;

function onClickMined(nonce: bigint, challenge: string | null): void {
  console.log(`[Button] onClickMined called - nonce=${nonce}, isMiningClick=${isMiningClick}, isPressed=${isPressed}`);

  // Clear safety timeout
  if (miningTimeout) {
    clearTimeout(miningTimeout);
    miningTimeout = null;
  }

  // Calculate how long the button has been visually down
  const elapsed = Date.now() - buttonDownTime;
  const remainingDelay = Math.max(0, MIN_DOWN_TIME_MS - elapsed);

  // Delay the visual reset to ensure minimum down time is visible
  setTimeout(() => {
    isMiningClick = false;
    isPressed = false;
    buttonImg.src = 'button-up.jpg';
    playButtonUp();
    console.log('[Button] onClickMined - reset state, showing up image');

    // Only add valid clicks (nonce 0 indicates mining error)
    if (nonce !== 0n) {
      gameState.addClick(nonce, challenge);
      updateDisplays();
      updateSubmitButton();

      // Auto-submit to server when batch is full (keeps nonces fresh vs difficulty changes)
      maybeAutoSubmit();
    }
  }, remainingDelay);
}

// ============ Connection ============

async function refreshRewardDisplayParams(): Promise<void> {
  const rewardParams = await fetchRewardParams();
  if (!rewardParams) return;
  targetClicksPerEpoch = rewardParams.targetClicksPerEpoch;
  epochBudget = rewardParams.epochBudget;
  epochBudgetUsed = rewardParams.epochBudgetUsed;
  epochClaimedClicks = rewardParams.epochClicks;
}

async function onConnected(): Promise<void> {
  initializeContracts();

  // Fetch game data from contract (both V1 and V2)
  // This sets poolRemaining, epoch info, and game active status
  await refreshGameData();

  // Fetch reward params (for reward/difficulty display)
  await refreshRewardDisplayParams();

  // Update difficulty and reward display
  updateDifficultyDisplay();

  // Try to restore saved clicks
  const restored = gameState.tryRestoreFromStorage();
  if (restored) {
    console.log(`[App] Restored ${gameState.validClicks} saved clicks`);
  }

  // Update UI
  updateConnectButton();
  updateDisplays();
  updateSubmitButton();

  // Fetch user stats
  await refreshUserStats();

  if (IS_V2) {
    // Fetch V1 server stats FIRST for milestones/achievements/streaks (shared Redis)
    // This must come before V2 stats because setServerStats() overwrites allTimeClicks
    const stats = await fetchServerStats(gameState.userAddress!);
    if (stats) {
      serverStats = stats;
      gameState.setServerStats(stats);
      updateStreakPanel(stats);
      await renderNftPanel(stats);
    }

    // V2 mode: Fetch stats from V2 API AFTER, so registry values win
    const v2Stats = await fetchV2Stats(gameState.userAddress!);
    if (v2Stats.success) {
      console.log('[V2] User stats:', v2Stats);
      // Set lifetime clicks from registry (overwrites V1 totalClicks)
      if (v2Stats.lifetimeClicks !== undefined) {
        gameState.setAllTimeClicks(v2Stats.lifetimeClicks);
      }
      // Set lifetime earned from registry (convert from wei string to CLICK number)
      if (v2Stats.lifetimeEarned !== undefined) {
        const earnedInClick = parseFloat(v2Stats.lifetimeEarned) / 1e18;
        gameState.setTotalEarned(earnedInClick);
      }
      // Sync difficulty from server (dynamic per-epoch adjustment)
      if (v2Stats.difficultyTarget) {
        gameState.setDifficulty(BigInt(v2Stats.difficultyTarget));
      }
    }
  } else {
    // V1 mode: Check verification status and fetch server stats
    await checkVerificationStatus(gameState.userAddress!);

    const stats = await fetchServerStats(gameState.userAddress!);
    if (stats) {
      serverStats = stats;
      gameState.setServerStats(stats);
      updateStreakPanel(stats);
      await renderNftPanel(stats);
    }
  }

  // Start periodic updates
  startPeriodicUpdates();

  // Start heartbeat for active user tracking
  startHeartbeat();

  // Start epoch countdown timer
  startEpochCountdown();

  // Check for unfinalized epochs (V2 only, fire-and-forget)
  if (IS_V2) {
    checkAndShowFinalizeBanner();
  }
}

// ============ Finalize Epochs ============

async function checkAndShowFinalizeBanner(): Promise<void> {
  try {
    const count = await getUnfinalizedEpochCount();
    if (count > 0) {
      setText(finalizeCountEl, count.toString());
      finalizeBanner.style.display = '';
      finalizeBtn.addEventListener('click', handleFinalizeEpochs);
    } else {
      finalizeBanner.style.display = 'none';
    }
  } catch (err) {
    console.error('[Finalize] Error checking unfinalized epochs:', err);
  }
}

async function handleFinalizeEpochs(): Promise<void> {
  finalizeBtn.disabled = true;
  addClass(finalizeBtn, 'finalizing');
  const originalText = finalizeBtn.innerHTML;
  finalizeBtn.textContent = 'Finalizing...';

  try {
    const finalized = await finalizeElapsedEpochs();
    if (finalized.length > 0) {
      finalizeBtn.textContent = `Finalized ${finalized.length} epoch${finalized.length > 1 ? 's' : ''}!`;
      // Re-check if there are more
      setTimeout(async () => {
        await checkAndShowFinalizeBanner();
      }, 2000);
    } else {
      finalizeBtn.textContent = 'Nothing to finalize';
      setTimeout(() => {
        finalizeBanner.style.display = 'none';
      }, 2000);
    }
  } catch (err) {
    console.error('[Finalize] Error:', err);
    finalizeBtn.textContent = 'Failed — try again';
    setTimeout(() => {
      finalizeBtn.innerHTML = originalText;
      finalizeBtn.disabled = false;
      removeClass(finalizeBtn, 'finalizing');
    }, 3000);
    return;
  }

  finalizeBtn.disabled = false;
  removeClass(finalizeBtn, 'finalizing');
}

async function handleDisconnect(): Promise<void> {
  terminateMining();
  stopHeartbeat();
  stopEpochCountdown();
  await disconnect();
  updateConnectButton();
  isMiningClick = false;
  isPressed = false;
  buttonImg.src = 'button-up.jpg';
  // Hide streak stat on disconnect
  streakStat.classList.remove('visible');
  setText(epochCountdownEl, '--:--:--');
}

// ============ Submit ============

async function handleSubmit(e: Event): Promise<void> {
  e.stopPropagation();

  const nonces = gameState.pendingNonces.slice(0, CONFIG.maxBatchSize);
  if (nonces.length < CONFIG.minBatchSize) return;

  // Require Turnstile verification before any submission
  // PoW proves the work was done, Turnstile proves a human is present
  if (!turnstileToken) {
    showTurnstileModal();
    return;
  }

  try {
    submitBtn.disabled = true;

    if (IS_V2) {
      // V2: Always submit to API (off-chain), claim later
      await handleV2Submit(nonces);
    } else if (gameState.isGameActive) {
      // V1 Game is active: submit to blockchain first, then record to API
      await handleOnChainSubmit(nonces);
    } else {
      // V1 Game is inactive: record to API only (with nonces as proof-of-work)
      await handleOffChainSubmit(nonces);
    }
  } catch (error) {
    console.error('[Submit] Error:', error);
    submitBtn.disabled = false;
    updateSubmitButton();
  }
}

async function handleOnChainSubmit(nonces: readonly MinedNonce[]): Promise<void> {
  // Submit to blockchain
  const receipt = await submitClicks(nonces.map(n => n.nonce));
  if (!receipt) return;

  // Record to server (with Turnstile token + PoW nonces)
  const clicksToRecord = Math.min(gameState.serverClicksPending, nonces.length);
  if (clicksToRecord > 0) {
    const result = await recordClicksToServer(
      gameState.userAddress!,
      clicksToRecord,
      turnstileToken,
      nonces.slice(0, clicksToRecord).map(n => n.nonce.toString()),
      gameState.currentEpoch
    );
    if (result.success) {
      gameState.markServerClicksRecorded(clicksToRecord);
      // Keep turnstileToken for session - server tracks verification status
      handleAchievements(result);
    } else if (result.requiresVerification) {
      // Server says re-verify (e.g., after N clicks)
      turnstileToken = null;
      showTurnstileModal();
    }
  }

  // Record on-chain submission
  await recordOnChainSubmission(
    gameState.userAddress!,
    nonces.length,
    receipt.transactionHash,
    gameState.currentEpoch
  );

  // Clear submitted clicks
  gameState.clearSubmittedClicks(nonces.length);

  // Update UI
  updateDisplays();
  updateSubmitButton();

  // Refresh stats and panels
  await refreshUserStats();
  const stats = await fetchServerStats(gameState.userAddress!);
  if (stats) {
    serverStats = stats;
    gameState.setServerStats(stats);
    updateStreakPanel(stats);
    await renderNftPanel(stats);
  }
}

async function handleOffChainSubmit(nonces: readonly MinedNonce[]): Promise<void> {
  // Record to API with Turnstile token + PoW nonces (no blockchain submission)
  const result = await recordClicksToServer(
    gameState.userAddress!,
    nonces.length,
    turnstileToken,
    nonces.map(n => n.nonce.toString())
  );

  if (result.success) {
    gameState.markServerClicksRecorded(nonces.length);
    // Keep turnstileToken for session - server tracks verification status
    handleAchievements(result);

    // Clear submitted clicks
    gameState.clearSubmittedClicks(nonces.length);

    // Update UI
    updateDisplays();
    updateSubmitButton();

    // Refresh stats from server and panels
    const stats = await fetchServerStats(gameState.userAddress!);
    if (stats) {
      serverStats = stats;
      gameState.setServerStats(stats);
      updateStreakPanel(stats);
      await renderNftPanel(stats);
    }
  } else if (result.requiresVerification) {
    // Server says re-verify (e.g., after N clicks)
    turnstileToken = null;
    showTurnstileModal();
    submitBtn.disabled = false;
    updateSubmitButton();
  } else {
    submitBtn.disabled = false;
    updateSubmitButton();
  }
}

/**
 * Clear only server-accepted clicks from the local pending queue.
 * V2 can partially accept a batch (rate limit / invalid / stale challenge),
 * so clearing the full submitted batch can drop uncredited clicks.
 */
function applyV2SubmissionResult(
  result: {
    validClicks?: number;
    invalidClicks?: number;
    acceptedIndexes?: number[];
    nonceOutcomes?: Array<
      'accepted'
      | 'missingChallenge'
      | 'invalidChallenge'
      | 'challengeIpMismatch'
      | 'invalidPow'
      | 'duplicateNonce'
      | 'rateLimited'
    >;
  },
  submittedCount: number
): number {
  const hasExactIndexes = Array.isArray(result.acceptedIndexes) || Array.isArray(result.nonceOutcomes);

  // Preferred path: exact per-index reconciliation from server.
  if (hasExactIndexes) {
    const acceptedSet = new Set<number>();
    const removeSet = new Set<number>();
    const permanentRejectOutcomes = new Set([
      'missingChallenge',
      'invalidChallenge',
      'challengeIpMismatch',
      'invalidPow',
      'duplicateNonce',
    ]);

    if (Array.isArray(result.acceptedIndexes)) {
      for (const idx of result.acceptedIndexes) {
        if (Number.isInteger(idx) && idx >= 0 && idx < submittedCount) {
          acceptedSet.add(idx);
          removeSet.add(idx);
        }
      }
    }

    let rateLimitedCount = 0;
    if (Array.isArray(result.nonceOutcomes)) {
      const max = Math.min(submittedCount, result.nonceOutcomes.length);
      for (let idx = 0; idx < max; idx++) {
        const outcome = result.nonceOutcomes[idx];
        if (outcome === 'accepted') {
          acceptedSet.add(idx);
          removeSet.add(idx);
        } else if (outcome === 'rateLimited') {
          rateLimitedCount++;
        } else if (permanentRejectOutcomes.has(outcome)) {
          removeSet.add(idx);
        }
      }
    }

    const removed = gameState.applySubmissionIndexes(submittedCount, Array.from(removeSet));
    const accepted = acceptedSet.size;
    const rejected = Math.max(0, submittedCount - accepted);
    const permanentlyRejected = Math.max(0, removed - accepted);

    // Surface partial acceptance/rejection while keeping retriable entries queued.
    if (rejected > 0) {
      const retryNote = rateLimitedCount > 0 ? ` (${rateLimitedCount} queued to retry)` : '';
      showAchievementToast(
        'Partial Submit',
        `${accepted}/${submittedCount} accepted${retryNote}`
      );
    } else if (permanentlyRejected > 0) {
      showAchievementToast(
        'Filtered',
        `${permanentlyRejected} invalid duplicate/stale clicks removed`
      );
    }

    return accepted;
  }

  // Backward-compatible fallback for older server responses.
  const accepted = typeof result.validClicks === 'number'
    ? Math.max(0, Math.min(submittedCount, result.validClicks))
    : submittedCount;
  const rejected = typeof result.invalidClicks === 'number'
    ? Math.max(0, result.invalidClicks)
    : Math.max(0, submittedCount - accepted);

  if (accepted > 0) {
    gameState.clearSubmittedClicks(accepted);
  }

  // Surface partial acceptance so users understand payout deltas.
  if (rejected > 0) {
    showAchievementToast('Partial Submit', `${accepted}/${submittedCount} clicks accepted`);
  }

  return accepted;
}

/**
 * Handle V2 submission (off-chain to API, claim rewards later)
 */
async function handleV2Submit(nonces: readonly MinedNonce[]): Promise<void> {
  // Submit to V2 API — each nonce carries the challenge it was mined with
  const result = await submitClicksV2(
    gameState.userAddress!,
    nonces.map(n => ({ nonce: n.nonce.toString(), challenge: n.challenge })),
    turnstileToken,
  );

  if (result.success) {
    console.log('[V2 Submit] Success:', result);

    // Update local state with server response
    if (result.lifetimeClicks !== undefined) {
      gameState.setAllTimeClicks(result.lifetimeClicks);
    }

    // Sync difficulty from server (tracks epoch-based adjustments)
    if (result.difficultyTarget) {
      gameState.setDifficulty(BigInt(result.difficultyTarget));
    }

    // Clear only accepted clicks (V2 may partially accept a batch)
    applyV2SubmissionResult(result, nonces.length);

    // Handle achievements from V2 response
    if (result.newMilestones && result.newMilestones.length > 0) {
      handleAchievements({ newMilestones: result.newMilestones });
    }
    if (result.newAchievements && result.newAchievements.length > 0) {
      handleAchievements({
        newAchievements: result.newAchievements.map(a => ({
          ...a,
          name: a.name,
          type: a.type as 'hidden' | 'global' | 'streak' | 'epoch',
        })),
      });
    }

    // Update UI
    updateDisplays();
    updateSubmitButton();

    // Refresh stats from V2 API
    const stats = await fetchV2Stats(gameState.userAddress!);
    if (stats.success && stats.gameState) {
      // Update game state from V2 API
      gameState.setEpochInfo(stats.gameState.currentEpoch, stats.gameState.totalEpochs);
      gameState.setGameActive(stats.gameState.gameStarted && !stats.gameState.gameEnded);
    }

    // Refresh NFT panel (milestones/achievements from shared Redis)
    const serverStatsRefresh = await fetchServerStats(gameState.userAddress!);
    if (serverStatsRefresh) {
      serverStats = serverStatsRefresh;
      await renderNftPanel(serverStatsRefresh);
    }
  } else if (Array.isArray(result.nonceOutcomes) || Array.isArray(result.acceptedIndexes)) {
    // Some server errors (e.g. all invalid/stale duplicates) still carry
    // per-index outcomes so we can prune dead entries from the queue.
    applyV2SubmissionResult(result, nonces.length);
    updateDisplays();
    updateSubmitButton();
    claimBtn.disabled = false;
  } else if (result.requiresVerification) {
    // Server says re-verify
    turnstileToken = null;
    showTurnstileModal();
    claimBtn.disabled = false;
    updateSubmitButton();
  } else {
    console.error('[V2 Submit] Error:', result.error);
    claimBtn.disabled = false;
    updateSubmitButton();
  }
}

/**
 * Auto-submit nonces to the server when the pending queue reaches maxBatchSize.
 * This prevents nonces from going stale if difficulty changes mid-session.
 * Only does the off-chain server submit (step 1) — on-chain claim stays manual.
 */
async function maybeAutoSubmit(): Promise<void> {
  if (!IS_V2) return;
  if (isAutoSubmitting) return;
  if (!turnstileToken) return;
  if (!gameState.userAddress) return;
  if (gameState.pendingNonces.length < CONFIG.maxBatchSize) return;

  isAutoSubmitting = true;
  try {
    const nonces = gameState.pendingNonces.slice(0, CONFIG.maxBatchSize);
    console.log(`[AutoSubmit] Submitting ${nonces.length} nonces to server`);

    const result = await submitClicksV2(
      gameState.userAddress,
      nonces.map(n => ({ nonce: n.nonce.toString(), challenge: n.challenge })),
      turnstileToken,
    );

    if (result.success) {
      console.log('[AutoSubmit] Success:', result);

      if (result.lifetimeClicks !== undefined) {
        gameState.setAllTimeClicks(result.lifetimeClicks);
      }
      if (result.difficultyTarget) {
        gameState.setDifficulty(BigInt(result.difficultyTarget));
      }

      applyV2SubmissionResult(result, nonces.length);
      updateDisplays();
      updateSubmitButton();

      // Handle achievements
      if (result.newMilestones && result.newMilestones.length > 0) {
        handleAchievements({ newMilestones: result.newMilestones });
      }
      if (result.newAchievements && result.newAchievements.length > 0) {
        handleAchievements({
          newAchievements: result.newAchievements.map(a => ({
            ...a,
            name: a.name,
            type: a.type as 'hidden' | 'global' | 'streak' | 'epoch',
          })),
        });
      }
    } else if (Array.isArray(result.nonceOutcomes) || Array.isArray(result.acceptedIndexes)) {
      applyV2SubmissionResult(result, nonces.length);
      updateDisplays();
      updateSubmitButton();
    } else if (result.requiresVerification) {
      console.log('[AutoSubmit] Turnstile expired, clearing token');
      turnstileToken = null;
      // Don't show modal — user will get prompted on next manual submit
    } else {
      console.warn('[AutoSubmit] Failed:', result.error);
    }
  } catch (err) {
    console.error('[AutoSubmit] Error:', err);
  } finally {
    isAutoSubmitting = false;
  }
}

/**
 * Handle V2 Claim button - full flow:
 * 1. Submit clicks to API (off-chain validation)
 * 2. Get claim signature from server
 * 3. Call contract to claim tokens
 */
async function handleV2Claim(e: Event): Promise<void> {
  e.stopPropagation();

  // Debug details intentionally omitted (security: avoid logging addresses/tokens)

  const nonces = gameState.pendingNonces.slice(0, CONFIG.maxBatchSize);
  if (nonces.length < CONFIG.minBatchSize) {
    console.log('[V2 Claim] Not enough nonces:', nonces.length, '< minBatchSize:', CONFIG.minBatchSize);
    return;
  }

  // Require Turnstile verification
  if (!turnstileToken) {
    console.log('[V2 Claim] No turnstile token, showing modal');
    showTurnstileModal();
    return;
  }

  try {
    claimBtn.disabled = true;
    addClass(claimBtn, 'claiming');
    removeClass(claimBtn, 'has-clicks');
    setText(claimBtn, 'Submitting...');

    // Step 1: Submit clicks to V2 API — each nonce carries its own challenge
    const submitResult = await submitClicksV2(
      gameState.userAddress!,
      nonces.map(n => ({ nonce: n.nonce.toString(), challenge: n.challenge })),
      turnstileToken,
    );

    if (!submitResult.success) {
      if (Array.isArray(submitResult.nonceOutcomes) || Array.isArray(submitResult.acceptedIndexes)) {
        applyV2SubmissionResult(submitResult, nonces.length);
        updateDisplays();
        updateSubmitButton();
      }
      if (submitResult.requiresVerification) {
        console.log('[V2 Claim] Verification required, showing Turnstile');
        turnstileToken = null;
        showTurnstileModal();
      } else {
        console.error('[V2 Claim] Submit failed:', submitResult.error);
        // Show error to user via button text
        setText(claimBtn, 'Submit failed!');
        setTimeout(() => updateSubmitButton(), 2000);
      }
      claimBtn.disabled = false;
      removeClass(claimBtn, 'claiming');
      return;
    }

    console.log('[V2 Claim] Clicks submitted:', submitResult);

    // Sync difficulty from server response
    if (submitResult.difficultyTarget) {
      gameState.setDifficulty(BigInt(submitResult.difficultyTarget));
    }

    // Update local state from submit response
    if (submitResult.lifetimeClicks !== undefined) {
      gameState.setAllTimeClicks(submitResult.lifetimeClicks);
    }

    // Clear accepted clicks immediately after server submit.
    // If wallet signing/tx fails later, we should not re-submit already accepted nonces.
    applyV2SubmissionResult(submitResult, nonces.length);

    // Defer mint modal during the claim flow so wallet prompts aren't interrupted
    deferMintModal = true;
    deferredClaimables = [];

    // Handle achievements from submit response (NFT milestones work between games)
    // Toasts still show immediately; only the mint modal is deferred until claim completes
    if (submitResult.newMilestones && submitResult.newMilestones.length > 0) {
      handleAchievements({ newMilestones: submitResult.newMilestones });
    }
    if (submitResult.newAchievements && submitResult.newAchievements.length > 0) {
      handleAchievements({
        newAchievements: submitResult.newAchievements.map(a => ({
          ...a,
          name: a.name,
          type: a.type as 'hidden' | 'global' | 'streak' | 'epoch',
        })),
      });
    }

    // Between games: submit to server only, no on-chain claim
    if (!gameState.isGameActive) {
      console.log('[V2 Claim] Game inactive — clicks submitted, skipping on-chain claim');
      updateDisplays();

      setText(claimBtn, 'Submitted!');
      setTimeout(() => updateSubmitButton(), 1500);
      claimBtn.disabled = false;
      removeClass(claimBtn, 'claiming');

      // Refresh NFT panel (milestones may have been unlocked)
      const serverStatsRefresh = await fetchServerStats(gameState.userAddress!);
      if (serverStatsRefresh) {
        serverStats = serverStatsRefresh;
        await renderNftPanel(serverStatsRefresh);
      }
      processDeferredMintModals();
      return;
    }

    // Get current epoch from response or state
    const currentEpoch = submitResult.epoch ?? gameState.currentEpoch;

    setText(claimBtn, 'Getting signature...');

    // Step 2: Get claim signature from server (handles wallet signature if required)
    const sigResponse = await requestV2ClaimAttestation(currentEpoch);

    if (sigResponse.requiresVerification) {
      // Turnstile needed - modal already shown by requestV2ClaimAttestation
      claimBtn.disabled = false;
      removeClass(claimBtn, 'claiming');
      processDeferredMintModals();
      return;
    }

    if (!sigResponse.success || !sigResponse.signature) {
      console.error('[V2 Claim] Failed to get signature:', sigResponse.error);
      setText(claimBtn, 'Signature failed!');
      setTimeout(() => updateSubmitButton(), 2000);
      claimBtn.disabled = false;
      removeClass(claimBtn, 'claiming');
      processDeferredMintModals();
      return;
    }

    console.log('[V2 Claim] Got signature for', sigResponse.clickCount, 'clicks');

    // Check how many clicks already claimed on-chain (for incremental claims)
    const alreadyClaimedClicks = await getV2ClaimedClicks(CONFIG.contractAddress, gameState.userAddress!, currentEpoch);
    if (sigResponse.clickCount! <= alreadyClaimedClicks) {
      console.log('[V2 Claim] No new clicks to claim for epoch', currentEpoch, '- already claimed:', alreadyClaimedClicks, 'signature for:', sigResponse.clickCount);
      setText(claimBtn, 'No new clicks!');
      setTimeout(() => updateSubmitButton(), 2000);
      claimBtn.disabled = false;
      removeClass(claimBtn, 'claiming');
      processDeferredMintModals();
      return;
    }
    console.log('[V2 Claim] Incremental claim:', alreadyClaimedClicks, '->', sigResponse.clickCount, 'clicks');

    setText(claimBtn, 'Claiming tokens...');

    // Step 3: Call contract to claim tokens
    const claimResult = await claimV2Reward(
      CONFIG.contractAddress,
      currentEpoch,
      sigResponse.clickCount!,
      sigResponse.signature
    );

    if (claimResult) {
      console.log('[V2 Claim] Success! Tokens claimed');

      // Play cash machine sound!
      playCashMachineSound();

      // Update UI
      updateDisplays();
      updateSubmitButton();

      // Refresh user stats from contract
      await refreshUserStats();
      await refreshRewardDisplayParams();
      updateDifficultyDisplay();

      // Refresh V2 stats
      const stats = await fetchV2Stats(gameState.userAddress!);
      if (stats.success && stats.gameState) {
        gameState.setEpochInfo(stats.gameState.currentEpoch, stats.gameState.totalEpochs);
        gameState.setGameActive(stats.gameState.gameStarted && !stats.gameState.gameEnded);
      }
    } else {
      console.error('[V2 Claim] Contract claim failed');
      setText(claimBtn, 'Claim failed!');
      setTimeout(() => updateSubmitButton(), 2000);
    }

    claimBtn.disabled = false;
    removeClass(claimBtn, 'claiming');
    updateSubmitButton();
    processDeferredMintModals();

  } catch (error) {
    console.error('[V2 Claim] Error:', error);
    setText(claimBtn, 'Error!');
    setTimeout(() => updateSubmitButton(), 2000);
    claimBtn.disabled = false;
    removeClass(claimBtn, 'claiming');
    processDeferredMintModals();
  }
}

/**
 * Process any NFT mint modals that were deferred during the claim flow.
 * Called after the claim transaction completes (success or failure).
 */
function processDeferredMintModals(): void {
  deferMintModal = false;
  if (deferredClaimables.length > 0) {
    const claimable = [...deferredClaimables];
    deferredClaimables = [];
    setTimeout(() => {
      const first = claimable.shift()!;
      gameState.addToClaimQueue(...claimable);
      showClaimModal(first.milestoneId, first.tier);
    }, 1000);
  }
}

// ============ Achievements ============

function handleAchievements(data: {
  newMilestones?: Array<{ id: string; name: string; tier?: number; cosmetic?: string }>;
  newAchievements?: UnlockedAchievement[];
}): void {
  console.log('[Achievements] handleAchievements called:', data);
  const claimable: ClaimState[] = [];
  let hasPersonalMilestone = false;
  let hasGlobalMilestone = false;

  // Handle personal milestones
  if (data.newMilestones && data.newMilestones.length > 0) {
    hasPersonalMilestone = true;
    for (const m of data.newMilestones) {
      showAchievementToast(m.name, m.cosmetic ? `Unlocked: ${m.cosmetic}` : 'Achievement unlocked!');
      if (m.tier) {
        claimable.push({ milestoneId: m.id, tier: m.tier });
      }
    }
  }

  // Handle other achievements
  if (data.newAchievements && data.newAchievements.length > 0) {
    for (const a of data.newAchievements) {
      if (a.type === 'global') {
        hasGlobalMilestone = true;
        showAchievementToast(`${a.name}`, '1/1 NFT incoming!');
      } else if (a.type === 'hidden') {
        showAchievementToast(`${a.name}`, 'Secret achievement!');
      } else if (a.type === 'streak') {
        showAchievementToast(`${a.name}`, `${a.days} day streak!`);
      } else {
        showAchievementToast(a.name, 'Achievement unlocked!');
      }
      if (a.tier) {
        claimable.push({ milestoneId: a.id, tier: a.tier });
      }
    }
  }

  // Trigger celebration
  if (hasGlobalMilestone) {
    celebrateGlobalMilestone();
  } else if (hasPersonalMilestone) {
    celebratePersonalMilestone();
  }

  // Queue claims — defer modal if a claim transaction is in progress
  if (claimable.length > 0 && hasNftContract()) {
    if (deferMintModal) {
      // Claim flow is in progress — save for later so modal doesn't interrupt wallet prompts
      deferredClaimables.push(...claimable);
    } else {
      setTimeout(() => {
        const first = claimable.shift()!;
        gameState.addToClaimQueue(...claimable);
        showClaimModal(first.milestoneId, first.tier);
      }, 2000);
    }
  }
}

/**
 * Handle sync achievements button click
 * Retroactively grants any missing achievements based on total clicks
 */
async function handleSyncAchievements(): Promise<void> {
  if (!gameState.userAddress) {
    showAchievementToast('Not Connected', 'Connect wallet first');
    return;
  }

  const syncBtn = document.getElementById('sync-achievements-btn');
  if (syncBtn?.classList.contains('syncing')) return; // Already syncing

  syncBtn?.classList.add('syncing');

  try {
    const result = await syncAchievements(gameState.userAddress);

    if (result.success) {
      // Combine global 1/1 milestones into the achievements array for processing
      const globalAsAchievements = (result.newGlobalMilestones || []).map(gm => ({
        ...gm,
        type: 'global' as const,
      }));
      const allNewAchievements = [
        ...(result.newAchievements?.map(a => ({
          ...a,
          type: a.type as 'hidden' | 'global' | 'streak' | 'epoch' | 'personal',
        })) || []),
        ...globalAsAchievements,
      ];
      const totalNew = (result.newMilestones?.length || 0) + allNewAchievements.length;

      if (totalNew > 0) {
        // Process any new achievements like normal
        handleAchievements({
          newMilestones: result.newMilestones || [],
          newAchievements: allNewAchievements,
        });
        showAchievementToast('Synced!', `Found ${totalNew} achievement${totalNew > 1 ? 's' : ''}`);
      } else {
        showAchievementToast('All Synced', 'No missing achievements');
      }
    } else {
      showAchievementToast('Sync Failed', 'Try again later');
    }
  } catch (error) {
    console.error('Sync error:', error);
    showAchievementToast('Sync Error', 'Something went wrong');
  } finally {
    syncBtn?.classList.remove('syncing');
  }
}

// ============ UI Updates ============

/** Track previous connection state to detect new connections */
let wasConnected = false;

function handleStateChange(event: string): void {
  switch (event) {
    case 'connectionChanged':
      updateConnectButton();
      updateMobileWalletText();
      updatePanelVisibility();
      // Detect new connection (transition from disconnected to connected)
      if (gameState.isConnected && !wasConnected) {
        wasConnected = true;
        onConnected();
      } else if (!gameState.isConnected) {
        wasConnected = false;
      }
      break;
    case 'clicksChanged':
      updateDisplays();
      updateSubmitButton();
      break;
    case 'statsChanged':
      updateDisplays();
      break;
  }
}

/**
 * Update visibility of panels that require wallet connection
 * Leaderboard panel is hidden until wallet is connected
 * NFT panel visibility is managed by renderNftPanel() based on claimable items
 */
function updatePanelVisibility(): void {
  if (gameState.isConnected) {
    leaderboardPanel.style.display = 'block';
    // NFT panel visibility is controlled by renderNftPanel based on achievements
  } else {
    leaderboardPanel.style.display = 'none';
    nftPanel.style.display = 'none';
  }
}

function updateConnectButton(): void {
  if (gameState.isConnected && gameState.userAddress) {
    setText(connectBtn, shortenAddress(gameState.userAddress));
    addClass(connectBtn, 'connected');
    removeClass(connectBtn, 'wrong-network');
  } else if (gameState.connectionState === 'wrong-network') {
    setText(connectBtn, 'Wrong Network');
    addClass(connectBtn, 'wrong-network');
    removeClass(connectBtn, 'connected');
  } else {
    setText(connectBtn, 'Connect Wallet');
    removeClass(connectBtn, 'connected', 'wrong-network');
  }
}

function updateDisplays(): void {
  setText(arcadeCurrentEl, gameState.validClicks.toLocaleString());
  setText(arcadeAlltimeEl, gameState.allTimeClicks.toLocaleString());
  setText(arcadeEarnedEl, formatTokens(gameState.totalEarned));
  setText(leaderboardToggleEpoch, gameState.isGameActive ? 'Epoch' : 'Off-Season');

  // Update game status, epoch, and pool based on whether game is active
  if (gameState.isGameActive) {
    setText(gameStatusEl, 'ACTIVE');
    removeClass(gameStatusEl, 'inactive');
    addClass(gameStatusEl, 'active');
    setText(epochInfoEl, `${gameState.currentEpoch} / ${gameState.totalEpochs}`);
    // Pool now shows full number with comma formatting
    setText(poolInfoEl, gameState.poolRemaining.toLocaleString());
  } else {
    setText(gameStatusEl, 'INACTIVE');
    removeClass(gameStatusEl, 'active');
    addClass(gameStatusEl, 'inactive');
    setText(epochInfoEl, '0 / 0');
    setText(poolInfoEl, '0');
  }

  // Update difficulty display
  updateDifficultyDisplay();
}

/**
 * Update difficulty and estimated reward per click displays
 */
function updateDifficultyDisplay(): void {
  if (!gameState.isGameActive || gameState.difficultyTarget === 0n) {
    setText(difficultyDisplayEl, '--');
    setText(rewardPerClickEl, '--');
    rewardPerClickEl.removeAttribute('title');
    return;
  }

  // Calculate difficulty ratio relative to starting difficulty
  // Starting difficulty = maxUint256 / 1000, so ratio of 1000 = normal
  // Higher ratio = harder (more hashes needed), lower = easier
  const maxUint256 = 2n ** 256n - 1n;
  const difficultyRatio = maxUint256 / gameState.difficultyTarget;

  // Convert to human-readable difficulty label
  // Reference: starting difficulty (1000) = NORMAL
  // Thresholds chosen to give intuitive labels:
  //   < 10:      EASY     (nearly every hash is valid)
  //   10-100:    NORMAL-  (easier than start)
  //   100-500:   NORMAL   (around starting difficulty)
  //   500-2000:  NORMAL+  (slightly harder than start)
  //   2000-10k:  HARD     (noticeably harder)
  //   10k-100k:  HARD+    (significantly harder)
  //   > 100k:    EXTREME  (very competitive)
  let difficultyStr: string;
  if (difficultyRatio < 10n) {
    difficultyStr = 'EASY';
  } else if (difficultyRatio < 100n) {
    difficultyStr = 'NORMAL-';
  } else if (difficultyRatio < 500n) {
    difficultyStr = 'NORMAL';
  } else if (difficultyRatio < 2000n) {
    difficultyStr = 'NORMAL+';
  } else if (difficultyRatio < 10000n) {
    difficultyStr = 'HARD';
  } else if (difficultyRatio < 100000n) {
    difficultyStr = 'HARD+';
  } else {
    difficultyStr = 'EXTREME';
  }
  setText(difficultyDisplayEl, difficultyStr);

  // Calculate estimated reward per click using current epoch usage:
  // - ideal per-click uses full epoch budget spread across target clicks
  // - effective per-click uses remaining budget vs remaining target clicks
  // This tracks real payout pressure as epochs fill up.
  if (targetClicksPerEpoch > 0n && epochBudget > 0n) {
    const used = epochBudgetUsed > epochBudget ? epochBudget : epochBudgetUsed;
    const remainingBudget = epochBudget > used ? (epochBudget - used) : 0n;
    const remainingTargetClicks = targetClicksPerEpoch > epochClaimedClicks
      ? (targetClicksPerEpoch - epochClaimedClicks)
      : 1n;

    const idealGrossPerClick = epochBudget / targetClicksPerEpoch;
    let effectiveGrossPerClick = remainingBudget / remainingTargetClicks;
    if (effectiveGrossPerClick > idealGrossPerClick) {
      effectiveGrossPerClick = idealGrossPerClick;
    }
    const effectivePlayerPerClick = effectiveGrossPerClick / 2n;
    const idealPlayerPerClick = idealGrossPerClick / 2n;

    // Convert to tokens (18 decimals)
    const rewardTokens = Number(effectivePlayerPerClick) / 1e18;

    // Format nicely (no ~ since it doesn't render in segment font)
    let rewardStr: string;
    if (rewardTokens >= 1) {
      rewardStr = rewardTokens.toFixed(1);
    } else if (rewardTokens >= 0.01) {
      rewardStr = rewardTokens.toFixed(2);
    } else if (rewardTokens >= 0.001) {
      rewardStr = rewardTokens.toFixed(3);
    } else {
      rewardStr = rewardTokens.toFixed(4);
    }
    setText(rewardPerClickEl, rewardStr);
    rewardPerClickEl.setAttribute(
      'title',
      `Effective ${Number(effectivePlayerPerClick) / 1e18} CLICK/click (ideal ${Number(idealPlayerPerClick) / 1e18})`
    );
  } else {
    setText(rewardPerClickEl, '--');
    rewardPerClickEl.removeAttribute('title');
  }
}

function updateSubmitButton(): void {
  const hasEnoughClicks = gameState.validClicks >= CONFIG.minBatchSize;
  const canSubmit = hasEnoughClicks && gameState.isConnected;

  if (IS_V2) {
    // V2: Use green Claim button (or "Submit" between games)
    removeClass(submitContainer, 'visible'); // Hide V1 submit button

    const atCap = gameState.pendingNonces.length >= CONFIG.maxBatchSize;
    claimBtn.disabled = !canSubmit;
    const label = gameState.isGameActive ? 'Claim' : 'Submit';

    if (atCap) {
      // Hard cap reached — force user to submit before more clicking
      setText(claimBtn, `${label} to keep clicking!`);
      addClass(claimContainer, 'visible');
      addClass(claimBtn, 'has-clicks');
      buttonImg.style.opacity = '0.4';
    } else {
      setText(claimBtn, `${label} (${gameState.validClicks})`);
      buttonImg.style.opacity = '1';
    }

    if (hasEnoughClicks) {
      addClass(claimContainer, 'visible');
      addClass(claimBtn, 'has-clicks'); // Trigger pulsing animation
    } else if (!atCap) {
      removeClass(claimContainer, 'visible');
      removeClass(claimBtn, 'has-clicks');
    }
  } else {
    // V1: Use red Submit button
    removeClass(claimContainer, 'visible'); // Hide V2 claim button
    submitBtn.disabled = !canSubmit;
    setText(submitBtn, `Submit (${gameState.validClicks})`);

    if (hasEnoughClicks) {
      addClass(submitContainer, 'visible');
    } else {
      removeClass(submitContainer, 'visible');
    }
  }
}

// ============ Leaderboard ============

/**
 * Set the leaderboard mode (epoch, alltime clicks, or earned)
 */
function setLeaderboardMode(mode: V2LeaderboardType): void {
  leaderboardMode = mode;

  // Update toggle button states
  const toggles = [leaderboardToggleEpoch, leaderboardToggleAlltime, leaderboardToggleEarned, leaderboardToggleBots];
  for (const btn of toggles) {
    removeClass(btn, 'active');
  }
  if (mode === 'epoch') addClass(leaderboardToggleEpoch, 'active');
  else if (mode === 'alltime') addClass(leaderboardToggleAlltime, 'active');
  else if (mode === 'earned') addClass(leaderboardToggleEarned, 'active');
  else if (mode === 'bots') addClass(leaderboardToggleBots, 'active');

  // Refresh leaderboard
  fetchLeaderboard();
}

async function fetchLeaderboard(): Promise<void> {
  if (IS_V2) {
    // V2 mode: Use V2 leaderboard API with type
    leaderboardData = await fetchV2Leaderboard(10, leaderboardMode);
  } else if (leaderboardMode === 'epoch') {
    // V1 fallback: all-time frontend clicks from Redis
    leaderboardData = await fetchGlobalLeaderboard(10);
  } else {
    // V1 fallback: on-chain clicks from current game's subgraph
    if (currentGame) {
      leaderboardData = await fetchGameLeaderboard(currentGame.subgraphUrl, 10);
    } else {
      leaderboardData = [];
    }
  }

  renderLeaderboard();
}

function renderLeaderboard(): void {
  if (leaderboardData.length === 0) {
    const epochEmptyLabel = gameState.isGameActive ? 'No clicks this epoch!' : 'No off-season clicks yet!';
    const emptyMessages: Record<V2LeaderboardType, string> = {
      epoch: epochEmptyLabel,
      alltime: 'No clicks yet!',
      earned: 'No earnings yet!',
      bots: 'No flagged bots',
    };
    setHtml(leaderboardListEl, `<li class="leaderboard-loading">${emptyMessages[leaderboardMode]}</li>`);
    return;
  }

  const userAddrLower = gameState.userAddress?.toLowerCase();
  const isEarned = leaderboardMode === 'earned';

  const html = leaderboardData
    .map((entry, index) => {
      const isYou = userAddrLower && entry.address?.toLowerCase() === userAddrLower;
      const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';

      // Priority: server name > cached ENS > shortened address
      // All user-supplied strings are escaped to prevent XSS
      const cachedEns = getCachedEns(entry.address);
      const rawName =
        entry.name && entry.name !== 'Anonymous'
          ? entry.name
          : cachedEns || shortenAddress(entry.address);
      const displayName = escapeHtml(rawName);
      const safeAddress = escapeHtml(entry.address);

      const isBotMode = leaderboardMode === 'bots';
      const milestone = getHighestMilestone(entry.totalClicks);
      const iconHtml = isBotMode
        ? `<span class="leaderboard-indicator leaderboard-bot-icon">🤖</span>`
        : milestone
          ? `<img src="cursors/${escapeHtml(milestone.cursor)}.png" class="leaderboard-cursor-icon" alt="${escapeHtml(milestone.name)}">`
          : `<span class="leaderboard-indicator">🧑</span>`;

      // Show earned amount for earned tab, click count otherwise
      const valueHtml = isEarned && entry.totalEarned
        ? `<span class="leaderboard-clicks leaderboard-earned">${formatWeiAsTokens(entry.totalEarned)}</span>`
        : `<span class="leaderboard-clicks">${formatNumber(entry.totalClicks)}</span>`;

      return `
        <li class="leaderboard-item ${isYou ? 'is-you' : ''}" data-address="${safeAddress}">
          <span class="leaderboard-rank ${rankClass}">${entry.rank}</span>
          ${iconHtml}
          <span class="leaderboard-name ${isYou ? 'is-you' : ''}">${displayName}${isYou ? ' (you)' : ''}</span>
          ${valueHtml}
        </li>
      `;
    })
    .join('');

  setHtml(leaderboardListEl, html);

  // Click-to-copy address on leaderboard names
  leaderboardListEl.querySelectorAll('.leaderboard-name').forEach(nameEl => {
    nameEl.addEventListener('click', (e) => {
      const li = (e.target as HTMLElement).closest('.leaderboard-item') as HTMLElement | null;
      const address = li?.dataset.address;
      if (address) {
        navigator.clipboard.writeText(address).then(() => {
          showAchievementToast('Copied!', `${address.slice(0, 6)}...${address.slice(-4)} copied to clipboard`);
        });
      }
    });
  });

  // Kick off ENS resolution in background for addresses without cached ENS
  resolveLeaderboardEns();
}

/**
 * Resolve ENS names for leaderboard entries in the background
 * Updates the DOM when names are resolved
 */
async function resolveLeaderboardEns(): Promise<void> {
  const addressesToResolve = leaderboardData
    .filter(entry => (!entry.name || entry.name === 'Anonymous') && !getCachedEns(entry.address))
    .map(entry => entry.address);

  if (addressesToResolve.length === 0) return;

  // Resolve all addresses in parallel
  for (const address of addressesToResolve) {
    lookupEns(address).then(ensName => {
      if (ensName) {
        // Update the DOM element with the ENS name
        const item = leaderboardListEl.querySelector(`[data-address="${address}"]`);
        if (item) {
          const nameEl = item.querySelector('.leaderboard-name');
          if (nameEl) {
            const isYou = gameState.userAddress?.toLowerCase() === address.toLowerCase();
            nameEl.textContent = ensName + (isYou ? ' (you)' : '');
          }
        }
      }
    });
  }
}

function startLeaderboardUpdates(): void {
  fetchLeaderboard();

  setInterval(() => {
    fetchLeaderboard();
  }, 30000);
}

// ============ Periodic Updates ============

function startPeriodicUpdates(): void {
  setInterval(async () => {
    if (gameState.isConnected) {
      await refreshGameData();
      await refreshUserStats();
      await refreshRewardDisplayParams();
      updateDifficultyDisplay();
    }
  }, 30000);
}

// ============ Epoch Countdown ============

let countdownInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Compute the end time (unix seconds) of the current epoch
 * based on gameStartTime, gameEndTime, totalEpochs, and currentEpoch.
 * epochDuration = (gameEndTime - gameStartTime) / totalEpochs
 * epochEndTime  = gameStartTime + currentEpoch * epochDuration
 */
function getEpochEndTime(): number {
  const { gameStartTime, gameEndTime, totalEpochs, currentEpoch } = gameState;
  if (!gameStartTime || !gameEndTime || !totalEpochs || !currentEpoch) return 0;

  const epochDuration = (gameEndTime - gameStartTime) / totalEpochs;
  return gameStartTime + currentEpoch * epochDuration;
}

/**
 * Format seconds remaining as HH:MM:SS or MM:SS
 */
function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');

  if (h > 0) {
    return `${h}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

/**
 * Update the epoch countdown display
 */
function updateEpochCountdown(): void {
  if (!gameState.isGameActive) {
    setText(epochCountdownEl, '--:--');
    return;
  }

  const epochEnd = getEpochEndTime();
  if (!epochEnd) {
    setText(epochCountdownEl, '--:--');
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const remaining = epochEnd - now;

  if (remaining <= 0) {
    setText(epochCountdownEl, '00:00');
  } else {
    setText(epochCountdownEl, formatCountdown(remaining));
  }
}

/**
 * Start the epoch countdown timer (updates every second)
 */
function startEpochCountdown(): void {
  if (countdownInterval) return;
  updateEpochCountdown();
  countdownInterval = setInterval(updateEpochCountdown, 1000);
}

/**
 * Stop the epoch countdown timer
 */
function stopEpochCountdown(): void {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

// ============ Heartbeat & Active Users ============

/**
 * Start sending heartbeat to track active frontend users
 */
function startHeartbeat(): void {
  if (heartbeatInterval) return;

  // Send immediately
  if (gameState.userAddress) {
    if (IS_V2) {
      sendHeartbeatV2(gameState.userAddress);
    } else {
      sendHeartbeat(gameState.userAddress);
    }
  }

  // Then every 30 seconds
  heartbeatInterval = setInterval(() => {
    if (gameState.userAddress) {
      if (IS_V2) {
        sendHeartbeatV2(gameState.userAddress);
      } else {
        sendHeartbeat(gameState.userAddress);
      }
    }
  }, 30000);
}

/**
 * Stop heartbeat when disconnected
 */
function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

/**
 * Refresh the All-Time header display based on current toggle state
 */
function refreshAlltimeDisplay(): void {
  if (alltimeShowEarned) {
    setText(alltimeLabelEl, 'Earned');
    const formatted = formatWeiSplit(cachedGlobalEarned);
    setText(headerAlltimeClicksEl, formatted.value);
    setText(headerAlltimeSuffixEl, formatted.suffix ? formatted.suffix + ' $C' : '$C');
  } else {
    setText(alltimeLabelEl, 'All-Time');
    const formatted = formatTokensSplit(gameState.globalClicks);
    setText(headerAlltimeClicksEl, formatted.value);
    setText(headerAlltimeSuffixEl, formatted.suffix);
  }
}

/**
 * Fetch and display global stats (active players)
 */
async function updateGlobalStats(): Promise<void> {
  try {
    // Fetch active players from our API (heartbeat-based)
    const activeUsers = IS_V2 ? await fetchActiveUsersV2() : await fetchActiveUsers();

    // Update displays
    setText(activeHumansEl, activeUsers.activeHumans.toString());

    // Cache values for toggle display
    if (activeUsers.globalClicks !== undefined) {
      gameState.setGlobalClicks(activeUsers.globalClicks);
    }
    if (activeUsers.globalEarned !== undefined) {
      cachedGlobalEarned = activeUsers.globalEarned;
    }

    // Update the header based on current toggle state
    refreshAlltimeDisplay();
  } catch (error) {
    console.warn('Failed to update global stats:', error);
  }
}

/**
 * Start periodic global stats updates
 */
function startGlobalStatsUpdates(): void {
  // Initial fetch
  updateGlobalStats();

  // Update every 30 seconds for active users and global clicks (from API)
  setInterval(updateGlobalStats, 30000);
}

// ============ Modals ============

function showModal(modal: HTMLElement): void {
  addClass(modal, 'visible');
}

function hideModal(modal: HTMLElement): void {
  removeClass(modal, 'visible');
}

// showWalletModal removed - AppKit handles wallet modal

function showAchievementToast(name: string, desc: string): void {
  setText(achievementNameEl, name);
  setText(achievementDescEl, desc);
  addClass(achievementToast, 'visible');
  setTimeout(() => removeClass(achievementToast, 'visible'), 4000);
}

// ============ Turnstile Verification ============

declare const turnstile: {
  render: (selector: string, options: {
    sitekey: string;
    callback: (token: string) => void;
    'error-callback'?: (errorCode: string) => void;
    'expired-callback'?: () => void;
    theme?: 'light' | 'dark';
  }) => string;
  reset: (widgetId: string) => void;
};

function showTurnstileModal(): void {
  showModal(turnstileModal);

  if (!turnstileWidgetId && typeof turnstile !== 'undefined') {
    turnstileWidgetId = turnstile.render('#turnstile-widget', {
      sitekey: CONFIG.turnstileSiteKey,
      callback: onTurnstileSuccess,
      'error-callback': (errorCode) => {
        console.error('[Turnstile] Error:', errorCode);
      },
      'expired-callback': () => {
        turnstileToken = null;
        // Token expired, will need to re-verify on next submit
      },
      theme: 'dark'
    });
  } else if (turnstileWidgetId && typeof turnstile !== 'undefined') {
    turnstile.reset(turnstileWidgetId);
  }
}

function onTurnstileSuccess(token: string): void {
  turnstileToken = token;
  hideModal(turnstileModal);

  // Retry pending clicks if any
  if (gameState.pendingNonces.length >= CONFIG.minBatchSize) {
    // Re-trigger submit/claim - use appropriate handler based on mode
    if (IS_V2) {
      handleV2Claim(new Event('click'));
    } else {
      handleSubmit(new Event('click'));
    }
  }
}

async function requestV2ClaimAttestation(epoch: number): Promise<V2ClaimSignatureResponse> {
  if (!gameState.userAddress) {
    return { error: 'Wallet not connected' };
  }

  let response = await requestV2ClaimSignature(gameState.userAddress, epoch, {
    turnstileToken,
  });

  if (response.requiresVerification) {
    turnstileToken = null;
    showTurnstileModal();
    return response;
  }

  if (response.requiresSignature && response.challenge) {
    const signer = getSigner();
    if (!signer) {
      return { error: 'Wallet not connected' };
    }

    // Store the challenge to send back with the signature
    const originalChallenge = response.challenge;

    // Security: verify the challenge is bound to this specific claim request.
    // A well-formed challenge should reference our address and epoch to prevent
    // a compromised API from issuing generic challenges that could be replayed.
    const challengeLower = originalChallenge.toLowerCase();
    if (gameState.userAddress && !challengeLower.includes(gameState.userAddress.toLowerCase().slice(2))) {
      console.error('[V2 Attestation] Challenge does not reference our address — refusing to sign');
      return { error: 'Invalid challenge (address mismatch)' };
    }

    try {
      const walletSignature = await signer.signMessage(originalChallenge);

      response = await requestV2ClaimSignature(gameState.userAddress, epoch, {
        turnstileToken,
        walletSignature,
        challenge: originalChallenge,
      });

      if (response.requiresVerification) {
        turnstileToken = null;
        showTurnstileModal();
      }
    } catch (err) {
      console.error('[V2 Attestation] Wallet signature rejected');
      return { error: 'Wallet signature rejected' };
    }
  }

  return response;
}

function showClaimModal(milestoneId: string, tier: number): void {
  gameState.setPendingClaim({ milestoneId, tier });

  const info = getMilestoneInfo(tier);
  const slot = findSlotByTier(tier);

  const previewEl = getElement('claim-nft-preview');
  const tierNameEl = getElement('claim-tier-name');
  const tierDescEl = getElement('claim-tier-desc');
  const claimBtn = getElement<HTMLButtonElement>('claim-nft-btn');

  // Set preview image
  if (slot?.cursor) {
    setHtml(previewEl, `<img src="cursors/${slot.cursor}.png" alt="${info.name}" style="width:100%;height:100%;object-fit:contain;">`);
  } else if (isGlobalMilestone(tier)) {
    setHtml(previewEl, `<img src="one-of-ones/${tier}.png" alt="${info.name}" style="width:100%;height:100%;object-fit:contain;">`);
  } else {
    setHtml(previewEl, '');
    setText(previewEl, info.emoji);
  }

  setText(tierNameEl, info.name);
  setText(tierDescEl, info.desc);
  setText(claimBtn, 'Mint NFT');
  claimBtn.disabled = false;
  removeClass(claimBtn, 'claiming');

  showModal(claimModal);
}

function showCollectionModal(): void {
  // Update equipped cursor name display
  setText(equippedCursorName, getEquippedCursorName());

  renderTrophySection();
  renderCollectionGrid();
  showModal(collectionModal);
}

/**
 * Show the rankings modal with tabs for Global and each game
 */
function showRankingsModal(): void {
  // Render tabs
  renderRankingsTabs();

  // Load rankings for current tab
  loadRankingsForTab(rankingsTab);

  showModal(rankingsModal);
}

/**
 * Render the tabs for the rankings modal
 */
function renderRankingsTabs(): void {
  let tabsHtml = '';

  if (IS_V2) {
    const epochLabel = gameState.isGameActive ? 'Current Epoch' : 'Off-Season';
    // V2 mode: 3 tabs matching the leaderboard panel
    const tabs: { id: string; label: string }[] = [
      { id: 'epoch', label: epochLabel },
      { id: 'alltime', label: 'All-Time Clicks' },
      { id: 'earned', label: 'All-Time Earned' },
    ];
    for (const tab of tabs) {
      const isActive = rankingsTab === tab.id;
      tabsHtml += `<button class="rankings-tab${isActive ? ' active' : ''}" data-tab="${tab.id}">${tab.label}</button>`;
    }
  } else {
    // V1 mode: global + per-game tabs
    const games = getAllGames();
    tabsHtml = `<button class="rankings-tab${rankingsTab === 'global' ? ' active' : ''}" data-tab="global">All-Time Humans</button>`;
    for (const game of games) {
      const isActive = rankingsTab === game.id;
      tabsHtml += `<button class="rankings-tab${isActive ? ' active' : ''}" data-tab="${game.id}">${game.name}</button>`;
    }
  }

  setHtml(rankingsTabsEl, tabsHtml);

  // Add click handlers to tabs
  const tabBtns = rankingsTabsEl.querySelectorAll('.rankings-tab');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab') || (IS_V2 ? 'epoch' : 'global');
      setRankingsTab(tabId);
    });
  });
}

/**
 * Set the active rankings tab
 */
function setRankingsTab(tabId: string): void {
  rankingsTab = tabId;

  // Update tab button states
  const tabBtns = rankingsTabsEl.querySelectorAll('.rankings-tab');
  tabBtns.forEach(btn => {
    const btnTabId = btn.getAttribute('data-tab');
    if (btnTabId === tabId) {
      addClass(btn as HTMLElement, 'active');
    } else {
      removeClass(btn as HTMLElement, 'active');
    }
  });

  // Load rankings for this tab
  loadRankingsForTab(tabId);
}

/**
 * Load and render rankings for a specific tab
 */
async function loadRankingsForTab(tabId: string): Promise<void> {
  // Show loading
  setHtml(rankingsListEl, '<li class="rankings-loading">Loading...</li>');

  try {
    if (IS_V2) {
      // V2 mode: Use V2 leaderboard API with type
      rankingsMatrixHeaderEl.style.display = 'none';
      const type = (tabId === 'epoch' || tabId === 'alltime' || tabId === 'earned') ? tabId as V2LeaderboardType : 'epoch';
      const data = await fetchV2Leaderboard(50, type);
      renderRankingsList(data, type === 'earned');
    } else if (tabId === 'global') {
      // V1 Global: all-time frontend clicks from Redis (simple list)
      rankingsMatrixHeaderEl.style.display = 'none';
      const data = await fetchGlobalLeaderboard(50);
      renderRankingsList(data);
    } else {
      // V1 Game: matrix view with on-chain + human clicks
      rankingsMatrixHeaderEl.style.display = 'flex';
      const games = getAllGames();
      const game = games.find(g => g.id === tabId);
      if (game) {
        const data = await fetchMatrixLeaderboard(game.subgraphUrl, 50);
        renderMatrixRankingsList(data);
      } else {
        setHtml(rankingsListEl, '<li class="rankings-loading">Game not found</li>');
      }
    }
  } catch (error) {
    console.error('Failed to load rankings:', error);
    setHtml(rankingsListEl, '<li class="rankings-loading">Failed to load rankings</li>');
  }
}

/**
 * Render the rankings list
 */
function renderRankingsList(data: MergedLeaderboardEntry[], isEarned = false): void {
  if (data.length === 0) {
    const epochEmptyLabel = gameState.isGameActive ? 'No clicks this epoch!' : 'No off-season clicks yet!';
    const emptyMessages: Record<string, string> = {
      epoch: epochEmptyLabel,
      alltime: 'No clicks recorded yet!',
      earned: 'No earnings yet!',
      global: 'No clicks recorded yet!',
    };
    setHtml(rankingsListEl, `<li class="rankings-loading">${emptyMessages[rankingsTab] || 'No data yet!'}</li>`);
    return;
  }

  const userAddrLower = gameState.userAddress?.toLowerCase();

  const html = data
    .map((entry, index) => {
      const isYou = userAddrLower && entry.address?.toLowerCase() === userAddrLower;
      const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';

      // Priority: server name > cached ENS > shortened address
      // All user-supplied strings are escaped to prevent XSS
      const cachedEns = getCachedEns(entry.address);
      const rawName =
        entry.name && entry.name !== 'Anonymous'
          ? entry.name
          : cachedEns || shortenAddress(entry.address);
      const displayName = escapeHtml(rawName);
      const safeAddress = escapeHtml(entry.address);

      const milestone = getHighestMilestone(entry.totalClicks);
      const iconHtml = milestone
        ? `<img src="cursors/${escapeHtml(milestone.cursor)}.png" class="rankings-cursor-icon" alt="${escapeHtml(milestone.name)}">`
        : `<span class="rankings-indicator">🧑</span>`;

      // Show earned amount for earned tab, click count otherwise
      const valueHtml = isEarned && entry.totalEarned
        ? `<span class="rankings-clicks rankings-earned">${formatWeiAsTokens(entry.totalEarned)}</span>`
        : `<span class="rankings-clicks">${formatNumber(entry.totalClicks)}</span>`;

      return `
        <li class="rankings-item ${isYou ? 'is-you' : ''}" data-address="${safeAddress}">
          <span class="rankings-rank ${rankClass}">${entry.rank}</span>
          ${iconHtml}
          <span class="rankings-name ${isYou ? 'is-you' : ''}">${displayName}${isYou ? ' (you)' : ''}</span>
          ${valueHtml}
        </li>
      `;
    })
    .join('');

  setHtml(rankingsListEl, html);

  // Click-to-copy address on rankings names
  rankingsListEl.querySelectorAll('.rankings-name').forEach(nameEl => {
    nameEl.addEventListener('click', (e) => {
      const li = (e.target as HTMLElement).closest('.rankings-item') as HTMLElement | null;
      const address = li?.dataset.address;
      if (address) {
        navigator.clipboard.writeText(address).then(() => {
          showAchievementToast('Copied!', `${address.slice(0, 6)}...${address.slice(-4)} copied to clipboard`);
        });
      }
    });
  });

  // Kick off ENS resolution in background
  resolveRankingsEns(data);
}

/**
 * Render the matrix rankings list (for game tabs with on-chain + human columns)
 */
function renderMatrixRankingsList(data: MatrixLeaderboardEntry[]): void {
  if (data.length === 0) {
    setHtml(rankingsListEl, '<li class="rankings-loading">No clicks recorded yet!</li>');
    return;
  }

  const userAddrLower = gameState.userAddress?.toLowerCase();

  const html = data
    .map((entry) => {
      const isYou = userAddrLower && entry.address?.toLowerCase() === userAddrLower;
      const rankClass = entry.rank === 1 ? 'gold' : entry.rank === 2 ? 'silver' : entry.rank === 3 ? 'bronze' : '';

      // Priority: server name > cached ENS > shortened address
      const cachedEns = getCachedEns(entry.address);
      const displayName =
        entry.name && entry.name !== 'Anonymous'
          ? entry.name
          : cachedEns || shortenAddress(entry.address);

      // Determine if mostly human: human clicks > 50% of on-chain clicks
      const isHuman = entry.humanClicks > 0 && entry.humanClicks >= entry.onChainClicks * 0.5;
      const labelClass = isHuman ? 'human-label' : 'bot-label';
      const labelText = isHuman ? 'H' : 'B';

      return `
        <li class="rankings-item matrix-item ${isYou ? 'is-you' : ''}" data-address="${entry.address}">
          <span class="rankings-rank ${rankClass}">${entry.rank}</span>
          <span class="rankings-type-label ${labelClass}">${labelText}</span>
          <span class="rankings-name ${isYou ? 'is-you' : ''}">${displayName}${isYou ? ' (you)' : ''}</span>
          <span class="rankings-clicks matrix-clicks">${formatNumber(entry.onChainClicks)}</span>
          <span class="rankings-clicks matrix-clicks human-clicks">${formatNumber(entry.humanClicks)}</span>
        </li>
      `;
    })
    .join('');

  setHtml(rankingsListEl, html);

  // Kick off ENS resolution in background
  resolveMatrixRankingsEns(data);
}

/**
 * Resolve ENS names for matrix rankings entries in the background
 */
async function resolveMatrixRankingsEns(data: MatrixLeaderboardEntry[]): Promise<void> {
  const addressesToResolve = data
    .filter(entry => !entry.name && !getCachedEns(entry.address))
    .map(entry => entry.address);

  if (addressesToResolve.length === 0) return;

  for (const address of addressesToResolve) {
    lookupEns(address).then(ensName => {
      if (ensName) {
        const item = rankingsListEl.querySelector(`[data-address="${address}"]`);
        if (item) {
          const nameEl = item.querySelector('.rankings-name');
          if (nameEl) {
            const isYou = gameState.userAddress?.toLowerCase() === address.toLowerCase();
            nameEl.textContent = ensName + (isYou ? ' (you)' : '');
          }
        }
      }
    });
  }
}

/**
 * Resolve ENS names for rankings entries in the background
 */
async function resolveRankingsEns(data: MergedLeaderboardEntry[]): Promise<void> {
  const addressesToResolve = data
    .filter(entry => !entry.name && !getCachedEns(entry.address))
    .map(entry => entry.address);

  if (addressesToResolve.length === 0) return;

  // Resolve all addresses in parallel
  for (const address of addressesToResolve) {
    lookupEns(address).then(ensName => {
      if (ensName) {
        // Update the DOM element with the ENS name
        const item = rankingsListEl.querySelector(`[data-address="${address}"]`);
        if (item) {
          const nameEl = item.querySelector('.rankings-name');
          if (nameEl) {
            const isYou = gameState.userAddress?.toLowerCase() === address.toLowerCase();
            nameEl.textContent = ensName + (isYou ? ' (you)' : '');
          }
        }
      }
    });
  }
}

// ============ Streak Panel ============

/**
 * Update the streak panel with current streak data
 */
function updateStreakPanel(stats: ServerStatsResponse): void {
  if (!stats.streak) {
    streakStat.classList.remove('visible');
    return;
  }

  const current = stats.streak.current || 0;
  setText(streakCurrentEl, String(current));

  // Show streak stat if connected
  if (gameState.isConnected) {
    streakStat.classList.add('visible');
  }
}

// ============ NFT Panel & Collection ============

/**
 * Render the NFT panel showing claimable achievements
 */
async function renderNftPanel(stats: ServerStatsResponse): Promise<void> {
  if (!stats || !hasNftContract()) {
    // Still show the panel with an empty message if wallet is connected
    if (gameState.isConnected) {
      nftPanel.style.display = 'block';
      setHtml(nftList, '<li class="nft-empty">No achievements yet</li>');
    } else {
      nftPanel.style.display = 'none';
    }
    return;
  }

  // Collect all unlocked milestones and achievements
  const allUnlocked: Array<{ id: string; tier: number; type: string }> = [];

  // Personal milestones
  if (stats.milestones?.unlocked) {
    for (const id of stats.milestones.unlocked) {
      const tier = MILESTONE_ID_TO_TIER[id as keyof typeof MILESTONE_ID_TO_TIER];
      if (tier) allUnlocked.push({ id, tier, type: 'personal' });
    }
  }

  // Other achievements (global, hidden, streak, epoch)
  if (stats.achievements?.unlocked) {
    for (const id of stats.achievements.unlocked) {
      const tier = MILESTONE_ID_TO_TIER[id as keyof typeof MILESTONE_ID_TO_TIER];
      if (tier) allUnlocked.push({ id, tier, type: tier >= 200 && tier < 500 ? 'global' : 'hidden' });
    }
  }

  // Populate module-level set so collection grid can show unlocked-but-not-minted items
  unlockedTiers = new Set(allUnlocked.map(u => u.tier));

  // Always show the panel when wallet is connected (even if no achievements yet)
  nftPanel.style.display = 'block';

  // Check on-chain claim status for each
  const nftItems: Array<{ id: string; tier: number; type: string; claimed: boolean }> = [];
  for (const item of allUnlocked) {
    let isClaimed = claimedOnChain.has(item.tier);
    if (!isClaimed) {
      isClaimed = await checkNftClaimed(gameState.userAddress!, item.tier);
      if (isClaimed) claimedOnChain.add(item.tier);
    }
    nftItems.push({ ...item, claimed: isClaimed });
  }

  // Sort: unclaimed first, then by tier
  nftItems.sort((a, b) => {
    if (a.claimed !== b.claimed) return a.claimed ? 1 : -1;
    return a.tier - b.tier;
  });

  // Render the list
  if (nftItems.length === 0) {
    setHtml(nftList, '<li class="nft-empty">No achievements yet</li>');
    return;
  }

  let html = '';
  for (const item of nftItems) {
    const info = getMilestoneInfo(item.tier);
    const slot = findSlotByTier(item.tier);
    const claimedClass = item.claimed ? ' claimed' : '';

    // Use cursor image if available, 1/1 image for globals, otherwise fall back to emoji
    let iconHtml: string;
    if (slot?.cursor) {
      iconHtml = `<img src="cursors/${slot.cursor}.png" class="nft-cursor-icon" alt="${info.name}">`;
    } else if (item.tier >= 200 && item.tier < 500) {
      iconHtml = `<img src="one-of-ones/${item.tier}.png" class="nft-cursor-icon" alt="${info.name}">`;
    } else {
      iconHtml = `<span class="nft-emoji">${info.emoji}</span>`;
    }

    html += `
      <li class="nft-item${claimedClass}" data-tier="${item.tier}" data-id="${item.id}">
        ${iconHtml}
        <div class="nft-info">
          <div class="nft-name">${info.name}</div>
          <div class="nft-desc">${info.desc}</div>
        </div>
        ${item.claimed ? '' : '<button class="nft-mint-btn">MINT</button>'}
      </li>
    `;
  }

  setHtml(nftList, html);

  // Add click handlers to unclaimed items
  const unclaimedItems = nftList.querySelectorAll('.nft-item:not(.claimed)');
  unclaimedItems.forEach(li => {
    li.addEventListener('click', () => {
      const tier = parseInt(li.getAttribute('data-tier') || '0', 10);
      const id = li.getAttribute('data-id') || '';
      if (tier > 0) {
        showClaimModal(id, tier);
      }
    });
  });
}

/**
 * Render the trophy section (global 1/1s)
 */
function renderTrophySection(): void {
  const ownedTrophies = GLOBAL_ONE_OF_ONE_TIERS.filter(t => claimedOnChain.has(t.tier));
  const totalTrophies = GLOBAL_ONE_OF_ONE_TIERS.length;

  // Update the title with owned/total count
  setText(trophyTitle, `LEGENDARY ${ownedTrophies.length}/${totalTrophies}`);

  if (ownedTrophies.length === 0) {
    addClass(trophySection, 'empty');
    return;
  }

  removeClass(trophySection, 'empty');
  trophyGrid.innerHTML = '';

  for (const trophy of ownedTrophies) {
    const div = document.createElement('div');
    div.className = 'trophy-item';
    div.style.cursor = 'pointer';
    div.innerHTML = `
      <img src="one-of-ones/${trophy.tier}.png" class="trophy-img" alt="${trophy.name}">
      <span class="trophy-name">${trophy.name}</span>
      <span class="trophy-click-num">CLICK ${trophy.globalClick.toLocaleString()}</span>
    `;

    // Click to view larger
    div.addEventListener('click', () => {
      showImageLightbox(
        `one-of-ones/${trophy.tier}.png`,
        trophy.name,
        `CLICK ${trophy.globalClick.toLocaleString()}`
      );
    });

    trophyGrid.appendChild(div);
  }
}

/**
 * Render the collection grid
 */
function renderCollectionGrid(): void {
  const equippedCursor = gameState.equippedCursor;
  collectionGrid.innerHTML = '';

  for (const slot of COLLECTION_SLOTS) {
    const isMinted = claimedOnChain.has(slot.tier);
    const isUnlocked = unlockedTiers.has(slot.tier);
    const isEquipped = slot.cursor && slot.cursor === equippedCursor;

    const div = document.createElement('div');

    if (isMinted) {
      // ---- MINTED: show full item with equip/lightbox handlers ----
      div.className = 'collection-item' + (isEquipped ? ' equipped' : '');

      let iconHtml: string;
      const isGlobal = slot.tier >= 200 && slot.tier < 500;

      if (slot.cursor) {
        iconHtml = `<img src="cursors/${slot.cursor}.png" class="collection-item-img" alt="${slot.name}">`;
      } else if (isGlobal) {
        iconHtml = `<img src="one-of-ones/${slot.tier}.png" class="collection-item-img" alt="${slot.name}">`;
      } else {
        const info = getMilestoneInfo(slot.tier);
        iconHtml = `<span class="collection-item-emoji">${info.emoji}</span>`;
      }

      div.innerHTML = `
        ${iconHtml}
        <span class="collection-item-name">${slot.name}</span>
      `;

      // Add click handler: cursor items equip, global 1/1s open lightbox
      if (slot.cursor) {
        div.addEventListener('click', () => {
          applyCursor(slot.cursor!);
          setText(equippedCursorName, slot.name);
          renderCollectionGrid();
          showAchievementToast('Cursor Equipped!', `Now using: ${slot.name}`);
        });
      } else if (isGlobal) {
        div.style.cursor = 'pointer';
        const globalInfo = GLOBAL_ONE_OF_ONE_TIERS.find(g => g.tier === slot.tier);
        const clickNumText = globalInfo ? `CLICK ${globalInfo.globalClick.toLocaleString()}` : '';
        div.addEventListener('click', () => {
          showImageLightbox(
            `one-of-ones/${slot.tier}.png`,
            slot.name,
            clickNumText
          );
        });
      }
    } else if (isUnlocked) {
      // ---- UNLOCKED BUT NOT MINTED: show preview + MINT button ----
      div.className = 'collection-item unlocked';

      let iconHtml: string;
      const isGlobal = slot.tier >= 200 && slot.tier < 500;

      if (slot.cursor) {
        iconHtml = `<img src="cursors/${slot.cursor}.png" class="collection-item-img" alt="${slot.name}">`;
      } else if (isGlobal) {
        iconHtml = `<img src="one-of-ones/${slot.tier}.png" class="collection-item-img" alt="${slot.name}">`;
      } else {
        const info = getMilestoneInfo(slot.tier);
        iconHtml = `<span class="collection-item-emoji">${info.emoji}</span>`;
      }

      div.innerHTML = `
        ${iconHtml}
        <span class="collection-item-name">${slot.name}</span>
        <button class="collection-mint-btn">MINT</button>
      `;

      // Mint button opens the claim modal
      const mintBtn = div.querySelector('.collection-mint-btn');
      mintBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        // Find the milestone ID for this tier
        const milestoneId = Object.entries(MILESTONE_ID_TO_TIER).find(
          ([, t]) => t === slot.tier
        )?.[0] || '';
        showClaimModal(milestoneId, slot.tier);
      });
    } else {
      // ---- LOCKED: show mystery placeholder ----
      div.className = 'collection-item locked';
      div.innerHTML = `
        <div class="collection-item-slot">?</div>
        <span class="collection-item-name">????</span>
      `;
    }

    collectionGrid.appendChild(div);
  }
}

// ============ NFT Claiming ============

/**
 * Handle NFT claim button click
 */
async function handleClaimNft(): Promise<void> {
  const pendingClaim = gameState.pendingClaim;
  if (!pendingClaim || !gameState.userAddress) return;

  const { tier } = pendingClaim;

  try {
    claimNftBtn.disabled = true;
    setText(claimNftBtn, 'Getting signature...');
    addClass(claimNftBtn, 'claiming');

    // Get signature from server
    const sigResponse = await getClaimSignature(gameState.userAddress, tier);

    setText(claimNftBtn, 'Confirm in wallet...');

    // Claim on-chain
    const receipt = await claimNft(tier, sigResponse.signature);

    // Confirm with server
    await confirmClaim(gameState.userAddress, tier, receipt.transactionHash);

    // Update local state
    claimedOnChain.add(tier);
    setText(claimNftBtn, 'Claimed!');

    // Refresh NFT panel
    if (serverStats) {
      await renderNftPanel(serverStats);
    }

    setTimeout(() => hideModal(claimModal), 1500);

  } catch (error) {
    console.error('NFT claim error:', error);
    setText(claimNftBtn, 'Error - Try Again');
    claimNftBtn.disabled = false;
    removeClass(claimNftBtn, 'claiming');

    if (error instanceof Error && error.message.includes('user rejected')) {
      setText(claimNftBtn, 'Mint NFT');
    }
  }
}

// ============ Start App ============

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
