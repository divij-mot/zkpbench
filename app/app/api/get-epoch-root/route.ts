import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { CONTRACTS, EPOCH_MANAGER_ABI } from '@/lib/contracts';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const epoch = searchParams.get('epoch');

    if (!epoch) {
      return NextResponse.json({ error: 'Missing epoch parameter' }, { status: 400 });
    }

    const rpcUrl = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL;
    
    if (!rpcUrl) {
      return NextResponse.json({ error: 'RPC URL not configured' }, { status: 500 });
    }

    // Create public client to read from blockchain
    const client = createPublicClient({
      chain: baseSepolia,
      transport: http(rpcUrl)
    });

    console.log(`📖 Fetching Merkle root for epoch ${epoch} from blockchain...`);

    // Read the Merkle root from EpochManager contract
    const merkleRoot = await client.readContract({
      address: CONTRACTS.EPOCH_MANAGER as `0x${string}`,
      abi: EPOCH_MANAGER_ABI,
      functionName: 'rootOf',
      args: [BigInt(epoch)]
    });

    // Check if epoch is finalized
    const isFinalized = merkleRoot !== '0x0000000000000000000000000000000000000000000000000000000000000000';

    if (!isFinalized) {
      console.log(`⚠️  Epoch ${epoch} not yet finalized on-chain`);
      return NextResponse.json({
        epoch: parseInt(epoch),
        merkleRoot: null,
        isFinalized: false,
        message: 'Epoch not yet finalized. Please wait a moment after test completion.'
      });
    }

    console.log(`✅ Fetched Merkle root for epoch ${epoch}: ${merkleRoot}`);

    return NextResponse.json({
      epoch: parseInt(epoch),
      merkleRoot,
      isFinalized: true
    });

  } catch (error: any) {
    console.error('Error fetching epoch root:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch root',
      details: error.toString()
    }, { status: 500 });
  }
}
