import type { IncomingMessage } from 'node:http';
import type { CompiledRateLimitPolicy } from '../compiled-config.js';
import { MemoryRateLimitStore } from './memory-rate-limit.store.js';
import type { RateLimitStore } from './rate-limit-store.js';
import {
  buildRateLimitHeaders,
  RateLimiter,
  resolveClientKey,
} from './rate-limiter.js';

const POLICY: CompiledRateLimitPolicy = {
  enabled: true,
  rateLimitPolicyId: 'rl-1',
  limit: 2,
  windowSeconds: 60,
  keyType: 'ip',
};

function fakeRequest(
  remoteAddress: string,
  headers: Record<string, string> = {},
): IncomingMessage {
  return { socket: { remoteAddress }, headers } as unknown as IncomingMessage;
}

describe('RateLimiter', () => {
  it('allows up to the limit within a window and blocks afterwards', async () => {
    const now = 120_000 + 15_000; // 15 s into a 60 s window
    const store = new MemoryRateLimitStore(() => now);
    const limiter = new RateLimiter(store, {
      trustForwardedFor: false,
      now: () => now,
    });
    const req = fakeRequest('10.0.0.1');

    expect(await limiter.check('rule-1', POLICY, req)).toEqual({
      allowed: true,
      limit: 2,
      remaining: 1,
      resetSeconds: 45,
    });
    expect((await limiter.check('rule-1', POLICY, req))?.allowed).toBe(true);
    expect(await limiter.check('rule-1', POLICY, req)).toEqual({
      allowed: false,
      limit: 2,
      remaining: 0,
      resetSeconds: 45,
    });

    await limiter.close();
  });

  it('counts clients and path rules separately and starts fresh in the next window', async () => {
    let now = 0;
    const store = new MemoryRateLimitStore(() => now);
    const limiter = new RateLimiter(store, {
      trustForwardedFor: false,
      now: () => now,
    });

    await limiter.check('rule-1', POLICY, fakeRequest('10.0.0.1'));
    await limiter.check('rule-1', POLICY, fakeRequest('10.0.0.1'));

    expect(
      (await limiter.check('rule-1', POLICY, fakeRequest('10.0.0.2')))?.allowed,
    ).toBe(true);
    expect(
      (await limiter.check('rule-2', POLICY, fakeRequest('10.0.0.1')))?.allowed,
    ).toBe(true);
    expect(
      (await limiter.check('rule-1', POLICY, fakeRequest('10.0.0.1')))?.allowed,
    ).toBe(false);

    now = 60_000;
    expect(
      (await limiter.check('rule-1', POLICY, fakeRequest('10.0.0.1')))?.allowed,
    ).toBe(true);

    await limiter.close();
  });

  it('returns null for a disabled policy without touching the store', async () => {
    const store: RateLimitStore = {
      increment: vi.fn(),
      close: vi.fn(),
    };
    const limiter = new RateLimiter(store, { trustForwardedFor: false });

    expect(
      await limiter.check(
        'rule-1',
        { ...POLICY, enabled: false, rateLimitPolicyId: null },
        fakeRequest('10.0.0.1'),
      ),
    ).toBeNull();
    expect(store.increment).not.toHaveBeenCalled();
  });

  it('fails open when the store throws', async () => {
    const store: RateLimitStore = {
      increment: vi.fn().mockRejectedValue(new Error('down')),
      close: vi.fn(),
    };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const limiter = new RateLimiter(store, { trustForwardedFor: false });

    expect(
      await limiter.check('rule-1', POLICY, fakeRequest('10.0.0.1')),
    ).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('fails open when the store is too slow', async () => {
    const store: RateLimitStore = {
      increment: () => new Promise(() => {}),
      close: vi.fn(),
    };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const limiter = new RateLimiter(store, {
      trustForwardedFor: false,
      storeTimeoutMs: 10,
    });

    expect(
      await limiter.check('rule-1', POLICY, fakeRequest('10.0.0.1')),
    ).toBeNull();
    errorSpy.mockRestore();
  });

  it('passes the remaining window time as ttl', async () => {
    const store: RateLimitStore = {
      increment: vi.fn().mockResolvedValue(1),
      close: vi.fn(),
    };
    const limiter = new RateLimiter(store, {
      trustForwardedFor: false,
      now: () => 70_000,
    });

    await limiter.check('rule-1', POLICY, fakeRequest('10.0.0.1'));

    expect(store.increment).toHaveBeenCalledWith(
      'rule-1:rl-1:ip:10.0.0.1:1',
      50_000,
    );
  });
});

describe('resolveClientKey', () => {
  it('uses the socket address and strips the IPv4-mapped prefix', () => {
    expect(resolveClientKey('ip', fakeRequest('::ffff:10.0.0.1'), false)).toBe(
      '10.0.0.1',
    );
  });

  it('ignores X-Forwarded-For unless it is trusted', () => {
    const req = fakeRequest('10.0.0.1', {
      'x-forwarded-for': '203.0.113.7, 10.0.0.1',
    });

    expect(resolveClientKey('ip', req, false)).toBe('10.0.0.1');
    expect(resolveClientKey('ip', req, true)).toBe('203.0.113.7');
  });
});

describe('buildRateLimitHeaders', () => {
  it('adds Retry-After only for blocked requests', () => {
    expect(
      buildRateLimitHeaders({
        allowed: true,
        limit: 10,
        remaining: 3,
        resetSeconds: 20,
      }),
    ).toEqual({
      'ratelimit-limit': '10',
      'ratelimit-remaining': '3',
      'ratelimit-reset': '20',
    });
    expect(
      buildRateLimitHeaders({
        allowed: false,
        limit: 10,
        remaining: 0,
        resetSeconds: 20,
      })['retry-after'],
    ).toBe('20');
  });
});
