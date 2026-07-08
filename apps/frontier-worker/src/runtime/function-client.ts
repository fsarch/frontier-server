import { STATUS_CODES } from 'http';
import { request as httpRequest } from 'undici';
import type { PostHookType } from '../types/hooks/post-hook.type.js';
import type { PreHookType } from '../types/hooks/pre-hook.type.js';
import type { RequestType } from '../types/http/request.type.js';
import type { ResponseType } from '../types/http/response.type.js';
import { BodyUtils } from '../utils/http/body.utils.js';
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
    hookPayload: PreHookType | PostHookType,
  ): Promise<{ statusCode: number; headers: Record<string, string>; body: unknown }> {
    const functionConfig = this.getFunctionConfig();
    if (!functionConfig) {
      throw new Error(`Function server not configured`);
    }

    // Token abrufen
    const accessToken = await this.getAccessToken(functionConfig);

    // Hook-URL zusammenbauen
    const hookUrl = `${functionConfig.url}/v1/functions/${hook.functionId}/executions`;

    const options = {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        arguments: [hookPayload],
      }),
    };

    this.debug(`executing hook: id=${hook.id} url=${hookUrl}`);

    // Timeout setzen
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5_000);

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

      this.debug(`hook executed: id=${hook.id} status=${response.statusCode}`);

      return {
        statusCode: response.statusCode,
        headers: response.headers as Record<string, string>,
        body: responseBody,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[worker][function-client] hook request failed: id=${hook.id} hook=${hook.name} url=${hookUrl} error=${errorMessage}`);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  public async executePreHooks(
    hooks: CompiledHooks,
    clientRequestData: RequestType,
    upstreamRequestData: RequestType,
  ): Promise<{
    modifiedRequest: RequestType;
    shortCircuitResponse?: ResponseType;
  }> {
    if (!hooks.enabled || hooks.functions.length === 0) {
      return { modifiedRequest: upstreamRequestData };
    }

    let currentRequest = { ...upstreamRequestData };

    for (const hook of hooks.functions) {
      try {
        const result = await this.executeHook(
          hook,
          this.buildPreHookPayload(hook, clientRequestData, currentRequest),
        );

        if (result.statusCode !== 201) {
          this.debug(`pre-hook unexpected status: id=${hook.id} status=${result.statusCode}`);
          return invalidPreHookResult(currentRequest, hook, 'Pre-hook returned an unexpected status code.');
        }

        const preHookOutcome = extractPreHookOutcome(result.body);

        if (preHookOutcome.kind === 'request') {
          currentRequest = preHookOutcome.request;
          continue;
        }

        if (preHookOutcome.kind === 'response') {
          this.debug(`pre-hook response short-circuit: id=${hook.id} status=${result.statusCode}`);
          return {
            modifiedRequest: currentRequest,
            shortCircuitResponse: preHookOutcome.response,
          };
        }

        this.debug(`pre-hook invalid result: id=${hook.id}`);
        return invalidPreHookResult(currentRequest, hook, 'Pre-hook must return either a request or a response.');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.debug(`pre-hook execution failed: id=${hook.id}`, error);
        console.error(`[worker][function-client] pre-hook execution failed: id=${hook.id} error=${errorMessage}`);
        // Bei Fehlern im Pre-Hook: Fehlermeldung als Response zurückgeben
        return {
          modifiedRequest: currentRequest,
          shortCircuitResponse: {
            type: 'response',
            statusCode: 500,
            headers: normalizeHeaders({
              'content-type': 'application/json',
              'x-error': 'pre-hook failed',
            }),
            body: await normalizeBody({
              error: `Pre-hook execution failed: ${errorMessage}`,
              hook: hook.id,
              hookName: hook.name
            }),
            statusText: normalizeStatusText(500),
          },
        };
      }
    }

    return { modifiedRequest: currentRequest };
  }

  public async executePostHooks(
    hooks: CompiledHooks,
    clientRequestData: RequestType,
    upstreamRequestData: RequestType,
    upstreamResponse: ResponseType,
  ): Promise<ResponseType> {
    if (!hooks.enabled || hooks.functions.length === 0) {
      return upstreamResponse;
    }

    let currentResponse = { ...upstreamResponse };

    for (const hook of hooks.functions) {
      try {
        const result = await this.executeHook(
          hook,
          this.buildPostHookPayload(hook, clientRequestData, upstreamRequestData, currentResponse),
        );

        // Response modifizieren basierend auf dem Hook-Ergebnis
        if (result.body && typeof result.body === 'object' && 'modifiedResponse' in result.body) {
          const modifiedResponseObj = result.body as {
            modifiedResponse: {
              statusCode?: number;
              statusText?: string;
              headers?: Record<string, string | string[]>;
              body?: unknown;
            };
          };
          const modified = modifiedResponseObj.modifiedResponse;
          currentResponse = {
            type: 'response',
            statusCode: modified.statusCode || currentResponse.statusCode,
            statusText: modified.statusText || currentResponse.statusText,
            headers: {
              ...currentResponse.headers,
              ...(modified.headers ? normalizeHeaders(modified.headers) : {}),
            },
            body: modified.body !== undefined ? await normalizeBody(modified.body) : currentResponse.body,
          };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.debug(`post-hook execution failed: id=${hook.id}`, error);
        console.error(`[worker][function-client] post-hook execution failed: id=${hook.id} hook=${hook.name} error=${errorMessage}`);
        // Bei Fehlern im Post-Hook: Generischer Fehler-Header
        // Die Original-Response wird zurückgegeben
      }
    }

    return currentResponse;
  }

  private getFunctionConfig(): FunctionServerConfig | undefined {
    return this.configs.function_worker;
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

  private buildPreHookPayload(
    hook: CompiledHookFunction,
    clientRequestData: RequestType,
    upstreamRequestData: RequestType,
  ): PreHookType {
    return {
      type: 'fsarch.frontier.pre_hook',
      payload: {
        clientRequest: clientRequestData,
        upstreamRequest: upstreamRequestData,
      },
      metadata: {
        hookId: hook.id,
        hookName: hook.name,
        functionId: hook.functionId,
      },
    };
  }

  private buildPostHookPayload(
    hook: CompiledHookFunction,
    clientRequestData: RequestType,
    upstreamRequestData: RequestType,
    responseData: ResponseType,
  ): PostHookType {
    return {
      type: 'fsarch.frontier.post_hook',
      payload: {
        clientRequest: clientRequestData,
        upstreamRequest: upstreamRequestData,
        response: responseData,
      },
      metadata: {
        hookId: hook.id,
        hookName: hook.name,
        functionId: hook.functionId,
      },
    };
  }
}

function extractPreHookOutcome(
  body: unknown,
): { kind: 'request'; request: RequestType } | { kind: 'response'; response: ResponseType } | { kind: 'invalid' } {
  if (!body || typeof body !== 'object') {
    return { kind: 'invalid' };
  }

  const candidate = body as Record<string, unknown>;
  const requestValue = candidate.request ?? candidate.modifiedRequest;
  const responseValue = candidate.response ?? candidate.modifiedResponse;

  if (requestValue && responseValue) {
    return { kind: 'invalid' };
  }

  if (requestValue) {
    return isRequestType(requestValue)
      ? { kind: 'request', request: requestValue }
      : { kind: 'invalid' };
  }

  if (responseValue) {
    return isResponseType(responseValue)
      ? { kind: 'response', response: responseValue }
      : { kind: 'invalid' };
  }

  return { kind: 'invalid' };
}

async function invalidPreHookResult(
  currentRequest: RequestType,
  hook: CompiledHookFunction,
  message: string,
): Promise<{
  modifiedRequest: RequestType;
  shortCircuitResponse: ResponseType;
}> {
  return {
    modifiedRequest: currentRequest,
    shortCircuitResponse: {
      type: 'response',
      statusCode: 500,
      statusText: STATUS_CODES[500] ?? 'Internal Server Error',
      headers: normalizeHeaders({
        'content-type': 'application/json',
        'x-error': 'pre-hook failed',
      }),
      body: await normalizeBody({
        error: message,
        hook: hook.id,
        hookName: hook.name,
      }),
    },
  };
}

async function normalizeBody(value: unknown): Promise<ResponseType['body']> {
  if (value && typeof value === 'object' && 'type' in value && 'payload' in value) {
    return value as ResponseType['body'];
  }

  return BodyUtils.bodyToPlainObject(value ?? null);
}

function normalizeHeaders(headers: Record<string, string | string[]>): ResponseType['headers'] {
  const result: ResponseType['headers'] = {};

  for (const [name, value] of Object.entries(headers)) {
    if (!/^[a-zA-Z0-9\-]+$/.test(name)) {
      continue;
    }

    result[name.toLowerCase()] = Array.isArray(value) ? value.map((item) => String(item)) : [String(value)];
  }

  return result;
}

function isRequestType(value: unknown): value is RequestType {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as RequestType;
  return (
    typeof candidate.method === 'string' &&
    isRequestUrl(candidate.url) &&
    isHeadersType(candidate.headers) &&
    isBodyType(candidate.body)
  );
}

function isResponseType(value: unknown): value is ResponseType {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as ResponseType;
  return (
    typeof candidate.statusCode === 'number' &&
    typeof candidate.statusText === 'string' &&
    isHeadersType(candidate.headers) &&
    isBodyType(candidate.body)
  );
}

function isRequestUrl(value: unknown): value is RequestType['url'] {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as RequestType['url'];
  return (
    typeof candidate.scheme === 'string' &&
    typeof candidate.host === 'string' &&
    typeof candidate.path === 'string' &&
    typeof candidate.port === 'number' &&
    isQueryParams(candidate.query)
  );
}

function isQueryParams(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return Object.values(value as Record<string, unknown>).every((item) => Array.isArray(item) && item.every((entry) => typeof entry === 'string'));
}

function isHeadersType(value: unknown): value is ResponseType['headers'] {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return Object.values(value as Record<string, unknown>).every((item) => Array.isArray(item) && item.every((entry) => typeof entry === 'string'));
}

function isBodyType(value: unknown): value is ResponseType['body'] {
  return Boolean(value && typeof value === 'object' && 'type' in value && (value as { type?: unknown }).type === 'json' && 'payload' in value);
}

function normalizeStatusText(statusCode: number): string {
  return STATUS_CODES[statusCode] ?? '';
}

function isDebugEnabled(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'debug';
}
