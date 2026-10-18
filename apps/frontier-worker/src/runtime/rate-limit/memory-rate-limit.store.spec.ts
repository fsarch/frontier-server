import { MemoryRateLimitStore } from './memory-rate-limit.store.js';

describe('MemoryRateLimitStore', () => {
  it('counts per key and resets after the ttl', async () => {
    let now = 1_000;
    const store = new MemoryRateLimitStore(() => now);

    expect(await store.increment('a', 1_000)).toBe(1);
    expect(await store.increment('a', 1_000)).toBe(2);
    expect(await store.increment('b', 1_000)).toBe(1);

    now = 2_000;
    expect(await store.increment('a', 1_000)).toBe(1);

    await store.close();
  });

  it('removes expired entries on cleanup', async () => {
    let now = 0;
    const store = new MemoryRateLimitStore(() => now);

    await store.increment('a', 100);
    await store.increment('b', 500);
    now = 200;
    store.cleanup();

    expect(store.size).toBe(1);
    await store.close();
  });
});
