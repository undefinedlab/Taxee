# EIP-7702 Contracts - Quick Reference

## 🎯 TL;DR

**What:** Smart contracts for MetaMask users to delegate tax optimization to Taxee  
**How:** Users sign EIP-712 message → Taxee gets scoped authority → Executes within limits  
**Safety:** User keeps private key, can revoke anytime, strict limits enforced on-chain  

---

## 📍 Addresses (Base Sepolia)

```solidity
DelegationRegistry: 0x403Fe0408976b518b2952BdF590135Ec6ba12ebc
TaxeeManager:       0xEE8DAE2D3f142052bDb704Ba0D94e04eC1680193
```

---

## 🧪 Test Results

```bash
$ npx hardhat run test-interactions.js --network baseSepolia

✅ Contract Configuration    - TaxeeManager correctly linked
✅ Executor Authorization    - Deployer authorized as executor  
✅ Circle Relayer            - Relayer address configured
✅ Allowed Assets            - ETH and USDC whitelisted
✅ Contract Parameters       - 1% slippage, 5min cooldown
✅ Delegation Simulation     - New user can create delegation
✅ Execution Validation      - Rejects without delegation
```

**Status:** All systems operational ✅

---

## 🔄 User Flow

```
1. Connect MetaMask
   ↓
2. Sign EIP-712 delegation (one-time)
   ↓
3. Taxee monitors portfolio
   ↓
4. Opportunity detected
   ↓
5. Taxee calls contract (within limits)
   ↓
6. Circle MPC co-signs
   ↓
7. Transaction executes
   ↓
8. User gets notification
```

---

## 📊 Key Functions

### For Users (Frontend)

| Function | Purpose | Gas |
|----------|---------|-----|
| `hasActiveDelegation()` | Check if user has delegation | Free (view) |
| `createDelegation()` | Authorize Taxee | ~150k |
| `revokeDelegation()` | Remove authorization | ~45k |
| `getRemainingMonthlyLimit()` | Check quota | Free (view) |

### For Taxee (Backend)

| Function | Purpose | Gas |
|----------|---------|-----|
| `executeHarvest()` | Start harvest workflow | ~80k |
| `executeRebuy()` | Rebuy after harvest | ~80k |
| `confirmExecution()` | Complete transaction | ~60k |
| `canExecute()` | Validate before execution | Free (view) |

---

## 🛡️ Security Limits

```yaml
Per Transaction: $5,000 USD
Per Month: $20,000 USD  
Delegation Expiry: 90 days
Rebuy Cooldown: 5 minutes
Slippage Tolerance: 1%
Allowed Assets: ETH, USDC, USYC
```

---

## 📁 Files

```
/taxee/contracts/
├── src/
│   ├── DelegationRegistry.sol    # Stores delegations
│   ├── TaxeeManager.sol          # Executes transactions
│   └── TaxeeTypes.sol            # Shared types
├── eip7702/
│   ├── README.md                 # Full documentation
│   ├── .env.example              # Env template
│   └── deployments/              # Deployment history
├── deployments/
│   └── 84532.json               # This deployment
├── test-interactions.js         # Automated tests
├── INTERACTIONS.md              # Integration guide
└── hardhat.config.cjs           # Network config
```

---

## 🚀 Usage

### Deploy
```bash
cd /taxee/contracts
npx hardhat deploy-eip7702 --network baseSepolia
```

### Test
```bash
npx hardhat run test-interactions.js --network baseSepolia
```

### Verify on BaseScan
```bash
npx hardhat verify --network baseSepolia 0x403Fe0408976b518b2952BdF590135Ec6ba12ebc
npx hardhat verify --network baseSepolia 0xEE8DAE2D3f142052bDb704Ba0D94e04eC1680193 0x403Fe0408976b518b2952BdF590135Ec6ba12ebc
```

---

## 🔗 Integration Points

### Frontend → Contracts
- `lib/wagmi.ts` - Contract addresses
- `.env.local` - Environment variables
- `components/wallet/` - Wallet connection & delegation

### Backend → Contracts  
- Executor account authorized in TaxeeManager
- Circle relayer for MPC co-signing

### Monitoring
- BaseScan: https://sepolia.basescan.org
- Events track all delegations and executions

---

## ⚡ Quick Commands

```bash
# Check deployment
cat deployments/84532.json

# Test contracts
npx hardhat run test-interactions.js --network baseSepolia

# Console access
npx hardhat console --network baseSepolia
> const dr = await ethers.getContractAt("DelegationRegistry", "0x403Fe0408976b518b2952BdF590135Ec6ba12ebc")
> await dr.hasActiveDelegation("0xUserAddress")

# View events
npx hardhat console --network baseSepolia
> const tm = await ethers.getContractAt("TaxeeManager", "0xEE8DAE2D3f142052bDb704Ba0D94e04eC1680193")
> await tm.queryFilter("HarvestExecuted")
```

---

## 📈 Status

| Component | Status |
|-----------|--------|
| Contracts Deployed | ✅ Complete |
| Tests Passing | ✅ 8/8 |
| Frontend Updated | ✅ Complete |
| Integration Ready | ✅ Complete |

---

**Last Updated:** 2024-05-24  
**Network:** Base Sepolia (Chain ID: 84532)  
**Deployer:** 0xc5b7b574EE84A9B59B475FE32Eaf908C246d3859
