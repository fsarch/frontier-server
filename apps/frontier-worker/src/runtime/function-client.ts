import { request as httpRequest } from 'undici';
import { CompiledHookFunction, CompiledHooks } from './compiled-config.js';

// Typ für Hook-Konfiguration
export type HookConfig = {
  name: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  timeout_ms: number;
};

// Typ für die Function-Server-Konfiguration aus der config.yml
export type FunctionServerConfig = {
  type: 'remote';
  url: string;
  auth: {
    type: 'openid-client-credentials';
    token_endpoint: string;
    client_id: string;
    client_secret: string;
  };
  hooks?: HookConfig[];
};

export type FunctionConfigs = {
  function_worker?: FunctionServerConfig;
};

// Cache für Access Tokens (einfache Implementierung)
type TokenCache = {
  [functionName: string]: {
    token: string;
    expiresAt: number;
  };
};

const tokenCache: TokenCache = {};
const TOKEN_REFRESH_MS = 5 * 60 * 1000; // 5 Minuten vor Ablauf

export class FunctionClient {
  private readonly configs: FunctionConfigs;
  private readonly debugEnabled: boolean;

  constructor(configs: FunctionConfigs) {
    this.configs = configs;
    this.debugEnabled = isDebugEnabled(process.env.FRONTIER_WORKER_DEBUG);
  }

  public async executeHook(
    hook: CompiledHookFunction,
    requestData: {
      method: string;
      url: string;
      headers: Record<string, string>;
      body?: unknown;
    },
  ): Promise<{ statusCode: number; headers: Record<string, string>; body: unknown }> {
    const functionConfig = this.getFunctionConfig(hook.functionServerName);

    if (!functionConfig) {
      this.debug(`hook execution failed: function server '${hook.functionServerName}' not found in config`);
      throw new Error(`Function server '${hook.functionServerName}' not configured`);
    }

    // Token abrufen
    const accessToken = await this.getAccessToken(functionConfig);

    // Hook-URL zusammenbauen
    const hookUrl = `${functionConfig.url}${hook.path}`;

    // Request-Optionen
    const options = {
      method: hook.method,
      headers: {
        ...requestData.headers,
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        // Original Request-Daten
        originalRequest: {
          method: requestData.method,
          url: requestData.url,
          headers: requestData.headers,
          body: requestData.body,
        },
        // Hook-spezifische Daten
        hook: {
          name: hook.name,
          type: 'pre', // oder 'post' - wird vom Aufrufer gesetzt
        },
      }),
    };

    this.debug(`executing hook: functionServer=${hook.functionServerName} url=${hookUrl} method=${hook.method}`);

    // Timeout setzen
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), hook.timeoutMs);

    try {
      const response = await httpRequest(hookUrl, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Response parsen
      let responseBody: unknown;
      try {
        responseBody = await response.body.json();
      } catch {
        responseBody = await response.body.text();
      }

      this.debug(`hook executed: functionServer=${hook.functionServerName} status=${response.statusCode}`);

      return {
        statusCode: response.statusCode,
        headers: response.headers as Record<string, string>,
        body: responseBody,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  public async executePreHooks(
    hooks: CompiledHooks,
    requestData: {
      method: string;
      url: string;
      headers: Record<string, string>;
      body?: unknown;
    },
  ): Promise<{
    modifiedRequest: {
      method: string;
      url: string;
      headers: Record<string, string>;
      body?: unknown;
    };
    shortCircuitResponse?: { statusCode: number; headers: Record<string, string>; body: unknown };
  }> {
    if (!hooks.enabled || hooks.functions.length === 0) {
      return { modifiedRequest: requestData };
    }

    let currentRequest = { ...requestData };

    for (const hook of hooks.functions) {
      try {
        const result = await this.executeHook(hook, currentRequest);

        // Wenn der Hook eine Response zurückgibt, die direkt an den Client gesendet werden soll
        // (z. B. für Validierungsfehler)
        if (result.statusCode !== 200 || (typeof result.body === 'object' && result.body !== null && 'shortCircuit' in result.body && (result.body as { shortCircuit?: boolean }).shortCircuit === true)) {
          this.debug(`pre-hook short-circuit: functionServer=${hook.functionServerName} status=${result.statusCode}`);
          return {
            modifiedRequest: currentRequest,
            shortCircuitResponse: {
              statusCode: result.statusCode,
              headers: result.headers,
              body: result.body,
            },
          };
        }

        // Request modifizieren basierend auf dem Hook-Ergebnis
        if (result.body && typeof result.body === 'object' && 'modifiedRequest' in result.body) {
          const modifiedRequestObj = result.body as { modifiedRequest: { method?: string; url?: string; headers?: Record<string, string>; body?: unknown } };
          const modified = modifiedRequestObj.modifiedRequest;
          currentRequest = {
            method: modified.method || currentRequest.method,
            url: modified.url || currentRequest.url,
            headers: { ...currentRequest.headers, ...(modified.headers || {}) },
            body: modified.body !== undefined ? modified.body : currentRequest.body,
          };
        }
      } catch (error) {
        this.debug(`pre-hook execution failed: functionServer=${hook.functionServerName}`, error);
        // Bei Fehlern im Pre-Hook: Fehlermeldung als Response zurückgeben
        return {
          modifiedRequest: currentRequest,
          shortCircuitResponse: {
            statusCode: 500,
            headers: { 'content-type': 'application/json' },
            body: { error: `Pre-hook execution failed: ${error instanceof Error ? error.message : String(error)}` },
          },
        };
      }
    }

    return { modifiedRequest: currentRequest };
  }

  public async executePostHooks(
    hooks: CompiledHooks,
    requestData: {
      method: string;
      url: string;
      headers: Record<string, string>;
      body?: unknown;
    },
    upstreamResponse: {
      statusCode: number;
      headers: Record<string, string>;
      body: unknown;
    },
  ): Promise<{ statusCode: number; headers: Record<string, string>; body: unknown }> {
    if (!hooks.enabled || hooks.functions.length === 0) {
      return upstreamResponse;
    }

    let currentResponse = { ...upstreamResponse };

    for (const hook of hooks.functions) {
      try {
        // Füge Response-Daten zum Hook-Request hinzu
        const result = await this.executeHook(hook, {
          ...requestData,
          body: {
            ...(typeof requestData.body === 'object' ? requestData.body : {}),
            upstreamResponse: {
              statusCode: upstreamResponse.statusCode,
              headers: upstreamResponse.headers,
              body: upstreamResponse.body,
            },
          },
        });

        // Response modifizieren basierend auf dem Hook-Ergebnis
        if (result.body && typeof result.body === 'object' && 'modifiedResponse' in result.body) {
          const modifiedResponseObj = result.body as { modifiedResponse: { statusCode?: number; headers?: Record<string, string>; body?: unknown } };
          const modified = modifiedResponseObj.modifiedResponse;
          currentResponse = {
            statusCode: modified.statusCode || currentResponse.statusCode,
            headers: { ...currentResponse.headers, ...(modified.headers || {}) },
            body: modified.body !== undefined ? modified.body : currentResponse.body,
          };
        }
      } catch (error) {
        this.debug(`post-hook execution failed: functionServer=${hook.functionServerName}`, error);
        // Bei Fehlern im Post-Hook: Original-Response zurückgeben (kein Short-Circuit)
        console.error('[worker][hooks] post-hook execution failed:', error);
      }
    }

    return currentResponse;
  }

  private getFunctionConfig(name: string): FunctionServerConfig | undefined {
    // Suche in den konfigurierten Function-Servern
    if (this.configs.function_worker?.auth?.client_id && name === 'function_worker') {
      return this.configs.function_worker;
    }

    // Falls der Name direkt in der Config ist
    return (this.configs as Record<string, FunctionServerConfig>)[name];
  }

  private getHookConfig(functionConfig: FunctionServerConfig | undefined, hookName: string): HookConfig | undefined {
    if (!functionConfig?.hooks) {
      return undefined;
    }
    return functionConfig.hooks.find(hook => hook.name === hookName);
  }

  private async getAccessToken(config: FunctionServerConfig): Promise<string> {
    const cacheKey = config.auth.client_id;
    const cached = tokenCache[cacheKey];

    // Gecachten Token zurückgeben, wenn noch gültig
    if (cached && cached.expiresAt > Date.now() + TOKEN_REFRESH_MS) {
      this.debug(`using cached token for client=${cacheKey}`);
      return cached.token;
    }

    // Neues Token abrufen
    this.debug(`fetching new token for client=${cacheKey} from ${config.auth.token_endpoint}`);

    const tokenResponse = await httpRequest(config.auth.token_endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.auth.client_id,
        client_secret: config.auth.client_secret,
      }).toString(),
    });

    if (tokenResponse.statusCode !== 200) {
      throw new Error(`Failed to get access token: ${tokenResponse.statusCode}`);
    }

    const tokenData = await tokenResponse.body.json() as { access_token?: string; expires_in?: number };
    const accessToken = tokenData.access_token || '';
    const expiresIn = tokenData.expires_in ?? 3600; // Default: 1 Stunde
    const expiresAt = Date.now() + (expiresIn * 1000);

    // Token cachen
    tokenCache[cacheKey] = { token: accessToken, expiresAt };

    return accessToken;
  }

  private debug(message: string, error?: unknown) {
    if (!this.debugEnabled) {
      return;
    }

    if (error) {
      console.debug(`[worker][function-client] ${message}`, error);
      return;
    }

    console.debug(`[worker][function-client] ${message}`);
  }
}

function isDebugEnabled(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'debug';
}
