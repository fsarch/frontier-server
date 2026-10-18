import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as yaml from 'js-yaml';
import { FunctionConfigs } from './function-client.js';
import {
  DEFAULT_RATE_LIMIT_CONFIG,
  type RateLimitConfig,
  type RateLimitStoreConfig,
} from './rate-limit/rate-limit-store.js';

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_CONFIG_PATH = join(__dirname, '..', '..', 'config', 'config.yml');

export type WorkerConfig = {
  function_worker?: {
    type: 'remote';
    url: string;
    auth: {
      type: 'openid-client-credentials';
      token_endpoint: string;
      client_id: string;
      client_secret: string;
    };
  };
  rate_limit?: {
    trust_forwarded_for?: boolean;
    store?: RateLimitStoreConfig;
  };
};

export type LoadedWorkerConfig = {
  functionConfigs: FunctionConfigs;
  rateLimit: RateLimitConfig;
};

export async function loadWorkerConfig(
  configPath?: string,
): Promise<LoadedWorkerConfig> {
  const path = configPath ?? DEFAULT_CONFIG_PATH;

  let config: WorkerConfig;
  try {
    const fileContent = await readFile(path, 'utf-8');
    config = (yaml.load(fileContent) as WorkerConfig) ?? {};
  } catch (error) {
    console.warn(
      `[worker][config] failed to load config from ${path}: ${error}`,
    );
    // Standardwerte zurückgeben
    return { functionConfigs: {}, rateLimit: DEFAULT_RATE_LIMIT_CONFIG };
  }

  const functionConfigs: FunctionConfigs = {
    function_worker: config.function_worker
      ? {
          type: config.function_worker.type,
          url: config.function_worker.url,
          auth: {
            type: config.function_worker.auth.type,
            token_endpoint: config.function_worker.auth.token_endpoint,
            client_id: config.function_worker.auth.client_id,
            client_secret: config.function_worker.auth.client_secret,
          },
        }
      : undefined,
  };

  // Not inside the try above on purpose: an invalid rate_limit section must fail startup instead
  // of silently falling back to the in-memory store.
  return {
    functionConfigs,
    rateLimit: parseRateLimitConfig(config.rate_limit),
  };
}

export function parseRateLimitConfig(
  config: WorkerConfig['rate_limit'],
): RateLimitConfig {
  const store = config?.store ?? DEFAULT_RATE_LIMIT_CONFIG.store;

  if (!['memory', 'redis', 'postgres'].includes(store.type)) {
    throw new Error(
      `rate_limit.store.type must be one of memory, redis, postgres (got: ${store.type})`,
    );
  }

  if (store.type === 'redis' && !store.url) {
    throw new Error('rate_limit.store.url is required for type redis');
  }

  if (store.type === 'postgres' && (!store.host || !store.database)) {
    throw new Error(
      'rate_limit.store.host and rate_limit.store.database are required for type postgres',
    );
  }

  return {
    trust_forwarded_for: config?.trust_forwarded_for === true,
    store,
  };
}
