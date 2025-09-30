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

interface RTTResult {
  index: number;
  nonce: string;
  sentAt: number;
  receivedAt: number;
  rttMs: number;
  valid: boolean;
}

interface TestSession {
  address: string;
  startTime: number;
  challenges: Array<{
    index: number;
    nonce: string;
    timestamp: number;
    deadline: number;
  }>;
  completedChallenges: number;
  results?: RTTResult[];
  epoch: number;
  status: 'active' | 'completed' | 'expired';
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, nonce, sentAt } = await request.json();
    const receivedAt = Date.now();

    if (!sessionId || !nonce || !sentAt) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get session
    const sessionData = await kv.get(`session:${sessionId}`);
    if (!sessionData) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const session = JSON.parse(sessionData as string) as TestSession;

    // Find the challenge
    const challenge = session.challenges.find(c => c.nonce === nonce);
    if (!challenge) {
      return NextResponse.json({ error: 'Invalid nonce' }, { status: 400 });
    }

    // Calculate RTT
    const rttMs = receivedAt - sentAt;

    // Validate RTT is reasonable (sanity check)
    // Allow some grace period beyond deadline for processing time
    const isWithinGracePeriod = receivedAt <= challenge.deadline + 3000; // 3 second grace period
    const isReasonableRTT = rttMs >= 0 && rttMs < 5000; // 0-5000ms

    const result: RTTResult = {
      index: challenge.index,
      nonce: challenge.nonce,
      sentAt,
      receivedAt,
      rttMs: isReasonableRTT ? rttMs : 9999, // Use max value for unreasonable RTT
      valid: isWithinGracePeriod && isReasonableRTT
    };

    // Update session with result
    if (!session.results) {
      session.results = [];
    }

    // Check if already recorded
    const existingIndex = session.results.findIndex(r => r.nonce === nonce);
    if (existingIndex >= 0) {
      // Update existing result (take the better one)
      if (result.valid && result.rttMs < session.results[existingIndex].rttMs) {
        session.results[existingIndex] = result;
      }
    } else {
      session.results.push(result);
      session.completedChallenges = session.results.length;
    }

    // Check if test is complete
    const isComplete = session.results.length >= session.challenges.length;
    console.log(`[RTT-TEST] Progress: ${session.results.length}/${session.challenges.length} complete=${isComplete}`);
    
    if (isComplete) {
      session.status = 'completed';
      console.log(`[RTT-TEST] 🎉 Test completed! Triggering finalization for epoch ${session.epoch}, session ${sessionId}`);
      
      // Trigger epoch finalization in background (don't wait for it)
      const finalizeUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/finalize-epoch`;
      console.log(`[RTT-TEST] 📤 Calling ${finalizeUrl}`);
      
      fetch(finalizeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          epoch: session.epoch,
          sessionIds: [sessionId]
        })
      }).then(res => {
        console.log(`[RTT-TEST] 📥 Finalize response: ${res.status} ${res.statusText}`);
        if (res.ok) {
          console.log(`[RTT-TEST] ✅ Epoch ${session.epoch} finalization triggered successfully`);
        } else {
          res.text().then(text => console.error(`[RTT-TEST] ❌ Finalize failed: ${text}`));
        }
      }).catch(err => {
        console.error('[RTT-TEST] ❌ Fetch error:', err);
      });
    }

    // Update session in KV (5 minute expiry to allow for finalization)
    await kv.setex(`session:${sessionId}`, 300, JSON.stringify(session));
    await kv.setex(`session:${session.address}`, 300, JSON.stringify(session));

    return NextResponse.json({
      success: true,
      rttMs: result.rttMs,
      valid: result.valid,
      challengeIndex: challenge.index,
      completedChallenges: session.completedChallenges,
      totalChallenges: session.challenges.length,
      isComplete: isComplete
    });

  } catch (error) {
    console.error('Error processing RTT test:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET endpoint for retrieving test results
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    const sessionData = await kv.get(`session:${sessionId}`);
    if (!sessionData) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const session = JSON.parse(sessionData as string) as TestSession;

    if (!session.results || session.results.length === 0) {
      return NextResponse.json({ error: 'No results available' }, { status: 404 });
    }

    // Calculate statistics
    const validResults = session.results.filter(r => r.valid);
    const rtts = validResults.map(r => r.rttMs).sort((a, b) => a - b);

    const stats = {
      total: session.results.length,
      valid: validResults.length,
      failed: session.results.length - validResults.length,
      minRtt: rtts[0] || 0,
      maxRtt: rtts[rtts.length - 1] || 0,
      avgRtt: rtts.length > 0 ? Math.round(rtts.reduce((a, b) => a + b, 0) / rtts.length) : 0,
      medianRtt: rtts.length > 0 ? rtts[Math.floor(rtts.length / 2)] : 0,
      p95Rtt: rtts.length > 0 ? rtts[Math.floor(rtts.length * 0.95)] : 0
    };

    // Determine potential tiers (count how many samples meet each threshold)
    const tierCounts = {
      15: validResults.filter(r => r.rttMs <= 15).length,
      50: validResults.filter(r => r.rttMs <= 50).length,
      100: validResults.filter(r => r.rttMs <= 100).length
    };

    // Determine highest achievable tier (need 28 out of 32)
    let bestTier = 0;
    if (tierCounts[15] >= 28) bestTier = 15;
    else if (tierCounts[50] >= 28) bestTier = 50;
    else if (tierCounts[100] >= 28) bestTier = 100;

    return NextResponse.json({
      sessionId,
      epoch: session.epoch,
      address: session.address,
      status: session.status,
      results: session.results,
      statistics: stats,
      tierCounts,
      bestTier,
      isComplete: session.status === 'completed'
    });

  } catch (error) {
    console.error('Error getting RTT results:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}