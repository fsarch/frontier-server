import type { RateLimitStore } from './rate-limit-store.js';

type Entry = {
  count: number;
  expiresAt: number;
};

/**
 * In-process counter store. Counts per worker instance only - with N workers behind a load
 * balancer, a client can effectively make N x limit requests per window.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly entries = new Map<string, Entry>();
  private readonly cleanupTimer: NodeJS.Timeout;

  constructor(
    private readonly now: () => number = Date.now,
    cleanupIntervalMs = 60_000,
  ) {
    this.cleanupTimer = setInterval(() => this.cleanup(), cleanupIntervalMs);
    this.cleanupTimer.unref();
  }

  public async increment(key: string, ttlMs: number): Promise<number> {
    const now = this.now();
    const entry = this.entries.get(key);

    if (!entry || entry.expiresAt <= now) {
      this.entries.set(key, { count: 1, expiresAt: now + ttlMs });
      return 1;
    }

    entry.count += 1;
    return entry.count;
  }

  public async close(): Promise<void> {
    clearInterval(this.cleanupTimer);
    this.entries.clear();
  }

  public get size(): number {
    return this.entries.size;
  }

  public cleanup() {
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
      }
    }
  }
}
