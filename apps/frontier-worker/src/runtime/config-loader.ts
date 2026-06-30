import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { FunctionConfigs } from './function-client.js';

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
};

export async function loadWorkerConfig(configPath?: string): Promise<FunctionConfigs> {
  const path = configPath ?? DEFAULT_CONFIG_PATH;

  try {
    const fileContent = await readFile(path, 'utf-8');
    const config = yaml.load(fileContent) as WorkerConfig;

    return {
      function_worker: config.function_worker ? {
        type: config.function_worker.type,
        url: config.function_worker.url,
        auth: {
          type: config.function_worker.auth.type,
          token_endpoint: config.function_worker.auth.token_endpoint,
          client_id: config.function_worker.auth.client_id,
          client_secret: config.function_worker.auth.client_secret,
        },
      } : undefined,
    };
  } catch (error) {
    console.warn(`[worker][config] failed to load config from ${path}: ${error}`);
    // Standardwerte zurückgeben
    return {};
  }
}
