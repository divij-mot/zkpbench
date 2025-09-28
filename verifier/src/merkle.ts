import { poseidon2, poseidon3 } from 'poseidon-lite';

export interface RTTSample {
  idx: number;
  nonce: bigint;
  rttMs: number;
  timestamp: number;
}

export interface MerkleLeaf {
  idx: number;
  nonce: bigint;
  rttMs: number;
  hash: bigint;
}

export interface MerkleProof {
  leaf: MerkleLeaf;
  siblings: bigint[];
  pathIndices: number[];
}

export class PoseidonMerkleTree {
  private leaves: MerkleLeaf[] = [];
  private tree: bigint[][] = [];
  private depth: number;

  constructor(depth: number = 16) {
    this.depth = depth;
  }

  addSample(sample: RTTSample): void {
    // Compute leaf hash: Poseidon(Poseidon(idx, nonce), rtt)
    const idxField = BigInt(sample.idx);
    const rttField = BigInt(sample.rttMs);

    const tempHash = poseidon2([idxField, sample.nonce]);
    const leafHash = poseidon2([tempHash, rttField]);

    const leaf: MerkleLeaf = {
      idx: sample.idx,
      nonce: sample.nonce,
      rttMs: sample.rttMs,
      hash: leafHash,
    };

    this.leaves.push(leaf);
  }

  buildTree(): bigint {
    if (this.leaves.length === 0) {
      throw new Error('No leaves to build tree');
    }

    // Pad leaves to next power of 2
    const maxLeaves = 2 ** this.depth;
    const paddedLeaves = [...this.leaves];

    // Pad with zero hashes
    while (paddedLeaves.length < maxLeaves) {
      paddedLeaves.push({
        idx: 0,
        nonce: 0n,
        rttMs: 0,
        hash: 0n,
      });
    }

    // Initialize tree with leaves
    this.tree = [paddedLeaves.map(leaf => leaf.hash)];

    // Build tree bottom-up
    for (let level = 0; level < this.depth; level++) {
      const currentLevel = this.tree[level];
      const nextLevel: bigint[] = [];

      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = currentLevel[i + 1];
        // Use domain separation for internal nodes
        const parent = poseidon2([left, right]);
        nextLevel.push(parent);
      }

      this.tree.push(nextLevel);
    }

    return this.getRoot();
  }

  getRoot(): bigint {
    if (this.tree.length === 0) {
      throw new Error('Tree not built');
    }
    return this.tree[this.tree.length - 1][0];
  }

  getMerkleProof(leafIndex: number): MerkleProof {
    if (leafIndex >= this.leaves.length) {
      throw new Error('Leaf index out of bounds');
    }

    if (this.tree.length === 0) {
      throw new Error('Tree not built');
    }

    const siblings: bigint[] = [];
    const pathIndices: number[] = [];

    let currentIndex = leafIndex;

    for (let level = 0; level < this.depth; level++) {
      const isRightNode = currentIndex % 2 === 1;
      const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;

      siblings.push(this.tree[level][siblingIndex]);
      pathIndices.push(isRightNode ? 1 : 0);

      currentIndex = Math.floor(currentIndex / 2);
    }

    return {
      leaf: this.leaves[leafIndex],
      siblings,
      pathIndices,
    };
  }

  getAllProofs(): MerkleProof[] {
    return this.leaves.map((_, index) => this.getMerkleProof(index));
  }

  static verifyProof(leaf: MerkleLeaf, siblings: bigint[], pathIndices: number[], root: bigint): boolean {
    let hash = leaf.hash;

    for (let i = 0; i < siblings.length; i++) {
      const sibling = siblings[i];
      const isRightNode = pathIndices[i] === 1;

      if (isRightNode) {
        hash = poseidon2([sibling, hash]);
      } else {
        hash = poseidon2([hash, sibling]);
      }
    }

    return hash === root;
  }
}

export function generateNonce(): bigint {
  // Generate 128-bit nonce
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  let nonce = 0n;
  for (let i = 0; i < 16; i++) {
    nonce = (nonce << 8n) | BigInt(bytes[i]);
  }

  return nonce;
}