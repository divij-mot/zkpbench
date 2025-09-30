// Mock KV implementation for local testing
class MockKV {
  private store = new Map<string, { value: any; expires: number | null }>();

  async get(key: string) {
    const item = this.store.get(key);
    if (!item) return null;
    
    if (item.expires && Date.now() > item.expires) {
      this.store.delete(key);
      return null;
    }
    
    return item.value;
  }

  async setex(key: string, ttlSeconds: number, value: any) {
    const expires = Date.now() + (ttlSeconds * 1000);
    this.store.set(key, { value, expires });
    return 'OK';
  }

  async set(key: string, value: any) {
    this.store.set(key, { value, expires: null });
    return 'OK';
  }

  async del(key: string) {
    return this.store.delete(key) ? 1 : 0;
  }
}

export const kv = new MockKV();
