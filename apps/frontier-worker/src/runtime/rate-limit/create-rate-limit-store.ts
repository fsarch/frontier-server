import { MemoryRateLimitStore } from './memory-rate-limit.store.js';
import { PostgresRateLimitStore } from './postgres-rate-limit.store.js';
import type {
  RateLimitStore,
  RateLimitStoreConfig,
} from './rate-limit-store.js';
import { RedisRateLimitStore } from './redis-rate-limit.store.js';

export function createRateLimitStore(
  config: RateLimitStoreConfig,
): RateLimitStore {
  switch (config.type) {
    case 'memory':
      return new MemoryRateLimitStore();
    case 'redis':
      return new RedisRateLimitStore(config);
    case 'postgres':
      return new PostgresRateLimitStore(config);
    default:
      throw new Error(
        `unknown rate limit store type: ${(config as { type: string }).type}`,
      );
  }
}
