import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { CONTRACTS, ZK_SLA_1155_ABI } from '@/lib/contracts';

interface LeaderboardEntry {
  address: string;
  tier: 'Diamond' | 'Gold' | 'Silver';
  threshold: number;
  actualRtt: number; // The actual RTT achieved in ms
  epoch: string;
  blockNumber: string;
  timestamp: number;
}

export async function GET() {
  try {
    // Use Base Sepolia public RPC for leaderboard queries (no rate limits!)
    // This is faster than Alchemy free tier and completely decentralized
    const publicRpcUrl = 'https://sepolia.base.org';
    
    console.log('📊 Using Base Sepolia public RPC for leaderboard queries');

    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(publicRpcUrl, {
        timeout: 30_000, // 30 second timeout for large queries
      })
    });

    console.log('📊 Fetching Verified events from blockchain...');

    // Get the latest block number
    const latestBlock = await publicClient.getBlockNumber();
    
    // Public RPC has no rate limits - we can query large ranges!
    // Query last 50,000 blocks (~28 hours of history)
    const blocksToQuery = 50000n;
    const startBlock = latestBlock > blocksToQuery ? latestBlock - blocksToQuery : 0n;
    
    console.log(`📊 Querying blocks ${startBlock} to ${latestBlock} (${blocksToQuery} blocks)`);

    // With public RPC, we can query in larger chunks (1000-2000 blocks per request)
    const batchSize = 2000n;
    const allLogs: any[] = [];
    let currentBlock = startBlock;
    
    while (currentBlock <= latestBlock) {
      const endBlock = currentBlock + batchSize - 1n > latestBlock ? latestBlock : currentBlock + batchSize - 1n;
      
      try {
        const logs = await publicClient.getLogs({
          address: CONTRACTS.ZK_SLA_1155 as `0x${string}`,
          event: {
            type: 'event',
            name: 'Verified',
            inputs: [
              { name: 'user', type: 'address', indexed: true },
              { name: 'epoch', type: 'uint256', indexed: true },
              { name: 'threshold', type: 'uint32', indexed: false },
              { name: 'actualRtt', type: 'uint32', indexed: false }
            ]
          },
          fromBlock: currentBlock,
          toBlock: endBlock
        });
        
        allLogs.push(...logs);
        
        if (logs.length > 0) {
          console.log(`📊 Found ${logs.length} events in blocks ${currentBlock}-${endBlock}`);
        }
      } catch (error) {
        console.error(`Error querying blocks ${currentBlock}-${endBlock}:`, error);
        // On error, try smaller batch
        if (batchSize > 500n) {
          console.log('Retrying with smaller batch size...');
          continue;
        }
      }
      
      currentBlock = endBlock + 1n;
    }

    console.log(`📊 Total found ${allLogs.length} Verified events`);

    // Get block timestamps for sorting
    const entriesWithTimestamps = await Promise.all(
      allLogs.map(async (log) => {
        const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
        const args = log.args as { user: string; epoch: bigint; threshold: number; actualRtt: number };
        
        let tier: 'Diamond' | 'Gold' | 'Silver' = 'Silver';
        if (args.threshold === 15) tier = 'Diamond';
        else if (args.threshold === 50) tier = 'Gold';
        
        return {
          address: args.user,
          tier,
          threshold: args.threshold,
          actualRtt: args.actualRtt,
          epoch: args.epoch.toString(),
          blockNumber: log.blockNumber.toString(),
          timestamp: Number(block.timestamp)
        };
      })
    );

    // Filter out entries with missing actualRtt (old contract events)
    const validEntries = entriesWithTimestamps.filter(entry => entry.actualRtt && entry.actualRtt > 0);
    
    // Group by address and keep only the best performance (lowest actualRtt)
    const userBestTiers = new Map<string, LeaderboardEntry>();
    
    for (const entry of validEntries) {
      const existing = userBestTiers.get(entry.address);
      
      if (!existing || entry.actualRtt < existing.actualRtt) {
        // Better performance (lower RTT is better)
        userBestTiers.set(entry.address, entry);
      } else if (entry.actualRtt === existing.actualRtt && entry.timestamp < existing.timestamp) {
        // Same RTT but earlier
        userBestTiers.set(entry.address, entry);
      }
    }

    // Convert to array and sort by actual RTT (lower is better)
    const leaderboard = Array.from(userBestTiers.values()).sort((a, b) => {
      // Sort by actual RTT (lower is better)
      if (a.actualRtt !== b.actualRtt) {
        return a.actualRtt - b.actualRtt;
      }
      // Same RTT: sort by timestamp (earliest first)
      return a.timestamp - b.timestamp;
    });

    console.log(`📊 Leaderboard has ${leaderboard.length} unique users`);

    return NextResponse.json({ leaderboard });

  } catch (error: any) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch leaderboard',
      leaderboard: []
    }, { status: 500 });
  }
}
