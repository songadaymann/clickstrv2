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

// Import config
import { CONFIG, hasNftContract, getCurrentGame, getAllGames, CURRENT_NETWORK, type GameConfig } from './config/index.ts';

// Check if we're using V2 (Sepolia)
const IS_V2 = CURRENT_NETWORK === 'sepolia';

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
  fetchRecentBotActivity,
  syncAchievements,
  lookupEns,
  getCachedEns,
  initWalletSubscriptions,
  openConnectModal,
  getSigner,
  requestV2ClaimSignature,
  submitClicksV2,
  fetchV2Stats,
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
  setText,
  setHtml,
  formatNumber,
  formatTokens,
  formatTokensSplit,
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
let activeBotsEl: HTMLElement;
let gameStatusEl: HTMLElement;
let difficultyDisplayEl: HTMLElement;
let rewardPerClickEl: HTMLElement;

// ============ Local State ============
let isPressed = false;
let isMiningClick = false;
let turnstileToken: string | null = null;
let turnstileWidgetId: string | null = null;
let leaderboardData: MergedLeaderboardEntry[] = [];
let claimedOnChain: Set<number> = new Set();
let serverStats: ServerStatsResponse | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let leaderboardMode: 'global' | 'game' = 'global';
let currentGame: GameConfig | undefined;
let targetClicksPerEpoch: bigint = 0n;
let dailyEmissionRate: bigint = 0n;
let v2ClaimableEpochs: V2ClaimableEpoch[] = [];
let v2IsClaimingInProgress = false;

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
let leaderboardToggleGlobal: HTMLButtonElement;
let leaderboardToggleGame: HTMLButtonElement;

// Rankings modal elements
let rankingsTabsEl: HTMLElement;
let rankingsListEl: HTMLElement;
let rankingsMatrixHeaderEl: HTMLElement;
let rankingsTab: 'global' | string = 'global'; // 'global' or game id

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
  activeBotsEl = getElement('active-bots');
  gameStatusEl = getElement('game-status');
  difficultyDisplayEl = getElement('difficulty-display');
  rewardPerClickEl = getElement('reward-per-click');

  // Leaderboard toggle elements
  leaderboardToggleGlobal = getElement<HTMLButtonElement>('leaderboard-toggle-global');
  leaderboardToggleGame = getElement<HTMLButtonElement>('leaderboard-toggle-game');

  // Rankings modal elements
  rankingsTabsEl = getElement('rankings-tabs');
  rankingsListEl = getElement('rankings-list');
  rankingsMatrixHeaderEl = getElement('rankings-matrix-header');

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
  leaderboardToggleGlobal.addEventListener('click', () => setLeaderboardMode('global'));
  leaderboardToggleGame.addEventListener('click', () => setLeaderboardMode('game'));

  // Lightbox
  setupLightboxListeners();
}

// Wallet modal setup removed - AppKit provides its own modal UI

/** Token contract address for copying */
const TOKEN_ADDRESS = '0x7ddbd0c4a0383a0f9611b715809f92c90e1d991d';

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

/**
 * Handle claiming a single epoch
 */
async function handleV2ClaimSingle(e: Event): Promise<void> {
  if (v2IsClaimingInProgress) return;

  const btn = e.target as HTMLButtonElement;
  const idx = parseInt(btn.dataset.idx || '0', 10);
  const epochData = v2ClaimableEpochs[idx];

  if (!epochData) return;

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
  }
}

/**
 * Handle claiming all epochs
 */
async function handleV2ClaimAll(): Promise<void> {
  if (v2IsClaimingInProgress || v2ClaimableEpochs.length === 0) return;

  v2ClaimAllBtn.disabled = true;
  v2ClaimAllBtn.textContent = 'Claiming...';

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
    isMiningClick = true;
    console.log('[Button] Starting mining...');
    startMining(onClickMined);

    // Safety timeout: if mining takes more than 10 seconds, something is wrong
    miningTimeout = setTimeout(() => {
      if (isMiningClick) {
        console.warn('[Mining] Timeout - resetting button state');
        terminateMining();
        onClickMined(0n); // Reset UI without adding click
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

function onClickMined(nonce: bigint): void {
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
      gameState.addClick(nonce);
      updateDisplays();
      updateSubmitButton();
    }
  }, remainingDelay);
}

// ============ Connection ============

async function onConnected(): Promise<void> {
  initializeContracts();

  // Fetch game data from contract (both V1 and V2)
  // This sets poolRemaining, epoch info, and game active status
  await refreshGameData();

  // Fetch reward params (for difficulty display)
  const rewardParams = await fetchRewardParams();
  if (rewardParams) {
    targetClicksPerEpoch = rewardParams.targetClicksPerEpoch;
    dailyEmissionRate = rewardParams.dailyEmissionRate;
  }

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
}

async function handleDisconnect(): Promise<void> {
  terminateMining();
  stopHeartbeat();
  await disconnect();
  updateConnectButton();
  isMiningClick = false;
  isPressed = false;
  buttonImg.src = 'button-up.jpg';
  // Hide streak stat on disconnect
  streakStat.classList.remove('visible');
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

async function handleOnChainSubmit(nonces: readonly bigint[]): Promise<void> {
  // Submit to blockchain
  const receipt = await submitClicks([...nonces]);
  if (!receipt) return;

  // Record to server (with Turnstile token + PoW nonces)
  const clicksToRecord = Math.min(gameState.serverClicksPending, nonces.length);
  if (clicksToRecord > 0) {
    const result = await recordClicksToServer(
      gameState.userAddress!,
      clicksToRecord,
      turnstileToken,
      nonces.slice(0, clicksToRecord).map(n => n.toString()),
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

async function handleOffChainSubmit(nonces: readonly bigint[]): Promise<void> {
  // Record to API with Turnstile token + PoW nonces (no blockchain submission)
  const result = await recordClicksToServer(
    gameState.userAddress!,
    nonces.length,
    turnstileToken,
    nonces.map(n => n.toString())
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
 * Handle V2 submission (off-chain to API, claim rewards later)
 */
async function handleV2Submit(nonces: readonly bigint[]): Promise<void> {
  // Submit to V2 API
  const result = await submitClicksV2(
    gameState.userAddress!,
    nonces.map(n => n.toString()),
    turnstileToken
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

    // Clear submitted clicks
    gameState.clearSubmittedClicks(nonces.length);

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
 * Handle V2 Claim button - full flow:
 * 1. Submit clicks to API (off-chain validation)
 * 2. Get claim signature from server
 * 3. Call contract to claim tokens
 */
async function handleV2Claim(e: Event): Promise<void> {
  e.stopPropagation();

  console.log('[V2 Claim] handleV2Claim called');
  console.log('[V2 Claim] pendingNonces:', gameState.pendingNonces.length);
  console.log('[V2 Claim] turnstileToken:', turnstileToken ? 'present' : 'null');
  console.log('[V2 Claim] userAddress:', gameState.userAddress);
  console.log('[V2 Claim] currentEpoch:', gameState.currentEpoch);

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

    // Step 1: Submit clicks to V2 API
    const submitResult = await submitClicksV2(
      gameState.userAddress!,
      nonces.map(n => n.toString()),
      turnstileToken
    );

    if (!submitResult.success) {
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

    // Get current epoch from response or state
    const currentEpoch = submitResult.epoch ?? gameState.currentEpoch;

    setText(claimBtn, 'Getting signature...');

    // Step 2: Get claim signature from server (handles wallet signature if required)
    const sigResponse = await requestV2ClaimAttestation(currentEpoch);

    if (sigResponse.requiresVerification) {
      // Turnstile needed - modal already shown by requestV2ClaimAttestation
      claimBtn.disabled = false;
      removeClass(claimBtn, 'claiming');
      return;
    }

    if (!sigResponse.success || !sigResponse.signature) {
      console.error('[V2 Claim] Failed to get signature:', sigResponse.error);
      setText(claimBtn, 'Signature failed!');
      setTimeout(() => updateSubmitButton(), 2000);
      claimBtn.disabled = false;
      removeClass(claimBtn, 'claiming');
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

      // Clear submitted clicks
      gameState.clearSubmittedClicks(nonces.length);

      // Update local state
      if (submitResult.lifetimeClicks !== undefined) {
        gameState.setAllTimeClicks(submitResult.lifetimeClicks);
      }

      // Handle achievements
      if (submitResult.newMilestones && submitResult.newMilestones.length > 0) {
        handleAchievements({ newMilestones: submitResult.newMilestones });
      }

      // Update UI
      updateDisplays();
      updateSubmitButton();

      // Refresh user stats from contract
      await refreshUserStats();

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

  } catch (error) {
    console.error('[V2 Claim] Error:', error);
    setText(claimBtn, 'Error!');
    setTimeout(() => updateSubmitButton(), 2000);
    claimBtn.disabled = false;
    removeClass(claimBtn, 'claiming');
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

  // Queue claims
  if (claimable.length > 0 && hasNftContract()) {
    setTimeout(() => {
      const first = claimable.shift()!;
      gameState.addToClaimQueue(...claimable);
      showClaimModal(first.milestoneId, first.tier);
    }, 2000);
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

  // Calculate estimated reward per click
  // Formula: (poolRemaining * dailyEmissionRate / 10000) / targetClicksPerEpoch / 2
  // This gives gross reward per click, then we take half (player gets 50%)
  if (targetClicksPerEpoch > 0n && dailyEmissionRate > 0n) {
    const poolWei = BigInt(Math.floor(gameState.poolRemaining * 1e18));
    const epochBudget = (poolWei * dailyEmissionRate) / 10000n;
    const grossPerClick = epochBudget / targetClicksPerEpoch;
    const playerPerClick = grossPerClick / 2n;

    // Convert to tokens (18 decimals)
    const rewardTokens = Number(playerPerClick) / 1e18;

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
  } else {
    setText(rewardPerClickEl, '--');
  }
}

function updateSubmitButton(): void {
  const hasEnoughClicks = gameState.validClicks >= CONFIG.minBatchSize;
  const canSubmit = hasEnoughClicks && gameState.isConnected;

  if (IS_V2) {
    // V2: Use green Claim button
    removeClass(submitContainer, 'visible'); // Hide V1 submit button
    claimBtn.disabled = !canSubmit;
    setText(claimBtn, `Claim (${gameState.validClicks})`);

    if (hasEnoughClicks) {
      addClass(claimContainer, 'visible');
      addClass(claimBtn, 'has-clicks'); // Trigger pulsing animation
    } else {
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
 * Set the leaderboard mode (global or current game)
 */
function setLeaderboardMode(mode: 'global' | 'game'): void {
  leaderboardMode = mode;

  // Update toggle button states
  if (mode === 'global') {
    addClass(leaderboardToggleGlobal, 'active');
    removeClass(leaderboardToggleGame, 'active');
  } else {
    removeClass(leaderboardToggleGlobal, 'active');
    addClass(leaderboardToggleGame, 'active');
  }

  // Refresh leaderboard
  fetchLeaderboard();
}

async function fetchLeaderboard(): Promise<void> {
  if (IS_V2) {
    // V2 mode: Use V2 leaderboard API
    leaderboardData = await fetchV2Leaderboard(10);
  } else if (leaderboardMode === 'global') {
    // V1 Global: all-time frontend clicks from Redis
    leaderboardData = await fetchGlobalLeaderboard(10);
  } else {
    // V1 Game: on-chain clicks from current game's subgraph
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
    const message = leaderboardMode === 'global'
      ? 'No human clicks yet!'
      : 'No on-chain clicks yet!';
    setHtml(leaderboardListEl, `<li class="leaderboard-loading">${message}</li>`);
    return;
  }

  const userAddrLower = gameState.userAddress?.toLowerCase();

  const html = leaderboardData
    .map((entry, index) => {
      const isYou = userAddrLower && entry.address?.toLowerCase() === userAddrLower;
      const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';

      // Priority: server name > cached ENS > shortened address
      const cachedEns = getCachedEns(entry.address);
      const displayName =
        entry.name && entry.name !== 'Anonymous'
          ? entry.name
          : cachedEns || shortenAddress(entry.address);

      const milestone = getHighestMilestone(entry.totalClicks);
      const iconHtml = milestone
        ? `<img src="cursors/${milestone.cursor}.png" class="leaderboard-cursor-icon" alt="${milestone.name}">`
        : `<span class="leaderboard-indicator">${entry.isHuman ? '🧑' : '🤖'}</span>`;

      return `
        <li class="leaderboard-item ${isYou ? 'is-you' : ''}" data-address="${entry.address}">
          <span class="leaderboard-rank ${rankClass}">${entry.rank}</span>
          ${iconHtml}
          <span class="leaderboard-name ${isYou ? 'is-you' : ''}">${displayName}${isYou ? ' (you)' : ''}</span>
          <span class="leaderboard-clicks">${formatNumber(entry.totalClicks)}</span>
        </li>
      `;
    })
    .join('');

  setHtml(leaderboardListEl, html);

  // Kick off ENS resolution in background for addresses without cached ENS
  resolveLeaderboardEns();
}

/**
 * Resolve ENS names for leaderboard entries in the background
 * Updates the DOM when names are resolved
 */
async function resolveLeaderboardEns(): Promise<void> {
  // Debug: log what names we have
  console.log('[Leaderboard] Entry names:', leaderboardData.map(e => ({ addr: e.address?.slice(0,10), name: e.name, cached: getCachedEns(e.address) })));

  const addressesToResolve = leaderboardData
    .filter(entry => (!entry.name || entry.name === 'Anonymous') && !getCachedEns(entry.address))
    .map(entry => entry.address);

  console.log('[Leaderboard] ENS addresses to resolve:', addressesToResolve.length);
  if (addressesToResolve.length === 0) return;

  // Resolve all addresses in parallel
  for (const address of addressesToResolve) {
    lookupEns(address).then(ensName => {
      if (ensName) {
        // Update the DOM element with the ENS name
        const item = leaderboardListEl.querySelector(`[data-address="${address}"]`);
        console.log('[Leaderboard] DOM update for', address, ':', item ? 'found' : 'NOT FOUND');
        if (item) {
          const nameEl = item.querySelector('.leaderboard-name');
          if (nameEl) {
            const isYou = gameState.userAddress?.toLowerCase() === address.toLowerCase();
            nameEl.textContent = ensName + (isYou ? ' (you)' : '');
            console.log('[Leaderboard] Updated name to:', ensName);
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
    }
  }, 30000);
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
 * Fetch and display global stats (active humans + bots)
 */
async function updateGlobalStats(): Promise<void> {
  try {
    // Fetch active humans from our API (heartbeat-based)
    const activeUsersPromise = IS_V2 ? fetchActiveUsersV2() : fetchActiveUsers();

    // Fetch recent bot activity from subgraph (addresses that submitted in last 5 mins)
    // In V2 mode, there are no bots (human-only via Turnstile)
    const botActivityPromise = IS_V2 ? Promise.resolve(0) : fetchRecentBotActivity(5);

    const [activeUsers, recentBots] = await Promise.all([activeUsersPromise, botActivityPromise]);

    // Update displays
    setText(activeHumansEl, activeUsers.activeHumans.toString());
    setText(activeBotsEl, recentBots.toString());

    // Update all-time clicks in header with k/M suffix formatting
    if (activeUsers.globalClicks !== undefined) {
      const formatted = formatTokensSplit(activeUsers.globalClicks);
      setText(headerAlltimeClicksEl, formatted.value);
      setText(headerAlltimeSuffixEl, formatted.suffix);
    }
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

  console.log('[V2 Attestation] Requesting signature for epoch:', epoch);

  let response = await requestV2ClaimSignature(gameState.userAddress, epoch, {
    turnstileToken,
  });

  console.log('[V2 Attestation] Initial response:', response);

  if (response.requiresVerification) {
    console.log('[V2 Attestation] Needs Turnstile verification');
    turnstileToken = null;
    showTurnstileModal();
    return response;
  }

  if (response.requiresSignature && response.challenge) {
    console.log('[V2 Attestation] Needs wallet signature, challenge:', response.challenge);
    const signer = getSigner();
    if (!signer) {
      console.error('[V2 Attestation] No signer available');
      return { error: 'Wallet not connected' };
    }

    // Store the challenge to send back with the signature
    const originalChallenge = response.challenge;

    console.log('[V2 Attestation] Prompting wallet to sign...');
    try {
      const walletSignature = await signer.signMessage(originalChallenge);
      console.log('[V2 Attestation] Got wallet signature, retrying...');

      response = await requestV2ClaimSignature(gameState.userAddress, epoch, {
        turnstileToken,
        walletSignature,
        challenge: originalChallenge,
      });
      console.log('[V2 Attestation] Retry response:', response);

      if (response.requiresVerification) {
        turnstileToken = null;
        showTurnstileModal();
      }
    } catch (err) {
      console.error('[V2 Attestation] Wallet signature failed:', err);
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
  const games = getAllGames();

  // Build tabs HTML
  let tabsHtml = `<button class="rankings-tab${rankingsTab === 'global' ? ' active' : ''}" data-tab="global">All-Time Humans</button>`;

  for (const game of games) {
    const isActive = rankingsTab === game.id;
    tabsHtml += `<button class="rankings-tab${isActive ? ' active' : ''}" data-tab="${game.id}">${game.name}</button>`;
  }

  setHtml(rankingsTabsEl, tabsHtml);

  // Add click handlers to tabs
  const tabBtns = rankingsTabsEl.querySelectorAll('.rankings-tab');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab') || 'global';
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
      // V2 mode: Use V2 leaderboard API
      rankingsMatrixHeaderEl.style.display = 'none';
      const data = await fetchV2Leaderboard(50);
      renderRankingsList(data);
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
function renderRankingsList(data: MergedLeaderboardEntry[]): void {
  if (data.length === 0) {
    const message = rankingsTab === 'global'
      ? 'No clicks recorded yet!'
      : 'No on-chain submissions yet!';
    setHtml(rankingsListEl, `<li class="rankings-loading">${message}</li>`);
    return;
  }

  const userAddrLower = gameState.userAddress?.toLowerCase();

  const html = data
    .map((entry, index) => {
      const isYou = userAddrLower && entry.address?.toLowerCase() === userAddrLower;
      const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';

      // Priority: server name > cached ENS > shortened address
      const cachedEns = getCachedEns(entry.address);
      const displayName =
        entry.name && entry.name !== 'Anonymous'
          ? entry.name
          : cachedEns || shortenAddress(entry.address);

      const milestone = getHighestMilestone(entry.totalClicks);
      const iconHtml = milestone
        ? `<img src="cursors/${milestone.cursor}.png" class="rankings-cursor-icon" alt="${milestone.name}">`
        : `<span class="rankings-indicator">${entry.isHuman ? '🧑' : '🤖'}</span>`;

      return `
        <li class="rankings-item ${isYou ? 'is-you' : ''}" data-address="${entry.address}">
          <span class="rankings-rank ${rankClass}">${entry.rank}</span>
          ${iconHtml}
          <span class="rankings-name ${isYou ? 'is-you' : ''}">${displayName}${isYou ? ' (you)' : ''}</span>
          <span class="rankings-clicks">${formatNumber(entry.totalClicks)}</span>
        </li>
      `;
    })
    .join('');

  setHtml(rankingsListEl, html);

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
    nftPanel.style.display = 'none';
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

  if (allUnlocked.length === 0) {
    nftPanel.style.display = 'none';
    return;
  }

  // Show the panel
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
    const isEquipped = slot.cursor && slot.cursor === equippedCursor;

    const div = document.createElement('div');
    div.className = 'collection-item' + (isMinted ? '' : ' locked') + (isEquipped ? ' equipped' : '');

    if (isMinted) {
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
        // Global 1/1 NFT - click to view larger
        div.style.cursor = 'pointer';
        // Find the global click number from GLOBAL_ONE_OF_ONE_TIERS
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
    } else {
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
