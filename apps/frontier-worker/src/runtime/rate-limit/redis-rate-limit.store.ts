import { Redis } from 'ioredis';
import {
  createThrottledErrorLogger,
  type RateLimitStore,
  type RedisRateLimitStoreConfig,
} from './rate-limit-store.js';

const DEFAULT_KEY_PREFIX = 'frontier:rl:';

type RedisClient = Pick<Redis, 'multi' | 'quit' | 'on'>;

export class RedisRateLimitStore implements RateLimitStore {
  private readonly client: RedisClient;
  private readonly keyPrefix: string;

  constructor(config: RedisRateLimitStoreConfig, client?: RedisClient) {
    this.keyPrefix = config.key_prefix ?? DEFAULT_KEY_PREFIX;
    this.client =
      client ??
      new Redis(config.url, {
        // Fail fast instead of queueing commands while Redis is unreachable - the rate limiter
        // fails open, so a quick error is better than holding the request.
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
      });

    const logError = createThrottledErrorLogger('[worker][rate-limit][redis]');
    this.client.on('error', (error) => logError('connection error', error));
  }

  public async increment(key: string, ttlMs: number): Promise<number> {
    const redisKey = `${this.keyPrefix}${key}`;
    // SET NX only creates the key (with its expiry) if it doesn't exist yet, INCR then counts.
    // Both run in one MULTI round-trip, so the expiry is always set exactly once per window.
    const results = await this.client
      .multi()
      .set(redisKey, '0', 'PX', ttlMs, 'NX')
      .incr(redisKey)
      .exec();

    if (!results) {
      throw new Error('redis transaction was aborted');
    }

    const [, incrResult] = results;
    const [error, value] = incrResult;
    if (error) {
      throw error;
    }

    return Number(value);
  }

  public async close(): Promise<void> {
    await this.client.quit();
  }
}
