# taxee — Smart Contracts

Solidity contracts (Foundry) for the taxee tax-optimization agent.
Two execution paths are supported:

1. **Custodial / Circle Programmable Wallets** — `TaxeeLotRegistry` + `TaxeeExecutor`, deployed primarily on **Arc Testnet**.
2. **Self-custody via EIP-7702** — `DelegationRegistry` + `TaxeeManager`, deployed on Arc Testnet, Ethereum Sepolia, and Base Sepolia.

Both paths share the same `TaxeeLotRegistry` on-chain hash anchor for compliance.

---

## 1. Deployed Addresses

### Arc Testnet — chainId `5042002` (primary execution chain)

| Contract             | Address                                      |
|----------------------|----------------------------------------------|
| `TaxeeLotRegistry`   | `0x0a4aa21D151635e16DD659ad607Eb6cFD11E27A1` |
| `DelegationRegistry` | `0xbC8E45D8314EA7b46CaE4de0856d28262b3b244d` |
| `TaxeeManager`       | `0xd335C4B56Ac9664413120f21c10b9F7aaC651AE0` |
| `TaxeeExecutor`      | `0x7fD85458A0958C5EB52234f3FF4f0C6bf7cC999c` |

Notes:
- USDC is the **native gas token** on Arc, so `USDC_ADDRESS = 0x000…000`.
- `USYC_ADDRESS` on testnet is wired to the testnet USDC address as a pass-through (no yield). Swap for Hashnote USYC on mainnet.
- Authorized executor: `0xc5b7b574EE84A9B59B475FE32Eaf908C246d3859`.
- RPC: `https://rpc.testnet.arc-node.thecanteenapp.com/v1/...`.

Source of truth: [deployments/arc_testnet.json](deployments/arc_testnet.json).

### Ethereum Sepolia — chainId `11155111`

| Contract             | Address                                      |
|----------------------|----------------------------------------------|
| `DelegationRegistry` | `0x786D17590AF61F06d6BBc2B77621a72a25F4A527` |
| `TaxeeManager`       | `0x919B8F07Ec889922AE08BA8CC64C43aaA9a34A37` |
| USDC                 | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |
| WETH                 | `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14` |

Source of truth: [deployments/eth_sepolia.json](deployments/eth_sepolia.json).

### Base Sepolia — chainId `84532`

| Contract             | Address                                      |
|----------------------|----------------------------------------------|
| `DelegationRegistry` (EIP-7702) | `0x403Fe0408976b518b2952BdF590135Ec6ba12ebc` |
| `TaxeeManager` (EIP-7702)       | `0xEE8DAE2D3f142052bDb704Ba0D94e04eC1680193` |
| USDC                 | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| WETH                 | `0x4200000000000000000000000000000000000006` |
| CCTP TokenMessenger  | `0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5` |
| CCTP MessageTransmitter | `0x7865fAFC2db2093669d92c0F33AeEF291086BEFD` |

### Base Mainnet — chainId `8453` (not yet deployed; reference addresses for CCTP / USDC)

| Contract             | Address                                      |
|----------------------|----------------------------------------------|
| USDC                 | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH                 | `0x4200000000000000000000000000000000000006` |
| CCTP TokenMessenger  | `0x1682ae6375c4e4a97e4b583bc394c861a46d8962` |
| CCTP MessageTransmitter | `0xad09780d193884d503182ad4588450c416d6f9d4` |
| USYC (Hashnote)      | TBD on mainnet deploy                         |

### Ethereum Mainnet — chainId `1` (reference only)

| Contract             | Address                                      |
|----------------------|----------------------------------------------|
| USDC                 | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| CCTP TokenMessenger  | `0xBd3fa81B58Ba92a82136038B25aDec7066af3155` |
| CCTP MessageTransmitter | `0x0a992d191DEeC32aFe36203Ad87D7d289a738F81` |

### Arbitrum One — chainId `42161` (reference only)

| Contract             | Address                                      |
|----------------------|----------------------------------------------|
| USDC                 | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |
| CCTP TokenMessenger  | `0x19330d10D9Cc8751218eaf51E8885D058642E08A` |
| CCTP MessageTransmitter | `0xC30362313FBBA5cf9163F0bb16a0e01f01A896ca` |

The full machine-readable chain table (CCTP domains, RPC env vars, explorer URLs) lives in [backend/packages/execution/chainConfig.ts](../backend/packages/execution/src/chainConfig.ts).

---

## 2. Contracts

### `TaxeeLotRegistry.sol`

Immutable on-chain registry of tax-lot disposal commitments. Used by both execution paths.

- **`commitDisposal(bytes32 lotId, bytes32 dataHash)`** — anchors `keccak256(abi.encode(ArcRecord))` for a given lot. Reverts if the lot has already been committed (disposals are permanent).
- **`verifyDisposal(bytes32 lotId, bytes32 dataHash) → bool`** — public verification anyone can call.
- **Storage:** `lotHashes`, `lotAgents`, `lotBlocks`, `totalDisposals`.
- **Event:** `LotDisposed(agent, lotId, dataHash, timestamp)`.

### `TaxeeExecutor.sol`

Atomic harvest + USYC-park executor. Called by the Circle Programmable Wallet that owns the user's funds.

- **`parkInUsyc(uint256 usdcAmount, bytes32 lotId, address agent) → shares`** — transfers USDC in, approves USYC, deposits. Atomic: either both succeed or both revert.
- **`redeemFromUsyc(uint256 shares) → usdcAmount`** — reverse when the lot matures or the wash window clears.
- **Authorization:** `onlyAuthorized` modifier — only the Circle PW address set at construction can call park/redeem.
- **Events:** `ParkedInUsyc`, `RedeemedFromUsyc`.

### `DelegationRegistry.sol`

EIP-7702 delegation store. Lets a self-custody user (MetaMask / Rainbow) grant scoped authority to `TaxeeManager`.

- **`createDelegation(...)`** — store EIP-712-signed delegation: delegate, policy hash, expiration, per-tx limit, per-month limit.
- **`revokeDelegation()`** — user revokes anytime.
- **`hasActiveDelegation(user)`** — read view.
- **`getRemainingMonthlyLimit(user)`** — view, 30-day rolling window.
- **`validateAndRecordUsage(...)`** — called by `TaxeeManager` before each execution to record spend.
- **Errors:** `DelegationExpired`, `MonthlyLimitExceeded`, `InvalidSignature`, `PolicyViolation`.

### `TaxeeManager.sol`

Execution authority users delegate to under EIP-7702.

- **`executeHarvest(user, asset, amount, proceeds, lotId)`** — start a harvest.
- **`executeRebuy(...)`** — rebuy after harvest (5-minute cooldown enforced).
- **`executeYieldMove(...)`** — move funds to / from USYC.
- **`confirmExecution(requestId, txHash, actualValue, success)`** — called by the Circle relayer after MPC co-sign.
- **`canExecute(user, action, asset, value) → (bool, reason)`** — pre-flight view used by the frontend.
- **Admin:** `setAuthorizedExecutor`, `setCircleRelayer`, `setAllowedAsset`, `setSlippageTolerance`, `setRebuyCooldown`, `setUsycToken`, `pause` / `unpause`.

### `TaxeeTypes.sol`

Shared structs, enums, and EIP-712 type hashes used by `DelegationRegistry` + `TaxeeManager`.

### Interfaces (`src/interfaces/`)

- **`ICircleCCTP.sol`** — `ITokenMessenger.depositForBurn` + `IMessageTransmitter.receiveMessage`. CCTP v1 addresses are documented inline per chain.
- **`IUsyc.sol`** — `deposit / redeem / previewRedeem / balanceOf`.
- **`IERC20.sol`** — minimal ERC-20 surface used by the executor.

---

## 3. Folder Layout

```
contracts/
├── src/
│   ├── TaxeeLotRegistry.sol      # on-chain commitment of disposal records
│   ├── TaxeeExecutor.sol         # atomic USYC park / redeem
│   ├── DelegationRegistry.sol    # EIP-7702 delegation store
│   ├── TaxeeManager.sol          # EIP-7702 execution authority
│   ├── TaxeeTypes.sol            # shared structs / EIP-712 typehashes
│   └── interfaces/
│       ├── ICircleCCTP.sol
│       ├── IUsyc.sol
│       └── IERC20.sol
│
├── script/
│   └── Deploy.s.sol              # Deploy, DeployArc, DeployEthSepolia
│
├── test/
│   ├── TaxeeLotRegistry.t.sol
│   ├── TaxeeExecutor.t.sol
│   └── TaxeeDelegation.t.sol
│
├── deployments/                  # Per-chain JSON, written by `forge script`
│   ├── arc_testnet.json
│   └── eth_sepolia.json
│
├── eip7702/                      # Hardhat sub-project for EIP-7702 flow
│   └── README.md                 # See contracts/eip7702/README.md
│
├── broadcast/                    # Foundry broadcast artifacts
├── INTERACTIONS.md               # Frontend / backend integration guide
├── QUICKREF.md                   # One-page cheat sheet
├── foundry.toml
├── hardhat.config.cjs            # For verification helpers
└── remappings.txt
```

---

## 4. Deploy

### Prerequisites

```bash
curl -L https://foundry.paradigm.xyz | bash && foundryup
forge install
```

Required env (in `contracts/.env`):

```bash
DEPLOYER_PRIVATE_KEY=0x...
EXECUTOR_ADDRESS=0xc5b7b574EE84A9B59B475FE32Eaf908C246d3859
USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
USYC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e   # = USDC on testnet
AUTHORIZED_CALLER=0x9b24cbf27e522dab9e621efb582ec4e5faa5faaa
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
ETH_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<key>
ARC_RPC_URL=https://rpc.testnet.arc-node.thecanteenapp.com/v1/<key>
BASESCAN_API_KEY=...
```

### Build & test

```bash
forge build
forge test -vvv
forge test --gas-report
forge test --fuzz-runs 10000     # fuzzing
```

### Deploy to Arc Testnet (primary)

```bash
forge script script/Deploy.s.sol:DeployArc \
  --rpc-url arc_testnet \
  --broadcast \
  --private-key $DEPLOYER_PRIVATE_KEY \
  -vvvv
```

Writes [deployments/arc_testnet.json](deployments/arc_testnet.json) — copy the addresses into `backend/.env`.

### Deploy to Ethereum Sepolia

```bash
forge script script/Deploy.s.sol:DeployEthSepolia \
  --rpc-url eth_sepolia \
  --broadcast \
  --private-key $DEPLOYER_PRIVATE_KEY \
  -vvvv
```

### Deploy to Base Sepolia

```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY \
  --private-key $DEPLOYER_PRIVATE_KEY
```

### Verify on Sourcify (Arc) / Basescan (Base)

Arc contracts are verified on Sourcify by hash:
```
https://sourcify.dev/#/lookup/<address>
```

Base contracts are verified during `--broadcast --verify`.

---

## 5. Integration

### Backend (custodial path)

```ts
// backend/packages/execution/src/executeOpportunity.ts
import { TaxeeLotRegistry__factory, TaxeeExecutor__factory } from "@taxee/contracts";

const lotRegistry = TaxeeLotRegistry__factory.connect(
  process.env.TAXEE_LOT_REGISTRY_ADDRESS!,
  signer
);
await lotRegistry.commitDisposal(lotId, dataHash);
```

### Backend (EIP-7702 path)

```ts
// backend/packages/execution/src/eip7702Executor.ts
const manager = TaxeeManager__factory.connect(
  process.env.TAXEE_MANAGER_ADDRESS!,
  signer
);
await manager.executeHarvest(userAddr, assetAddr, amount, proceeds, lotId);
```

### Frontend (wagmi)

Frontend uses [`use-taxee-contracts.ts`](../frontend/components/wallet/use-taxee-contracts.ts) to call `createDelegation` / `revokeDelegation` from the connected wallet. Addresses are read from `frontend/lib/wagmi.ts`.

See [INTERACTIONS.md](INTERACTIONS.md) for the full integration walkthrough.

---

## 6. Security Model

1. **EIP-7702 delegation** — user grants scoped authority via signature, never moves funds.
2. **`DelegationRegistry`** — validates per-tx and per-month limits on-chain, supports revocation.
3. **`TaxeeManager`** — enforces asset whitelist, 1% slippage tolerance, 5-minute rebuy cooldown.
4. **Circle MPC** — when on the custodial path, every broadcast requires user-PIN co-signature.
5. **Pause switch** — `TaxeeManager.pause()` exists for emergency stops.

Properties:

- **Non-custodial** — taxee never holds private keys (custodial flow uses Circle MPC; user controls PIN).
- **Revocable** — `DelegationRegistry.revokeDelegation()` is callable anytime.
- **Time-bounded** — default delegation expiry is 90 days.
- **Scoped** — limited to whitelisted actions and assets.
- **Auditable** — every action emits an indexed event; every disposal commits a hash to `TaxeeLotRegistry`.

---

## 7. Testing

```bash
forge test -vvv                       # unit + integration
forge test --match-test test_Harvest  # filter by name
forge test --gas-report               # gas table
forge test --fuzz-runs 10000          # property-based fuzz
```

Existing test suites:
- [test/TaxeeLotRegistry.t.sol](test/TaxeeLotRegistry.t.sol) — commit/verify, duplicate-commit revert, event emission.
- [test/TaxeeExecutor.t.sol](test/TaxeeExecutor.t.sol) — park/redeem atomicity, authorization, event emission.
- [test/TaxeeDelegation.t.sol](test/TaxeeDelegation.t.sol) — delegation creation, revocation, monthly limits.

---

## 8. References

- [INTERACTIONS.md](INTERACTIONS.md) — full frontend / backend integration walkthrough
- [QUICKREF.md](QUICKREF.md) — one-page cheat sheet
- [eip7702/README.md](eip7702/README.md) — EIP-7702 sub-project
- [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702)
- [Circle CCTP v1 docs](https://developers.circle.com/cctp/v1/evm-smart-contracts)
- [Circle Programmable Wallets](https://developers.circle.com/w3s/)
- [Arc docs](https://arc-node.thecanteenapp.com/)

## License

MIT
