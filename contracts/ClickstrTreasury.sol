// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ClickstrTreasury
 * @notice Central treasury for all $CLICK tokens across all Clickstr seasons.
 * @dev This contract is designed to be allowlisted by TokenWorks ONCE.
 *      New season contracts are authorized by the treasury owner (you),
 *      eliminating the need for external coordination for each season.
 *
 *      Flow:
 *      1. Treasury gets allowlisted by TokenWorks
 *      2. Transfer $CLICK from Safe to Treasury
 *      3. For each new season:
 *         a. Deploy ClickstrGameV2
 *         b. Call authorizeDisburser(gameContract)
 *         c. Game contract calls disburse() to send rewards
 *
 *      The treasury enforces the 50/50 burn split at the disbursement level,
 *      ensuring game contracts cannot bypass the burn mechanism.
 */
contract ClickstrTreasury is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    /// @notice Burn address
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // ============ State ============

    /// @notice The $CLICK token
    IERC20 public immutable clickToken;

    /// @notice Contracts authorized to request disbursements
    mapping(address => bool) public authorizedDisbursers;

    /// @notice Per-disburser allowance limit (0 = unlimited)
    mapping(address => uint256) public disburserAllowance;

    /// @notice Per-disburser amount already disbursed
    mapping(address => uint256) public disburserDisbursed;

    /// @notice Total tokens disbursed to users
    uint256 public totalDisbursedToUsers;

    /// @notice Total tokens burned via disbursements
    uint256 public totalBurned;

    // ============ Events ============

    event Disbursed(
        address indexed disburser,
        address indexed recipient,
        uint256 userAmount,
        uint256 burnAmount
    );

    event DisburserAuthorized(
        address indexed disburser,
        uint256 allowance
    );

    event DisburserRevoked(address indexed disburser);

    event DisburserAllowanceUpdated(
        address indexed disburser,
        uint256 oldAllowance,
        uint256 newAllowance
    );

    event Withdrawn(
        address indexed to,
        uint256 amount
    );

    // ============ Errors ============

    error NotAuthorizedDisburser();
    error ZeroAddress();
    error ZeroAmount();
    error ExceedsAllowance();
    error InsufficientBalance();
    error InsufficientBurnRatio();

    // ============ Constructor ============

    /**
     * @notice Deploy the treasury
     * @param _clickToken Address of the $CLICK token
     */
    constructor(address _clickToken) Ownable(msg.sender) {
        if (_clickToken == address(0)) revert ZeroAddress();
        clickToken = IERC20(_clickToken);
    }

    // ============ Modifiers ============

    modifier onlyAuthorizedDisburser() {
        if (!authorizedDisbursers[msg.sender]) revert NotAuthorizedDisburser();
        _;
    }

    // ============ Disburser Functions ============

    /**
     * @notice Disburse tokens with mandatory 50/50 burn split
     * @param recipient User receiving tokens
     * @param userAmount Amount to send to user
     * @param burnAmount Amount to burn
     * @dev Called by authorized game contracts when users claim rewards.
     *      Enforces that burnAmount >= userAmount (at least 50% burn).
     */
    function disburse(
        address recipient,
        uint256 userAmount,
        uint256 burnAmount
    ) external nonReentrant onlyAuthorizedDisburser {
        if (recipient == address(0)) revert ZeroAddress();

        uint256 totalAmount = userAmount + burnAmount;
        if (totalAmount == 0) revert ZeroAmount();

        // Enforce minimum 50% burn ratio
        if (burnAmount < userAmount) revert InsufficientBurnRatio();

        // Check allowance if set
        uint256 allowance = disburserAllowance[msg.sender];
        if (allowance > 0) {
            if (disburserDisbursed[msg.sender] + totalAmount > allowance) {
                revert ExceedsAllowance();
            }
        }

        // Check balance
        uint256 balance = clickToken.balanceOf(address(this));
        if (balance < totalAmount) revert InsufficientBalance();

        // Update tracking
        disburserDisbursed[msg.sender] += totalAmount;
        totalDisbursedToUsers += userAmount;
        totalBurned += burnAmount;

        // Transfer tokens
        if (userAmount > 0) {
            clickToken.safeTransfer(recipient, userAmount);
        }
        if (burnAmount > 0) {
            clickToken.safeTransfer(BURN_ADDRESS, burnAmount);
        }

        emit Disbursed(msg.sender, recipient, userAmount, burnAmount);
    }

    /**
     * @notice Burn tokens directly (no user recipient)
     * @param amount Amount to burn
     * @dev Used for burning unused epoch emissions, etc.
     */
    function burn(uint256 amount) external nonReentrant onlyAuthorizedDisburser {
        if (amount == 0) revert ZeroAmount();

        // Check allowance if set
        uint256 allowance = disburserAllowance[msg.sender];
        if (allowance > 0) {
            if (disburserDisbursed[msg.sender] + amount > allowance) {
                revert ExceedsAllowance();
            }
        }

        // Check balance
        uint256 balance = clickToken.balanceOf(address(this));
        if (balance < amount) revert InsufficientBalance();

        // Update tracking
        disburserDisbursed[msg.sender] += amount;
        totalBurned += amount;

        // Burn
        clickToken.safeTransfer(BURN_ADDRESS, amount);

        emit Disbursed(msg.sender, address(0), 0, amount);
    }

    // ============ Admin Functions ============

    /**
     * @notice Authorize a new disburser (e.g., a season's game contract)
     * @param disburser Address to authorize
     * @param allowance Maximum tokens this disburser can disburse (0 = unlimited)
     */
    function authorizeDisburser(
        address disburser,
        uint256 allowance
    ) external onlyOwner {
        if (disburser == address(0)) revert ZeroAddress();

        authorizedDisbursers[disburser] = true;
        disburserAllowance[disburser] = allowance;

        emit DisburserAuthorized(disburser, allowance);
    }

    /**
     * @notice Revoke a disburser's authorization
     * @param disburser Address to revoke
     * @dev Use for compromised contracts or ended seasons
     */
    function revokeDisburser(address disburser) external onlyOwner {
        if (disburser == address(0)) revert ZeroAddress();

        authorizedDisbursers[disburser] = false;

        emit DisburserRevoked(disburser);
    }

    /**
     * @notice Update a disburser's allowance
     * @param disburser Address to update
     * @param newAllowance New allowance (0 = unlimited)
     */
    function updateDisburserAllowance(
        address disburser,
        uint256 newAllowance
    ) external onlyOwner {
        uint256 oldAllowance = disburserAllowance[disburser];
        disburserAllowance[disburser] = newAllowance;

        emit DisburserAllowanceUpdated(disburser, oldAllowance, newAllowance);
    }

    /**
     * @notice Withdraw tokens from treasury
     * @param to Recipient address
     * @param amount Amount to withdraw
     * @dev For moving to new treasury, emergencies, or returning to Safe
     */
    function withdraw(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 balance = clickToken.balanceOf(address(this));
        if (balance < amount) revert InsufficientBalance();

        clickToken.safeTransfer(to, amount);

        emit Withdrawn(to, amount);
    }

    // ============ View Functions ============

    /**
     * @notice Get treasury balance
     * @return Current $CLICK balance
     */
    function getBalance() external view returns (uint256) {
        return clickToken.balanceOf(address(this));
    }

    /**
     * @notice Get disburser stats
     * @param disburser Address to check
     * @return authorized Whether authorized
     * @return allowance Maximum allowed (0 = unlimited)
     * @return disbursed Amount already disbursed
     * @return remaining Amount remaining in allowance
     */
    function getDisburserStats(
        address disburser
    ) external view returns (
        bool authorized,
        uint256 allowance,
        uint256 disbursed,
        uint256 remaining
    ) {
        authorized = authorizedDisbursers[disburser];
        allowance = disburserAllowance[disburser];
        disbursed = disburserDisbursed[disburser];

        if (allowance == 0) {
            // Unlimited - remaining is treasury balance
            remaining = clickToken.balanceOf(address(this));
        } else if (allowance > disbursed) {
            remaining = allowance - disbursed;
        } else {
            remaining = 0;
        }
    }

    /**
     * @notice Get treasury stats
     * @return balance Current balance
     * @return disbursedToUsers Total sent to users
     * @return burned Total burned
     */
    function getTreasuryStats() external view returns (
        uint256 balance,
        uint256 disbursedToUsers,
        uint256 burned
    ) {
        balance = clickToken.balanceOf(address(this));
        disbursedToUsers = totalDisbursedToUsers;
        burned = totalBurned;
    }
}
