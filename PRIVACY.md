# 🔐 Privacy & Trust Model

## TL;DR

**What the verifier service sees:** Your RTT measurements (necessary to create challenges and Merkle commitments)  
**What the blockchain sees:** Only a Merkle root hash and your ZK proof  
**What YOU prove:** You met the threshold without revealing which 28 samples or their exact values  

This is fundamentally better than traditional systems because proofs are **verifiable on-chain** and can't be faked, and the system can be **decentralized** to minimize trust.

---

## 🤔 Why Traditional Performance Testing Fails Privacy

### Ookla Speedtest, Fast.com, Google Speed Test

These services have **fundamental privacy and trust issues**:

```
┌──────────────────────────────────────────────┐
│  YOUR DEVICE                                 │
│  Measures: [12ms, 45ms, 89ms, 120ms, ...]  │
└───────────────┬──────────────────────────────┘
                │
                │ ❌ SENDS ALL RAW DATA
                ▼
       ┌─────────────────────┐
       │  THEIR SERVER       │
       │  (Closed Source)    │
       │                     │
       │  They see & store:  │
       │  • All RTT values   │
       │  • Your IP address  │
       │  • Exact timestamps │
       │  • Location data    │
       │  • ISP details      │
       │  • Usage patterns   │
       └─────────────────────┘
                │
                ▼
       ┌─────────────────────┐
       │   THEIR DATABASE    │
       │   (You can't audit) │
       └─────────────────────┘
```

### Problems with Traditional Systems:

1. **Unverifiable Claims**
   - "We don't log data" - **You can't verify this**
   - Backend is closed-source
   - Database schemas are hidden
   - No cryptographic proof of honesty

2. **Data Value & Incentives**
   - Performance data reveals location, ISP, usage times
   - Valuable for advertising networks
   - Can be sold to third parties
   - Future policy changes can affect past data

3. **Arbitrary Results**
   - Server can fabricate performance badges
   - No cryptographic proof tests actually ran
   - Results can be manipulated for competitive advantage

4. **Database Leakage**
   - Error logging tools (Sentry, etc.) capture data
   - Analytics platforms track everything
   - Third-party dependencies exfiltrate info
   - Backups expose historical data forever

5. **Audit Impossibility**
   - Can't inspect server code
   - Can't verify database doesn't exist
   - Can't prove data isn't shared
   - Must trust corporate policy

---

## ✅ How zk-SLA Improves This

### Our Architecture

```
┌────────────────────────────────────────────────────┐
│  YOUR BROWSER                                      │
│  1. Receives challenges from verifier              │
│  2. Measures RTTs: [12ms, 45ms, ...]              │
│  3. Sends RTTs back (verifier creates Merkle tree)│
│  4. Generates ZK proof IN BROWSER                  │
│  5. Submits only proof to blockchain               │
└────────────────────────────────────────────────────┘
           │                            │
           │ RTT Data                   │ ZK Proof Only
           ▼                            ▼
   ┌──────────────┐            ┌──────────────────┐
   │ VERIFIER     │            │   BLOCKCHAIN     │
   │ (Your Server)│────────────│  (Public)        │
   │              │ Merkle Root│                  │
   │ Sees:        │            │ Sees:            │
   │ • Your RTTs  │            │ • Merkle root    │
   │ • Challenges │            │ • ZK proof       │
   │              │            │ • Your address   │
   │ Doesn't Post │            │ • Threshold (75) │
   │ to Chain     │            │                  │
   └──────────────┘            │ Verifies proof   │
                               │ Mints badge ✓    │
                               └──────────────────┘
```

### What Makes This Better:

#### 1. **Verifiable On-Chain Proofs**
- **Traditional**: Server says "you passed" - no proof
- **zk-SLA**: Cryptographic proof verified on-chain - can't be faked

```solidity
// Smart contract code is PUBLIC and AUDITABLE
function verifyAndMint(proof, publicInputs) {
    require(verifier.verifyProof(proof, publicInputs)); // Math, not trust
    _mint(msg.sender, badgeId);
}
```

#### 2. **You Can Run Your Own Verifier**
- The verifier service is **open source**
- You can run it yourself
- Or use multiple independent verifiers
- Future: k-of-N verifier consensus (no single point of trust)

#### 3. **No Long-Term Storage**
- RTT data only stored in Redis with **short TTL** (2 minutes)
- After Merkle root is posted, data is discarded
- No permanent database of your measurements
- Traditional systems: data stored forever

#### 4. **Minimal Data Exposure**
- **Verifier sees**: RTTs during test (ephemeral)
- **Blockchain sees**: Only commitment (Merkle root) + proof
- **Public sees**: Only that you earned a badge
- Traditional systems: Everything goes to central DB

#### 5. **Cryptographic Guarantees**
- Proof generation happens **in your browser** (JavaScript you can inspect)
- Mathematical impossibility to extract RTT values from proof
- Zero-knowledge property: proof reveals nothing beyond "threshold met"

#### 6. **Decentralization Path**
- Current: 1 verifier (MVP)
- Easy upgrade: Multiple independent verifiers
- Future: Consensus among N verifiers
- Traditional: Always single centralized party

---

## 🔍 What You Can Verify

### 1. Inspect the Code
```bash
# Clone the repo
git clone https://github.com/your-org/zk-sla
cd app

# Check what gets sent to blockchain
grep -r "writeContract" --include="*.tsx"
# You'll see ONLY proof + public inputs, NO raw RTTs

# Check verifier service
cd ../verifier/src
cat server.ts
# See: RTTs measured, Merkle root created, but NOT posted to permanent DB
```

### 2. Monitor Network Traffic
Open browser DevTools → Network tab during test:

**You'll see:**
- ✅ `POST /api/rtt-test` - RTT measurements (goes to YOUR verifier)
- ✅ `writeContract()` - Only proof goes to blockchain
- ❌ NO raw RTTs sent to blockchain
- ❌ NO permanent database calls

### 3. Inspect Smart Contract
Visit Basescan: https://sepolia.basescan.org/address/0xAAbF735Ea2cE761BD7dd664D0B9274228bfbC9Bd

```solidity
// The contract CANNOT accept raw RTTs - only proofs
function verifyAndMint(
    uint256 epoch,
    uint32 T,           // threshold
    uint16 m,           // 28
    uint16 n,           // 32
    bytes32 root,       // Merkle commitment
    bytes calldata proof,        // ZK proof
    uint256[] calldata publicInputs  // NO raw RTTs here!
) external
```

The contract **physically cannot** receive your raw RTT data. Only proof.

### 4. Read the Merkle Root
```bash
# Check what's stored on-chain
cast call 0x979F3A1e36CAFe70F930A606f116FF5CaC42451b \
  "rootOf(uint256)(bytes32)" \
  5863987 \
  --rpc-url https://sepolia.base.org

# Returns: bytes32 hash (commitment)
# NOT individual RTT values
```

---

## 🆚 Comparison Table

| Feature | Ookla/Traditional | zk-SLA (This Project) |
|---------|-------------------|----------------------|
| **Raw data sent to server** | ✅ Yes, always | ✅ Yes (verifier service) |
| **Raw data on blockchain** | N/A | ❌ No |
| **Long-term storage** | ✅ Yes, forever | ❌ No (2-min TTL) |
| **Verifiable proofs** | ❌ No | ✅ Yes (on-chain) |
| **You can audit code** | ❌ No | ✅ Yes (open source) |
| **Can run own verifier** | ❌ No | ✅ Yes |
| **Result fakeable** | ✅ Yes | ❌ No (cryptographic) |
| **Decentralization possible** | ❌ No | ✅ Yes (multi-verifier) |
| **Privacy from public** | ❌ No | ✅ Yes (only commitment) |
| **Data monetization risk** | ✅ High | ⚠️ Low (ephemeral, self-hostable) |

---

## 🎯 Honest Trust Model

### What You Must Trust:

1. **Verifier Service (During Test)**
   - Provides authentic challenges
   - Measures RTTs fairly
   - Doesn't collude to fake results
   
   **Mitigations:**
   - Open source (inspect code)
   - Run your own instance
   - Short-lived data (auto-deletes)
   - Future: multi-verifier consensus

2. **Your Browser**
   - Executes JavaScript correctly
   - Doesn't leak data to other tabs/extensions
   
   **Mitigations:**
   - Use reputable browser (Chrome, Firefox, Safari)
   - Inspect network tab during test
   - Browser JS is sandboxed

3. **Blockchain Security**
   - Base Sepolia remains secure
   - Validators don't collude
   
   **Mitigations:**
   - Use established L2s
   - Multi-validator proof-of-stake

### What You Don't Need to Trust:

1. ❌ **That verifier deletes data** - You can verify with code inspection
2. ❌ **That blockchain doesn't see RTTs** - Smart contract code proves it
3. ❌ **That proofs are valid** - Math guarantees this
4. ❌ **That results are real** - Cryptographic commitment enforces honesty

---

## 🚀 Why This Matters

### For Users:
- **Verifiable performance claims** (can't be faked)
- **Reduced data exposure** (no permanent records)
- **Self-sovereignty option** (run your own verifier)

### For DePIN Networks:
- **Cryptographic SLA compliance** (instead of trust-based)
- **Decentralized verification** (multi-verifier consensus)
- **Portable proofs** (prove once, use anywhere)

### Compared to Ookla:
- **Ookla**: Centralized server sees all, stores all, controls all
- **zk-SLA**: Decentralizable, ephemeral, verifiable, self-hostable

---

## 📖 Technical Details

### Privacy Properties

**Zero-Knowledge Proof Guarantees:**
- ✅ **Completeness**: Valid proofs always verify
- ✅ **Soundness**: Invalid proofs never verify (computational security)
- ✅ **Zero-Knowledge**: Proof reveals ONLY "threshold met", nothing about:
  - Which 28 samples were selected
  - Exact RTT values of those samples
  - Order of samples
  - Timing information

**What's Public:**
- Your wallet address (required for badge minting)
- Threshold you proved (e.g., "≤150ms")
- Epoch ID (batch identifier)
- Transaction hash

**What's Private from Public:**
- ❌ Individual RTT measurements
- ❌ Which samples passed/failed
- ❌ Exact latency distribution
- ❌ Sample selection strategy

**What Verifier Service Sees (Temporarily):**
- ✅ Your RTT measurements (necessary to create Merkle tree)
- ✅ Challenge timing
- ✅ Session ID

**What Verifier Service Posts On-Chain:**
- Only the Merkle root (hash commitment)
- NOT individual measurements

---

## 🔬 Future Enhancements

### Multi-Verifier Consensus
Instead of trusting one verifier, require k-of-N agreement:

```
User runs test with 3 independent verifiers
  → Verifier A: root_A
  → Verifier B: root_B  
  → Verifier C: root_C

Require 2-of-3 matching roots to accept proof
```

This removes single-point trust.

### Client-Side Challenge Generation
Generate challenges in-browser using VRF:

```
Blockchain posts VRF seed → Browser generates challenges
```

Eliminates verifier control of challenges (but adds gaming vectors).

---

## ✅ Bottom Line

**Is this perfectly private?** No - the verifier service sees your RTTs.

**Is this better than Ookla/traditional?**

### YES, because:

1. **Verifiable**: Proofs are cryptographically verified on-chain (can't be faked)
2. **Auditable**: All code is open source (can inspect)
3. **Ephemeral**: Data auto-deletes after 2 minutes (no permanent database)
4. **Self-hostable**: Run your own verifier instance
5. **Decentralizable**: Easy path to multi-verifier consensus
6. **On-chain**: Public can verify badge authenticity without seeing your data
7. **ZK-proof**: Mathematical guarantee that individual samples stay private from blockchain

**Traditional systems:** 
- ❌ Send data to permanent databases
- ❌ Closed source (can't audit)
- ❌ No cryptographic proofs
- ❌ Must trust corporate promises
- ❌ No decentralization path
- ❌ Results can be faked

**zk-SLA:**
- ✅ Ephemeral verifier data
- ✅ Open source (auditable)
- ✅ Cryptographic proofs
- ✅ Math over trust
- ✅ Decentralization roadmap
- ✅ Unfakeable results

---

## 🎯 For The Paranoid

Want maximum privacy? 

**Run your own verifier instance:**

```bash
cd verifier
npm install
# Set your own private key
VERIFIER_PRIVKEY=0xYOUR_KEY npm start
```

Now YOU control the challenge service. The verifier code is fully open-source and inspectable.

**Use Tor/VPN:**
- Hide your IP from the verifier
- Privacy from verifier + privacy from blockchain = full privacy

**Multi-verifier (coming soon):**
- Run test against 3+ independent verifiers
- Require consensus on Merkle root
- No single party sees all your data

---

## 📊 Data Flow Summary

| Data Type | Verifier Sees | Blockchain Sees | Public Sees |
|-----------|---------------|-----------------|-------------|
| Individual RTTs | ✅ Temporary (2 min) | ❌ Never | ❌ Never |
| Merkle Root | ✅ Creates it | ✅ Stored on-chain | ✅ Public hash |
| ZK Proof | ❌ No | ✅ Verified on-chain | ✅ Public proof |
| Your Address | ❌ No (optional anonymity) | ✅ Badge recipient | ✅ Public |
| Threshold Claimed | ❌ No | ✅ Part of proof | ✅ Public (e.g., "≤150ms") |
| Which samples selected | ❌ No | ❌ No | ❌ No |
| Exact RTT values | ✅ During test only | ❌ Never | ❌ Never |

---

## 🛡️ Why This Architecture?

### Q: Why not do everything client-side?

**A:** Challenge-response needs a trusted time source:
- Client could pre-compute answers
- Client could fake network delays
- Need unpredictable nonces with tight deadlines

### Q: Why trust the verifier at all?

**A:** You don't have to:
- Code is open source (audit it)
- Run your own verifier
- Use multi-verifier consensus (roadmap)
- Data is ephemeral (deleted after 2 min)

### Q: What if verifier lies about my RTTs?

**A:** Two scenarios:
1. **Verifier inflates your RTTs**: You can't prove better performance (annoying, but not data leak)
2. **Verifier helps you fake good RTTs**: Proof still needs to match the on-chain Merkle root they posted, so they'd be caught lying

The verifier commits to a Merkle root on-chain. Your proof must match that commitment. If they lie, the proof won't verify.

---

## 🎓 Educational Value

This project demonstrates:

1. **Hybrid trust models** - Some trust in verifier, zero trust in proof verification
2. **Cryptographic commitments** - Merkle roots prevent post-hoc data changes
3. **ZK-SNARK applications** - Prove compliance without revealing data
4. **Decentralization paths** - How to minimize trust over time

---

## 📞 Questions?

**Q: Is this production-ready for financial applications?**  
A: MVP stage. For production:
- Add multi-verifier consensus
- Professional audit of circuits & contracts
- Formal verification of ZK circuits
- Secure key management for verifier

**Q: Can I use this for my DePIN project?**  
A: Yes! Fork it and customize:
- Change circuits for bandwidth/jitter/packet loss
- Add staking/slashing for verifier honesty
- Implement verifier rotation
- Add economic incentives

**Q: How is this different from other ZK projects?**  
A: Most ZK projects focus on privacy from everyone. We focus on **verifiable claims** with **minimal trust**. The verifier sees data, but:
- Data is ephemeral
- Verifier can be you
- Proofs are unfakeable
- System is decentralizable

---

**Built for the future of verifiable, trust-minimized DePIN infrastructure.** 🚀
