import { PostgresRateLimitStore } from './postgres-rate-limit.store.js';

const CONFIG = {
  type: 'postgres' as const,
  host: 'localhost',
  username: 'u',
  password: 'p',
  database: 'd',
};

function createPool() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [{ count: '4' }] }),
    end: vi.fn(),
    on: vi.fn(),
  };
}

describe('PostgresRateLimitStore', () => {
  it('creates the table once and upserts the counter', async () => {
    const pool = createPool();
    const store = new PostgresRateLimitStore(CONFIG, pool as never);

    expect(await store.increment('k', 1_000)).toBe(4);
    await store.increment('k', 1_000);

    const statements = pool.query.mock.calls.map(([sql]) => sql as string);
    expect(
      statements.filter((sql) => sql.includes('CREATE TABLE IF NOT EXISTS')),
    ).toHaveLength(1);
    expect(statements[1]).toContain('ON CONFLICT (key) DO UPDATE');
    expect(statements[1]).toContain('frontier_rate_limit_counter');
    expect(pool.query.mock.calls[1][1][0]).toBe('k');

    await store.close();
  });

  it('retries table creation after a failure', async () => {
    const pool = createPool();
    pool.query.mockRejectedValueOnce(new Error('connection refused'));
    const store = new PostgresRateLimitStore(CONFIG, pool as never);

    await expect(store.increment('k', 1_000)).rejects.toThrow(
      'connection refused',
    );
    expect(await store.increment('k', 1_000)).toBe(4);

    await store.close();
  });

  it('rejects unsafe table names', () => {
    expect(
      () =>
        new PostgresRateLimitStore(
          { ...CONFIG, table: 'x; DROP TABLE y' },
          createPool() as never,
        ),
    ).toThrow('invalid rate limit table name');
  });
});
