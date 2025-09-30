// Redis client for Redis Cloud
import Redis from 'ioredis';

let redis: Redis | null = null;

function getRedisClient(): Redis {
  if (redis) return redis;

  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable is not set');
  }

  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    lazyConnect: true,
  });

  redis.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  redis.on('connect', () => {
    console.log('Redis Client Connected');
  });

  return redis;
}

// Vercel KV-compatible interface
export const kv = {
  async get(key: string) {
    const client = getRedisClient();
    await client.connect().catch(() => {});
    return await client.get(key);
  },

  async set(key: string, value: any) {
    const client = getRedisClient();
    await client.connect().catch(() => {});
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    return await client.set(key, serialized);
  },

  async setex(key: string, ttlSeconds: number, value: any) {
    const client = getRedisClient();
    await client.connect().catch(() => {});
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    return await client.setex(key, ttlSeconds, serialized);
  },

  async del(key: string) {
    const client = getRedisClient();
    await client.connect().catch(() => {});
    return await client.del(key);
  },

  async exists(key: string) {
    const client = getRedisClient();
    await client.connect().catch(() => {});
    return await client.exists(key);
  },

  async ttl(key: string) {
    const client = getRedisClient();
    await client.connect().catch(() => {});
    return await client.ttl(key);
  },
};

export default kv;
