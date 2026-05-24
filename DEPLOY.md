# Contract Deployment Guide

This guide walks you through deploying the Taxee smart contracts to Base Sepolia testnet.

## Prerequisites

1. **Base Sepolia ETH** - Get free testnet ETH from:
   - [Coinbase Faucet](https://www.coinbase.com/faucets/base-sepolia-faucet)
   - [Alchemy Faucet](https://www.alchemy.com/faucets/base-sepolia)

2. **Private Key** - Export your test wallet private key (with 0x prefix)

3. **BaseScan API Key** (optional, for verification) - Get from [basescan.org/apis](https://basescan.org/apis)

## Setup

1. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` and add:**
   ```
   PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
   BASESCAN_API_KEY=your_basescan_api_key_here
   ```

## Deploy Contracts

Run the deployment script:

```bash
npm run deploy:contracts
```

This will:
1. Deploy `DelegationRegistry` contract
2. Deploy `TaxeeManager` contract
3. Configure contracts with default settings
4. Save deployment info to `deployments/84532.json`

## Update Frontend

After deployment, update the frontend with the new contract addresses:

```bash
npm run deploy:update-frontend
```

This updates:
- `frontend/lib/wagmi.ts` - Contract addresses
- `frontend/.env.local` - Environment variables

## Verify Contracts (Optional)

To verify contracts on BaseScan:

```bash
# Get addresses from deployments/84532.json or deployment output
npx hardhat verify --network baseSepolia DELEGATION_REGISTRY_ADDRESS
npx hardhat verify --network baseSepolia TAXEE_MANAGER_ADDRESS DELEGATION_REGISTRY_ADDRESS
```

## Contract Addresses

After deployment, your contracts will be at:

**Base Sepolia:**
- DelegationRegistry: `0x...` (from deployment output)
- TaxeeManager: `0x...` (from deployment output)

## Testing

Run the test suite:

```bash
npm run test:contracts
```

## Architecture

### DelegationRegistry.sol
- Stores user delegations
- Validates policy limits (per-transaction and monthly)
- Tracks monthly usage
- Supports delegation revocation

### TaxeeManager.sol
- Main execution contract
- Handles harvest, rebuy, and yield move operations
- Validates actions against user policy
- Integrates with Circle Wallets API via relayer

## Troubleshooting

**"insufficient funds" error:**
- Make sure you have Base Sepolia ETH in your deployer wallet
- Get more from the faucets listed above

**"Private key too short" error:**
- Make sure your private key has the `0x` prefix
- Should be 66 characters long (0x + 64 hex characters)

**"network does not exist" error:**
- Make sure `BASE_SEPOLIA_RPC` is set correctly in `.env`
- Or use the default public endpoint

## Next Steps

After deployment:
1. Update `frontend/.env.local` with contract addresses
2. Restart the frontend dev server
3. Test the wallet connection and delegation flow
4. Update the relayer address to your actual Circle relayer service
