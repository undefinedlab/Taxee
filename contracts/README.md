# Taxee Smart Contracts

EIP-7702 delegation contracts for autonomous tax optimization on Base L2.

## Architecture

### Core Contracts

```
┌─────────────────────┐
│  DelegationRegistry │  ← Stores user delegations, validates limits
│  (0x...)            │
└──────────┬──────────┘
           │ validates
           ▼
┌─────────────────────┐
│    TaxeeManager     │  ← Main execution contract, users delegate here
│  (0x...)            │
└──────────┬──────────┘
           │ calls
           ▼
┌─────────────────────┐
│  Circle Wallets API │  ← MPC co-signing and execution
│  (off-chain)        │
└─────────────────────┘
```

### Contract Overview

#### DelegationRegistry.sol
- Stores EIP-7702 delegations from users to TaxeeManager
- Validates policy limits (per-transaction and monthly)
- Tracks monthly usage with automatic reset
- Supports delegation revocation

#### TaxeeManager.sol
- Main contract users delegate execution authority to
- Handles harvest, rebuy, and yield move operations
- Validates actions against user policy
- Integrates with Circle Wallets API via relayer
- Enforces slippage tolerance and cooldowns

#### TaxeeTypes.sol
- Shared structs and enums
- EIP-712 type hashes
- Asset position tracking

## User Flow

### 1. Onboarding Delegation

```solidity
// User signs EIP-712 message (off-chain)
struct Delegation {
    address delegate = 0xTaxeeManager;
    bytes32 policyHash = keccak256(policy);
    uint256 expiration = now + 90 days;
    uint256 maxPerTx = 5_000e18;      // $5,000
    uint256 maxPerMonth = 20_000e18;   // $20,000
    // ... signature
}

// User submits to DelegationRegistry.createDelegation()
```

### 2. Autonomous Execution

```solidity
// Taxee backend detects opportunity and calls:
TaxeeManager.executeHarvest(user, asset, amount, proceeds, lotId);

// Contract validates:
// - User has active delegation
// - Within policy limits
// - Asset is allowed
// - Monthly cap not exceeded

// Circle relayer confirms after MPC signing
TaxeeManager.confirmExecution(requestId, txHash, actualValue, success);
```

### 3. Revocation

```solidity
// User can revoke at any time:
DelegationRegistry.revokeDelegation();
```

## Development

### Prerequisites

- [Foundry](https://book.getfoundry.sh/)
- Node.js 18+

### Install

```bash
# Clone dependencies
forge install OpenZeppelin/openzeppelin-contracts

# Install Node deps (for deployment scripts)
npm install
```

### Build

```bash
forge build
```

### Test

```bash
# Run all tests
forge test

# Run with verbose output
forge test -vvv

# Run specific test
forge test --match-test test_ExecuteHarvest

# Gas report
forge test --gas-report
```

### Deploy

#### Base Sepolia (Testnet)

```bash
# Set environment variables
export PRIVATE_KEY=0x...
export BASE_SEPOLIA_RPC=https://sepolia.base.org
export BASESCAN_API_KEY=...

# Deploy
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $BASE_SEPOLIA_RPC \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY
```

#### Base Mainnet

```bash
export PRIVATE_KEY=0x...
export BASE_RPC=https://mainnet.base.org
export BASESCAN_API_KEY=...

forge script script/Deploy.s.sol:Deploy \
  --rpc-url $BASE_RPC \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY
```

## Contract Addresses

### Base Sepolia
- DelegationRegistry: `TBD`
- TaxeeManager: `TBD`
- TaxeeTypes: `TBD`

### Base Mainnet
- DelegationRegistry: `TBD`
- TaxeeManager: `TBD`

## Security Model

### Layered Enforcement

1. **EIP-7702 Delegation**: User grants scoped authority via signature
2. **DelegationRegistry**: Validates limits and expiration
3. **TaxeeManager**: Validates actions and asset whitelist
4. **Circle MPC**: Multi-party co-signing provides final check

### Key Properties

- **Non-custodial**: Taxee never holds private keys
- **Revocable**: User can revoke instantly
- **Time-bounded**: Delegations expire (default 90 days)
- **Scoped**: Limited to specific actions and limits
- **Auditable**: All actions logged on-chain

### Emergency Procedures

```solidity
// Owner can pause in emergency
TaxeeManager.pause();

// User can revoke individually
DelegationRegistry.revokeDelegation();
```

## Policy Structure

```yaml
Authorization:
  actions:
    - HARVEST
    - REBUY
    - YIELD_MOVE
  
  limits:
    per_transaction: $5,000 USD
    per_month: $20,000 USD
  
  assets:
    allowed: [ETH, USDC, USYC]
  
  restrictions:
    no_external_transfers: true
    require_user_approval_above: $5,000
    
  timing:
    delegation_expiry: 90 days
    rebuy_cooldown: 5 minutes
```

## Integration

### From Taxee Backend

```typescript
// 1. Check if action is allowed
const [canExecute, reason] = await taxeeManager.canExecute(
  userAddress,
  ActionType.HARVEST,
  assetAddress,
  valueWei
);

// 2. Execute harvest
const tx = await taxeeManager.connect(executor).executeHarvest(
  userAddress,
  assetAddress,
  amount,
  estimatedProceeds,
  lotId
);

// 3. Wait for Circle confirmation
// (Handled by Circle relayer calling confirmExecution)
```

### Circle Relayer Integration

The Circle relayer (authorized address) confirms executions after:
1. Receiving signed transaction from Taxee
2. Submitting to Circle MPC for co-signing
3. Broadcasting to blockchain
4. Calling `confirmExecution()` with results

## Testing

### Unit Tests
- Delegation creation and revocation
- Monthly limit tracking and reset
- Harvest/rebuy/yield move execution
- Slippage protection
- Authorization checks

### Integration Tests
- Full harvest + rebuy flow
- Monthly limit enforcement across transactions
- Delegation expiration handling
- Emergency revocation

### Fuzzing
```bash
forge test --fuzz-runs 10000
```

## Gas Optimization

- Delegation storage packed efficiently
- Monthly usage tracked with minimal writes
- Events used for off-chain indexing
- View functions for pre-flight checks

## License

MIT
