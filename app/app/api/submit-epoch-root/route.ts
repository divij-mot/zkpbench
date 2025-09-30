import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, http, publicActions } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { CONTRACTS, EPOCH_MANAGER_ABI } from '@/lib/contracts';

export async function POST(request: NextRequest) {
  try {
    const { epoch, merkleRoot } = await request.json();

    if (!epoch || !merkleRoot) {
      return NextResponse.json({ error: 'Missing epoch or merkleRoot' }, { status: 400 });
    }

    // Get verifier private key from environment
    const privateKey = process.env.VERIFIER_PRIVATE_KEY;
    const rpcUrl = process.env.RPC_URL;

    if (!privateKey || !rpcUrl) {
      console.error('Missing VERIFIER_PRIVATE_KEY or RPC_URL in environment');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Create wallet client
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const client = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(rpcUrl)
    }).extend(publicActions);

    console.log(`📤 Submitting Merkle root for epoch ${epoch} to EpochManager...`);
    console.log(`Root: ${merkleRoot}`);
    console.log(`Verifier address: ${account.address}`);

    // Check if epoch is already finalized
    const existingRoot = await client.readContract({
      address: CONTRACTS.EPOCH_MANAGER as `0x${string}`,
      abi: EPOCH_MANAGER_ABI,
      functionName: 'rootOf',
      args: [BigInt(epoch)]
    });

    if (existingRoot && existingRoot !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      console.log(`Epoch ${epoch} already finalized with root: ${existingRoot}`);
      return NextResponse.json({
        success: true,
        alreadyFinalized: true,
        epoch,
        merkleRoot: existingRoot
      });
    }

    // Submit the Merkle root to the blockchain
    const hash = await client.writeContract({
      address: CONTRACTS.EPOCH_MANAGER as `0x${string}`,
      abi: EPOCH_MANAGER_ABI,
      functionName: 'finalizeEpoch',
      args: [BigInt(epoch), merkleRoot as `0x${string}`]
    });

    console.log(`✅ Transaction submitted: ${hash}`);

    // Wait for confirmation
    const receipt = await client.waitForTransactionReceipt({ hash });

    console.log(`✅ Epoch ${epoch} finalized on-chain! Block: ${receipt.blockNumber}`);

    return NextResponse.json({
      success: true,
      txHash: hash,
      epoch,
      merkleRoot,
      blockNumber: receipt.blockNumber.toString()
    });

  } catch (error: any) {
    console.error('Error submitting epoch root:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to submit root',
      details: error.toString()
    }, { status: 500 });
  }
}
