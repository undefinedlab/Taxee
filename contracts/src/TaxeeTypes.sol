// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TaxeeTypes
 * @notice Shared types and structs for Taxee protocol
 */
library TaxeeTypes {
    
    /// @notice Delegation structure for EIP-7702
    struct Delegation {
        address delegate;           // Contract address delegated to (TaxeeManager)
        bytes32 policyHash;         // Hash of user policy
        uint256 expiration;         // Timestamp when delegation expires
        uint256 maxPerTx;           // Maximum USD value per transaction (wei units)
        uint256 maxPerMonth;        // Maximum USD value per month (wei units)
        bool isActive;              // Whether delegation is currently active
        uint256 createdAt;          // Timestamp of creation
        bytes signature;            // User's EIP-712 signature
    }
    
    /// @notice Action types that can be delegated
    enum ActionType {
        HARVEST,      // Tax loss harvesting
        YIELD_MOVE,   // Move to/from yield-bearing assets
        REBUY,        // Rebuy same asset after harvest
        UNKNOWN
    }
    
    /// @notice Transaction payload for execution
    struct TransactionPayload {
        ActionType action;
        address asset;
        uint256 amount;
        uint256 estimatedValue;     // USD value at time of execution
        bytes data;                 // Encoded call data
        uint256 nonce;
        uint256 deadline;
    }
    
    /// @notice Policy limits structure
    struct PolicyLimits {
        uint256 perTransaction;
        uint256 perMonth;
        uint256 remainingThisMonth;
        uint256 monthStart;
    }
    
    /// @notice Asset position tracking
    struct AssetPosition {
        address asset;
        uint256 balance;
        uint256 averageCostBasis;
        uint256 lastUpdated;
    }
    
    /// @notice EIP-712 type hashes
    bytes32 constant DELEGATION_TYPEHASH = keccak256(
        "Delegation(address delegate,bytes32 policyHash,uint256 expiration,uint256 maxPerTx,uint256 maxPerMonth,uint256 nonce)"
    );
    
    bytes32 constant TRANSACTION_TYPEHASH = keccak256(
        "Transaction(ActionType action,address asset,uint256 amount,uint256 estimatedValue,uint256 nonce,uint256 deadline)"
    );
}
