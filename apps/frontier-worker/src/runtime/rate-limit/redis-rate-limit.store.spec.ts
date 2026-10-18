import { RedisRateLimitStore } from './redis-rate-limit.store.js';

function createClient(execResult: unknown) {
  const transaction = {
    set: vi.fn().mockReturnThis(),
    incr: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue(execResult),
  };

  return {
    transaction,
    client: {
      multi: vi.fn(() => transaction),
      quit: vi.fn(),
      on: vi.fn(),
    },
  };
}

describe('RedisRateLimitStore', () => {
  it('creates the key with an expiry and increments it in one transaction', async () => {
    const { client, transaction } = createClient([
      [null, 'OK'],
      [null, 3],
    ]);
    const store = new RedisRateLimitStore(
      { type: 'redis', url: 'redis://unused' },
      client as never,
    );

    expect(await store.increment('rule:key', 5_000)).toBe(3);
    expect(transaction.set).toHaveBeenCalledWith(
      'frontier:rl:rule:key',
      '0',
      'PX',
      5_000,
      'NX',
    );
    expect(transaction.incr).toHaveBeenCalledWith('frontier:rl:rule:key');
  });

  it('uses a custom key prefix', async () => {
    const { client, transaction } = createClient([
      [null, null],
      [null, 1],
    ]);
    const store = new RedisRateLimitStore(
      { type: 'redis', url: 'redis://unused', key_prefix: 'x:' },
      client as never,
    );

    await store.increment('k', 1_000);
    expect(transaction.incr).toHaveBeenCalledWith('x:k');
  });

  it('throws when the increment fails', async () => {
    const { client } = createClient([
      [null, 'OK'],
      [new Error('WRONGTYPE'), null],
    ]);
    const store = new RedisRateLimitStore(
      { type: 'redis', url: 'redis://unused' },
      client as never,
    );

    await expect(store.increment('k', 1_000)).rejects.toThrow('WRONGTYPE');
  });
});
