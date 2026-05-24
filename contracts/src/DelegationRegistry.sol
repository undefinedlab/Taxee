// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TaxeeTypes.sol";

/**
 * @title DelegationRegistry
 * @notice Stores and validates EIP-7702 delegations for Taxee protocol
 * @dev Users delegate execution authority to TaxeeManager via this registry
 */
contract DelegationRegistry {
    
    // ============ Errors ============
    
    error DelegationExpired();
    error DelegationNotFound();
    error InvalidSignature();
    error PolicyViolation(string reason);
    error UnauthorizedCaller();
    error MonthlyLimitExceeded();
    error ZeroAddress();
    
    // ============ Events ============
    
    event DelegationCreated(
        address indexed user,
        address indexed delegate,
        bytes32 indexed policyHash,
        uint256 expiration
    );
    
    event DelegationRevoked(
        address indexed user,
        address indexed delegate,
        uint256 timestamp
    );
    
    event DelegationUsed(
        address indexed user,
        address indexed delegate,
        uint256 value,
        TaxeeTypes.ActionType action
    );
    
    event MonthlyLimitUpdated(
        address indexed user,
        uint256 newRemaining,
        uint256 monthStart
    );
    
    // ============ State ============
    
    /// @notice User => Delegation mapping
    mapping(address => TaxeeTypes.Delegation) public delegations;
    
    /// @notice User => Monthly usage tracking (monthStart => amountUsed)
    mapping(address => mapping(uint256 => uint256)) public monthlyUsage;
    
    /// @notice User => Current month start timestamp
    mapping(address => uint256) public currentMonthStart;
    
    /// @notice TaxeeManager contract address (authorized caller)
    address public taxeeManager;
    
    /// @notice Contract owner
    address public owner;
    
    /// @notice Domain separator for EIP-712
    bytes32 public immutable DOMAIN_SEPARATOR;
    
    /// @notice Nonce tracking for replay protection
    mapping(address => uint256) public nonces;
    
    // ============ Modifiers ============
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert UnauthorizedCaller();
        _;
    }
    
    modifier onlyTaxeeManager() {
        if (msg.sender != taxeeManager) revert UnauthorizedCaller();
        _;
    }
    
    // ============ Constructor ============
    
    constructor() {
        owner = msg.sender;
        
        // EIP-712 Domain Separator
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("Taxee")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }
    
    // ============ External Functions ============
    
    /**
     * @notice Set the TaxeeManager contract address
     * @param _taxeeManager Address of TaxeeManager contract
     */
    function setTaxeeManager(address _taxeeManager) external onlyOwner {
        if (_taxeeManager == address(0)) revert ZeroAddress();
        taxeeManager = _taxeeManager;
    }
    
    /**
     * @notice Create a new delegation (called by user or via signature)
     * @param delegation Delegation struct with all parameters
     */
    function createDelegation(TaxeeTypes.Delegation calldata delegation) external {
        _createDelegation(msg.sender, delegation);
    }
    
    /**
     * @notice Create delegation on behalf of user via meta-transaction
     * @param user Address of user creating delegation
     * @param delegation Delegation struct
     * @param signature User's EIP-712 signature
     */
    function createDelegationWithSignature(
        address user,
        TaxeeTypes.Delegation calldata delegation,
        bytes calldata signature
    ) external {
        bytes32 structHash = keccak256(abi.encode(
            TaxeeTypes.DELEGATION_TYPEHASH,
            delegation.delegate,
            delegation.policyHash,
            delegation.expiration,
            delegation.maxPerTx,
            delegation.maxPerMonth,
            nonces[user]++
        ));
        
        bytes32 hash = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        address signer = recoverSigner(hash, signature);
        
        if (signer != user) revert InvalidSignature();
        
        _createDelegation(user, delegation);
    }
    
    /**
     * @notice Revoke active delegation
     */
    function revokeDelegation() external {
        address user = msg.sender;
        TaxeeTypes.Delegation storage delegation = delegations[user];
        
        if (!delegation.isActive) revert DelegationNotFound();
        
        delegation.isActive = false;
        
        emit DelegationRevoked(user, delegation.delegate, block.timestamp);
    }
    
    /**
     * @notice Validate and record delegation usage (called by TaxeeManager)
     * @param user User address
     * @param value USD value of transaction
     * @param action Type of action being performed
     * @return valid Whether the delegation is valid for this transaction
     */
    function validateAndRecordUsage(
        address user,
        uint256 value,
        TaxeeTypes.ActionType action
    ) external onlyTaxeeManager returns (bool valid) {
        TaxeeTypes.Delegation storage delegation = delegations[user];
        
        // Check delegation exists and is active
        if (!delegation.isActive) revert DelegationNotFound();
        
        // Check expiration
        if (block.timestamp > delegation.expiration) {
            delegation.isActive = false;
            revert DelegationExpired();
        }
        
        // Check per-transaction limit
        if (value > delegation.maxPerTx) {
            revert PolicyViolation("Exceeds per-transaction limit");
        }
        
        // Check and update monthly limit
        _checkAndUpdateMonthlyLimit(user, value, delegation.maxPerMonth);
        
        emit DelegationUsed(user, delegation.delegate, value, action);
        
        return true;
    }
    
    /**
     * @notice Check if user has an active delegation
     * @param user User address
     * @return hasDelegation Whether user has an active delegation
     * @return expiration Delegation expiration timestamp
     */
    function hasActiveDelegation(address user) 
        external 
        view 
        returns (bool hasDelegation, uint256 expiration) 
    {
        TaxeeTypes.Delegation storage delegation = delegations[user];
        hasDelegation = delegation.isActive && block.timestamp <= delegation.expiration;
        expiration = delegation.expiration;
    }
    
    /**
     * @notice Get remaining monthly limit for user
     * @param user User address
     * @return remaining Amount remaining this month
     * @return monthStart Start timestamp of current month
     */
    function getRemainingMonthlyLimit(address user) 
        external 
        view 
        returns (uint256 remaining, uint256 monthStart) 
    {
        TaxeeTypes.Delegation storage delegation = delegations[user];
        monthStart = currentMonthStart[user];
        
        // Reset if new month
        if (block.timestamp >= monthStart + 30 days) {
            remaining = delegation.maxPerMonth;
        } else {
            uint256 used = monthlyUsage[user][monthStart];
            remaining = delegation.maxPerMonth > used ? delegation.maxPerMonth - used : 0;
        }
    }
    
    // ============ Internal Functions ============
    
    function _createDelegation(address user, TaxeeTypes.Delegation calldata delegation) internal {
        if (delegation.delegate == address(0)) revert ZeroAddress();
        if (delegation.expiration <= block.timestamp) revert PolicyViolation("Expiration must be in future");
        if (delegation.maxPerTx == 0 || delegation.maxPerMonth == 0) {
            revert PolicyViolation("Limits must be greater than zero");
        }
        if (delegation.maxPerTx > delegation.maxPerMonth) {
            revert PolicyViolation("Per-transaction limit cannot exceed monthly limit");
        }
        
        // Store delegation
        delegations[user] = TaxeeTypes.Delegation({
            delegate: delegation.delegate,
            policyHash: delegation.policyHash,
            expiration: delegation.expiration,
            maxPerTx: delegation.maxPerTx,
            maxPerMonth: delegation.maxPerMonth,
            isActive: true,
            createdAt: block.timestamp,
            signature: delegation.signature
        });
        
        // Initialize monthly tracking
        currentMonthStart[user] = block.timestamp;
        
        emit DelegationCreated(
            user,
            delegation.delegate,
            delegation.policyHash,
            delegation.expiration
        );
    }
    
    function _checkAndUpdateMonthlyLimit(
        address user,
        uint256 value,
        uint256 maxPerMonth
    ) internal {
        uint256 monthStart = currentMonthStart[user];
        
        // Check if we need to reset monthly counter
        if (block.timestamp >= monthStart + 30 days) {
            monthStart = block.timestamp;
            currentMonthStart[user] = monthStart;
            monthlyUsage[user][monthStart] = 0;
        }
        
        uint256 currentUsage = monthlyUsage[user][monthStart];
        
        if (currentUsage + value > maxPerMonth) {
            revert MonthlyLimitExceeded();
        }
        
        monthlyUsage[user][monthStart] = currentUsage + value;
        
        emit MonthlyLimitUpdated(
            user,
            maxPerMonth - currentUsage - value,
            monthStart
        );
    }
    
    function recoverSigner(bytes32 hash, bytes memory signature) internal pure returns (address) {
        require(signature.length == 65, "Invalid signature length");
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        
        if (v < 27) v += 27;
        
        return ecrecover(hash, v, r, s);
    }
}
