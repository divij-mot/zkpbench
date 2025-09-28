// ZK Proving utilities for browser-based proof generation
// Note: This is a simplified implementation for demo purposes
// In production, you would integrate with bb.js or similar ZK proving libraries

export interface RTTSample {
  idx: number;
  nonce: string;
  rtt: number;
  timestamp: number;
}

export interface MerkleProof {
  leaf: string;
  siblings: string[];
  pathIndices: number[];
}

export interface ProofInputs {
  root: string;
  threshold: number;
  m: number;
  n: number;
  epoch: number;
  samples: RTTSample[];
  merkleProofs: MerkleProof[];
}

export interface GeneratedProof {
  proof: Uint8Array;
  publicInputs: string[];
}

// Mock ZK proof generation for demo purposes
// In production, this would use bb.js and actual circuit compilation
export async function generateZKProof(inputs: ProofInputs): Promise<GeneratedProof> {
  // Simulate proof generation time
  await new Promise(resolve => setTimeout(resolve, 15000 + Math.random() * 10000));

  // Validate inputs
  if (inputs.samples.length < inputs.m) {
    throw new Error('Insufficient valid samples for proof generation');
  }

  // Filter samples that meet the threshold
  const validSamples = inputs.samples
    .filter(sample => sample.rtt <= inputs.threshold)
    .slice(0, inputs.m);

  if (validSamples.length < inputs.m) {
    throw new Error(`Only ${validSamples.length} samples meet the ${inputs.threshold}ms threshold, need ${inputs.m}`);
  }

  // In a real implementation, this would:
  // 1. Compile the Noir circuit
  // 2. Generate witness from inputs
  // 3. Generate proof using bb.js
  // 4. Return actual proof bytes and public inputs

  // Mock proof data
  const mockProof = new Uint8Array(192); // Typical proof size
  crypto.getRandomValues(mockProof);

  const publicInputs = [
    inputs.root,
    inputs.threshold.toString(),
    inputs.m.toString(),
    inputs.n.toString(),
    inputs.epoch.toString(),
  ];

  return {
    proof: mockProof,
    publicInputs,
  };
}

export function formatProofForContract(proof: GeneratedProof): {
  proof: string;
  publicInputs: string[];
} {
  return {
    proof: `0x${Array.from(proof.proof).map(b => b.toString(16).padStart(2, '0')).join('')}`,
    publicInputs: proof.publicInputs,
  };
}

// Utility to estimate which tiers a user can prove
export function estimateEligibleTiers(samples: RTTSample[]): {
  tier75: boolean;
  tier150: boolean;
  tier300: boolean;
} {
  const M_REQUIRED = 28;

  const tier75Count = samples.filter(s => s.rtt <= 75).length;
  const tier150Count = samples.filter(s => s.rtt <= 150).length;
  const tier300Count = samples.filter(s => s.rtt <= 300).length;

  return {
    tier75: tier75Count >= M_REQUIRED,
    tier150: tier150Count >= M_REQUIRED,
    tier300: tier300Count >= M_REQUIRED,
  };
}

// Performance statistics
export function calculateStats(samples: RTTSample[]): {
  totalSamples: number;
  validSamples: number;
  averageRTT: number;
  medianRTT: number;
  minRTT: number;
  maxRTT: number;
} {
  const validSamples = samples.filter(s => s.rtt < 5000); // Filter out timeouts
  const rtts = validSamples.map(s => s.rtt).sort((a, b) => a - b);

  return {
    totalSamples: samples.length,
    validSamples: validSamples.length,
    averageRTT: rtts.length > 0 ? rtts.reduce((sum, rtt) => sum + rtt, 0) / rtts.length : 0,
    medianRTT: rtts.length > 0 ? rtts[Math.floor(rtts.length / 2)] : 0,
    minRTT: rtts.length > 0 ? rtts[0] : 0,
    maxRTT: rtts.length > 0 ? rtts[rtts.length - 1] : 0,
  };
}