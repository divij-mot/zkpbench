# zk-SLA: Zero-Knowledge Network Performance Badges

A decentralized application that uses **zero-knowledge proofs** to verify network performance without revealing raw latency data. Users prove they meet SLA thresholds (Diamond <15ms, Gold <50ms, Silver <100ms) and mint ERC-1155 badges on Base Sepolia.

## 🏗️ Architecture Overview

```
User Browser              Backend Verifier           Blockchain (Base Sepolia)
    │                           │                            │
    │──── 1. Run Test ─────────>│                            │
    │    (32 RTT samples)        │                            │
    │                            │                            │
    │<─── 2. Challenges ─────────│                            │
    │    (nonces + timestamps)   │                            │
    │                            │                            │
    │──── 3. Submit RTTs ────────>│                            │
    │    (timed responses)       │                            │
    │                            │                            │
    │                            │──── 4. Finalize Epoch ────>│
    │                            │    Build Merkle tree       │ EpochManager
    │                            │    Commit root to chain    │ (stores roots)
    │                            │                            │
    │<─── 5. Fetch Root ─────────┼────────────────────────────│
    │                            │                            │
    │──── 6. Generate ZK Proof ──>│                            │
    │    (prove best 28/32       │                            │
    │     samples meet threshold)│                            │
    │                            │                            │
    │──── 7. Mint Badge ─────────────────────────────────────>│
    │    (submit proof)          │                            │ ZkSLA1155
    │                            │                            │ (verifies + mints)
    │<─── 8. Badge NFT ──────────────────────────────────────│
```

## 🔐 Zero-Knowledge Proof Flow

### **What is being proven?**
> "I have 28 samples (out of 32) where each RTT ≤ threshold, and these samples are in the committed Merkle tree"

### **What remains private?**
- Individual RTT values (only the backend sees raw data)
- Which specific 28 samples were selected
- The Merkle proof path

### **What is public?**
- The Merkle root (committed on-chain)
- The threshold being claimed (15ms, 50ms, or 100ms)
- That you passed (proof verifies)
- Your actual worst RTT of the best 28 (stored on-chain for leaderboard transparency)

## 📋 Step-by-Step Process

### **Step 1: Network Performance Test**
- **What happens:** User runs 32 RTT challenge-response tests over 45 seconds
- **Technology:**
  - WebSocket connections (Next.js API routes)
  - Challenge-response protocol with server-generated nonces
  - Timestamp validation (1.5s + 3s grace period per challenge)
- **Security:** Flow tokens bind test → proof → mint, preventing reuse attacks

### **Step 2: Merkle Tree Construction**
- **What happens:** Backend builds a Poseidon Merkle tree from all user sessions in an epoch
- **Technology:**
  - **Poseidon hash function** (ZK-friendly hash, gas-efficient for SNARKs)
  - **Epoch system** (5-minute windows batch multiple users)
  - **Leaf structure:** `H(index || nonce || rtt_ms)` prevents replay attacks
- **Storage:** Redis Cloud (session data, epoch tracking)

### **Step 3: On-Chain Root Commitment**
- **What happens:** Backend commits Merkle root to `EpochManager` contract
- **Smart Contract:** `EpochManager.sol` (Solidity + Foundry)
  - Stores `mapping(uint256 epoch => bytes32 root)`
  - Only authorized verifier can commit roots
  - Emits `EpochFinalized` event
- **Blockchain:** Base Sepolia testnet
- **RPC:** Alchemy + Base Public RPC

### **Step 4: Zero-Knowledge Proof Generation**
- **What happens:** User's browser generates a SNARK proof locally
- **ZK Circuit:** Noir language (`circuits/rtt_threshold/src/main.nr`)
  ```
  Inputs (private):
    - indices[28]: which samples to use
    - rtts[28]: the RTT values
  Inputs (public):
    - root: Merkle root from blockchain
    - threshold: tier being claimed (15/50/100)
    - m=28, n=32
  
  Constraints:
    1. All 28 RTTs ≤ threshold
    2. All 28 samples verify against Merkle root
    3. All indices are unique and < 32
  ```
- **Proving System:**
  - **Noir** (domain-specific language for zero-knowledge circuits)
  - **Barretenberg (bb.js)** (PLONK-based proving system, runs in browser)
  - Proving time: ~10-15 seconds in-browser
- **Output:** 256-byte proof + public inputs

### **Step 5: Proof Verification & Badge Minting**
- **What happens:** User submits proof to `ZkSLA1155` contract, which verifies and mints badge
- **Smart Contract:** `ZkSLA1155.sol` (ERC-1155 multi-token standard)
  - Calls `RttThresholdVerifier.verifyProof(proof, publicInputs)`
  - Checks Merkle root matches `EpochManager.rootOf(epoch)`
  - Validates tier threshold is supported (15/50/100)
  - Prevents double-minting (stores `hasMinted[user][epoch][tier]`)
  - Allows re-minting if new `actualRtt` improves on previous
  - Mints token ID = threshold value (e.g., Diamond = token 15)
  - Emits `Verified(user, epoch, threshold, actualRtt)` event
- **Verifier Contract:** `RttThresholdVerifier.sol`
  - Auto-generated from Noir circuit
  - Uses Barretenberg's PLONK verifier (Solidity)
  - Gas-efficient verification (~300k gas)

### **Step 6: On-Chain Leaderboard**
- **What happens:** Frontend queries `Verified` events to build leaderboard
- **Technology:**
  - **viem** (TypeScript Ethereum library)
  - **Event filtering** over 50,000 blocks (~28 hours)
  - **Pagination** (2000 blocks per query to avoid rate limits)
- **Ranking Logic:**
  - Groups by wallet address
  - Keeps best `actualRtt` per user (lower is better)
  - Sorts by latency, then timestamp (earlier is better for ties)

## 🛠️ Technology Stack

### **Frontend**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS + shadcn/ui
- **Wagmi v2** (React hooks for Ethereum)
- **RainbowKit** (wallet connection UI)
- **viem** (low-level Ethereum interactions)

### **Zero-Knowledge**
- **Noir** v1.0.0-beta.12 (circuit language)
- **Barretenberg (bb.js)** (PLONK prover, WASM in browser)
- **Poseidon hash** (ZK-friendly, used in Merkle tree)

### **Smart Contracts**
- **Solidity** ^0.8.25
- **Foundry** (development framework: forge, cast, anvil)
- **OpenZeppelin** (ERC-1155, Ownable, access control)
- **Custom verifier contract** (generated from Noir circuit)

### **Blockchain**
- **Base Sepolia** testnet (Optimistic rollup, low fees)
- **Alchemy RPC** (development)
- **Base Public RPC** (production leaderboard queries)

### **Backend**
- Next.js API routes (serverless)
- **Upstash Redis Cloud** (persistent storage)
- Node.js crypto (nonce generation)
- **ethers.js / viem** (wallet for backend transactions)

## 🔑 Key Cryptographic Components

### **1. Poseidon Hash Function**
- **Why:** SNARK-friendly (uses only 8 constraints in circuit vs 25,000 for SHA-256)
- **Where:** Merkle tree leaf hashing, tree construction
- **Benefit:** 10x cheaper gas costs for verification

### **2. Merkle Tree Proof**
- **Purpose:** Prove a sample exists in the committed set without revealing others
- **Structure:** Binary tree with 32 leaves (2^5 depth)
- **Verification:** O(log n) = 5 hashes per sample in circuit

### **3. PLONK Proof System**
- **Type:** Universal SNARK (no trusted setup per circuit)
- **Proof size:** 256 bytes (constant, regardless of circuit complexity)
- **Verification:** ~300k gas (cheap enough for Base Sepolia)

### **4. Challenge-Response Protocol**
- **Purpose:** Prevent pre-computed or replayed test results
- **Mechanism:** 
  - Server generates random nonce per challenge
  - Client must respond within time window
  - Nonce included in Merkle leaf (ties result to specific test)

## 📊 Privacy Model

| Who Sees What | Raw RTT Data | Merkle Root | ZK Proof | Badge Tier | Actual RTT |
|---------------|--------------|-------------|----------|------------|------------|
| **User (you)** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Backend Verifier** | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Blockchain / Public** | ❌ No | ✅ Yes | ❌ No (just hash) | ✅ Yes | ✅ Yes* |

*Note: `actualRtt` is emitted for leaderboard transparency, but individual sample values and timestamps remain private.

### **Why this matters vs. traditional systems (Ookla, etc.)**
- **Traditional:** Centralized service sees AND controls your data (trust required)
- **zk-SLA:** 
  - Backend sees raw data but **cannot forge proofs** (Merkle root is on-chain)
  - Blockchain verifies proofs but **never sees raw samples** (zero-knowledge)
  - You own the proof and badge (ERC-1155 NFT, fully decentralized)

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Deploy contracts
cd contracts && forge script script/DeployProduction.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast
```

## 📄 License

MIT
