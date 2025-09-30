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

interface RTTChallenge {
  index: number;
  nonce: string;
  timestamp: number;
  deadline: number;
}

interface TestSession {
  address: string;
  startTime: number;
  challenges: RTTChallenge[];
  completedChallenges: number;
  results?: Array<{ nonce: string; [key: string]: any }>;
  epoch: number;
  status: 'active' | 'completed' | 'expired';
}

const CHALLENGE_COUNT = 32;
const CHALLENGE_INTERVAL = 1400; // ~1.4 seconds between challenges
const CHALLENGE_TTL = 1500; // 1.5 second deadline for each challenge

export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json();

    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
    }

    // Rate limiting: Check if user has active session
    const existingSession = await kv.get(`session:${address.toLowerCase()}`);
    if (existingSession) {
      return NextResponse.json({ error: 'Active session already exists' }, { status: 429 });
    }

    // Generate session
    const sessionId = crypto.randomUUID();
    const currentTime = Date.now();
    const currentEpoch = Math.floor(currentTime / (5 * 60 * 1000)); // 5-minute epochs

    // Pre-generate all challenges for consistent timing
    const challenges: RTTChallenge[] = [];
    for (let i = 0; i < CHALLENGE_COUNT; i++) {
      const nonce = crypto.randomUUID().replace(/-/g, '');
      const challengeTime = currentTime + (i * CHALLENGE_INTERVAL);
      challenges.push({
        index: i,
        nonce,
        timestamp: challengeTime,
        deadline: challengeTime + CHALLENGE_TTL
      });
    }

    const session: TestSession = {
      address: address.toLowerCase(),
      startTime: currentTime,
      challenges,
      completedChallenges: 0,
      epoch: currentEpoch,
      status: 'active'
    };

    // Store session with 5-minute expiry (to allow for finalization after test completion)
    await kv.setex(`session:${address.toLowerCase()}`, 300, JSON.stringify(session));
    await kv.setex(`session:${sessionId}`, 300, JSON.stringify(session));

    return NextResponse.json({
      sessionId,
      epoch: currentEpoch,
      challengeCount: CHALLENGE_COUNT,
      estimatedDuration: (CHALLENGE_COUNT * CHALLENGE_INTERVAL) + CHALLENGE_TTL,
      firstChallengeAt: challenges[0].timestamp
    });

  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET endpoint for session status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const address = searchParams.get('address');

    if (!sessionId && !address) {
      return NextResponse.json({ error: 'Missing sessionId or address' }, { status: 400 });
    }

    const key = sessionId ? `session:${sessionId}` : `session:${address?.toLowerCase()}`;
    const sessionData = await kv.get(key);

    if (!sessionData) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const session = JSON.parse(sessionData as string) as TestSession;
    const currentTime = Date.now();

    // Update session status based on timing
    if (currentTime > session.startTime + (CHALLENGE_COUNT * CHALLENGE_INTERVAL) + CHALLENGE_TTL) {
      session.status = 'completed';
    }

    // Get current challenge (first uncompleted challenge that has started)
    const completedNonces = new Set(session.results?.map(r => r.nonce) || []);
    const currentChallenge = session.challenges.find(c =>
      currentTime >= c.timestamp && !completedNonces.has(c.nonce)
    );

    return NextResponse.json({
      status: session.status,
      completedChallenges: session.completedChallenges,
      totalChallenges: CHALLENGE_COUNT,
      currentChallenge,
      nextChallengeAt: session.challenges.find(c => c.timestamp > currentTime)?.timestamp,
      epoch: session.epoch
    });

  } catch (error) {
    console.error('Error getting session status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}