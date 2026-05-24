# Circle MPC Key Management & Transaction Flows

**Document Version:** 1.0  
**Last Updated:** 2026-05-24  
**Applies to:** taxee web app, Telegram bot, and API

---

## 1. Overview

This document describes how taxee manages cryptographic keys and executes transactions using **Circle's Multi-Party Computation (MPC) programmable wallets**. This architecture ensures maximum security while enabling automated tax-optimized portfolio management.

### Key Principles

| Principle | Implementation |
|-----------|----------------|
| **No single point of failure** | Private key split across multiple MPC nodes |
| **User control** | User sets policy limits; taxee cannot exceed them |
| **Transparency** | Every action logged to Arc ledger for audit |
| **Gradual trust** | Watch tier → Manual execution → Delegated execution |

---

## 2. What is MPC (Multi-Party Computation)?

### Traditional Key Management
```
Traditional Wallet:
  Private Key → Full control
  If stolen → Funds drained
  If lost → Funds lost forever
```

### MPC Key Management
```
MPC Wallet (Circle):
  Key Share 1 → Node A (Circle infrastructure)
  Key Share 2 → Node B (Circle infrastructure)
  Key Share 3 → Node C (Circle infrastructure)
  
  Transaction requires 2-of-3 shares to sign
  No single node knows the full key
  No single breach compromises funds
```

### Security Properties

| Property | Traditional | MPC |
|----------|-------------|-----|
| Key storage | Single location | Distributed across nodes |
| Breach impact | Complete loss | No impact (only 1 share) |
| Insider risk | High | None (no single party has key) |
| User experience | Manage seed phrase | PIN/biometric only |

---

## 3. Onboarding Key Flow

### Phase 1: Wallet Connection (Watch Tier)
```
User Action                    System Response
─────────────────────────────────────────────────────
Paste wallet address           →  Validate format (0x...)
                               →  Create Agent record
                               →  Provision Circle Wallet
                               →  Store walletId (NOT key)
```

**Key Points:**
- User never enters a seed phrase
- User never downloads a private key
- taxee stores only the `circleWalletId` (public identifier)
- Wallet starts empty; user funds it separately

### Phase 2: Authorization Policy
```
User Action                    System Response
─────────────────────────────────────────────────────
Sign authorization policy      →  Policy stored on Circle
(via secure iframe)               
                               Policy includes:
                               • Max $ per transaction
                               • Allowed contract addresses
                               • Daily/hourly rate limits
                               • Required confirmations
```

**Example Policy:**
```json
{
  "authorizedOperations": ["harvest", "rebalance", "park"],
  "maxAmountPerTransaction": "10000.00",
  "maxAmountPerDay": "50000.00",
  "cooldownHours": 24,
  "allowedContracts": [
    "0x...USYC",
    "0x...TaxeeLotRegistry",
    "0x...TaxeeExecutor"
  ],
  "requirePin": true
}
```

### Phase 3: Funding the Wallet
```
User transfers assets            Circle Wallet receives
to Circle Wallet address         →  Assets visible in taxee
                                 →  Agent can now propose actions
```

---

## 4. Transaction Execution Flows

### 4.1 Manual Approval Mode (Default)

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Opportunity Detection                                   │
└─────────────────────────────────────────────────────────────────┘
     ↓
Heartbeat scans portfolio
     ↓
Tax Engine flags: "wETH down 14%, harvest opportunity"
     ↓
LLM Action Reasoner evaluates → RECOMMEND: EXECUTE
     ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: User Notification                                       │
└─────────────────────────────────────────────────────────────────┘
     ↓
Telegram / Web notification:
     
     🌾 Harvest Opportunity — wETH
     Unrealized loss: $600
     Est. tax savings: $180
     
     [✅ Approve] [⏰ Defer] [❌ Skip]
     
     ℹ️ This will sell wETH and buy stETH to maintain exposure
     ↓
User taps [✅ Approve]
     ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: Challenge Generation (Security Layer)                   │
└─────────────────────────────────────────────────────────────────┘
     ↓
POST /api/circle/challenge/:opportunityId
     ↓
Circle validates:
     ✓ Is opportunityId valid?
     ✓ Does user have sufficient balance?
     ✓ Is amount within policy limits?
     ✓ Has cooldown period passed?
     ↓
Challenge created:
     {
       "challengeId": "ch_abc123",
       "expiresAt": "2026-05-24T12:00:00Z",
       "requiresPin": true
     }
     ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: Secure Confirmation                                     │
└─────────────────────────────────────────────────────────────────┘
     ↓
User receives:
     "🔐 Confirm your tax action"
     
     Action: Harvest wETH ($600)
     Tax savings: $180
     
     [✅ Confirm & Execute]
     ↓
User taps button → Opens secure page:
     /execute?challengeId=ch_abc123&token=xyz789
     ↓
Circle SDK iframe loads:
     • Domain-verified (circle.com)
     • PIN entry field
     • Biometric option (if enabled)
     ↓
User enters PIN
     ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 5: MPC Signing Ceremony                                    │
└─────────────────────────────────────────────────────────────────┘
     ↓
Circle's MPC nodes perform:
     
     Node A: Has Share 1
     Node B: Has Share 2  ──┐
     Node C: Has Share 3  ──┘
                            ↓
                    Joint computation
                    (no share revealed)
                            ↓
                    Valid signature produced
     ↓
Transaction submitted to blockchain
     ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 6: Post-Execution                                          │
└─────────────────────────────────────────────────────────────────┘
     ↓
TaxeeLotRegistry.commitDisposal()
     • Records lot disposal on-chain
     • Immutable audit trail
     ↓
TaxeeExecutor.parkInUsyc()
     • Converts proceeds to USYC
     • Earns yield while waiting
     ↓
Arc ledger write
     • Form 8949 pre-filled record
     • Cost basis, proceeds, gain/loss
     ↓
User notification:
     "✅ Executed successfully
      Tx: 0xabc... (view on BaseScan)
      Park: 0xdef... (USYC deposit)
      Arc record: arc_xyz..."
```

### 4.2 Delegated Approval Mode

```
┌─────────────────────────────────────────────────────────────────┐
│  AUTONOMOUS EXECUTION (Within Policy Guardrails)                 │
└─────────────────────────────────────────────────────────────────┘

Heartbeat detects opportunity
     ↓
LLM Action Reasoner: EXECUTE
     ↓
Policy Guardrails (code-enforced):
     ✓ Is action in allowedActions[]?
     ✓ Is amount < maxAmountPerTransaction?
     ✓ Is daily total < maxAmountPerDay?
     ✓ Has cooldownHours passed?
     ✓ Is contract in allowedContracts[]?
     ✓ Is lot NOT within maturation buffer?
     ↓
All checks pass?
     YES → Execute via Circle API (pre-authorized)
           (No PIN required — policy pre-approved)
           
     NO  → Defer or notify user
     ↓
Post-execution notification:
     "🤖 Executed autonomously
      Parked wETH in USYC
      Est. tax savings: $180
      
      [View Details] [Switch to Manual Mode]"
```

### 4.3 Execution States

```
                    ┌─────────────┐
                    │  DETECTED   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ↓            ↓            ↓
         ┌────────┐   ┌────────┐   ┌────────┐
         │ MANUAL │   │DELEGATED│  │ DEFER  │
         └───┬────┘   └────┬───┘   └───┬────┘
             │             │           │
             ↓             ↓           ↓
     ┌──────────────┐ ┌──────────┐ ┌──────────┐
     │User approves │ │Auto-exec │ │Schedule  │
     └──────┬───────┘ └────┬─────┘ │re-check  │
            │              │       └──────────┘
            ↓              ↓
     ┌──────────────┐ ┌──────────┐
     │ MPC signing  │ │MPC sign  │
     └──────┬───────┘ └────┬─────┘
            │              │
            └──────┬───────┘
                   ↓
            ┌────────────┐
            │  EXECUTED  │
            └─────┬──────┘
                  ↓
         ┌────────────────┐
         │ Arc ledger     │
         │ Notification   │
         └────────────────┘
```

---

## 5. Security FAQ

### Q: Does taxee store my private key?
**A:** No. The private key never exists as a single object. It's split across Circle's MPC infrastructure. taxee only stores a public `walletId`.

### Q: Can taxee steal my funds?
**A:** No. The authorization policy you sign enforces strict limits. taxee can only execute transactions that:
- Are within your spending limits
- Target whitelisted contracts only
- Respect cooldown periods

### Q: What if taxee's servers are hacked?
**A:** An attacker could propose transactions, but they cannot sign them. Your PIN/biometric is required for every execution in manual mode. In delegated mode, policy guardrails are enforced by Circle's servers, not taxee's.

### Q: What if Circle is compromised?
**A:** MPC requires multiple nodes to sign. A single breach (or even two breaches) cannot produce a valid signature. Circle's infrastructure is designed so that no single party ever has the complete key.

### Q: Can I revoke taxee's access?
**A:** Yes, at any time:
1. Log into Circle's web interface
2. Revoke the authorization policy
3. Or transfer funds to a different wallet

### Q: What happens if I forget my PIN?
**A:** Circle provides a recovery flow (typically email + identity verification). Your funds are never lost because Circle maintains the MPC shares.

### Q: Is this non-custodial?
**A:** It's a hybrid model:
- **Non-custodial**: taxee never holds your keys
- **Managed**: Circle holds MPC shares under your policy
- **User-controlled**: You set limits and can revoke anytime

---

## 6. API Endpoints

### Create Execution Challenge
```http
POST /api/circle/challenge/:opportunityId
Authorization: Bearer <userToken>

Response:
{
  "challengeId": "ch_abc123",
  "status": "pending",
  "expiresAt": "2026-05-24T12:00:00Z",
  "requiresPin": true,
  "action": {
    "type": "HARVEST",
    "asset": "wETH",
    "amount": "0.5",
    "estimatedTaxSaving": 180.00
  }
}
```

### Execute with Challenge
```http
POST /api/circle/execute
Authorization: Bearer <userToken>
Content-Type: application/json

{
  "challengeId": "ch_abc123",
  "pin": "123456"  // Or biometric token
}

Response:
{
  "status": "success",
  "txHash": "0xabc...",
  "parkTxHash": "0xdef...",
  "arcRecordId": "arc_xyz...",
  "executedAt": "2026-05-24T10:30:00Z"
}
```

### Get Wallet Status
```http
GET /api/circle/wallet/:walletId
Authorization: Bearer <userToken>

Response:
{
  "walletId": "w_123",
  "status": "active",
  "policy": {
    "maxAmountPerTransaction": "10000.00",
    "dailyLimitRemaining": "8500.00"
  },
  "balances": [
    { "asset": "USDC", "amount": "5000.00" },
    { "asset": "wETH", "amount": "2.5" }
  ]
}
```

---

## 7. Error Handling

| Error Code | Scenario | User Message |
|------------|----------|--------------|
| `POLICY_LIMIT_EXCEEDED` | Tx amount > maxAmountPerTransaction | "This action exceeds your policy limit. Update your policy or split into smaller transactions." |
| `COOLDOWN_ACTIVE` | Last action < cooldownHours ago | "Policy requires 24h between actions. Next available: [time]" |
| `INSUFFICIENT_BALANCE` | Wallet balance < required amount | "Insufficient balance. Current: $X, Required: $Y" |
| `INVALID_CONTRACT` | Target not in allowedContracts | "This contract is not in your approved list. Update policy to add it." |
| `CHALLENGE_EXPIRED` | Challenge not executed within timeout | "Confirmation expired. Please approve the opportunity again." |
| `PIN_INVALID` | Wrong PIN entered | "Invalid PIN. Please try again." |
| `MPC_SIGNING_FAILED` | Circle MPC nodes unavailable | "Signing service temporarily unavailable. Please try again in a few minutes." |

---

## 8. Migration Paths

### Watch → Manual → Delegated

```
New User
    ↓
[Watch Tier]
  • View opportunities only
  • Execute manually in your own wallet
  • No Circle wallet needed
    ↓
[Connect Circle Wallet]
  • Create MPC wallet
  • Set authorization policy
  • Fund the wallet
    ↓
[Manual Mode]
  • taxee proposes actions
  • You approve each one with PIN
  • Full control, minimal friction
    ↓
[Delegated Mode]
  • Pre-approved policy guardrails
  • Automatic execution within limits
  • Notifications only
```

---

## 9. Compliance & Audit

Every executed transaction produces:

1. **On-chain record** (`TaxeeLotRegistry.commitDisposal()`)
   - Lot ID, cost basis, proceeds
   - Immutable and verifiable

2. **Arc ledger record** (Form 8949 pre-fill)
   - Date acquired, date sold
   - Gain/loss calculation
   - Term (short/long)

3. **LLM reasoning log**
   - Why this action was recommended
   - Alternatives considered
   - Confidence score

4. **Circle audit trail**
   - Challenge ID
   - Policy version used
   - Timestamp and signatures

---

## 10. Glossary

| Term | Definition |
|------|------------|
| **MPC** | Multi-Party Computation — cryptographic technique where multiple parties jointly compute a function without revealing their inputs |
| **Key Share** | A fragment of a private key; multiple shares required to reconstruct signature |
| **Authorization Policy** | User-signed constraints on what taxee can execute (limits, allowed contracts, cooldowns) |
| **Challenge** | A time-bound token representing a proposed transaction; requires user confirmation |
| **Watch Tier** | Read-only mode; taxee scans and notifies but cannot execute |
| **Manual Mode** | User approves each transaction with PIN/biometric |
| **Delegated Mode** | Pre-approved transactions execute automatically within policy limits |
| **Arc Ledger** | Compliance layer for Form 8949 generation and audit trails |
| **Circle Wallets** | MPC-based programmable wallet infrastructure |

---

## 11. Related Documents

- `architecture.md` — High-level system architecture
- `README.md` — API reference and data models
- `status.md` — Current implementation status

---

*For questions or security concerns, contact: security@taxee.xyz*
