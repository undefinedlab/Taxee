// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IERC20.sol";
import "./interfaces/IUsyc.sol";
import "./TaxeeLotRegistry.sol";

/**
 * @title  TaxeeExecutor
 * @notice Atomic execution contract for taxee harvest + USYC park operations.
 *
 *         When the taxee agent decides to park capital in USYC (while waiting for:
 *           a) a wash-sale window to close, or
 *           b) a lot to cross the 365-day long-term threshold),
 *         this contract atomically moves USDC into USYC in a single transaction.
 *
 *         "Atomic" is the key word: both the USDC transfer and the USYC deposit
 *         succeed together, or both revert. No partial execution.
 *
 *         Also records every park/redeem against the TaxeeLotRegistry for
 *         non-repudiable on-chain audit.
 *
 * @dev    Deployed on Base. Authorized caller = Circle Programmable Wallet address
 *         for the user's taxee agent (set at construction, immutable).
 *         USYC address on Base must be confirmed before mainnet deploy.
 */
contract TaxeeExecutor {
    // ─── Immutables ────────────────────────────────────────────────────────────

    IUsyc  public immutable usyc;
    IERC20 public immutable usdc;
    TaxeeLotRegistry public immutable registry;

    /// @notice The only address permitted to call park/redeem functions.
    ///         Set to the Circle Programmable Wallet address at construction.
    address public immutable authorizedCaller;

    // ─── Events ────────────────────────────────────────────────────────────────

    /**
     * @notice Emitted when USDC is successfully parked into USYC for a lot.
     */
    event ParkedInUsyc(
        address indexed agent,
        bytes32 indexed lotId,
        uint256 usdcAmount,
        uint256 usycShares,
        uint256 timestamp
    );

    /**
     * @notice Emitted when USYC shares are redeemed back to USDC.
     */
    event RedeemedFromUsyc(
        address indexed agent,
        bytes32 indexed lotId,
        uint256 usycShares,
        uint256 usdcAmount,
        uint256 timestamp
    );

    // ─── Storage ───────────────────────────────────────────────────────────────

    /// @notice Tracks USYC share balances per lot (lotId → shares).
    ///         Allows partial redemptions and precise accounting per lot.
    mapping(bytes32 => uint256) public parkedShares;

    /// @notice Tracks the agent address that parked each lot.
    mapping(bytes32 => address) public parkedBy;

    // ─── Errors ────────────────────────────────────────────────────────────────

    error Unauthorized();
    error ZeroAmount();
    error InsufficientAllowance(uint256 required, uint256 actual);
    error NoSharesParked(bytes32 lotId);
    error InsufficientShares(bytes32 lotId, uint256 requested, uint256 available);

    // ─── Constructor ───────────────────────────────────────────────────────────

    /**
     * @param _usyc             USYC token address on Base
     * @param _usdc             USDC token address on Base (0x833589fCD6eDb6E08f4cEAA5e9...)
     * @param _registry         TaxeeLotRegistry address
     * @param _authorizedCaller Circle Programmable Wallet address for this agent
     */
    constructor(
        address _usyc,
        address _usdc,
        address _registry,
        address _authorizedCaller
    ) {
        require(_usyc != address(0), "Zero USYC");
        require(_usdc != address(0), "Zero USDC");
        require(_registry != address(0), "Zero registry");
        require(_authorizedCaller != address(0), "Zero caller");

        usyc             = IUsyc(_usyc);
        usdc             = IERC20(_usdc);
        registry         = TaxeeLotRegistry(_registry);
        authorizedCaller = _authorizedCaller;
    }

    // ─── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyAuthorized() {
        if (msg.sender != authorizedCaller) revert Unauthorized();
        _;
    }

    // ─── Core Functions ────────────────────────────────────────────────────────

    /**
     * @notice Park USDC into USYC for a specific tax lot.
     *
     *         Called by the taxee agent when:
     *         - A lot is within `maturationBufferDays` of the 365-day LT threshold, OR
     *         - A harvest is deferred due to an open wash-sale window and the agent
     *           parks the capital to earn yield in the interim.
     *
     * @param  usdcAmount  Amount of USDC to park (must be pre-approved to this contract)
     * @param  lotId       Taxee lot identifier (keccak256 of lot UUID + agentId)
     * @param  agentAddr   Agent address (for event indexing and registry)
     * @return shares      USYC shares received
     */
    function parkInUsyc(
        uint256 usdcAmount,
        bytes32 lotId,
        address agentAddr
    ) external onlyAuthorized returns (uint256 shares) {
        if (usdcAmount == 0) revert ZeroAmount();

        uint256 allowance = usdc.allowance(msg.sender, address(this));
        if (allowance < usdcAmount) revert InsufficientAllowance(usdcAmount, allowance);

        usdc.transferFrom(msg.sender, address(this), usdcAmount);
        usdc.approve(address(usyc), usdcAmount);

        shares = usyc.deposit(usdcAmount, address(this));

        parkedShares[lotId] += shares;
        parkedBy[lotId]      = agentAddr;

        emit ParkedInUsyc(agentAddr, lotId, usdcAmount, shares, block.timestamp);
    }

    /**
     * @notice Redeem USYC shares back to USDC when a lot is ready to harvest
     *         (wash-sale window closed or LT threshold crossed).
     *
     * @param  shares      USYC shares to redeem for this lot
     * @param  lotId       Lot identifier
     * @param  recipient   Address to send USDC proceeds to (usually the agent wallet)
     * @return usdcAmount  USDC received
     */
    function redeemFromUsyc(
        uint256 shares,
        bytes32 lotId,
        address recipient
    ) external onlyAuthorized returns (uint256 usdcAmount) {
        if (shares == 0) revert ZeroAmount();
        if (parkedShares[lotId] == 0) revert NoSharesParked(lotId);
        if (parkedShares[lotId] < shares) {
            revert InsufficientShares(lotId, shares, parkedShares[lotId]);
        }

        parkedShares[lotId] -= shares;

        usdcAmount = usyc.redeem(shares, recipient, address(this));

        emit RedeemedFromUsyc(parkedBy[lotId], lotId, shares, usdcAmount, block.timestamp);
    }

    /**
     * @notice Redeem ALL parked shares for a lot in one call.
     *         Used when a lot fully crosses the LT threshold and is ready for harvest.
     */
    function redeemAllForLot(
        bytes32 lotId,
        address recipient
    ) external onlyAuthorized returns (uint256 usdcAmount) {
        uint256 shares = parkedShares[lotId];
        if (shares == 0) revert NoSharesParked(lotId);

        parkedShares[lotId] = 0;

        usdcAmount = usyc.redeem(shares, recipient, address(this));

        emit RedeemedFromUsyc(parkedBy[lotId], lotId, shares, usdcAmount, block.timestamp);
    }

    // ─── View Functions ────────────────────────────────────────────────────────

    /**
     * @notice Preview current USDC value of shares parked for a lot (reflects NAV appreciation).
     */
    function previewParkedValue(bytes32 lotId) external view returns (uint256 usdcValue) {
        uint256 shares = parkedShares[lotId];
        if (shares == 0) return 0;
        return usyc.previewRedeem(shares);
    }

    /**
     * @notice Return parked share balance for a lot.
     */
    function getParkedShares(bytes32 lotId) external view returns (uint256) {
        return parkedShares[lotId];
    }
}
