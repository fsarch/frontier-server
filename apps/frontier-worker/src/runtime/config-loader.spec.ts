import { parseRateLimitConfig } from './config-loader.js';

describe('parseRateLimitConfig', () => {
  it('defaults to the memory store without trusting X-Forwarded-For', () => {
    expect(parseRateLimitConfig(undefined)).toEqual({
      trust_forwarded_for: false,
      store: { type: 'memory' },
    });
  });

  it('accepts a redis store', () => {
    expect(
      parseRateLimitConfig({
        trust_forwarded_for: true,
        store: { type: 'redis', url: 'redis://localhost:6379' },
      }),
    ).toEqual({
      trust_forwarded_for: true,
      store: { type: 'redis', url: 'redis://localhost:6379' },
    });
  });

  it('rejects unknown store types and incomplete store configs', () => {
    expect(() =>
      parseRateLimitConfig({ store: { type: 'mongo' } as never }),
    ).toThrow('rate_limit.store.type');
    expect(() =>
      parseRateLimitConfig({ store: { type: 'redis' } as never }),
    ).toThrow('rate_limit.store.url');
    expect(() =>
      parseRateLimitConfig({ store: { type: 'postgres' } as never }),
    ).toThrow('rate_limit.store.host');
  });
});
