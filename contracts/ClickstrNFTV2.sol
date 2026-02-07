// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title IClickRegistry
 * @notice Interface for the permanent click registry
 */
interface IClickRegistry {
    function totalClicks(address user) external view returns (uint256);
    function clicksPerSeason(address user, uint256 season) external view returns (uint256);
}

/**
 * @title ClickstrNFTV2
 * @notice Achievement NFTs for Clickstr milestones - V2 with ClickRegistry integration
 * @dev Key change from V1: Now checks ClickRegistry for eligibility instead of game contract.
 *      This enables cross-season click accumulation for milestone eligibility.
 *
 *      Benefits:
 *      - 500K clicks across 5 seasons still qualifies for 500K milestone
 *      - NFT contract doesn't need to know about each game contract
 *      - Future seasons automatically count toward milestones
 *
 *      Still uses signature-based claiming for flexibility (server can apply
 *      additional checks like Turnstile verification, time gates, etc.)
 *
 * Tier Ranges (same as V1):
 *   1-99:    Personal click milestones (editions)
 *   100-199: Streak & epoch achievements (editions)
 *   200-499: Global 1/1 milestones
 *   500+:    Hidden personal achievements (editions)
 */
contract ClickstrNFTV2 is ERC1155, Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;
    using Strings for uint256;

    // ============ State ============

    /// @notice The click registry (can be updated if registry is migrated)
    IClickRegistry public registry;

    /// @notice Address authorized to sign claim messages
    address public signer;

    /// @notice Tracks which tiers each address has claimed
    mapping(address => mapping(uint256 => bool)) public claimed;

    /// @notice Tracks which global milestone tiers have been claimed (1/1s)
    mapping(uint256 => bool) public globalMilestoneClaimed;

    /// @notice Who claimed each global milestone
    mapping(uint256 => address) public globalMilestoneOwner;

    /// @notice Minimum clicks required for each tier (0 = no on-chain check, rely on signature)
    mapping(uint256 => uint256) public tierClickRequirement;

    /// @notice Base URI for token metadata
    string public baseURI;

    /// @notice Contract-level metadata URI
    string public contractURI;

    // ============ Events ============

    event MilestoneClaimed(
        address indexed user,
        uint256 indexed tier,
        bool isGlobal,
        uint256 userTotalClicks
    );
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    event RegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event BaseURIUpdated(string newBaseURI);
    event ContractURIUpdated(string newContractURI);
    event TierRequirementUpdated(uint256 indexed tier, uint256 clicksRequired);

    // ============ Errors ============

    error InvalidSignature();
    error AlreadyClaimed();
    error GlobalMilestoneAlreadyClaimed();
    error InvalidTier();
    error ZeroAddress();
    error InsufficientClicks();

    // ============ Constructor ============

    /**
     * @notice Deploy the V2 NFT contract
     * @param _registry Address of the permanent ClickRegistry
     * @param _signer Address that signs claim messages (server wallet)
     * @param _baseURI Base URI for token metadata
     */
    constructor(
        address _registry,
        address _signer,
        string memory _baseURI
    ) ERC1155(_baseURI) Ownable(msg.sender) {
        if (_registry == address(0)) revert ZeroAddress();
        if (_signer == address(0)) revert ZeroAddress();

        registry = IClickRegistry(_registry);
        signer = _signer;
        baseURI = _baseURI;

        // Set default click requirements for personal milestones
        // These can be updated by owner if needed
        _setDefaultTierRequirements();
    }

    // ============ Internal Setup ============

    function _setDefaultTierRequirements() internal {
        // Personal click milestones (tiers 1-12)
        tierClickRequirement[1] = 1;           // First Timer
        tierClickRequirement[2] = 100;         // Getting Started
        tierClickRequirement[3] = 500;         // Warming Up
        tierClickRequirement[4] = 1_000;       // Dedicated
        tierClickRequirement[5] = 5_000;       // Serious Clicker
        tierClickRequirement[6] = 10_000;      // Obsessed
        tierClickRequirement[7] = 25_000;      // No Sleep
        tierClickRequirement[8] = 50_000;      // Touch Grass
        tierClickRequirement[9] = 100_000;     // Legend
        tierClickRequirement[10] = 250_000;    // Ascended
        tierClickRequirement[11] = 500_000;    // Transcendent
        tierClickRequirement[12] = 1_000_000;  // Click God

        // Streak/epoch tiers (101-105) - no on-chain requirement (server tracks)
        // Global 1/1s (200-499) - no on-chain requirement (server determines)
        // Hidden achievements (500+) - no on-chain requirement (server determines)
    }

    // ============ Claiming ============

    /**
     * @notice Claim an achievement NFT with a server signature
     * @param tier The milestone tier to claim (also the token ID)
     * @param signature Server signature authorizing this claim
     * @dev For personal milestones (1-12), also checks registry for sufficient clicks
     */
    function claim(uint256 tier, bytes calldata signature) external {
        if (tier == 0) revert InvalidTier();
        if (claimed[msg.sender][tier]) revert AlreadyClaimed();

        // For global milestones (200-499), check if anyone has claimed
        bool isGlobal = tier >= 200 && tier < 500;
        if (isGlobal) {
            if (globalMilestoneClaimed[tier]) revert GlobalMilestoneAlreadyClaimed();
        }

        // Check on-chain click requirement if set
        uint256 required = tierClickRequirement[tier];
        uint256 userClicks = 0;
        if (required > 0) {
            userClicks = registry.totalClicks(msg.sender);
            if (userClicks < required) revert InsufficientClicks();
        }

        // Verify signature (server can apply additional checks)
        bytes32 messageHash = keccak256(
            abi.encodePacked(msg.sender, tier, address(this))
        );
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();

        if (ethSignedHash.recover(signature) != signer) revert InvalidSignature();

        // Mark as claimed
        claimed[msg.sender][tier] = true;

        // For global milestones, mark globally claimed
        if (isGlobal) {
            globalMilestoneClaimed[tier] = true;
            globalMilestoneOwner[tier] = msg.sender;
        }

        // Mint NFT
        _mint(msg.sender, tier, 1, "");

        emit MilestoneClaimed(msg.sender, tier, isGlobal, userClicks);
    }

    /**
     * @notice Claim multiple achievement NFTs in one transaction
     * @param tiers Array of milestone tiers to claim
     * @param signatures Array of server signatures for each tier
     */
    function claimBatch(uint256[] calldata tiers, bytes[] calldata signatures) external {
        require(tiers.length == signatures.length, "Array length mismatch");
        require(tiers.length <= 20, "Too many claims");

        // Get user's total clicks once (gas optimization)
        uint256 userClicks = registry.totalClicks(msg.sender);

        uint256[] memory amounts = new uint256[](tiers.length);

        for (uint256 i = 0; i < tiers.length; i++) {
            uint256 tier = tiers[i];
            if (tier == 0) revert InvalidTier();
            if (claimed[msg.sender][tier]) revert AlreadyClaimed();

            bool isGlobal = tier >= 200 && tier < 500;
            if (isGlobal && globalMilestoneClaimed[tier]) revert GlobalMilestoneAlreadyClaimed();

            // Check click requirement
            uint256 required = tierClickRequirement[tier];
            if (required > 0 && userClicks < required) revert InsufficientClicks();

            // Verify signature
            bytes32 messageHash = keccak256(
                abi.encodePacked(msg.sender, tier, address(this))
            );
            bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
            if (ethSignedHash.recover(signatures[i]) != signer) revert InvalidSignature();

            // Mark as claimed
            claimed[msg.sender][tier] = true;
            amounts[i] = 1;

            if (isGlobal) {
                globalMilestoneClaimed[tier] = true;
                globalMilestoneOwner[tier] = msg.sender;
            }

            emit MilestoneClaimed(msg.sender, tier, isGlobal, userClicks);
        }

        // Batch mint all NFTs
        _mintBatch(msg.sender, tiers, amounts, "");
    }

    // ============ View Functions ============

    /**
     * @notice Check if a user can claim a specific tier (based on on-chain data)
     * @param user Address to check
     * @param tier Milestone tier
     * @return canClaim_ Whether the user can claim
     * @return userClicks_ User's total clicks from registry
     * @return required_ Clicks required for this tier
     */
    function canClaim(
        address user,
        uint256 tier
    ) external view returns (
        bool canClaim_,
        uint256 userClicks_,
        uint256 required_
    ) {
        if (tier == 0) return (false, 0, 0);
        if (claimed[user][tier]) return (false, 0, 0);
        if (tier >= 200 && tier < 500 && globalMilestoneClaimed[tier]) return (false, 0, 0);

        userClicks_ = registry.totalClicks(user);
        required_ = tierClickRequirement[tier];

        // If no on-chain requirement, assume claimable (needs valid signature)
        if (required_ == 0) {
            canClaim_ = true;
        } else {
            canClaim_ = userClicks_ >= required_;
        }
    }

    /**
     * @notice Get user's click-based eligibility for all personal milestones
     * @param user Address to check
     * @return eligible Array of bools for tiers 1-12
     * @return totalClicks_ User's lifetime clicks
     */
    function getEligibleMilestones(
        address user
    ) external view returns (
        bool[12] memory eligible,
        uint256 totalClicks_
    ) {
        totalClicks_ = registry.totalClicks(user);

        for (uint256 i = 0; i < 12; i++) {
            uint256 tier = i + 1;
            uint256 required = tierClickRequirement[tier];

            // Eligible if: has enough clicks AND hasn't claimed
            eligible[i] = totalClicks_ >= required && !claimed[user][tier];
        }
    }

    /**
     * @notice Get all tiers claimed by a user
     * @param user Address to check
     * @param maxTier Maximum tier to check
     * @return tiers Array of claimed tier numbers
     */
    function getClaimedTiers(
        address user,
        uint256 maxTier
    ) external view returns (uint256[] memory tiers) {
        uint256 count = 0;
        for (uint256 i = 1; i <= maxTier; i++) {
            if (claimed[user][i]) count++;
        }

        tiers = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= maxTier; i++) {
            if (claimed[user][i]) {
                tiers[index++] = i;
            }
        }
    }

    /**
     * @notice Get user stats from registry
     * @param user Address to check
     * @return totalClicks_ Lifetime clicks across all seasons
     */
    function getUserClicks(address user) external view returns (uint256 totalClicks_) {
        return registry.totalClicks(user);
    }

    /**
     * @notice Get user's season-specific clicks
     * @param user Address to check
     * @param season Season number
     * @return clicks Clicks for that season
     */
    function getUserSeasonClicks(
        address user,
        uint256 season
    ) external view returns (uint256 clicks) {
        return registry.clicksPerSeason(user, season);
    }

    // ============ Admin Functions ============

    /**
     * @notice Update the signer address
     * @param _newSigner New signer address
     */
    function setSigner(address _newSigner) external onlyOwner {
        if (_newSigner == address(0)) revert ZeroAddress();
        address oldSigner = signer;
        signer = _newSigner;
        emit SignerUpdated(oldSigner, _newSigner);
    }

    /**
     * @notice Update the registry address (if registry is migrated)
     * @param _newRegistry New registry address
     */
    function setRegistry(address _newRegistry) external onlyOwner {
        if (_newRegistry == address(0)) revert ZeroAddress();
        address oldRegistry = address(registry);
        registry = IClickRegistry(_newRegistry);
        emit RegistryUpdated(oldRegistry, _newRegistry);
    }

    /**
     * @notice Update the base URI for token metadata
     * @param _newBaseURI New base URI
     */
    function setBaseURI(string calldata _newBaseURI) external onlyOwner {
        baseURI = _newBaseURI;
        emit BaseURIUpdated(_newBaseURI);
    }

    /**
     * @notice Update the contract-level metadata URI
     * @param _newContractURI New contract URI
     */
    function setContractURI(string calldata _newContractURI) external onlyOwner {
        contractURI = _newContractURI;
        emit ContractURIUpdated(_newContractURI);
    }

    /**
     * @notice Update click requirement for a tier
     * @param tier Tier to update
     * @param clicksRequired New click requirement (0 = no on-chain check)
     */
    function setTierRequirement(uint256 tier, uint256 clicksRequired) external onlyOwner {
        tierClickRequirement[tier] = clicksRequired;
        emit TierRequirementUpdated(tier, clicksRequired);
    }

    /**
     * @notice Batch update click requirements
     * @param tiers Array of tiers
     * @param requirements Array of click requirements
     */
    function setTierRequirementsBatch(
        uint256[] calldata tiers,
        uint256[] calldata requirements
    ) external onlyOwner {
        require(tiers.length == requirements.length, "Array length mismatch");

        for (uint256 i = 0; i < tiers.length; i++) {
            tierClickRequirement[tiers[i]] = requirements[i];
            emit TierRequirementUpdated(tiers[i], requirements[i]);
        }
    }

    // ============ Metadata ============

    /**
     * @notice Get the URI for a given token ID (tier)
     * @param tokenId Token ID (same as tier number)
     * @return URI string
     */
    function uri(uint256 tokenId) public view override returns (string memory) {
        return string(abi.encodePacked(baseURI, tokenId.toString()));
    }

    /**
     * @notice Get total supply of a specific tier
     * @param tier The tier to check
     * @return supply Total minted for this tier (0 or 1 for globals)
     */
    function totalSupply(uint256 tier) external view returns (uint256 supply) {
        if (tier >= 200 && tier < 500) {
            return globalMilestoneClaimed[tier] ? 1 : 0;
        }
        return 0; // Editions don't track total on-chain
    }

    /**
     * @notice Check if a tier is a 1/1 global milestone
     * @param tier The tier to check
     * @return isGlobal True if tier is in global range (200-499)
     */
    function isGlobalMilestone(uint256 tier) external pure returns (bool) {
        return tier >= 200 && tier < 500;
    }
}
