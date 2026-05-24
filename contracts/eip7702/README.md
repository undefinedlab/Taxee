# EIP-7702 Delegation Contracts

Smart contracts implementing EIP-7702 for Taxee's self-custody wallet integration, enabling users to delegate transaction execution authority to Taxee while maintaining full control of their private keys.

## Overview

These contracts allow **self-custody wallet users** (MetaMask, Rainbow, etc.) to authorize Taxee via EIP-7702 delegation. 

⚠️ **Note:** This is one of three wallet options in Taxee:
1. **Self-Custody (EIP-7702)** ← These contracts
2. **Circle MPC Wallet** ← Custodial option via `/setup-wallet`
3. **Watch-Only Mode** ← Read-only tracking

See [Wallet Options Guide](../../docs/wallet-options.md) for full comparison.

## Architecture

```
User (MetaMask)
    ↓
Sign EIP-712 Delegation Message
    ↓
DelegationRegistry (stores delegation on-chain)
    ↓
TaxeeManager (validates & executes within policy)
    ↓
Circle MPC (co-signs transaction)
    ↓
Blockchain (transaction executed)
```

## Deployed Contracts

### Base Sepolia (Testnet)

| Contract | Address | Verified |
|----------|---------|----------|
| **DelegationRegistry** | `0x403Fe0408976b518b2952BdF590135Ec6ba12ebc` | ⏳ Pending |
| **TaxeeManager** | `0xEE8DAE2D3f142052bDb704Ba0D94e04eC1680193` | ⏳ Pending |

**View on BaseScan:**
- DelegationRegistry: https://sepolia.basescan.org/address/0x403Fe0408976b518b2952BdF590135Ec6ba12ebc
- TaxeeManager: https://sepolia.basescan.org/address/0xEE8DAE2D3f142052bDb704Ba0D94e04eC1680193

### Base Mainnet

Not yet deployed. Use Base Sepolia for testing.

## Contract Details

### DelegationRegistry.sol

Stores and validates user delegations for EIP-7702.

**Key Features:**
- Stores delegation metadata (delegate address, policy hash, expiration, limits)
- Validates per-transaction limits ($5,000 default)
- Tracks monthly usage with automatic 30-day reset
- Supports delegation revocation by user
- EIP-712 signature verification

**Main Functions:**
- `createDelegation()` - Create new delegation
- `revokeDelegation()` - Revoke active delegation
- `hasActiveDelegation()` - Check if user has active delegation
- `getRemainingMonthlyLimit()` - Get remaining monthly quota
- `validateAndRecordUsage()` - Called by TaxeeManager to validate and record usage

### TaxeeManager.sol

Main execution contract that users delegate to.

**Key Features:**
- Executes harvest, rebuy, and yield move operations
- Validates actions against user policy
- Enforces slippage tolerance (1% default)
- 5-minute cooldown between harvest and rebuy
- Integrates with Circle Wallets API via authorized relayer

**Main Functions:**
- `executeHarvest()` - Execute tax loss harvest
- `executeRebuy()` - Rebuy asset after harvest
- `executeYieldMove()` - Move funds to/from USYC
- `canExecute()` - Check if action is allowed
- `confirmExecution()` - Called by Circle relayer after MPC signing

## User Flow

### 1. Onboarding

```typescript
// User connects MetaMask
const { address } = useAccount();

// User signs EIP-712 delegation
const signature = await signTypedData({
  domain: EIP712_DOMAIN,
  types: EIP712_TYPES,
  message: {
    delegate: TAXEE_MANAGER_ADDRESS,
    policyHash: keccak256(policy),
    expiration: now + 90 days,
    maxPerTx: $5,000,
    maxPerMonth: $20,000,
  }
});

// Delegation stored on-chain
await createDelegation(policy, signature);
```

### 2. Autonomous Execution

```typescript
// Taxee detects opportunity and calls:
TaxeeManager.executeHarvest(
  userAddress,
  asset,
  amount,
  estimatedProceeds,
  lotId
);

// Contract validates:
// - User has active delegation
// - Within policy limits
// - Asset is allowed
// - Monthly cap not exceeded

// Circle relayer confirms after MPC signing
TaxeeManager.confirmExecution(requestId, txHash, actualValue, success);
```

### 3. Revocation

User can revoke delegation anytime:

```typescript
DelegationRegistry.revokeDelegation();
```

## Policy Structure

Default policy for new users:

```yaml
Authorized Actions:
  - HARVEST (tax loss harvesting)
  - REBUY (rebuy same asset within 1 hour)
  - YIELD_MOVE (move to/from USYC)

Limits:
  per_transaction: $5,000 USD
  per_month: $20,000 USD

Allowed Assets:
  - ETH
  - USDC
  - USYC

Restrictions:
  - NO_EXTERNAL_TRANSFERS
  - Cannot exceed limits without re-authorization
  - Cannot access funds outside Circle Wallet

Timing:
  delegation_expiry: 90 days
  rebuy_cooldown: 5 minutes
```

## Development

### Prerequisites

- Node.js 18+
- Private key with Base Sepolia ETH

### Setup

```bash
cd /taxee/contracts/eip7702

# Create environment file
cp .env.example .env

# Edit .env and add:
# PRIVATE_KEY=0xYourPrivateKey
# BASESCAN_API_KEY=your_key (optional, for verification)
```

### Deploy

```bash
# From contracts folder
cd /taxee/contracts

# Deploy to Base Sepolia
npx hardhat deploy-eip7702 --network baseSepolia

# Verify on BaseScan (optional)
npx hardhat verify --network baseSepolia DELEGATION_REGISTRY_ADDRESS
npx hardhat verify --network baseSepolia TAXEE_MANAGER_ADDRESS DELEGATION_REGISTRY_ADDRESS
```

### Testing

```bash
# Run tests
npx hardhat test

# Run specific test
npx hardhat test test/TaxeeDelegation.t.sol
```

## Security Model

### Layered Enforcement

1. **EIP-7702 Delegation** - User grants scoped authority via signature
2. **DelegationRegistry** - Validates limits and expiration on-chain
3. **TaxeeManager** - Validates actions and asset whitelist
4. **Circle MPC** - Multi-party co-signing provides final check

### Key Properties

- **Non-custodial**: Taxee never holds private keys
- **Revocable**: User can revoke instantly
- **Time-bounded**: Delegations expire (default 90 days)
- **Scoped**: Limited to specific actions and limits
- **Auditable**: All actions logged on-chain

## Integration

### Frontend

Contract addresses are automatically updated in:
- `frontend/lib/wagmi.ts` - Wagmi configuration
- `frontend/.env.local` - Environment variables

### Supported Wallets

- MetaMask
- Rainbow Wallet
- Coinbase Wallet
- WalletConnect-compatible wallets (50+)

### Networks

- ✅ Base Sepolia (testnet) - Deployed
- ⏳ Base Mainnet - Coming soon

## Troubleshooting

### "Delegation expired"
- Delegations are valid for 90 days by default
- User needs to re-authorize

### "Monthly limit exceeded"
- Default: $20,000 per month
- Resets automatically after 30 days
- Or user can revoke and create new delegation with higher limits

### "Asset not allowed"
- Only ETH, USDC, and USYC are allowed by default
- Contact Taxee to add new assets

## Contract Interactions

See [INTERACTIONS.md](../INTERACTIONS.md) for detailed documentation on:
- How frontend integrates with contracts
- Complete user flow examples
- Error handling guide
- Gas estimates
- Testing instructions

### Quick Interaction Test

```bash
cd /taxee/contracts
npx hardhat run test-interactions.js --network baseSepolia
```

Expected output:
```
✅ Contract Configuration
✅ Executor Authorization  
✅ Circle Relayer
✅ Allowed Assets
✅ Contract Parameters
✅ Delegation Simulation
✅ Execution Validation
```

## References

- [EIP-7702: Set EOA account code](https://eips.ethereum.org/EIPS/eip-7702)
- [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-sepolia-faucet)
- [Circle W3S SDK Docs](https://developers.circle.com/w3s/)
- [Contract Interactions Guide](../INTERACTIONS.md)

## Deployment History

| Date | Network | DelegationRegistry | TaxeeManager | Notes |
|------|---------|-------------------|--------------|-------|
| 2024-05-24 | Base Sepolia | `0x403Fe0408976b518b2952BdF590135Ec6ba12ebc` | `0xEE8DAE2D3f142052bDb704Ba0D94e04eC1680193` | Initial deployment |

## License

MIT
