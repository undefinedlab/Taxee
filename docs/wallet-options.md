# Taxee Wallet Options

Taxee supports three different wallet connection methods, each with different trade-offs between convenience and control.

## 1. Self-Custody Wallet (EIP-7702) ⭐ Recommended

**Best for:** Users who want full control of their private keys

### How it works:
- Connect your existing MetaMask, Rainbow, or Coinbase Wallet
- Sign an EIP-7702 delegation message authorizing Taxee within policy limits
- Your private key stays in your wallet - Taxee never has it
- Taxee gets scoped authority to execute transactions on your behalf

### Pros:
- ✅ Full control of private keys
- ✅ Can revoke authorization anytime
- ✅ Works with any existing wallet
- ✅ No need to transfer funds

### Cons:
- ❌ Requires understanding of delegations
- ❌ One-time signature required

### Setup:
1. Select "Connect Wallet" on onboarding
2. Connect your MetaMask (or other wallet)
3. Configure your policy (limits, jurisdiction, etc.)
4. Review and sign EIP-7702 delegation
5. Done! Taxee can now optimize within your limits

---

## 2. Circle MPC Wallet

**Best for:** Users who prefer custodial convenience with security

### How it works:
- Create a new wallet using Circle's MPC (Multi-Party Computation) infrastructure
- Your private key is split across multiple secure enclaves
- Access via PIN or biometric authentication
- Transactions require Circle's nodes to co-sign

### Pros:
- ✅ No seed phrase to manage
- ✅ PIN/biometric protection
- ✅ Institutional-grade security
- ✅ Can recover wallet if device lost

### Cons:
- ❌ Custodial (Circle holds key shares)
- ❌ Need to transfer funds to new wallet
- ❌ **Requires Telegram bot to initiate** (not available in web onboarding)

### Setup (Telegram Only):
1. **Open Telegram** and start @taxee_bot
2. Send `/start` command
3. Bot creates a user account and provides setup link
4. Click link to `/setup-wallet?userId=xxx`
5. Set up Circle wallet with PIN/biometric
6. Transfer funds to your Circle wallet address
7. Taxee manages the wallet via API calls + your PIN

### Why Telegram Required?
Circle wallet setup requires a backend user account with secure session management. This is handled through the Telegram bot flow to ensure:
- Secure user identification
- Proper session initialization
- Integration with Taxee's notification system

### Security Model:
```
Key Share 1 → Circle Node A (encrypted)
Key Share 2 → Circle Node B (encrypted)
Key Share 3 → Circle Node C (encrypted)

Your PIN unlocks the signing process
No single point of compromise
```

---

## 3. Watch-Only Mode

**Best for:** Users who just want to track portfolio without automation

### How it works:
- Paste any Ethereum address (no connection required)
- Taxee scans blockchain for token balances
- View-only access - no transactions possible
- No private keys involved

### Pros:
- ✅ No wallet connection needed
- ✅ Completely safe (read-only)
- ✅ Can track any address
- ✅ Quick setup

### Cons:
- ❌ Taxee cannot execute transactions
- ❌ No automation possible
- ❌ Manual rebalancing only

### Setup:
1. Select "Watch-Only Mode" on onboarding
2. Paste the wallet address (0x...)
3. Taxee scans for balances
4. View portfolio and get recommendations

---

## Comparison Table

| Feature | Self-Custody (EIP-7702) | Circle MPC | Watch-Only |
|---------|------------------------|------------|------------|
| **Control** | You hold keys | Circle holds shares | No keys |
| **Automation** | ✅ Full | ✅ Full | ❌ None |
| **Setup Time** | 2 minutes | 5 minutes | 30 seconds |
| **Entry Point** | Web onboarding | Telegram bot only | Web onboarding |
| **Security** | Your responsibility | Institutional | N/A (read-only) |
| **Recovery** | Seed phrase | Email + ID | N/A |
| **Fund Transfer** | ❌ Not needed | ✅ Required | ❌ Not needed |
| **Revocable** | ✅ Anytime | ✅ Via Circle | N/A |
| **Best For** | DeFi natives | Beginners via Telegram | Trackers |

---

## Which should I choose?

### Choose Self-Custody (EIP-7702) if:
- You already use MetaMask or similar
- You want full control
- You're comfortable signing messages
- You don't want to move funds

### Choose Circle MPC if:
- You're new to crypto
- You prefer PIN/biometric login
- You want institutional security
- You don't mind custodial solution

### Choose Watch-Only if:
- You just want to track a portfolio
- You don't want to connect any wallet
- You prefer manual control
- You're just exploring

---

## Security Notes

### Self-Custody (EIP-7702)
- Delegation is scoped: limits, expiration, allowed actions
- Can revoke via `revokeDelegation()` or signing new message
- Taxee cannot exceed your policy limits
- Your private key never leaves your device

### Circle MPC
- PIN required for every transaction (manual mode)
- Policy guardrails enforced by Circle's servers
- Recovery via Circle's identity verification
- 2-of-3 MPC threshold for signing

### Watch-Only
- No private key exposure whatsoever
- Taxee cannot spend or move funds
- Recommendations only - you execute manually

---

## Technical Details

### EIP-7702 Delegation
```typescript
// User signs this message
{
  delegate: TaxeeManagerAddress,      // What contract can execute
  policyHash: keccak256(policy),      // Which policy applies
  expiration: 90 days,                // When it expires
  maxPerTx: $5,000,                   // Per-transaction limit
  maxPerMonth: $20,000,               // Monthly limit
}
```

### Circle MPC
```typescript
// User creates wallet via SDK
const sdk = new W3SSdk();
sdk.setAppSettings({ appId });
sdk.setAuthentication({ userToken, encryptionKey });

// Each transaction:
// 1. Taxee requests via API
// 2. User approves with PIN in iframe
// 3. Circle nodes co-sign
// 4. Transaction executes
```

### Watch-Only
```typescript
// Just scan blockchain
const positions = await scanWallet(address);
// No signing, no transactions
```

---

## Migration Between Options

### Self-Custody → Circle
1. Create Circle wallet
2. Transfer funds from self-custody wallet
3. New onboarding with Circle option

### Circle → Self-Custody
1. Connect self-custody wallet
2. Withdraw from Circle wallet to your address
3. Sign EIP-7702 delegation

### Either → Watch-Only
1. Simply paste address in watch-only mode
2. No funds need to move
3. Read-only access

---

## Support

**Self-Custody Issues:** Check wallet connection, network (Base Sepolia/Mainnet), delegation status

**Circle Issues:** Contact Circle support or restart setup from Telegram

**Watch-Only Issues:** Verify address format (0x...), check if address has activity
