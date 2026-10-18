import { readFileSync } from 'node:fs';
import pg from 'pg';
import type {
  PostgresRateLimitStoreConfig,
  RateLimitStore,
} from './rate-limit-store.js';

const DEFAULT_TABLE = 'frontier_rate_limit_counter';
const TABLE_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

type PgPool = Pick<pg.Pool, 'query' | 'end' | 'on'>;

/**
 * Counter store backed by Postgres/CockroachDB. Uses its own connection (not frontier-api's
 * database) and creates its table on first use.
 */
export class PostgresRateLimitStore implements RateLimitStore {
  private readonly pool: PgPool;
  private readonly table: string;
  private readonly cleanupTimer: NodeJS.Timeout;
  private ready: Promise<void> | null = null;

  constructor(
    config: PostgresRateLimitStoreConfig,
    pool?: PgPool,
    cleanupIntervalMs = 60_000,
  ) {
    this.table = config.table ?? DEFAULT_TABLE;
    if (!TABLE_NAME_PATTERN.test(this.table)) {
      throw new Error(`invalid rate limit table name: ${this.table}`);
    }

    this.pool = pool ?? new pg.Pool(buildPoolConfig(config));
    this.pool.on('error', (error) => {
      console.error('[worker][rate-limit][postgres] idle client error', error);
    });

    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch((error) => {
        console.error('[worker][rate-limit][postgres] cleanup failed', error);
      });
    }, cleanupIntervalMs);
    this.cleanupTimer.unref();
  }

  public async increment(key: string, ttlMs: number): Promise<number> {
    await this.ensureTable();

    const result = await this.pool.query<{ count: string }>(
      `INSERT INTO ${this.table} (key, count, expires_at) VALUES ($1, 1, $2)
       ON CONFLICT (key) DO UPDATE SET count = ${this.table}.count + 1
       RETURNING count`,
      [key, new Date(Date.now() + ttlMs)],
    );

    return Number(result.rows[0].count);
  }

  public async cleanup(): Promise<void> {
    await this.ensureTable();
    await this.pool.query(`DELETE FROM ${this.table} WHERE expires_at < $1`, [
      new Date(),
    ]);
  }

  public async close(): Promise<void> {
    clearInterval(this.cleanupTimer);
    await this.pool.end();
  }

  private ensureTable(): Promise<void> {
    if (!this.ready) {
      this.ready = this.pool
        .query(
          `CREATE TABLE IF NOT EXISTS ${this.table} (
             key varchar(512) PRIMARY KEY,
             count bigint NOT NULL,
             expires_at timestamptz NOT NULL
           )`,
        )
        .then(() => undefined)
        .catch((error) => {
          // Retry on the next call instead of caching the failure forever.
          this.ready = null;
          throw error;
        });
    }

    return this.ready;
  }
}

function buildPoolConfig(config: PostgresRateLimitStoreConfig): pg.PoolConfig {
  return {
    host: config.host,
    port: config.port ?? 5432,
    user: config.username,
    password: config.password,
    database: config.database,
    ssl: config.ssl
      ? {
          rejectUnauthorized: config.ssl.rejectUnauthorized ?? true,
          ca: config.ssl.ca?.path
            ? readFileSync(config.ssl.ca.path, 'utf-8')
            : undefined,
        }
      : undefined,
    connectionTimeoutMillis: 2_000,
  };
}
