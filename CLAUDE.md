# zk‑SLA: Zero‑Knowledge Service‑Level Proofs — Full‑Stack Spec

**Goal:** Ship a public demo where any user proves on‑chain that they met a simple network performance SLA (e.g., “≥28 of 32 RTTs ≤ 150 ms”) **without revealing raw logs, IPs, or timestamps**. On success, a smart contract verifies the proof and mints a tiered badge (ERC‑1155). Clean UI, easy to run locally, deployable to a testnet.

---

## 0) TL;DR (for the coding agent)

- **Frontend:** Next.js + TypeScript + Tailwind + shadcn/ui + Wagmi + RainbowKit + Viem.  
- **ZK:** Noir (barretenberg) or Circom (Groth16). Default to **Noir** + **bb.js** prover in the browser. Hash = **Poseidon**.  
- **Backend:** Node.js (Fastify) WS challenge engine that measures RTTs, builds a **Poseidon Merkle tree**, and commits **`root`** to chain per **epoch**.  
- **Contracts (Solidity + Foundry):**
  - `EpochManager`: finalize epoch root(s) from authorized verifier(s).
  - `ZkSLA1155`: verify proof + mint tiered badge. (Optional `IncentivePool`.)  
- **Chain:** **Base Sepolia** (fast, cheap).  
- **Circuit:** proves **m‑of‑n** RTTs are ≤ threshold **T**, each with valid Merkle inclusion to on‑chain `root`, indices unique and within range.  
- **Demo flow:** Click **Run Test → Prove → Mint**. Leaderboard shows addresses per tier.  
- **Constraints target:** < 50k constraints → browser proving 5‑20 s on laptop; on‑chain verify ~200–300k gas (Groth16).

---

## 1) Problem & Value

- DePINs need to reward nodes that meet performance SLOs without leaking telemetry or trusting a central oracle.  
- This demo provides **portable ZK proofs** of compliance with a simple SLA over authenticated samples.  
- Clear, relatable UX (“zero‑knowledge speed test”), plus reusable on‑chain verifier for DePIN rewards.

---

## 2) System Overview

### Components
1. **Frontend (Next.js App)**
   - Wallet connect, “Run zk‑SLA test,” progress UI, local proving, proof submission, badge mint, leaderboard.
2. **Verifier Service (Node)**
   - WebSocket session per user.
   - Sends **n** scheduled challenges (nonce + short TTL).
   - Measures RTTs, constructs Poseidon Merkle tree of leaves `H(idx || nonce || rtt_ms)`, publishes `root` on chain for epoch `E`.
   - Serves signed bundle of leaves for provers (IPFS + HTTPS fallback).
3. **Circuits & Prover**
   - Noir circuit (`rtt_threshold.nr`) with in‑browser WASM prover (bb.js).
4. **Smart Contracts**
   - `EpochManager`: `finalizeEpoch(E, root)` gated by `isVerifier`.
   - `ZkSLA1155`: `verifyAndMint(E, proof, publicInputs)`; mints tiered ERC‑1155 badge(s).

### Data/Timing Model
- **n = 32** challenges over ~45 s.  
- **m = 28**, thresholds tiers `T ∈ {75, 150, 300}` ms.  
- Epoch cadence: every 2–5 minutes (demo) so multiple users share a root; or per-session roots for simplicity.

---

## 3) Cryptographic Design

### Commitments
- **Leaf:** `leaf_i = Poseidon( i || nonce_i || rtt_i_ms )` with field‑safe encodings (32‑bit ints).  
- **Merkle Root:** Poseidon‑based tree; depth 16 is sufficient.  
- **On‑Chain Auth:** `EpochManager.rootOf[E] = root`. Circuits accept only that `root`.

### Public Inputs
```
root:    bytes32 (Poseidon Merkle root posted for epoch E)
T:       uint32  (threshold in ms)
m:       uint16  (required successes)
n:       uint16  (total samples)
E:       uint64  (epoch id)
```
*(Add verifier address only at contract level; it’s not needed inside the circuit if `root` is already on‑chain.)*

### Witness
```
{ (idx_j, nonce_j, rtt_j_ms, merkle_path_j[]) for j in 1..m }
```

### Circuit Constraints (Noir pseudo)
```text
for j in 1..m:
  leaf_j = Poseidon( pack(idx_j), pack(nonce_j), pack(rtt_j_ms) )
  assert merkle_verify(leaf_j, path_j, root)
  assert rtt_j_ms <= T

# Distinct indices and bounds
assert all idx_j are pairwise distinct
assert 0 <= idx_j < n
```

**Notes**
- “m‑of‑n” avoids proving all samples; user chooses any m satisfiers from the provided set under the committed `root`.  
- **Time** is enforced by server (nonce TTL + WS schedule), not in-circuit.  
- Use **domain separation** in Poseidon for leaves vs. internal nodes.

---

## 4) Smart Contracts (Solidity)

### 4.1 `EpochManager.sol` (interface sketch)
```solidity
interface IEpochManager {
  event EpochFinalized(uint256 indexed epoch, bytes32 root);
  function rootOf(uint256 epoch) external view returns (bytes32);
  function setVerifier(address who, bool isOk) external; // owner‑only
  function finalizeEpoch(uint256 epoch, bytes32 root) external; // onlyVerifier
}
```

### 4.2 `ZkSLA1155.sol`
- Holds verifying key(s) per **tier** (or a single universal verifier if same circuit).  
- Mints `ERC‑1155` token id by threshold tier.  
- Optional: emits `Verified(address user, uint256 epoch, uint32 T)`.  

```solidity
interface IVerifier {
  function verifyProof(bytes calldata proof, uint256[] calldata pubInputs) external view returns (bool);
}

contract ZkSLA1155 is ERC1155, Ownable {
  IEpochManager public mgr;
  IVerifier public verifier;

  mapping(uint32 => bool) public isTier; // e.g., 75,150,300

  function verifyAndMint(
    uint256 epoch,
    uint32 T,
    uint16 m,
    uint16 n,
    bytes32 root,
    bytes calldata proof,
    uint256[] calldata publicInputs
  ) external {
    require(isTier[T], "tier");
    require(mgr.rootOf(epoch) == root, "root");
    require(verifier.verifyProof(proof, publicInputs), "bad proof");

    uint256 id = uint256(T); // tier id
    _mint(msg.sender, id, 1, "");
  }
}
```

### Gas Targets
- Groth16 verifier ~200–300k gas per call on Base Sepolia.  
- Store minimal state; badge mint is single `SSTORE` (balance) + events.

---

## 5) Backend (Verifier Service)

**Stack:** Node 20, Fastify, WS, Viem (chain tx), Prisma (optional for sessions).

### Endpoints
- `WS /session/:addr` → Sends `n` challenges: `{idx, nonce, t_send}`; expects echo.  
- `GET /bundle/:epoch` → Returns bundle metadata (Merkle siblings, leaves, and mapping indices).  
- `POST /submitRoot` (internal) → Calls `EpochManager.finalizeEpoch(E, root)`.

### Challenge Logic
- Nonces are 128‑bit random; TTL 1.5 s; schedule jitter ±100 ms.  
- Any missing/late echo counts as failure; still included in leaves with `rtt_ms = MAX`.  
- Rate limit per IP + per address.

### Merkle
- Build Poseidon tree from leaves; persist to disk; pin to IPFS with CID referenced in `EpochFinalized` off‑chain indexer.

---

## 6) Frontend (Next.js + shadcn/ui)

### Pages
- `/` Landing (hero, CTA: “Prove your speed privately”)  
- `/test` Run test, progress meter, estimated tier.  
- `/prove` Prover page: show proving progress/time; handle WASM memory; display proof size.  
- `/mint` Submit to contract; show tx hash & badge.  
- `/leaderboard` Query holders by tier (simple TheGraph/subgraph later; initially RPC scan).

### UI Style
- **Minimalist dark** theme; neutral foreground; accent gradient on CTA.  
- shadcn components: `Button`, `Card`, `Progress`, `Tabs`, `Badge`, `Alert`, `Dialog`, `DataTable`.  
- Tailwind tokens:
  - `bg-[#0B0D10]`, `text-zinc-200`, `muted:text-zinc-400`
  - Accent grad: `from-indigo-500 via-sky-500 to-teal-400`
- Motion: subtle fade/scale on card mount (Framer Motion).

### Wallet & Chain
- **RainbowKit + Wagmi + Viem**, chain = Base Sepolia (`chainId: 0x14a34` if available; otherwise OP/Arbitrum Sepolia).  
- Contract addresses & ABIs exposed via `.env` + typed config.

---

## 7) Repository Layout

```
zk-sla/
  contracts/
    src/
      EpochManager.sol
      ZkSLA1155.sol
      Verifier.sol   // generated
    script/
      Deploy.s.sol
    test/
      Epoch.t.sol
      ZkSLA.t.sol
    foundry.toml
  circuits/
    rtt_threshold/
      circuit.nr
      Proving.key (gitignored)
      Verification.key (json)
      verifier.sol (generated)
      README.md
  verifier/
    src/
      server.ts
      merkle.ts
      submitRoot.ts
    package.json
  app/
    next/
      app/
        (routes...)
      components/
      lib/
      public/
      package.json
  scripts/
    dev.sh
    build-all.sh
    deploy.ts
  README.md
  CLAUDE.md  // task list (included below)
```

---

## 8) Setup & Commands

### Prereqs
- Node 20+, pnpm, Foundry, Rust (for Noir), Docker.  
- Wallet with Base Sepolia test ETH.

### Environment
```
# .env
NEXT_PUBLIC_CHAIN_ID=84532            # Base Sepolia (example)
NEXT_PUBLIC_RPC_URL=...
NEXT_PUBLIC_ZKSLA_ADDR=0x...
EPOCH_MANAGER_ADDR=0x...
VERIFIER_PRIVKEY=0x...                # backend root submitter
```

### Build
```bash
# Circuits
cd circuits/rtt_threshold
nargo check
nargo prove-keygen        # produces proving/verifying keys
# Generate Solidity verifier
# (use noir-solgen or a provided script to export verifier.sol)

# Contracts
cd contracts
forge install
forge test
forge script script/Deploy.s.sol --rpc-url $RPC --broadcast

# Backend
cd verifier && pnpm i && pnpm dev

# Frontend
cd app/next && pnpm i && pnpm dev
```

---

## 9) Circuit Details (Noir sketch)

```rust
// circuits/rtt_threshold/circuit.nr
// Pseudocode-level; actual Noir syntax may vary.

fn main(
  pub root: Field,
  pub T: u32,
  pub m: u16,
  pub n: u16,
  pub epoch: u64,
  idxs: [u16; M_MAX],
  nonces: [u128; M_MAX],
  rtts: [u32; M_MAX],
  paths: [MerklePath; M_MAX]
) {
  // For j in 0..m-1:
  for j in 0..M_MAX {
    constrain_if(j < m, || {
      let leaf = poseidon_hash( pack_u16(idxs[j]), pack_u128(nonces[j]), pack_u32(rtts[j]) );
      merkle_verify_poseidon(leaf, paths[j], root);
      assert(rtts[j] <= T);
    });
  }

  // Distinct indices among first m entries
  for a in 0..M_MAX {
    for b in (a+1)..M_MAX {
      constrain_if(a < m && b < m, || {
        assert(idxs[a] != idxs[b]);
      });
    }
  }

  // Bounds
  for j in 0..M_MAX {
    constrain_if(j < m, || {
      assert(idxs[j] < n);
    });
  }
}
```

---

## 10) E2E Flow

1. **Landing** → click *Run Test* (wallet auto‑connect suggest).  
2. **WS session** starts; receive timed nonces; client echoes immediately.  
3. **Server** computes RTTs, builds tree, posts `root` via `EpochManager.finalizeEpoch`.  
4. **Client** fetches leaf bundle → **Prove** in browser (WASM).  
5. **Submit** proof to `ZkSLA1155.verifyAndMint` → on success, badge minted.  
6. **Leaderboard** queries holders per tier and shows badges.

---

## 11) Security & Anti‑Cheat (demo‑grade)

- **Fresh challenges**: nonces unpredictable; short TTL; schedule jitter.  
- **Cherry‑pick resistance**: m‑of‑n proof must open leaves under committed `root`; can’t fabricate new samples.  
- **Verifier trust**: acknowledged; extend to **k‑of‑N independent verifiers** later.  
- **Sybil**: one badge per epoch per address; sponsor payouts gated to OAuth or small allowlist (optional).  
- **Privacy**: no raw RTTs or IPs on chain; leaf bundle can omit IP and timestamps entirely.

---

## 12) Testing

- **Circuit tests**: fixed vector (n=8), property tests for wrong root/path/duplicates/over‑T failure.  
- **Contract tests**: verify success/failure paths; wrong root; tier mismatch; re‑mint.  
- **Backend tests**: WS timing harness; Merkle correctness vs. circuit.  
- **Frontend tests**: Cypress run through demo with mocked backend and test verifier root.

---

## 13) Milestones

- **Wk 1**: Repo scaffold, contracts + basic deploy, WS skeleton, Noir stub.  
- **Wk 2**: Circuit complete, verifier.sol generated, backend root submit, Next.js test/prove/mint flow.  
- **Wk 3**: Leaderboard, polish UI, docs, public demo on Base Sepolia.  
- **Stretch**: multi‑verifier, bandwidth sum/percentile circuit, incentive pool.

---

## 14) Acceptance Criteria (ship checklist)

- [ ] User can connect wallet and run test to completion in < 60 s.  
- [ ] Browser proving completes in < 20 s on recent laptop.  
- [ ] Successful on‑chain verification mints correct tier badge.  
- [ ] Leaderboard shows badge holders per tier.  
- [ ] All contracts have unit tests; E2E happy path recorded (loom).

---

## 15) UI Notes (minimalist shadcn + Tailwind)

- **Hero**: big headline “Prove performance privately.” CTA button with gradient border.  
- **Cards**: soft shadows (`shadow-xl/10`), rounded‑2xl, 1px border `border-white/10`.  
- **Progress**: show 32 dots animating as challenges complete.  
- **Prover**: show steps “Compile witness → Prove → Verify.”  
- **Color**: neutrals + a single accent gradient for CTAs.  
- **Typography**: Inter or Geist, `tracking-tight`, large line‑height on hero.

---

## 16) Appendix A — Runner‑Ups (if needed later)

### A1. ZK Proof‑of‑Inference (zkPoI)
- Fixed tiny model (MNIST/CIFAR tiny CNN). Prove correct inference on private input; mint receipt.  
- Stack: `ezkl` or `noir‑zkml`, Solidity verifier, Next.js.  
- Tradeoff: keep model tiny for UX.

### A2. zk‑Federated Evaluation
- Publish hashed public minibatch; clients prove accuracy ≥ X% locally w/out revealing per‑sample preds.  
- Same Merkle + threshold pattern; useful research demo.

---

## 17) CLAUDE.md (Task List for Agent)

**Context:** Build a demo‑ready zk‑SLA as described above. Keep commits small. Prefer Noir.  
**Tasks:**

1. **Bootstrapping**
   - Create monorepo with pnpm workspaces: `contracts`, `circuits`, `verifier`, `app/next`.
   - Add lint/format configs (biome/eslint, prettier).

2. **Contracts**
   - Implement `EpochManager` with `Ownable`, `isVerifier` mapping, `finalizeEpoch`.
   - Implement `ZkSLA1155` with `verifyAndMint`.  
   - Unit tests in Foundry; deploy script; write addresses to `.env` JSON for frontend/backend.

3. **Circuits**
   - Implement Noir circuit `rtt_threshold`.  
   - Poseidon Merkle lib; set `M_MAX = 28`, `N_MAX = 32`.  
   - Proving/verification keys; generate `verifier.sol`.  
   - Provide TypeScript wrapper to generate publicInputs array from app state.

4. **Backend**
   - WS server: send challenges, measure RTTs, build Poseidon tree (TS lib), store leaves, post `root`.  
   - `/bundle/:epoch` returns JSON with leaves (indices, nonces, rtts) and sibling paths.  
   - Env‑driven signer; submit `finalizeEpoch` on Base Sepolia.

5. **Frontend**
   - Landing page + shadcn theme.  
   - `/test` page: connect wallet, start WS, show progress; after done, download bundle.  
   - Prover page: run WASM proving → produce `proof`, `publicInputs`.  
   - Mint page: call `verifyAndMint` via wagmi/viem; show tx hash.  
   - Leaderboard: read balances for tier ids.

6. **Polish**
   - Error states, retries, timeouts.  
   - Copy: single‑line Twitter share after mint.  
   - README with screenshots and quickstart.

7. **Deliverables**
   - Public demo URL (Vercel) + contracts on Base Sepolia.  
   - Short video walk‑through.  
   - Post‑mortem with gas/prover times.

---

## 18) License & Attribution

- MIT for code; circuits and verifier under same.  
- Mention Noir, barretenberg, Poseidon libs in README.

---

## 19) Out‑of‑Scope (for this demo)

- Strong sybil resistance, legal claims, enterprise SLAs.  
- Precise geo/IP verification, clock synchronization proofs.  
- Full multi‑verifier consensus (leave as extension).

---

## 20) One‑Liner Pitch

**“A zero‑knowledge speed test: prove you met an SLA and mint the proof on‑chain — no logs, no leaks.”**
