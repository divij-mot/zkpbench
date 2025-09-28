import { createWalletClient, createPublicClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

// Smart contract ABI for EpochManager
const epochManagerABI = [
  {
    name: 'finalizeEpoch',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'epoch', type: 'uint256' },
      { name: 'root', type: 'bytes32' }
    ],
    outputs: []
  },
  {
    name: 'rootOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'epoch', type: 'uint256' }],
    outputs: [{ name: '', type: 'bytes32' }]
  },
] as const;

const RPC_URL = process.env.RPC_URL || 'https://sepolia.base.org';
const PRIVATE_KEY = process.env.VERIFIER_PRIVKEY;
const EPOCH_MANAGER_ADDR = process.env.EPOCH_MANAGER_ADDR as `0x${string}`;

if (!PRIVATE_KEY) {
  throw new Error('VERIFIER_PRIVKEY environment variable is required');
}

if (!EPOCH_MANAGER_ADDR) {
  throw new Error('EPOCH_MANAGER_ADDR environment variable is required');
}

const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);

const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(RPC_URL),
});

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
});

export async function submitRoot(epoch: number, root: bigint): Promise<string> {
  try {
    // Check if epoch already finalized
    const existingRoot = await publicClient.readContract({
      address: EPOCH_MANAGER_ADDR,
      abi: epochManagerABI,
      functionName: 'rootOf',
      args: [BigInt(epoch)],
    });

    if (existingRoot !== 0n) {
      console.log(`Epoch ${epoch} already finalized with root: ${existingRoot.toString(16)}`);
      return '';
    }

    // Submit new root
    const hash = await walletClient.writeContract({
      address: EPOCH_MANAGER_ADDR,
      abi: epochManagerABI,
      functionName: 'finalizeEpoch',
      args: [BigInt(epoch), `0x${root.toString(16).padStart(64, '0')}`],
    });

    console.log(`Submitted root for epoch ${epoch}: ${hash}`);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`Root confirmed for epoch ${epoch} in block ${receipt.blockNumber}`);

    return hash;
  } catch (error) {
    console.error(`Failed to submit root for epoch ${epoch}:`, error);
    throw error;
  }
}

export async function getEpochRoot(epoch: number): Promise<bigint> {
  return await publicClient.readContract({
    address: EPOCH_MANAGER_ADDR,
    abi: epochManagerABI,
    functionName: 'rootOf',
    args: [BigInt(epoch)],
  });
}