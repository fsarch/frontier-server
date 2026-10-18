/**
 * Counter storage for rate limiting. A store only knows about opaque keys - window bucketing and
 * key derivation happen in RateLimiter.
 */
export interface RateLimitStore {
  /**
   * Atomically increments the counter for `key` and returns the value after the increment.
   * A key that does not exist yet starts at 1 and expires after `ttlMs`.
   */
  increment(key: string, ttlMs: number): Promise<number>;

  close(): Promise<void>;
}

export type MemoryRateLimitStoreConfig = {
  type: 'memory';
};

export type RedisRateLimitStoreConfig = {
  type: 'redis';
  url: string;
  key_prefix?: string;
};

export type PostgresRateLimitStoreConfig = {
  type: 'postgres';
  host: string;
  port?: number;
  username: string;
  password: string;
  database: string;
  ssl?: {
    rejectUnauthorized?: boolean;
    ca?: {
      path: string;
    };
  };
  table?: string;
};

export type RateLimitStoreConfig =
  | MemoryRateLimitStoreConfig
  | RedisRateLimitStoreConfig
  | PostgresRateLimitStoreConfig;

export type RateLimitConfig = {
  trust_forwarded_for: boolean;
  store: RateLimitStoreConfig;
};

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  trust_forwarded_for: false,
  store: { type: 'memory' },
};

/**
 * Logs at most once per interval so a store that is down (and fails every request) doesn't flood
 * the log.
 */
export function createThrottledErrorLogger(
  prefix: string,
  intervalMs = 30_000,
) {
  let lastLoggedAt = 0;
  let suppressed = 0;

  return (message: string, error?: unknown) => {
    const now = Date.now();
    if (now - lastLoggedAt < intervalMs) {
      suppressed += 1;
      return;
    }

    const suffix =
      suppressed > 0 ? ` (${suppressed} similar errors suppressed)` : '';
    lastLoggedAt = now;
    suppressed = 0;
    console.error(`${prefix} ${message}${suffix}`, error ?? '');
  };
}
