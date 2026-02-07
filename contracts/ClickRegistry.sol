// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ClickRegistry
 * @notice Permanent, canonical record of ALL clicks across ALL Clickstr seasons.
 * @dev This contract is designed to be deployed once and never replaced.
 *      It serves as the single source of truth for:
 *      - Lifetime clicks per user (for NFT eligibility)
 *      - Per-season clicks (for historical records)
 *      - Global click statistics
 *
 *      Only authorized game contracts can write to this registry.
 *      Anyone can read from it.
 */
contract ClickRegistry is Ownable {
    // ============ State ============

    /// @notice Lifetime clicks per user (across all seasons)
    mapping(address => uint256) public totalClicks;

    /// @notice Clicks per user per season
    mapping(address => mapping(uint256 => uint256)) public clicksPerSeason;

    /// @notice Global total clicks across all seasons
    uint256 public globalTotalClicks;

    /// @notice Lifetime tokens earned per user (across all seasons)
    mapping(address => uint256) public totalEarned;

    /// @notice Tokens earned per user per season
    mapping(address => mapping(uint256 => uint256)) public earnedPerSeason;

    /// @notice Global total tokens earned across all seasons
    uint256 public globalTotalEarned;

    /// @notice Highest season number that has been registered
    uint256 public totalSeasons;

    /// @notice Authorized game contracts that can record clicks
    mapping(address => bool) public authorizedGames;

    /// @notice Maps game contract address to its season number
    mapping(address => uint256) public gameToSeason;

    /// @notice Maps season number to its game contract address
    mapping(uint256 => address) public seasonToGame;

    /// @notice Whether historical data for a season has been seeded (one-time migration)
    mapping(uint256 => bool) public historicalSeeded;

    // ============ Events ============

    event ClicksRecorded(
        address indexed user,
        uint256 indexed season,
        uint256 clicks,
        address indexed gameContract
    );

    event EarningsRecorded(
        address indexed user,
        uint256 indexed season,
        uint256 amount,
        address indexed gameContract
    );

    event GameAuthorized(
        address indexed game,
        uint256 indexed season
    );

    event GameRevoked(address indexed game);

    event HistoricalClicksSeeded(
        uint256 indexed season,
        uint256 userCount,
        uint256 totalClicksSeeded
    );

    event HistoricalEarningsSeeded(
        uint256 indexed season,
        uint256 userCount,
        uint256 totalEarningsSeeded
    );

    // ============ Errors ============

    error NotAuthorizedGame();
    error ZeroAddress();
    error ZeroClicks();
    error SeasonAlreadyHasGame();
    error AlreadySeeded();
    error ArrayLengthMismatch();
    error SeasonMismatch();

    // ============ Constructor ============

    constructor() Ownable(msg.sender) {}

    // ============ Modifiers ============

    modifier onlyAuthorizedGame() {
        if (!authorizedGames[msg.sender]) revert NotAuthorizedGame();
        _;
    }

    // ============ Game Functions ============

    /**
     * @notice Record clicks for a user (called by authorized game contracts)
     * @param user The user who earned the clicks
     * @param season The season number
     * @param clicks Number of clicks to record
     * @dev Clicks are additive - multiple calls for the same user/season accumulate
     */
    function recordClicks(
        address user,
        uint256 season,
        uint256 clicks
    ) external onlyAuthorizedGame {
        if (user == address(0)) revert ZeroAddress();
        if (clicks == 0) revert ZeroClicks();

        // Verify game is recording to its authorized season
        if (season != gameToSeason[msg.sender]) revert SeasonMismatch();

        // Update user's lifetime total
        totalClicks[user] += clicks;

        // Update user's per-season total
        clicksPerSeason[user][season] += clicks;

        // Update global total
        globalTotalClicks += clicks;

        emit ClicksRecorded(user, season, clicks, msg.sender);
    }

    /**
     * @notice Record token earnings for a user (called by authorized game contracts)
     * @param user The user who earned the tokens
     * @param season The season number
     * @param amount Amount of tokens earned (in wei)
     * @dev Earnings are additive - multiple calls for the same user/season accumulate
     */
    function recordEarnings(
        address user,
        uint256 season,
        uint256 amount
    ) external onlyAuthorizedGame {
        if (user == address(0)) revert ZeroAddress();
        if (amount == 0) return; // Silent return for zero - not an error

        // Verify game is recording to its authorized season
        if (season != gameToSeason[msg.sender]) revert SeasonMismatch();

        // Update user's lifetime total
        totalEarned[user] += amount;

        // Update user's per-season total
        earnedPerSeason[user][season] += amount;

        // Update global total
        globalTotalEarned += amount;

        emit EarningsRecorded(user, season, amount, msg.sender);
    }

    // ============ Admin Functions ============

    /**
     * @notice Authorize a game contract for a specific season
     * @param gameContract Address of the game contract
     * @param season Season number (must not already have a game)
     */
    function authorizeGame(
        address gameContract,
        uint256 season
    ) external onlyOwner {
        if (gameContract == address(0)) revert ZeroAddress();
        if (seasonToGame[season] != address(0)) revert SeasonAlreadyHasGame();

        authorizedGames[gameContract] = true;
        gameToSeason[gameContract] = season;
        seasonToGame[season] = gameContract;

        // Track highest season number
        if (season > totalSeasons) {
            totalSeasons = season;
        }

        emit GameAuthorized(gameContract, season);
    }

    /**
     * @notice Revoke a game contract's authorization (emergency only)
     * @param gameContract Address of the game contract to revoke
     * @dev Use with caution - should only be used for compromised contracts
     */
    function revokeGame(address gameContract) external onlyOwner {
        if (gameContract == address(0)) revert ZeroAddress();

        authorizedGames[gameContract] = false;
        // Note: We don't clear gameToSeason/seasonToGame to preserve history

        emit GameRevoked(gameContract);
    }

    /**
     * @notice Seed historical clicks from a previous season (one-time migration)
     * @param users Array of user addresses
     * @param clicks Array of click counts (parallel to users array)
     * @param season Season number being migrated
     * @dev Can only be called once per season. Used to migrate V1 data.
     */
    function seedHistoricalClicks(
        address[] calldata users,
        uint256[] calldata clicks,
        uint256 season
    ) external onlyOwner {
        if (historicalSeeded[season]) revert AlreadySeeded();
        if (users.length != clicks.length) revert ArrayLengthMismatch();

        historicalSeeded[season] = true;

        uint256 totalSeeded = 0;
        for (uint256 i = 0; i < users.length; i++) {
            if (users[i] == address(0)) continue;
            if (clicks[i] == 0) continue;

            totalClicks[users[i]] += clicks[i];
            clicksPerSeason[users[i]][season] += clicks[i];
            totalSeeded += clicks[i];
        }

        globalTotalClicks += totalSeeded;

        // Track highest season number
        if (season > totalSeasons) {
            totalSeasons = season;
        }

        emit HistoricalClicksSeeded(season, users.length, totalSeeded);
    }

    /**
     * @notice Seed historical earnings from a previous season (one-time migration)
     * @param users Array of user addresses
     * @param amounts Array of earned amounts in wei (parallel to users array)
     * @param season Season number being migrated
     * @dev Uses same historicalSeeded flag as clicks - call after seedHistoricalClicks
     */
    function seedHistoricalEarnings(
        address[] calldata users,
        uint256[] calldata amounts,
        uint256 season
    ) external onlyOwner {
        if (users.length != amounts.length) revert ArrayLengthMismatch();

        uint256 totalSeeded = 0;
        for (uint256 i = 0; i < users.length; i++) {
            if (users[i] == address(0)) continue;
            if (amounts[i] == 0) continue;

            totalEarned[users[i]] += amounts[i];
            earnedPerSeason[users[i]][season] += amounts[i];
            totalSeeded += amounts[i];
        }

        globalTotalEarned += totalSeeded;

        emit HistoricalEarningsSeeded(season, users.length, totalSeeded);
    }

    // ============ View Functions ============

    /**
     * @notice Get a user's lifetime click total
     * @param user Address to check
     * @return Total clicks across all seasons
     */
    function getTotalClicks(address user) external view returns (uint256) {
        return totalClicks[user];
    }

    /**
     * @notice Get a user's clicks for a specific season
     * @param user Address to check
     * @param season Season number
     * @return Clicks for that season
     */
    function getSeasonClicks(
        address user,
        uint256 season
    ) external view returns (uint256) {
        return clicksPerSeason[user][season];
    }

    /**
     * @notice Get a user's lifetime earnings total
     * @param user Address to check
     * @return Total tokens earned across all seasons (in wei)
     */
    function getTotalEarned(address user) external view returns (uint256) {
        return totalEarned[user];
    }

    /**
     * @notice Get a user's earnings for a specific season
     * @param user Address to check
     * @param season Season number
     * @return Tokens earned for that season (in wei)
     */
    function getSeasonEarned(
        address user,
        uint256 season
    ) external view returns (uint256) {
        return earnedPerSeason[user][season];
    }

    /**
     * @notice Get a user's click history across multiple seasons
     * @param user Address to check
     * @param fromSeason Starting season (inclusive)
     * @param toSeason Ending season (inclusive)
     * @return seasons Array of season numbers
     * @return clickCounts Array of click counts (parallel)
     */
    function getClickHistory(
        address user,
        uint256 fromSeason,
        uint256 toSeason
    ) external view returns (
        uint256[] memory seasons,
        uint256[] memory clickCounts
    ) {
        require(toSeason >= fromSeason, "Invalid range");
        uint256 count = toSeason - fromSeason + 1;

        seasons = new uint256[](count);
        clickCounts = new uint256[](count);

        for (uint256 i = 0; i < count; i++) {
            uint256 season = fromSeason + i;
            seasons[i] = season;
            clickCounts[i] = clicksPerSeason[user][season];
        }
    }

    /**
     * @notice Check if an address is an authorized game
     * @param gameContract Address to check
     * @return True if authorized
     */
    function isAuthorizedGame(address gameContract) external view returns (bool) {
        return authorizedGames[gameContract];
    }

    /**
     * @notice Get the game contract for a specific season
     * @param season Season number
     * @return Game contract address (address(0) if none)
     */
    function getSeasonGame(uint256 season) external view returns (address) {
        return seasonToGame[season];
    }
}
