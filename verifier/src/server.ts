import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { PoseidonMerkleTree, RTTSample, generateNonce, type MerkleProof } from './merkle.js';
import { submitRoot } from './submitRoot.js';

const fastify = Fastify({ logger: true });

interface Challenge {
  idx: number;
  nonce: bigint;
  timestamp: number;
  ttl: number; // milliseconds
}

interface SessionData {
  address: string;
  challenges: Challenge[];
  samples: RTTSample[];
  startTime: number;
  completed: boolean;
  epochId: number;
}

// In-memory session storage (use Redis in production)
const sessions = new Map<string, SessionData>();
const epochs = new Map<number, { root: bigint; proofs: MerkleProof[] }>();

let currentEpoch = Math.floor(Date.now() / (5 * 60 * 1000)); // 5-minute epochs

const TOTAL_CHALLENGES = 32;
const CHALLENGE_TTL = 1500; // 1.5 seconds
const MAX_RTT = 5000; // 5 seconds max RTT

await fastify.register(cors, {
  origin: true,
  credentials: true,
});

await fastify.register(websocket);

// WebSocket endpoint for RTT challenges
fastify.register(async function (fastify) {
  fastify.get('/session/:address', { websocket: true }, (connection, request) => {
    const address = (request.params as { address: string }).address;

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      connection.socket.close(1008, 'Invalid address');
      return;
    }

    fastify.log.info(`Starting session for address: ${address}`);

    const sessionId = `${address}_${Date.now()}`;
    const sessionData: SessionData = {
      address,
      challenges: [],
      samples: [],
      startTime: Date.now(),
      completed: false,
      epochId: currentEpoch,
    };

    sessions.set(sessionId, sessionData);

    connection.socket.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        handleMessage(sessionId, data, connection);
      } catch (error) {
        fastify.log.error('Error parsing message:', error);
        connection.socket.send(JSON.stringify({
          type: 'error',
          error: 'Invalid message format'
        }));
      }
    });

    connection.socket.on('close', () => {
      fastify.log.info(`Session closed: ${sessionId}`);
      if (!sessionData.completed && sessionData.challenges.length > 0) {
        // Complete session with current samples
        completeSession(sessionId);
      }
      sessions.delete(sessionId);
    });

    // Start sending challenges
    startChallengeSequence(sessionId, connection);
  });
});

function handleMessage(sessionId: string, data: any, connection: any) {
  const session = sessions.get(sessionId);
  if (!session) return;

  if (data.type === 'echo' && typeof data.idx === 'number' && typeof data.nonce === 'string') {
    const challenge = session.challenges.find(c =>
      c.idx === data.idx && c.nonce.toString() === data.nonce
    );

    if (challenge) {
      const now = Date.now();
      const rtt = now - challenge.timestamp;
      const isValid = rtt <= challenge.ttl;

      const sample: RTTSample = {
        idx: challenge.idx,
        nonce: challenge.nonce,
        rttMs: isValid ? rtt : MAX_RTT,
        timestamp: challenge.timestamp,
      };

      session.samples.push(sample);

      connection.socket.send(JSON.stringify({
        type: 'result',
        idx: challenge.idx,
        rtt: sample.rttMs,
        valid: isValid
      }));

      // Check if all challenges completed
      if (session.samples.length === TOTAL_CHALLENGES) {
        completeSession(sessionId);
      }
    }
  }
}

async function startChallengeSequence(sessionId: string, connection: any) {
  const session = sessions.get(sessionId);
  if (!session) return;

  for (let i = 0; i < TOTAL_CHALLENGES; i++) {
    const challenge: Challenge = {
      idx: i,
      nonce: generateNonce(),
      timestamp: Date.now(),
      ttl: CHALLENGE_TTL,
    };

    session.challenges.push(challenge);

    connection.socket.send(JSON.stringify({
      type: 'challenge',
      idx: challenge.idx,
      nonce: challenge.nonce.toString(),
      ttl: challenge.ttl,
    }));

    // Wait with jitter
    const delay = 1000 + Math.random() * 400 - 200; // 800-1200ms
    await new Promise(resolve => setTimeout(resolve, delay));

    // Check if session still exists
    if (!sessions.has(sessionId)) break;
  }

  // Wait a bit more for any pending responses
  setTimeout(() => {
    if (sessions.has(sessionId)) {
      completeSession(sessionId);
    }
  }, 3000);
}

async function completeSession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session || session.completed) return;

  session.completed = true;

  try {
    // Build Merkle tree
    const tree = new PoseidonMerkleTree(16);

    // Add all samples (fill missing ones with max RTT)
    for (let i = 0; i < TOTAL_CHALLENGES; i++) {
      let sample = session.samples.find(s => s.idx === i);
      if (!sample) {
        // Missing sample - add with max RTT
        sample = {
          idx: i,
          nonce: generateNonce(),
          rttMs: MAX_RTT,
          timestamp: Date.now(),
        };
      }
      tree.addSample(sample);
    }

    const root = tree.buildTree();
    const proofs = tree.getAllProofs();

    // Store epoch data
    epochs.set(session.epochId, { root, proofs });

    fastify.log.info(`Session completed: ${sessionId}, Root: ${root.toString(16)}`);

    // Submit root to blockchain (in background)
    submitRoot(session.epochId, root).catch(error => {
      fastify.log.error('Failed to submit root:', error);
    });

    // Notify client
    const connection = sessions.get(sessionId);
    if (connection) {
      // Send completion status with stats
      const validSamples = session.samples.filter(s => s.rttMs < MAX_RTT).length;
      const avgRtt = validSamples > 0
        ? session.samples.filter(s => s.rttMs < MAX_RTT).reduce((sum, s) => sum + s.rttMs, 0) / validSamples
        : MAX_RTT;

      // Calculate tier eligibility
      const tier75 = session.samples.filter(s => s.rttMs <= 75).length >= 28;
      const tier150 = session.samples.filter(s => s.rttMs <= 150).length >= 28;
      const tier300 = session.samples.filter(s => s.rttMs <= 300).length >= 28;

      // Send final results - Note: In a real WebSocket, we'd need to access the connection differently
      // This is simplified for the demo structure
    }

  } catch (error) {
    fastify.log.error('Error completing session:', error);
  }
}

// REST endpoint to get bundle for proving
fastify.get('/bundle/:epoch', async (request, reply) => {
  const epoch = parseInt((request.params as { epoch: string }).epoch);
  const epochData = epochs.get(epoch);

  if (!epochData) {
    return reply.code(404).send({ error: 'Epoch not found' });
  }

  return {
    epoch,
    root: epochData.root.toString(),
    leaves: epochData.proofs.map(proof => ({
      idx: proof.leaf.idx,
      nonce: proof.leaf.nonce.toString(),
      rttMs: proof.leaf.rttMs,
      hash: proof.leaf.hash.toString(),
    })),
    proofs: epochData.proofs.map(proof => ({
      idx: proof.leaf.idx,
      siblings: proof.siblings.map(s => s.toString()),
      pathIndices: proof.pathIndices,
    })),
  };
});

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: Date.now(), epoch: currentEpoch };
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001');
    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(`Verifier service listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();