// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TaxeeTypes.sol";
import "./DelegationRegistry.sol";

/**
 * @title TaxeeManager
 * @notice Main execution contract for Taxee protocol
 * @dev Users delegate to this contract via EIP-7702. It validates policy,
 *      calls Circle Wallets API, and handles tax lot tracking.
 */
contract TaxeeManager {
    
    // ============ Errors ============
    
    error UnauthorizedAction();
    error InvalidPolicy();
    error ExecutionFailed(string reason);
    error SlippageExceeded();
    error CooldownActive();
    error AssetNotAllowed();
    
    // ============ Events ============
    
    event HarvestExecuted(
        address indexed user,
        address indexed asset,
        uint256 amount,
        uint256 proceeds,
        uint256 lossRealized,
        bytes32 txHash
    );
    
    event RebuyExecuted(
        address indexed user,
        address indexed asset,
        uint256 amount,
        uint256 newBasis,
        bytes32 txHash
    );
    
    event YieldMoveExecuted(
        address indexed user,
        address indexed fromAsset,
        address indexed toAsset,
        uint256 amount,
        bytes32 txHash
    );
    
    event ExecutionRequested(
        address indexed user,
        bytes32 indexed requestId,
        TaxeeTypes.ActionType action,
        uint256 estimatedValue
    );
    
    event ExecutionConfirmed(
        address indexed user,
        bytes32 indexed requestId,
        bytes32 txHash,
        uint256 actualValue
    );
    
    event OpportunitySkipped(
        address indexed user,
        string reason,
        uint256 timestamp
    );
    
    // ============ State ============
    
    /// @notice Delegation registry contract
    DelegationRegistry public immutable delegationRegistry;
    
    /// @notice Circle Wallets API endpoint (off-chain oracle/relayer)
    address public circleRelayer;
    
    /// @notice Contract owner
    address public owner;
    
    /// @notice Authorized executors (Taxee backend nodes)
    mapping(address => bool) public authorizedExecutors;
    
    /// @notice Allowed assets for trading
    mapping(address => bool) public allowedAssets;
    
    /// @notice USYC (Circle Yield Token) address
    address public usycToken;
    
    /// @notice Cooldown between harvest and rebuy (in seconds)
    uint256 public rebuyCooldown = 300; // 5 minutes
    
    /// @notice Slippage tolerance (basis points, 100 = 1%)
    uint256 public slippageTolerance = 100;
    
    /// @notice Last harvest timestamp per user (for cooldown)
    mapping(address => uint256) public lastHarvestTime;
    
    /// @notice Pending executions
    mapping(bytes32 => TaxeeTypes.TransactionPayload) public pendingExecutions;
    
    /// @notice Request nonce counter
    uint256 public requestNonce;
    
    // ============ Modifiers ============
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier onlyExecutor() {
        require(authorizedExecutors[msg.sender], "Not authorized executor");
        _;
    }
    
    modifier onlyRelayer() {
        require(msg.sender == circleRelayer, "Not circle relayer");
        _;
    }
    
    // ============ Constructor ============
    
    constructor(address _delegationRegistry) {
        owner = msg.sender;
        delegationRegistry = DelegationRegistry(_delegationRegistry);
        
        // Default allowed assets
        allowedAssets[0x0000000000000000000000000000000000000000] = true; // ETH
        allowedAssets[0xA0b86a33E6441e0A421e56E4773C3C4b0Db7E5b5] = true; // USDC (Base)
    }
    
    // ============ Admin Functions ============
    
    function setCircleRelayer(address _relayer) external onlyOwner {
        circleRelayer = _relayer;
    }
    
    function setAuthorizedExecutor(address executor, bool authorized) external onlyOwner {
        authorizedExecutors[executor] = authorized;
    }
    
    function setAllowedAsset(address asset, bool allowed) external onlyOwner {
        allowedAssets[asset] = allowed;
    }
    
    function setUsycToken(address _usyc) external onlyOwner {
        usycToken = _usyc;
    }
    
    function setRebuyCooldown(uint256 cooldown) external onlyOwner {
        rebuyCooldown = cooldown;
    }
    
    function setSlippageTolerance(uint256 tolerance) external onlyOwner {
        require(tolerance <= 1000, "Max 10% slippage"); // Max 10%
        slippageTolerance = tolerance;
    }
    
    // ============ Execution Functions ============
    
    /**
     * @notice Execute a tax loss harvest
     * @param user User address (via delegation)
     * @param asset Asset to sell
     * @param amount Amount to sell
     * @param estimatedProceeds Estimated USD proceeds
     * @param lotId Tax lot identifier for Arc
     */
    function executeHarvest(
        address user,
        address asset,
        uint256 amount,
        uint256 estimatedProceeds,
        string calldata lotId
    ) external onlyExecutor returns (bytes32 requestId) {
        // Validate
        _validateAction(user, TaxeeTypes.ActionType.HARVEST, asset, estimatedProceeds);
        
        // Create request
        requestId = keccak256(abi.encodePacked(user, block.timestamp, requestNonce++));
        
        TaxeeTypes.TransactionPayload memory payload = TaxeeTypes.TransactionPayload({
            action: TaxeeTypes.ActionType.HARVEST,
            asset: asset,
            amount: amount,
            estimatedValue: estimatedProceeds,
            data: abi.encode(lotId),
            nonce: requestNonce,
            deadline: block.timestamp + 10 minutes
        });
        
        pendingExecutions[requestId] = payload;
        lastHarvestTime[user] = block.timestamp;
        
        emit ExecutionRequested(user, requestId, TaxeeTypes.ActionType.HARVEST, estimatedProceeds);
        
        // Record delegation usage
        delegationRegistry.validateAndRecordUsage(user, estimatedProceeds, TaxeeTypes.ActionType.HARVEST);
        
        return requestId;
    }
    
    /**
     * @notice Execute rebuy after harvest (within cooldown window)
     * @param user User address
     * @param asset Asset to buy
     * @param amount Amount to buy
     * @param estimatedCost Estimated USD cost
     * @param originalLotId Original lot that was harvested
     */
    function executeRebuy(
        address user,
        address asset,
        uint256 amount,
        uint256 estimatedCost,
        string calldata originalLotId
    ) external onlyExecutor returns (bytes32 requestId) {
        // Validate cooldown period
        if (block.timestamp < lastHarvestTime[user] + rebuyCooldown) {
            revert CooldownActive();
        }
        
        _validateAction(user, TaxeeTypes.ActionType.REBUY, asset, estimatedCost);
        
        requestId = keccak256(abi.encodePacked(user, block.timestamp, requestNonce++));
        
        TaxeeTypes.TransactionPayload memory payload = TaxeeTypes.TransactionPayload({
            action: TaxeeTypes.ActionType.REBUY,
            asset: asset,
            amount: amount,
            estimatedValue: estimatedCost,
            data: abi.encode(originalLotId),
            nonce: requestNonce,
            deadline: block.timestamp + 10 minutes
        });
        
        pendingExecutions[requestId] = payload;
        
        emit ExecutionRequested(user, requestId, TaxeeTypes.ActionType.REBUY, estimatedCost);
        
        delegationRegistry.validateAndRecordUsage(user, estimatedCost, TaxeeTypes.ActionType.REBUY);
        
        return requestId;
    }
    
    /**
     * @notice Move funds to/from USYC yield token
     * @param user User address
     * @param fromAsset Asset to move from
     * @param toAsset Asset to move to (USYC or back)
     * @param amount Amount to move
     * @param estimatedValue USD value
     */
    function executeYieldMove(
        address user,
        address fromAsset,
        address toAsset,
        uint256 amount,
        uint256 estimatedValue
    ) external onlyExecutor returns (bytes32 requestId) {
        // Validate one side is USYC
        if (fromAsset != usycToken && toAsset != usycToken) {
            revert UnauthorizedAction();
        }
        
        _validateAction(user, TaxeeTypes.ActionType.YIELD_MOVE, fromAsset, estimatedValue);
        
        requestId = keccak256(abi.encodePacked(user, block.timestamp, requestNonce++));
        
        TaxeeTypes.TransactionPayload memory payload = TaxeeTypes.TransactionPayload({
            action: TaxeeTypes.ActionType.YIELD_MOVE,
            asset: fromAsset,
            amount: amount,
            estimatedValue: estimatedValue,
            data: abi.encode(toAsset),
            nonce: requestNonce,
            deadline: block.timestamp + 10 minutes
        });
        
        pendingExecutions[requestId] = payload;
        
        emit ExecutionRequested(user, requestId, TaxeeTypes.ActionType.YIELD_MOVE, estimatedValue);
        
        delegationRegistry.validateAndRecordUsage(user, estimatedValue, TaxeeTypes.ActionType.YIELD_MOVE);
        
        return requestId;
    }
    
    /**
     * @notice Confirm execution after Circle MPC signs and submits
     * @param requestId Request identifier
     * @param txHash On-chain transaction hash
     * @param actualValue Actual USD value executed
     * @param success Whether execution succeeded
     */
    function confirmExecution(
        bytes32 requestId,
        bytes32 txHash,
        uint256 actualValue,
        bool success
    ) external onlyRelayer {
        TaxeeTypes.TransactionPayload storage payload = pendingExecutions[requestId];
        require(payload.deadline > 0, "Request not found");
        require(block.timestamp <= payload.deadline, "Request expired");
        
        // Check slippage
        uint256 expectedValue = payload.estimatedValue;
        uint256 maxSlippage = (expectedValue * slippageTolerance) / 10000;
        
        if (actualValue < expectedValue - maxSlippage) {
            // Slippage exceeded - mark as failed
            delete pendingExecutions[requestId];
            emit OpportunitySkipped(
                address(uint160(uint256(requestId))), // Rough extraction
                "Slippage exceeded",
                block.timestamp
            );
            revert SlippageExceeded();
        }
        
        if (success) {
            // Emit appropriate event based on action type
            if (payload.action == TaxeeTypes.ActionType.HARVEST) {
                emit HarvestExecuted(
                    address(uint160(uint256(requestId))), // This is a simplification
                    payload.asset,
                    payload.amount,
                    actualValue,
                    0, // Loss calculated off-chain
                    txHash
                );
            } else if (payload.action == TaxeeTypes.ActionType.REBUY) {
                emit RebuyExecuted(
                    address(uint160(uint256(requestId))),
                    payload.asset,
                    payload.amount,
                    actualValue,
                    txHash
                );
            } else if (payload.action == TaxeeTypes.ActionType.YIELD_MOVE) {
                address toAsset = abi.decode(payload.data, (address));
                emit YieldMoveExecuted(
                    address(uint160(uint256(requestId))),
                    payload.asset,
                    toAsset,
                    payload.amount,
                    txHash
                );
            }
            
            emit ExecutionConfirmed(
                address(uint160(uint256(requestId))),
                requestId,
                txHash,
                actualValue
            );
        } else {
            emit OpportunitySkipped(
                address(uint160(uint256(requestId))),
                "Execution failed",
                block.timestamp
            );
        }
        
        delete pendingExecutions[requestId];
    }
    
    /**
     * @notice Skip an opportunity without executing
     * @param requestId Request to skip
     * @param reason Reason for skipping
     */
    function skipOpportunity(
        bytes32 requestId,
        string calldata reason
    ) external onlyExecutor {
        TaxeeTypes.TransactionPayload storage payload = pendingExecutions[requestId];
        require(payload.deadline > 0, "Request not found");
        
        delete pendingExecutions[requestId];
        
        emit OpportunitySkipped(
            address(uint160(uint256(requestId))),
            reason,
            block.timestamp
        );
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Check if an action can be executed
     */
    function canExecute(
        address user,
        TaxeeTypes.ActionType action,
        address asset,
        uint256 value
    ) external view returns (bool, string memory) {
        (bool hasDelegation, ) = delegationRegistry.hasActiveDelegation(user);
        if (!hasDelegation) return (false, "No active delegation");
        
        if (!allowedAssets[asset]) return (false, "Asset not allowed");
        
        (uint256 remaining, ) = delegationRegistry.getRemainingMonthlyLimit(user);
        if (value > remaining) return (false, "Exceeds monthly limit");
        
        if (action == TaxeeTypes.ActionType.REBUY) {
            if (block.timestamp < lastHarvestTime[user] + rebuyCooldown) {
                return (false, "Cooldown active");
            }
        }
        
        return (true, "");
    }
    
    /**
     * @notice Get pending execution details
     */
    function getPendingExecution(bytes32 requestId) 
        external 
        view 
        returns (TaxeeTypes.TransactionPayload memory) 
    {
        return pendingExecutions[requestId];
    }
    
    // ============ Internal Functions ============
    
    function _validateAction(
        address user,
        TaxeeTypes.ActionType action,
        address asset,
        uint256 value
    ) internal view {
        // Check asset is allowed
        if (!allowedAssets[asset]) revert AssetNotAllowed();
        
        // Additional validation happens in DelegationRegistry.validateAndRecordUsage
        // which is called after this function
    }
}
