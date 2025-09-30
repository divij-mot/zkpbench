import { Address } from 'viem';

// Contract addresses from environment variables
export const CONTRACTS = {
  EPOCH_MANAGER: process.env.NEXT_PUBLIC_EPOCH_MANAGER_ADDRESS as Address,
  ZK_SLA_1155: process.env.NEXT_PUBLIC_ZKSLA1155_ADDRESS as Address,
  RTT_VERIFIER: process.env.NEXT_PUBLIC_VERIFIER_ADDRESS as Address
} as const;

// ABI fragments for the contracts
export const EPOCH_MANAGER_ABI = [
  {
    type: 'function',
    name: 'rootOf',
    inputs: [{ name: 'epoch', type: 'uint256' }],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'finalizeEpoch',
    inputs: [
      { name: 'epoch', type: 'uint256' },
      { name: 'root', type: 'bytes32' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'event',
    name: 'EpochFinalized',
    inputs: [
      { name: 'epoch', type: 'uint256', indexed: true },
      { name: 'root', type: 'bytes32', indexed: false }
    ]
  }
] as const;

export const ZK_SLA_1155_ABI = [
  {
    type: 'function',
    name: 'verifyAndMint',
    inputs: [
      { name: 'epoch', type: 'uint256' },
      { name: 'T', type: 'uint32' },
      { name: 'm', type: 'uint16' },
      { name: 'n', type: 'uint16' },
      { name: 'root', type: 'bytes32' },
      { name: 'proof', type: 'bytes' },
      { name: 'publicInputs', type: 'uint256[]' },
      { name: 'actualRtt', type: 'uint32' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'getTierBalance',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'tier', type: 'uint32' }
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'id', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'isTier',
    inputs: [{ name: 'threshold', type: 'uint32' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'event',
    name: 'Verified',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'epoch', type: 'uint256', indexed: true },
      { name: 'threshold', type: 'uint32', indexed: false },
      { name: 'actualRtt', type: 'uint32', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'TransferSingle',
    inputs: [
      { name: 'operator', type: 'address', indexed: true },
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'id', type: 'uint256', indexed: false },
      { name: 'value', type: 'uint256', indexed: false }
    ]
  }
] as const;

export const RTT_VERIFIER_ABI = [
  {
    type: 'function',
    name: 'verifyProof',
    inputs: [
      { name: 'proof', type: 'bytes' },
      { name: 'publicInputs', type: 'uint256[]' }
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getVkHash',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'pure'
  }
] as const;

// Tier configurations
export const TIERS = [
  { threshold: 15, name: 'Diamond', color: 'from-blue-400 to-purple-500' },
  { threshold: 50, name: 'Gold', color: 'from-yellow-400 to-orange-500' },
  { threshold: 100, name: 'Silver', color: 'from-gray-400 to-gray-600' }
] as const;

export type Tier = typeof TIERS[number];

// Helper functions
export function getTierByThreshold(threshold: number): Tier | undefined {
  return TIERS.find(tier => tier.threshold === threshold);
}

export function getTierName(threshold: number): string {
  const tier = getTierByThreshold(threshold);
  return tier?.name || 'Unknown';
}

export function getTierColor(threshold: number): string {
  const tier = getTierByThreshold(threshold);
  return tier?.color || 'from-gray-400 to-gray-600';
}

export function formatAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatHash(hash: string): string {
  if (!hash || hash.length < 10) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
}

// Chain configuration
export const CHAIN_CONFIG = {
  BASE_SEPOLIA: {
    id: 84532,
    name: 'Base Sepolia',
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.base.org',
    blockExplorer: 'https://sepolia.basescan.org'
  }
} as const;