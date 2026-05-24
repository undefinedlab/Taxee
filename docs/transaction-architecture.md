# Taxee Transaction Architecture

## Overview

Taxee uses a layered architecture that combines **user-defined policy**, **EIP-7702 delegation**, and **Circle MPC multi-party computation** to enable autonomous tax optimization while maintaining security and user control.

```
┌─────────────────────────────────────────────────────────────┐
│                      USER (MetaMask)                         │
│  Signs EIP-7702 delegation once → grants scoped authority   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  EIP-7702 DELEGATION                         │
│  Session-scoped authority stored in delegation contract      │
│  Revocable by user at any time                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    TAXEE ENGINE                              │
│  • Detects opportunities via price feeds                     │
│  • Validates against user policy                             │
│  • Generates transaction payloads                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│               CIRCLE WALLETS API                             │
│  • Policy validation at MPC level                           │
│  • Multi-party co-signing (never full key exposure)         │
│  • Transaction execution on-chain                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    ON-CHAIN EVENTS                           │
│  • Arc ledger writes (disposal + acquisition)               │
│  • Lot status updates                                        │
│  • Telegram notifications                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## User Policy

The policy is signed once during onboarding. It defines the scope of autonomous actions Taxee is authorized to perform.

### Authorized Actions

```yaml
taxee_is_authorized_to:
  loss_harvest:
    description: Execute buy/sell transactions to realize losses
    rebuy_window: 1 hour  # No wash sale rule in crypto
  
  yield_optimization:
    description: Move capital to/from USYC (Circle Yield Token)
    
  limits:
    per_transaction: $5,000 USD
    per_month: $20,000 USD
    
  assets:
    allowed: [ETH, USDC, USYC]
    blocked: []  # Explicit exclusions
```

### Restrictions

```yaml
taxee_cannot:
  external_transfers: Send funds to addresses outside Circle Wallet
  exceed_limits: Execute above policy limits without re-authorization
  access_scope: Access or control funds beyond the Circle Wallet
  open_positions: Create new asset positions not in allowed list
```

---

## Transaction Flow Example: Loss Harvest

### Step-by-Step Execution

#### 1. Opportunity Detection

```
Taxee Engine detects:
  • User holds: 0.8 ETH
  • Current price: $2,900/ETH
  • Cost basis: $3,800/ETH (from Lot #3)
  • Unrealized loss: -$720
  
Decision: Execute harvest (within policy limits)
```

#### 2. Transaction Generation

```typescript
// Taxee generates transaction payload
const harvestTx = {
  type: "SELL",
  walletId: "user-circle-wallet-id",
  asset: "ETH",
  amount: "0.8",
  estimatedProceeds: 2320, // USD
  purpose: "TAX_LOSS_HARVEST",
  lotId: "lot-3",
  policyReference: "policy-signature-hash"
};
```

#### 3. Circle Wallets API Call

```
POST /wallets/transactions
Headers:
  Authorization: Bearer <taxee-api-key>
  
Body:
{
  "walletId": "wa-...",
  "tokenId": "ETH-SEPOLIA",
  "destinationAddress": "0x...",
  "amounts": ["0.8"],
  "metadata": {
    "taxee_opportunity_id": "opp-123",
    "taxee_lot_id": "lot-3",
    "estimated_proceeds_usd": 2320
  }
}
```

#### 4. Circle MPC Validation

```
Circle MPC Nodes validate:
  ✓ Within policy limits? Yes ($2,320 < $5,000)
  ✓ Monthly cap not exceeded? Yes
  ✓ Asset allowed? Yes (ETH in whitelist)
  ✓ User delegation valid? Yes (EIP-7702 active)
  
→ Co-sign transaction (2-of-3 MPC threshold)
→ Submit to blockchain
```

#### 5. On-Chain Execution

```
Transaction confirmed:
  Tx Hash: 0xabc123...
  Block: 18,234,567
  Gas: 45,000
  
Event emitted:
  SwapExecuted(
    user: 0xuser...,
    sold: 0.8 ETH,
    received: 2,320 USDC,
    price: 2900
  )
```

#### 6. Tax Calculation

```typescript
// Taxee calculates realized loss
const disposal = {
  lot_id: "lot-3",
  asset: "ETH",
  quantity: 0.8,
  cost_basis: 3040,      // 0.8 × $3,800
  proceeds: 2320,        // 0.8 × $2,900
  realized_loss: -720,   // $2,320 - $3,040
  timestamp: "2025-01-15T14:23:00Z",
  tx_hash: "0xabc123...",
  type: "DISPOSAL"
};
```

#### 7. Immediate Rebuy

```
Taxee immediately calls Circle API:
  "buy 0.8 ETH at market"
  
Rationale: No wash sale rule applies to crypto in most jurisdictions
→ Fresh cost basis established
→ Maintains same position size
```

#### 8. Arc Ledger Writes

```typescript
// Write #1: Disposal
arc.write({
  type: "DISPOSAL",
  lot_id: "lot-3",
  asset: "ETH",
  qty: 0.8,
  basis: 3040,
  proceeds: 2320,
  loss: -720,
  timestamp: "2025-01-15T14:23:00Z",
  tx_hash: "0xabc123..."
});

// Write #2: New Acquisition
arc.write({
  type: "ACQUISITION",
  new_lot_id: "lot-4",
  asset: "ETH",
  qty: 0.8,
  new_basis: 2320,  // 0.8 × $2,900 (new price)
  acquired: "2025-01-15T14:23:15Z",
  tx_hash: "0xdef456..."
});
```

#### 9. Lot Ledger Update

```
Before:
  Lot #3: ETH 0.8, basis $3,800, status: ACTIVE
  
After:
  Lot #3: ETH 0.8, basis $3,800, status: DISPOSED, loss: -$720
  Lot #4: ETH 0.8, basis $2,900, status: ACTIVE, age: 0 days
```

#### 10. User Notification

```
Telegram → @username
━━━━━━━━━━━━━━━━━━━━━━
✅ Harvest Complete

Asset: ETH 0.8
Loss Realized: −$720
New Basis: $2,900

📊 Year-to-Date: −$4,230 in losses

Next opportunity estimated: 3 days
━━━━━━━━━━━━━━━━━━━━━━
```

---

## EIP-7702 Delegation Contract

### Architecture

EIP-7702 enables an EOA (user wallet) to delegate transaction execution to a smart contract while retaining full control.

```solidity
// User's EOA delegates to TaxeeManager contract
// This is done via a single signature, not a transaction

struct Delegation {
    address delegate;        // TaxeeManager contract address
    bytes32 authority;       // Policy hash + limits
    uint256 expiration;      // Delegation expiry
    bytes signature;         // User's EIP-712 signature
}
```

### Authorization Flow

```
1. Onboarding
   ↓
   User signs EIP-712 message:
   "Delegate execution to TaxeeManager
    under policy hash: 0x...
    with limits: $5K/tx, $20K/month
    expires: 90 days"
   ↓
   Signature stored on-chain in DelegationRegistry

2. Execution
   ↓
   Taxee calls TaxeeManager.execute(payload)
   ↓
   TaxeeManager verifies:
     - Delegation exists and not expired
     - Policy limits not exceeded
     - Action type authorized
   ↓
   TaxeeManager calls Circle Wallets API
   ↓
   Circle MPC co-signs and executes

3. Revocation
   ↓
   User signs new EIP-712 message:
   "Revoke all delegations"
   ↓
   Or clears delegation via MetaMask
```

### Security Properties

| Property | Implementation |
|----------|---------------|
| **Scoped Authority** | Delegation includes policy hash; contract enforces limits |
| **Time-Bound** | Expiration enforced (e.g., 90 days) |
| **Revocable** | User can revoke instantly via signature or UI |
| **Non-Custodial** | Taxee never holds private keys; only delegated authority |
| **MPC-Backed** | Circle MPC provides final policy enforcement layer |

---

## Policy Enforcement Layers

### Layer 1: EIP-7702 Delegation Contract
- Validates delegation is active and not expired
- Enforces per-transaction limits
- Tracks monthly rolling limits
- Only allows whitelisted action types

### Layer 2: Taxee Backend
- Validates opportunities against user policy
- Generates compliant transaction payloads
- Maintains audit log of all decisions

### Layer 3: Circle MPC
- Final policy validation before signing
- Multi-party consent (2-of-3 nodes)
- No single point of compromise
- Immutable transaction history

### Layer 4: On-Chain Events
- All actions recorded in Arc ledger
- Transparent audit trail
- Tax reporting ready

---

## Data Flow Diagram

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   MetaMask   │────▶│   Taxee UI   │────▶│  Onboarding  │
│   (User)     │     │   (Next.js)  │     │   (Policy)   │
└──────────────┘     └──────────────┘     └──────┬───────┘
      │                                          │
      │ Sign EIP-7702                             │ Store policy
      │ delegation                                │
      ▼                                          ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Delegation  │◀────│    Arc       │◀────│   Policy     │
│  Registry    │     │   (Ledger)   │     │   Database   │
└──────┬───────┘     └──────────────┘     └──────────────┘
       │
       │ Query delegation
       ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Taxee      │────▶│   Circle     │────▶│  Blockchain  │
│   Engine     │     │   Wallets    │     │  (Base L2)   │
│   (Node.js)  │     │   API/MPC    │     │              │
└──────────────┘     └──────────────┘     └──────┬───────┘
       │                                          │
       │ Write events                             │ Confirm tx
       ▼                                          ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    Arc       │     │   Telegram   │◀────│   User       │
│   Ledger     │────▶│    Bot       │     │  (Notified)  │
│  (Tax Lots)  │     │              │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
```

---

## Error Handling & Edge Cases

### Policy Violation
```
Scenario: Transaction exceeds $5,000 limit
Response: 
  1. Taxee Engine rejects before API call
  2. Log event: "Policy violation prevented"
  3. Telegram: "Action blocked - exceeds limit"
  4. User prompted to approve one-time exception
```

### Delegation Expired
```
Scenario: 90-day delegation expires mid-execution
Response:
  1. TaxeeManager rejects with "DelegationExpired"
  2. User receives "Re-authorization required" notification
  3. One-click renewal in Taxee UI
```

### Circle MPC Timeout
```
Scenario: MPC nodes fail to reach consensus
Response:
  1. Retry with exponential backoff (3 attempts)
  2. If persistent failure: Alert Taxee ops team
  3. User notified of delay
  4. Manual intervention if needed
```

### Price Slippage
```
Scenario: ETH price moves >2% during execution
Response:
  1. Taxee includes slippage tolerance in payload (1%)
  2. If exceeded: Transaction reverts
  3. Opportunity re-evaluated with new price
  4. User notified of skipped opportunity
```

---

## Compliance Considerations

### Tax Reporting
- All disposals and acquisitions recorded with timestamps
- Cost basis tracking per lot (not average cost)
- Realized gains/losses calculated at transaction time
- Exportable reports (CSV, PDF) for tax filing

### Audit Trail
- Immutable ledger in Arc
- All policy decisions logged
- Delegation signatures stored on-chain
- Circle MPC provides third-party validation

### Regulatory
- No wash sale rule enforcement (crypto-specific)
- Jurisdiction-specific reporting (US, UK, EU)
- User controls all limits and permissions
- Revocable authority at any time

---

## Implementation Checklist

- [x] Circle MPC documentation
- [ ] EIP-7702 DelegationRegistry contract
- [ ] TaxeeManager contract with policy enforcement
- [ ] Circle Wallets API integration layer
- [ ] Arc ledger integration (disposal/acquisition writes)
- [ ] Telegram notification service
- [ ] Policy validation middleware
- [ ] Transaction simulation before execution
- [ ] Error handling and retry logic
- [ ] Audit logging and reporting
- [ ] Delegation renewal UI flow
- [ ] Emergency revocation mechanism

---

## References

- [EIP-7702: Set EOA account code](https://eips.ethereum.org/EIPS/eip-7702)
- [Circle Wallets API Documentation](https://developers.circle.com/wallets/)
- [Circle MPC Key Management](./circle-mpc-key-management.md)
- [Base L2 Documentation](https://docs.base.org/)
