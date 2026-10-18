import type { IncomingMessage } from 'node:http';
import type { RateLimitKeyType } from '../../types/worker-config.types.js';
import type { CompiledRateLimitPolicy } from '../compiled-config.js';
import {
  createThrottledErrorLogger,
  type RateLimitStore,
} from './rate-limit-store.js';

const DEFAULT_STORE_TIMEOUT_MS = 250;

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the current window ends and the counter resets. */
  resetSeconds: number;
};

export type RateLimiterOptions = {
  trustForwardedFor: boolean;
  storeTimeoutMs?: number;
  now?: () => number;
};

/**
 * Fixed-window rate limiter: every policy window is a bucket `floor(now / windowMs)`, and each
 * (path rule, policy, client key, bucket) gets its own counter in the store.
 */
export class RateLimiter {
  private readonly storeTimeoutMs: number;
  private readonly now: () => number;
  private readonly logError = createThrottledErrorLogger(
    '[worker][rate-limit]',
  );

  constructor(
    private readonly store: RateLimitStore,
    private readonly options: RateLimiterOptions,
  ) {
    this.storeTimeoutMs = options.storeTimeoutMs ?? DEFAULT_STORE_TIMEOUT_MS;
    this.now = options.now ?? Date.now;
  }

  /**
   * Counts the request and decides whether it may pass. Returns null when the route has no
   * active policy, or when the store failed - rate limiting fails open so an unavailable store
   * never takes the gateway down with it.
   */
  public async check(
    pathRuleId: string,
    policy: CompiledRateLimitPolicy,
    req: IncomingMessage,
  ): Promise<RateLimitDecision | null> {
    if (!policy.enabled || !policy.rateLimitPolicyId) {
      return null;
    }

    const clientKey = resolveClientKey(
      policy.keyType,
      req,
      this.options.trustForwardedFor,
    );
    const windowMs = policy.windowSeconds * 1000;
    const now = this.now();
    const windowIndex = Math.floor(now / windowMs);
    const windowEndsAt = (windowIndex + 1) * windowMs;
    const key = `${pathRuleId}:${policy.rateLimitPolicyId}:${policy.keyType}:${clientKey}:${windowIndex}`;

    let count: number;
    try {
      count = await withTimeout(
        this.store.increment(key, windowEndsAt - now),
        this.storeTimeoutMs,
      );
    } catch (error) {
      this.logError('store unavailable, letting request through', error);
      return null;
    }

    return {
      allowed: count <= policy.limit,
      limit: policy.limit,
      remaining: Math.max(0, policy.limit - count),
      resetSeconds: Math.max(1, Math.ceil((windowEndsAt - now) / 1000)),
    };
  }

  public async close(): Promise<void> {
    await this.store.close();
  }
}

/**
 * Derives the identity a request is counted under. Only `ip` exists today; further key types
 * (e.g. a header value or a global counter per rule) plug in here.
 */
export function resolveClientKey(
  keyType: RateLimitKeyType,
  req: IncomingMessage,
  trustForwardedFor: boolean,
): string {
  switch (keyType) {
    case 'ip':
      return resolveClientIp(req, trustForwardedFor);
    default:
      return resolveClientIp(req, trustForwardedFor);
  }
}

function resolveClientIp(
  req: IncomingMessage,
  trustForwardedFor: boolean,
): string {
  if (trustForwardedFor) {
    const forwardedFor = req.headers['x-forwarded-for'];
    const value = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    const first = value?.split(',')[0]?.trim();
    if (first) {
      return normalizeIp(first);
    }
  }

  return normalizeIp(req.socket?.remoteAddress ?? 'unknown');
}

function normalizeIp(ip: string): string {
  // Node reports IPv4 clients on dual-stack sockets as IPv4-mapped IPv6 (::ffff:1.2.3.4).
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

export function buildRateLimitHeaders(
  decision: RateLimitDecision,
): Record<string, string> {
  const headers: Record<string, string> = {
    'ratelimit-limit': String(decision.limit),
    'ratelimit-remaining': String(decision.remaining),
    'ratelimit-reset': String(decision.resetSeconds),
  };

  if (!decision.allowed) {
    headers['retry-after'] = String(decision.resetSeconds);
  }

  return headers;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(new Error(`rate limit store timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
