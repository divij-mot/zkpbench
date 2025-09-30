import { NextRequest, NextResponse } from 'next/server';

// Use Redis Cloud or mock KV for local development
let kv: any;
try {
  // Try to use Redis Cloud
  if (process.env.REDIS_URL) {
    kv = require('@/lib/redis').kv;
  } else {
    throw new Error('REDIS_URL not available');
  }
} catch (error) {
  // Fall back to mock KV for local development
  console.warn('Using mock KV for local development. Set REDIS_URL for production.');
  kv = require('@/lib/kv-mock').kv;
}

// Simplified Poseidon hash implementation
// TODO: Replace with actual Poseidon implementation from @noir-lang
function simplePoseidon(inputs: bigint[]): bigint {
  // This is a placeholder - in production, use the actual Poseidon hash
  let result = 0n;
  for (let i = 0; i < inputs.length; i++) {
    result = (result + inputs[i] * BigInt(i + 1)) % (2n ** 254n - 1n);
  }
  return result;
}

interface RTTSample {
  index: number;
  nonce: string;
  rttMs: number;
  leafHash: string;
}

interface EpochData {
  epoch: number;
  samples: RTTSample[];
  merkleRoot: string;
  merkleTree: string[];
  finalizedAt: number;
}

function buildMerkleTree(leaves: string[]): { root: string; tree: string[] } {
  const tree: string[] = [...leaves];
  let currentLevel = [...leaves];

  // Pad to power of 2 if necessary
  while ((currentLevel.length & (currentLevel.length - 1)) !== 0) {
    currentLevel.push('0x0000000000000000000000000000000000000000000000000000000000000000');
  }

  // Build tree bottom-up
  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = BigInt(currentLevel[i]);
      const right = i + 1 < currentLevel.length ? BigInt(currentLevel[i + 1]) : 0n;
      const parent = simplePoseidon([left, right]);
      const parentHex = '0x' + parent.toString(16).padStart(64, '0');
      nextLevel.push(parentHex);
      tree.push(parentHex);
    }
    currentLevel = nextLevel;
  }

  return {
    root: currentLevel[0],
    tree
  };
}

function generateLeafHash(index: number, nonce: string, rttMs: number): string {
  // Convert to field elements
  const indexField = BigInt(index);
  const nonceField = BigInt('0x' + nonce.replace(/-/g, '').substring(0, 16));
  const rttField = BigInt(rttMs);

  // Hash: Poseidon(Poseidon(index, nonce), rtt)
  const temp = simplePoseidon([indexField, nonceField]);
  const leaf = simplePoseidon([temp, rttField]);

  return '0x' + leaf.toString(16).padStart(64, '0');
}

export async function POST(request: NextRequest) {
  try {
    const { epoch, sessionIds } = await request.json();

    if (!epoch || !Array.isArray(sessionIds)) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    // Check if epoch is already finalized
    const existingEpoch = await kv.get(`epoch:${epoch}`);
    if (existingEpoch) {
      return NextResponse.json(JSON.parse(existingEpoch as string));
    }

    // Collect all samples from sessions
    const allSamples: RTTSample[] = [];

    for (const sessionId of sessionIds) {
      const sessionData = await kv.get(`session:${sessionId}`);
      if (!sessionData) {
        console.warn(`⚠️  Session ${sessionId} not found in Redis`);
        continue;
      }

      const session = JSON.parse(sessionData as string);
      console.log(`📊 Processing session ${sessionId}: epoch=${session.epoch}, results=${session.results?.length || 0}`);
      
      if (session.epoch !== epoch) {
        console.warn(`⚠️  Session epoch mismatch: expected ${epoch}, got ${session.epoch}`);
        continue;
      }
      if (!session.results) {
        console.warn(`⚠️  Session ${sessionId} has no results`);
        continue;
      }

      // Convert session results to samples
      for (const result of session.results) {
        const leafHash = generateLeafHash(result.index, result.nonce, result.rttMs);
        allSamples.push({
          index: result.index,
          nonce: result.nonce,
          rttMs: result.rttMs,
          leafHash
        });
      }
    }

    if (allSamples.length === 0) {
      return NextResponse.json({ error: 'No samples found for epoch' }, { status: 404 });
    }

    // Sort samples by index for consistent tree construction
    allSamples.sort((a, b) => a.index - b.index);

    // Build Merkle tree
    const leaves = allSamples.map(s => s.leafHash);
    const { root, tree } = buildMerkleTree(leaves);

    const epochData: EpochData = {
      epoch,
      samples: allSamples,
      merkleRoot: root,
      merkleTree: tree,
      finalizedAt: Date.now()
    };

    // Store epoch data (expires in 1 hour)
    await kv.setex(`epoch:${epoch}`, 3600, JSON.stringify(epochData));

    // Submit root to smart contract
    try {
      const submitResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/submit-epoch-root`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ epoch, merkleRoot: root })
      });

      if (submitResponse.ok) {
        const submitResult = await submitResponse.json();
        console.log(`✅ Epoch ${epoch} finalized on-chain:`, submitResult);
      } else {
        console.error('Failed to submit root on-chain:', await submitResponse.text());
      }
    } catch (submitError) {
      console.error('Error submitting root to blockchain:', submitError);
      // Continue anyway - root is stored in KV
    }

    return NextResponse.json({
      epoch,
      merkleRoot: root,
      sampleCount: allSamples.length,
      finalizedAt: epochData.finalizedAt
    });

  } catch (error) {
    console.error('Error finalizing epoch:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET endpoint for retrieving epoch data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const epoch = searchParams.get('epoch');

    if (!epoch) {
      return NextResponse.json({ error: 'Missing epoch' }, { status: 400 });
    }

    const epochData = await kv.get(`epoch:${epoch}`);
    if (!epochData) {
      return NextResponse.json({ error: 'Epoch not found' }, { status: 404 });
    }

    const data = JSON.parse(epochData as string) as EpochData;

    return NextResponse.json(data);

  } catch (error) {
    console.error('Error getting epoch data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}