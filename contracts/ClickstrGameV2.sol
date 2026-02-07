// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title IClickRegistry
 * @notice Interface for the permanent click registry
 */
interface IClickRegistry {
    function recordClicks(address user, uint256 season, uint256 clicks) external;
    function recordEarnings(address user, uint256 season, uint256 amount) external;
    function totalClicks(address user) external view returns (uint256);
}

/**
 * @title IClickstrNFT
 * @notice Interface for the achievement NFT contract (V1 or V2)
 */
interface IClickstrNFT {
    function claimed(address user, uint256 tier) external view returns (bool);
}

/**
 * @title IClickstrTreasury
 * @notice Interface for the token treasury
 */
interface IClickstrTreasury {
    function disburse(address recipient, uint256 userAmount, uint256 burnAmount) external;
    function burn(uint256 amount) external;
    function getBalance() external view returns (uint256);
}

/**
 * @title ClickstrGameV2
 * @notice V2 per-season game contract with off-chain proof validation.
 * @dev Key differences from V1:
 *      - Proof validation is done OFF-CHAIN by the server
 *      - Users claim rewards with a server-signed attestation
 *      - No on-chain nonce tracking (massive gas savings)
 *      - Clicks are recorded to the permanent ClickRegistry
 *      - Tokens come from ClickstrTreasury (not held directly)
 *
 *      User Flow:
 *      1. User clicks in browser, passes Turnstile verification
 *      2. WebWorker mines PoW proofs
 *      3. Frontend POSTs proofs to server (NOT blockchain)
 *      4. Server validates and tracks clicks in Redis
 *      5. User calls claimReward() with server signature
 *      6. Contract verifies sig, records to registry, requests disbursement
 *
 *      Gas Comparison:
 *      - V1 submitClicks(500 nonces): ~10M gas (~$50-100)
 *      - V2 claimReward(): ~150k gas (~$0.75-1.50)
 */
contract ClickstrGameV2 is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ============ Constants ============

    /// @notice Basis points denominator
    uint256 public constant BASIS_POINTS = 10000;

    /// @notice Winner bonus rate (10% of epoch distribution)
    uint256 public constant WINNER_BONUS_RATE = 1000; // 10%

    /// @notice Finalizer reward rate (0.1% of epoch distribution, 50/50 split)
    uint256 public constant FINALIZER_REWARD_RATE = 10; // 0.1%

    /// @notice Maximum clicks per claim (safety limit)
    uint256 public constant MAX_CLICKS_PER_CLAIM = 100_000_000; // 100M

    /// @notice Grace period after game end for claiming rewards
    uint256 public constant CLAIM_GRACE_PERIOD = 72 hours;

    /// @notice Daily emission rate (2% of remaining pool)
    uint256 public constant DAILY_EMISSION_RATE = 200; // 2%

    // ============ Immutable Configuration ============

    /// @notice The permanent click registry
    IClickRegistry public immutable registry;

    /// @notice The token treasury
    IClickstrTreasury public immutable treasury;

    /// @notice Season number for this game instance
    uint256 public immutable SEASON_NUMBER;

    /// @notice Total epochs in this season
    uint256 public immutable TOTAL_EPOCHS;

    /// @notice Duration of each epoch in seconds
    uint256 public immutable EPOCH_DURATION;

    // ============ State Variables ============

    /// @notice Address authorized to sign claim attestations
    address public attestationSigner;

    /// @notice Game start timestamp
    uint256 public gameStartTime;

    /// @notice Game end timestamp
    uint256 public gameEndTime;

    /// @notice Current epoch number (1-indexed)
    uint256 public currentEpoch;

    /// @notice Remaining tokens allocated to this season
    uint256 public poolRemaining;

    /// @notice Whether the game has started
    bool public gameStarted;

    /// @notice Whether the game has ended
    bool public gameEnded;

    // ============ NFT Bonus System ============

    /// @notice The achievement NFT contract (optional, can be address(0) for first season)
    IClickstrNFT public achievementNFT;

    /// @notice Bonus percentage per NFT tier (in basis points, e.g., 500 = 5%)
    mapping(uint256 => uint256) public tierBonus;

    /// @notice List of tiers that grant bonuses (for iteration)
    uint256[] public bonusTiers;

    // ============ Claim Tracking ============

    /// @notice Total clicks already claimed per user per epoch (supports incremental claims)
    mapping(address => mapping(uint256 => uint256)) public claimedClicks;

    /// @notice Total clicks claimed per user per epoch (same as claimedClicks, kept for compatibility)
    mapping(address => mapping(uint256 => uint256)) public userEpochClicks;

    // ============ Epoch Statistics ============

    /// @notice Total clicks claimed in each epoch
    mapping(uint256 => uint256) public totalClicksPerEpoch;

    /// @notice Tokens distributed in each epoch
    mapping(uint256 => uint256) public epochDistributed;

    /// @notice Tokens burned in each epoch
    mapping(uint256 => uint256) public epochBurned;

    /// @notice Whether epoch has been finalized
    mapping(uint256 => bool) public epochFinalized;

    /// @notice Winner of each epoch (most clicks at finalization)
    mapping(uint256 => address) public epochWinner;

    /// @notice Winner's click count for each epoch
    mapping(uint256 => uint256) public epochWinnerClicks;

    /// @notice Epoch emission budget (set when first claim happens)
    mapping(uint256 => uint256) public epochEmissionBudget;

    /// @notice Epoch emission already used
    mapping(uint256 => uint256) public epochEmissionUsed;

    // ============ User Lifetime Stats (this season) ============

    /// @notice Total clicks by user this season
    mapping(address => uint256) public totalUserClicks;

    /// @notice Total tokens earned by user this season
    mapping(address => uint256) public totalUserEarned;

    /// @notice Epochs won by user this season
    mapping(address => uint256) public epochsWon;

    // ============ Events ============

    event GameStarted(
        uint256 startTime,
        uint256 endTime,
        uint256 seasonPool
    );

    event RewardClaimed(
        address indexed user,
        uint256 indexed epoch,
        uint256 clicks,
        uint256 userAmount,
        uint256 burnAmount
    );

    event EpochFinalized(
        uint256 indexed epoch,
        address indexed winner,
        uint256 winnerClicks,
        uint256 totalClicks,
        uint256 distributed,
        uint256 burned,
        address finalizer,
        uint256 finalizerReward
    );

    event GameEnded(
        uint256 totalDistributed,
        uint256 totalBurned
    );

    event AttestationSignerUpdated(
        address indexed oldSigner,
        address indexed newSigner
    );

    event AchievementNFTUpdated(
        address indexed oldNFT,
        address indexed newNFT
    );

    event BonusApplied(
        address indexed user,
        uint256 baseReward,
        uint256 bonusAmount,
        uint256 bonusBps
    );

    // ============ Errors ============

    error GameNotStarted();
    error GameAlreadyStarted();
    error GameHasEnded();
    error InvalidEpoch();
    error EpochNotStarted();
    error EpochNotOver();
    error EpochAlreadyFinalized();
    error AlreadyClaimed();
    error NoClicks();
    error ClickCountTooHigh();
    error InvalidSignature();
    error ZeroAddress();
    error InsufficientPool();
    error GracePeriodNotOver();

    // ============ Constructor ============

    /**
     * @notice Deploy a new V2 game contract for a season
     * @param _registry Address of the permanent ClickRegistry
     * @param _treasury Address of the ClickstrTreasury
     * @param _seasonNumber Season number for this game
     * @param _totalEpochs Number of epochs in this season
     * @param _epochDuration Duration of each epoch in seconds
     * @param _attestationSigner Address that signs claim attestations
     */
    constructor(
        address _registry,
        address _treasury,
        uint256 _seasonNumber,
        uint256 _totalEpochs,
        uint256 _epochDuration,
        address _attestationSigner
    ) Ownable(msg.sender) {
        if (_registry == address(0)) revert ZeroAddress();
        if (_treasury == address(0)) revert ZeroAddress();
        if (_attestationSigner == address(0)) revert ZeroAddress();
        require(_totalEpochs > 0, "Epochs must be > 0");
        require(_epochDuration >= 2 minutes, "Epoch too short"); // TODO: restore to 1 hours before mainnet
        require(_seasonNumber > 0, "Season must be > 0");

        registry = IClickRegistry(_registry);
        treasury = IClickstrTreasury(_treasury);
        SEASON_NUMBER = _seasonNumber;
        TOTAL_EPOCHS = _totalEpochs;
        EPOCH_DURATION = _epochDuration;
        attestationSigner = _attestationSigner;
    }

    // ============ Admin Functions ============

    /**
     * @notice Start the game
     * @param _seasonPool Amount of tokens allocated to this season
     * @dev Treasury must have authorized this contract as a disburser
     */
    function startGame(uint256 _seasonPool) external onlyOwner {
        if (gameStarted) revert GameAlreadyStarted();
        require(_seasonPool > 0, "Pool must be > 0");

        // Verify treasury has enough balance
        uint256 treasuryBalance = treasury.getBalance();
        require(treasuryBalance >= _seasonPool, "Insufficient treasury balance");

        poolRemaining = _seasonPool;
        gameStartTime = block.timestamp;
        gameEndTime = block.timestamp + (TOTAL_EPOCHS * EPOCH_DURATION);
        currentEpoch = 1;
        gameStarted = true;

        emit GameStarted(gameStartTime, gameEndTime, _seasonPool);
    }

    /**
     * @notice Update the attestation signer
     * @param _newSigner New signer address
     */
    function setAttestationSigner(address _newSigner) external onlyOwner {
        if (_newSigner == address(0)) revert ZeroAddress();
        address oldSigner = attestationSigner;
        attestationSigner = _newSigner;
        emit AttestationSignerUpdated(oldSigner, _newSigner);
    }

    /**
     * @notice Set or update the achievement NFT contract
     * @param _nftContract Address of the ClickstrNFT contract (or address(0) to disable)
     * @dev Can be called at any time by owner (to set V2 NFT, update contract, etc.)
     */
    function setAchievementNFT(address _nftContract) external onlyOwner {
        address oldNFT = address(achievementNFT);
        achievementNFT = IClickstrNFT(_nftContract);
        emit AchievementNFTUpdated(oldNFT, _nftContract);
    }

    /**
     * @notice Set bonus percentages for NFT tiers (call before startGame)
     * @param tiers Array of NFT tier numbers that grant bonuses
     * @param bonuses Array of bonus amounts in basis points (e.g., 500 = 5%)
     * @dev Can only be called before game starts. Clears any previous bonuses.
     *
     * Recommended tier bonuses (personal milestones only, no globals):
     *   Tier 4  (1K clicks):   200 bps (2%)
     *   Tier 6  (10K clicks):  300 bps (3%)
     *   Tier 8  (50K clicks):  500 bps (5%)
     *   Tier 9  (100K clicks): 700 bps (7%)
     *   Tier 11 (500K clicks): 1000 bps (10%)
     *   Max possible: 27%
     */
    function setTierBonuses(uint256[] calldata tiers, uint256[] calldata bonuses) external onlyOwner {
        require(!gameStarted, "Game already started");
        require(tiers.length == bonuses.length, "Array length mismatch");
        require(tiers.length <= 20, "Too many bonus tiers");

        // Clear existing bonuses
        for (uint256 i = 0; i < bonusTiers.length; i++) {
            tierBonus[bonusTiers[i]] = 0;
        }
        delete bonusTiers;

        // Set new bonuses
        for (uint256 i = 0; i < tiers.length; i++) {
            require(bonuses[i] <= 2000, "Bonus too high (max 20%)"); // Cap at 20% per tier
            tierBonus[tiers[i]] = bonuses[i];
            bonusTiers.push(tiers[i]);
        }
    }

    // ============ Core Game Functions ============

    /**
     * @notice Claim rewards for an epoch with server attestation
     * @dev Supports incremental claims - user can claim multiple times as they accumulate more clicks
     * @param epoch Epoch to claim for (can be current epoch)
     * @param clickCount TOTAL clicks attested by server (not incremental)
     * @param signature Server signature over claim data
     */
    function claimReward(
        uint256 epoch,
        uint256 clickCount,
        bytes calldata signature
    ) external nonReentrant {
        if (!gameStarted) revert GameNotStarted();
        if (gameEnded) revert GameHasEnded();
        if (epoch < 1 || epoch > TOTAL_EPOCHS) revert InvalidEpoch();

        // Check and advance epoch if needed
        _checkAndAdvanceEpoch();

        if (epoch > currentEpoch) revert EpochNotStarted();
        if (epochFinalized[epoch]) revert EpochAlreadyFinalized();
        if (clickCount == 0) revert NoClicks();
        if (clickCount > MAX_CLICKS_PER_CLAIM) revert ClickCountTooHigh();

        // Check for new clicks to claim (incremental)
        uint256 previouslyClaimed = claimedClicks[msg.sender][epoch];
        if (clickCount <= previouslyClaimed) revert AlreadyClaimed();
        uint256 newClicks = clickCount - previouslyClaimed;

        // Verify server attestation
        _verifyAttestation(msg.sender, epoch, clickCount, signature);

        // Update claimed clicks (now tracks total, not boolean)
        claimedClicks[msg.sender][epoch] = clickCount;
        userEpochClicks[msg.sender][epoch] = clickCount;

        // Update epoch stats (only add new clicks)
        totalClicksPerEpoch[epoch] += newClicks;

        // Update winner tracking (based on total clicks)
        if (clickCount > epochWinnerClicks[epoch]) {
            epochWinner[epoch] = msg.sender;
            epochWinnerClicks[epoch] = clickCount;
        }

        // Record only NEW clicks to permanent registry
        registry.recordClicks(msg.sender, SEASON_NUMBER, newClicks);

        // Calculate and distribute reward with NFT bonus
        _distributeReward(epoch, newClicks);
    }

    /**
     * @notice Claim rewards for multiple epochs in one transaction
     * @dev Supports incremental claims per epoch
     * @param epochs Array of epochs to claim
     * @param clickCounts Array of TOTAL click counts per epoch (not incremental)
     * @param signatures Array of signatures per epoch
     */
    function claimMultipleEpochs(
        uint256[] calldata epochs,
        uint256[] calldata clickCounts,
        bytes[] calldata signatures
    ) external nonReentrant {
        require(epochs.length == clickCounts.length, "Array length mismatch");
        require(epochs.length == signatures.length, "Array length mismatch");
        require(epochs.length <= 20, "Too many epochs");

        if (!gameStarted) revert GameNotStarted();
        if (gameEnded) revert GameHasEnded();

        _checkAndAdvanceEpoch();

        _processMultiClaim(epochs, clickCounts, signatures);
    }

    /**
     * @dev Internal multi-epoch claim processing (extracted to avoid stack-too-deep)
     */
    function _processMultiClaim(
        uint256[] calldata epochs,
        uint256[] calldata clickCounts,
        bytes[] calldata signatures
    ) internal {
        // Calculate bonus once (gas optimization)
        uint256 bonusBps = calculateBonus(msg.sender);

        // Accumulate totals in an array to reduce stack depth: [userAmount, burnAmount, bonusAmount, newClicks]
        uint256[4] memory totals;

        for (uint256 i = 0; i < epochs.length; i++) {
            uint256[4] memory result = _processEpochClaim(epochs[i], clickCounts[i], signatures[i], bonusBps);
            totals[0] += result[0];
            totals[1] += result[1];
            totals[2] += result[2];
            totals[3] += result[3];
        }

        if (totals[3] > 0) {
            // Emit bonus event if applicable
            if (totals[2] > 0) {
                emit BonusApplied(msg.sender, totals[0] - totals[2], totals[2], bonusBps);
            }

            // Record only new clicks to registry
            registry.recordClicks(msg.sender, SEASON_NUMBER, totals[3]);

            // Update user stats
            totalUserClicks[msg.sender] += totals[3];
            totalUserEarned[msg.sender] += totals[0];

            // Record earnings to permanent registry
            if (totals[0] > 0) {
                registry.recordEarnings(msg.sender, SEASON_NUMBER, totals[0]);
            }

            // Single disbursement for all epochs
            if (totals[0] > 0 || totals[1] > 0) {
                treasury.disburse(msg.sender, totals[0], totals[1]);
            }
        }
    }

    /**
     * @notice Finalize an epoch and distribute winner bonus
     * @param epoch Epoch to finalize
     */
    function finalizeEpoch(uint256 epoch) external nonReentrant {
        if (!gameStarted) revert GameNotStarted();
        if (epoch < 1 || epoch > TOTAL_EPOCHS) revert InvalidEpoch();
        if (epochFinalized[epoch]) revert EpochAlreadyFinalized();

        uint256 epochEndTime_ = gameStartTime + (epoch * EPOCH_DURATION);
        if (block.timestamp < epochEndTime_) revert EpochNotOver();

        _finalizeEpochInternal(epoch, msg.sender, true);
    }

    /**
     * @notice End the game after all epochs complete and grace period expires
     * @dev Users have 72 hours after gameEndTime to claim their rewards
     */
    function endGame() external nonReentrant {
        if (block.timestamp < gameEndTime + CLAIM_GRACE_PERIOD) revert GracePeriodNotOver();
        if (gameEnded) return;
        _endGame();
    }

    // ============ Internal Functions ============

    /**
     * @dev Verify a server attestation signature
     */
    function _verifyAttestation(
        address user,
        uint256 epoch,
        uint256 clickCount,
        bytes calldata signature
    ) internal view {
        bytes32 message = keccak256(abi.encodePacked(
            user,
            epoch,
            clickCount,
            SEASON_NUMBER,
            address(this),
            block.chainid
        ));
        bytes32 ethSignedMessage = message.toEthSignedMessageHash();

        if (ethSignedMessage.recover(signature) != attestationSigner) {
            revert InvalidSignature();
        }
    }

    /**
     * @dev Calculate and distribute reward with NFT bonus for a single epoch claim
     */
    function _distributeReward(uint256 epoch, uint256 newClicks) internal {
        uint256 reward = _calculateReward(epoch, newClicks);
        if (reward == 0) revert InsufficientPool();

        // 50/50 split
        uint256 baseUserAmount = reward / 2;
        uint256 burnAmount = reward - baseUserAmount;

        // Apply NFT bonus to player reward (bonus comes from pool, matched by equal burn)
        uint256 bonusBps = calculateBonus(msg.sender);
        uint256 bonusAmount = 0;
        if (bonusBps > 0) {
            bonusAmount = (baseUserAmount * bonusBps) / BASIS_POINTS;
            // Cap bonus at available pool (after reward deduction) — need 2x for user+burn
            uint256 availableForBonus = (poolRemaining - reward) / 2;
            if (bonusAmount > availableForBonus) {
                bonusAmount = availableForBonus;
            }
        }
        uint256 userAmount = baseUserAmount + bonusAmount;
        burnAmount += bonusAmount; // Burn matching amount to maintain >= 50% burn ratio

        // Update tracking (pool pays reward + 2x bonus: bonus to user + bonus burned)
        poolRemaining -= (reward + bonusAmount * 2);
        epochEmissionUsed[epoch] += reward;
        epochDistributed[epoch] += userAmount;
        epochBurned[epoch] += burnAmount;
        totalUserClicks[msg.sender] += newClicks;
        totalUserEarned[msg.sender] += userAmount;

        // Emit bonus event if applicable
        if (bonusAmount > 0) {
            emit BonusApplied(msg.sender, baseUserAmount, bonusAmount, bonusBps);
        }

        // Record earnings to permanent registry
        registry.recordEarnings(msg.sender, SEASON_NUMBER, userAmount);

        // Request disbursement from treasury
        treasury.disburse(msg.sender, userAmount, burnAmount);

        emit RewardClaimed(msg.sender, epoch, newClicks, userAmount, burnAmount);
    }

    function _checkAndAdvanceEpoch() internal {
        uint256 epochsSinceStart = (block.timestamp - gameStartTime) / EPOCH_DURATION;
        uint256 targetEpoch = epochsSinceStart + 1;

        if (targetEpoch > TOTAL_EPOCHS) {
            targetEpoch = TOTAL_EPOCHS;
        }

        // Auto-finalize elapsed epochs (capped for gas safety)
        uint256 finalized = 0;
        while (currentEpoch < targetEpoch && finalized < 5) {
            if (!epochFinalized[currentEpoch]) {
                _finalizeEpochInternal(currentEpoch, address(0), false);
                finalized++;
            }
            currentEpoch++;
        }
    }

    /**
     * @dev Process a single epoch claim within claimMultipleEpochs (extracted to avoid stack-too-deep)
     * @return result [userAmount, burnAmount, bonusAmount, newClicks]
     */
    function _processEpochClaim(
        uint256 epoch,
        uint256 clickCount,
        bytes calldata signature,
        uint256 bonusBps
    ) internal returns (uint256[4] memory result) {
        if (epoch < 1 || epoch > TOTAL_EPOCHS) return result;
        if (epoch > currentEpoch) return result;
        if (epochFinalized[epoch]) return result;
        if (clickCount == 0) return result;
        if (clickCount > MAX_CLICKS_PER_CLAIM) return result;

        // Check for new clicks (incremental)
        uint256 previouslyClaimed = claimedClicks[msg.sender][epoch];
        if (clickCount <= previouslyClaimed) return result;
        uint256 newClicks = clickCount - previouslyClaimed;

        // Verify signature (reverts silently on failure for batch)
        {
            bytes32 message = keccak256(abi.encodePacked(
                msg.sender, epoch, clickCount, SEASON_NUMBER, address(this), block.chainid
            ));
            if (message.toEthSignedMessageHash().recover(signature) != attestationSigner) {
                return result;
            }
        }

        // Update claimed clicks
        claimedClicks[msg.sender][epoch] = clickCount;
        userEpochClicks[msg.sender][epoch] = clickCount;
        totalClicksPerEpoch[epoch] += newClicks;

        // Update winner tracking
        if (clickCount > epochWinnerClicks[epoch]) {
            epochWinner[epoch] = msg.sender;
            epochWinnerClicks[epoch] = clickCount;
        }

        // Calculate reward for new clicks only
        uint256 reward = _calculateReward(epoch, newClicks);
        if (reward == 0) return result;

        uint256 baseUserAmount = reward / 2;
        uint256 burnAmount = reward - baseUserAmount;

        // Apply NFT bonus (matched by equal burn to maintain treasury ratio)
        uint256 bonusAmount = 0;
        if (bonusBps > 0) {
            bonusAmount = (baseUserAmount * bonusBps) / BASIS_POINTS;
            // Cap bonus: need 2x (user + burn) from remaining pool
            uint256 availableForBonus = (poolRemaining - reward) / 2;
            if (bonusAmount > availableForBonus) {
                bonusAmount = availableForBonus;
            }
        }
        uint256 userAmount = baseUserAmount + bonusAmount;
        burnAmount += bonusAmount; // Burn matching amount to maintain >= 50% burn ratio

        // Update tracking (pool pays reward + 2x bonus: bonus to user + bonus burned)
        poolRemaining -= (reward + bonusAmount * 2);
        epochEmissionUsed[epoch] += reward;
        epochDistributed[epoch] += userAmount;
        epochBurned[epoch] += burnAmount;

        emit RewardClaimed(msg.sender, epoch, newClicks, userAmount, burnAmount);

        result[0] = userAmount;
        result[1] = burnAmount;
        result[2] = bonusAmount;
        result[3] = newClicks;
    }

    function _calculateReward(
        uint256 epoch,
        uint256 clickCount
    ) internal returns (uint256) {
        // Initialize epoch budget if not set
        if (epochEmissionBudget[epoch] == 0) {
            epochEmissionBudget[epoch] = (poolRemaining * DAILY_EMISSION_RATE) / BASIS_POINTS;
        }

        uint256 budget = epochEmissionBudget[epoch];
        uint256 used = epochEmissionUsed[epoch];
        uint256 remaining = budget > used ? budget - used : 0;

        if (remaining == 0) {
            // Soft overflow: 10% of normal rate from pool
            return (poolRemaining * clickCount) / (1_000_000 * 10);
        }

        // Normal calculation: proportional to clicks vs target (1M/day)
        uint256 targetClicks = (1_000_000 * EPOCH_DURATION) / 86400;
        uint256 reward = (budget * clickCount) / targetClicks;

        // Cap at remaining budget
        if (reward > remaining) {
            reward = remaining;
        }

        // Cap at 10% of pool per claim (safety)
        uint256 maxReward = poolRemaining / 10;
        if (reward > maxReward) {
            reward = maxReward;
        }

        return reward;
    }

    function _finalizeEpochInternal(
        uint256 epoch,
        address finalizer,
        bool payFinalizer
    ) internal {
        epochFinalized[epoch] = true;

        // Burn unused emission
        uint256 budget = epochEmissionBudget[epoch];
        if (budget == 0) {
            budget = (poolRemaining * DAILY_EMISSION_RATE) / BASIS_POINTS;
            epochEmissionBudget[epoch] = budget;
        }

        uint256 used = epochEmissionUsed[epoch];
        if (budget > used) {
            uint256 unused = budget - used;
            if (unused > poolRemaining) {
                unused = poolRemaining;
            }
            if (unused > 0) {
                poolRemaining -= unused;
                epochBurned[epoch] += unused;
                treasury.burn(unused);
            }
        }

        // Winner bonus (10% of distributed, 50/50 split)
        address winner = epochWinner[epoch];
        uint256 winnerBonus = 0;
        if (winner != address(0) && epochDistributed[epoch] > 0 && poolRemaining > 0) {
            winnerBonus = (epochDistributed[epoch] * WINNER_BONUS_RATE) / BASIS_POINTS;
            if (winnerBonus > poolRemaining) {
                winnerBonus = poolRemaining;
            }

            uint256 winnerReceives = winnerBonus / 2;
            uint256 winnerBurns = winnerBonus - winnerReceives;

            poolRemaining -= winnerBonus;
            epochDistributed[epoch] += winnerReceives;
            epochBurned[epoch] += winnerBurns;
            totalUserEarned[winner] += winnerReceives;
            epochsWon[winner]++;

            if (winnerBonus > 0) {
                treasury.disburse(winner, winnerReceives, winnerBurns);
            }
        }

        // Finalizer reward (0.1% of distributed, 50/50 split)
        uint256 finalizerReward = 0;
        if (payFinalizer && finalizer != address(0) && poolRemaining > 0) {
            finalizerReward = (epochDistributed[epoch] * FINALIZER_REWARD_RATE) / BASIS_POINTS;
            if (finalizerReward > poolRemaining) {
                finalizerReward = poolRemaining;
            }
            if (finalizerReward > 0) {
                uint256 finalizerReceives = finalizerReward / 2;
                uint256 finalizerBurns = finalizerReward - finalizerReceives;

                poolRemaining -= finalizerReward;
                epochDistributed[epoch] += finalizerReceives;
                epochBurned[epoch] += finalizerBurns;

                treasury.disburse(finalizer, finalizerReceives, finalizerBurns);
            }
        }

        emit EpochFinalized(
            epoch,
            winner,
            epochWinnerClicks[epoch],
            totalClicksPerEpoch[epoch],
            epochDistributed[epoch],
            epochBurned[epoch],
            finalizer,
            finalizerReward
        );

        if (epoch >= TOTAL_EPOCHS) {
            // Respect claim grace period before ending the game
            if (block.timestamp >= gameEndTime + CLAIM_GRACE_PERIOD) {
                _endGame();
            }
        }
    }

    function _endGame() internal {
        gameEnded = true;

        uint256 totalDistributed = 0;
        uint256 totalBurned = 0;

        for (uint256 i = 1; i <= TOTAL_EPOCHS; i++) {
            totalDistributed += epochDistributed[i];
            totalBurned += epochBurned[i];
        }

        // Burn remaining pool
        if (poolRemaining > 0) {
            treasury.burn(poolRemaining);
            totalBurned += poolRemaining;
            poolRemaining = 0;
        }

        emit GameEnded(totalDistributed, totalBurned);
    }

    // ============ NFT Bonus Functions ============

    /**
     * @notice Calculate bonus multiplier for a user based on their NFT holdings
     * @param user Address to check
     * @return bonusBps Total bonus in basis points (0 = no bonus, 500 = 5% bonus)
     */
    function calculateBonus(address user) public view returns (uint256 bonusBps) {
        // If no NFT contract set, no bonuses
        if (address(achievementNFT) == address(0)) {
            return 0;
        }

        // Sum up bonuses for all tiers the user has claimed
        for (uint256 i = 0; i < bonusTiers.length; i++) {
            uint256 tier = bonusTiers[i];
            if (tierBonus[tier] > 0) {
                // Use try/catch in case NFT contract call fails
                try achievementNFT.claimed(user, tier) returns (bool isClaimed) {
                    if (isClaimed) {
                        bonusBps += tierBonus[tier];
                    }
                } catch {
                    // NFT contract call failed, skip this tier
                }
            }
        }

        // Cap total bonus at 50% (5000 bps)
        if (bonusBps > 5000) {
            bonusBps = 5000;
        }
    }

    /**
     * @notice Get all configured bonus tiers and their bonuses
     * @return tiers Array of tier numbers
     * @return bonuses Array of bonus amounts in basis points
     */
    function getBonusTiers() external view returns (uint256[] memory tiers, uint256[] memory bonuses) {
        tiers = bonusTiers;
        bonuses = new uint256[](bonusTiers.length);
        for (uint256 i = 0; i < bonusTiers.length; i++) {
            bonuses[i] = tierBonus[bonusTiers[i]];
        }
    }

    /**
     * @notice Get detailed bonus info for a user
     * @param user Address to check
     * @return totalBonusBps Total bonus in basis points
     * @return qualifyingTiers Array of tier numbers the user qualifies for
     */
    function getUserBonusInfo(address user) external view returns (
        uint256 totalBonusBps,
        uint256[] memory qualifyingTiers
    ) {
        if (address(achievementNFT) == address(0)) {
            return (0, new uint256[](0));
        }

        // First pass: count qualifying tiers
        uint256 count = 0;
        for (uint256 i = 0; i < bonusTiers.length; i++) {
            try achievementNFT.claimed(user, bonusTiers[i]) returns (bool isClaimed) {
                if (isClaimed && tierBonus[bonusTiers[i]] > 0) {
                    count++;
                }
            } catch {}
        }

        // Second pass: build array
        qualifyingTiers = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < bonusTiers.length; i++) {
            try achievementNFT.claimed(user, bonusTiers[i]) returns (bool isClaimed) {
                if (isClaimed && tierBonus[bonusTiers[i]] > 0) {
                    qualifyingTiers[idx++] = bonusTiers[i];
                    totalBonusBps += tierBonus[bonusTiers[i]];
                }
            } catch {}
        }

        // Cap at 50%
        if (totalBonusBps > 5000) {
            totalBonusBps = 5000;
        }
    }

    // ============ View Functions ============

    /**
     * @notice Get current epoch info
     */
    function getCurrentEpochInfo() external view returns (
        uint256 epoch,
        uint256 epochStartTime_,
        uint256 epochEndTime_,
        uint256 totalClicks,
        address currentLeader,
        uint256 leaderClicks,
        uint256 distributed,
        uint256 burned
    ) {
        if (!gameStarted) {
            return (0, 0, 0, 0, address(0), 0, 0, 0);
        }
        epoch = currentEpoch;
        epochStartTime_ = gameStartTime + ((currentEpoch - 1) * EPOCH_DURATION);
        epochEndTime_ = epochStartTime_ + EPOCH_DURATION;
        totalClicks = totalClicksPerEpoch[currentEpoch];
        currentLeader = epochWinner[currentEpoch];
        leaderClicks = epochWinnerClicks[currentEpoch];
        distributed = epochDistributed[currentEpoch];
        burned = epochBurned[currentEpoch];
    }

    /**
     * @notice Get game stats
     */
    function getGameStats() external view returns (
        uint256 poolRemaining_,
        uint256 currentEpoch_,
        uint256 totalEpochs_,
        uint256 gameStartTime_,
        uint256 gameEndTime_,
        uint256 seasonNumber_,
        bool started_,
        bool ended_
    ) {
        poolRemaining_ = poolRemaining;
        currentEpoch_ = currentEpoch;
        totalEpochs_ = TOTAL_EPOCHS;
        gameStartTime_ = gameStartTime;
        gameEndTime_ = gameEndTime;
        seasonNumber_ = SEASON_NUMBER;
        started_ = gameStarted;
        ended_ = gameEnded;
    }

    /**
     * @notice Get user stats for this season
     */
    function getUserStats(address user) external view returns (
        uint256 totalClicks_,
        uint256 totalEarned_,
        uint256 epochsWon_
    ) {
        totalClicks_ = totalUserClicks[user];
        totalEarned_ = totalUserEarned[user];
        epochsWon_ = epochsWon[user];
    }

    /**
     * @notice Check if user has claimed ANY clicks for an epoch
     * @dev Returns true if claimedClicks > 0 (backwards compatible)
     */
    function hasClaimed(address user, uint256 epoch) external view returns (bool) {
        return claimedClicks[user][epoch] > 0;
    }

    /**
     * @notice Get user's claimed clicks for an epoch (for incremental claim tracking)
     */
    function getClaimedClicks(address user, uint256 epoch) external view returns (uint256) {
        return claimedClicks[user][epoch];
    }

    /**
     * @notice Get user's total clicks for an epoch (same as claimedClicks)
     */
    function getUserEpochClicks(address user, uint256 epoch) external view returns (uint256) {
        return userEpochClicks[user][epoch];
    }

    /**
     * @notice Get epoch end timestamp
     */
    function getEpochEndTime(uint256 epoch) external view returns (uint256) {
        if (!gameStarted || epoch < 1 || epoch > TOTAL_EPOCHS) {
            return 0;
        }
        return gameStartTime + (epoch * EPOCH_DURATION);
    }
}
