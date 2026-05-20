# taxee — Smart Contracts

Foundry project for taxee's on-chain components. Deployed on **Base** (primary) and Base Sepolia (testnet).

## Setup

```bash
# Install Foundry (if not installed)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install dependencies
forge install foundry-rs/forge-std
forge install OpenZeppelin/openzeppelin-contracts

# Build
forge build

# Test
forge test -vvv

# Test with gas report
forge test --gas-report
```

## Contracts

| Contract             | Description                                                             |
|----------------------|-------------------------------------------------------------------------|
| `TaxeeLotRegistry`   | Immutable on-chain hash commitment per disposal lot. Backs Arc records. |
| `TaxeeExecutor`      | Atomic USDC → USYC park / USYC → USDC redeem per tax lot.              |

## Deploy

```bash
cp ../.env.example .env
# fill in DEPLOYER_PRIVATE_KEY, USYC_ADDRESS, USDC_ADDRESS, AUTHORIZED_CALLER

# Base Sepolia (testnet)
forge script script/Deploy.s.sol \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY

# Base Mainnet
forge script script/Deploy.s.sol \
  --rpc-url $BASE_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY
```

## Known Addresses (Base Mainnet)

| Contract     | Address                                      |
|--------------|----------------------------------------------|
| USDC         | `0x833589fCD6eDb6E08f4cEAA5e9087D3Ef0E2B5B` |
| CCTP TokenMessenger | `0x1682Ae6375C4E4A97e4B583BC394c861A46D8962` |
| CCTP MessageTransmitter | `0xAD09780d193884d503182aD4588450C416D6F9D` |
| USYC         | Verify on Basescan before production deploy  |
