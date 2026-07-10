import { createServer, IncomingHttpHeaders, IncomingMessage, Server, ServerResponse } from 'http';
import { request as httpsRequest } from 'https';
import { gunzip as zlibGunzip } from 'zlib';
import { promisify } from 'util';

const gunzipAsync = promisify(zlibGunzip);
import { buildUpstreamPath, CompiledWorkerConfig, CompiledHooks } from './compiled-config.js';
import { WorkerConfigSnapshot } from '../types/worker-config.types.js';
import type { RequestType } from '../types/http/request.type.js';
import type { ResponseType } from '../types/http/response.type.js';
import { FunctionClient, FunctionServerConfig } from './function-client.js';
import { BodyUtils } from '../utils/http/body.utils.js';
import { compressResponseBody } from './response-compression.js';
import {
  executePreHooks,
  executePostHooks,
} from './function-hooks.js';
import { HeadersUtils } from "../utils/http/index.js";

type Metrics = {
  startedAt: number;
  inflight: number;
  totalRequests: number;
  totalErrors: number;
};

type RouteCorsPolicy = {
  enabled: boolean;
  allowCredentials: boolean;
  allowedOrigins: string[];
};

export type RequestLogPayload = {
  domainGroupId: string;
  pathRuleId: string;
  logPolicyId: string;
  incomingMethod: string;
  incomingUrl: string;
  incomingHeaders: Record<string, string | string[]>;
  upstreamMethod: string;
  upstreamUrl: string;
  upstreamHeaders: Record<string, string>;
  responseStatusCode: number;
  requestTimeMs: number;
};

type HttpProxyServerOptions = {
  onRequestLog?: (payload: RequestLogPayload) => Promise<void>;
  functionClient?: FunctionClient;
  functionConfigs?: Record<string, FunctionServerConfig>;
};

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-length',
]);

export class HttpProxyServer {
  private readonly metrics: Metrics = {
    startedAt: Date.now(),
    inflight: 0,
    totalRequests: 0,
    totalErrors: 0,
  };
  private readonly debugEnabled = isDebugEnabled(process.env.FRONTIER_WORKER_DEBUG);

  private activeConfig: CompiledWorkerConfig | null = null;
  private activeVersion = 0;
  private hasPrintedInitialRoutes = false;
  private server: Server;
  private functionClient: FunctionClient | null = null;
  private functionConfigs: Record<string, FunctionServerConfig> = {};

  constructor(
    private readonly port: number,
    private readonly options?: HttpProxyServerOptions,
  ) {
    this.server = createServer(this.handleRequest.bind(this));
    if (options?.functionClient) {
      this.functionClient = options.functionClient;
    }
    if (options?.functionConfigs) {
      this.functionConfigs = options.functionConfigs;
    }
  }

  public setSnapshot(version: number, snapshot: WorkerConfigSnapshot) {
    this.activeConfig = new CompiledWorkerConfig(snapshot, this.functionConfigs);
    this.activeVersion = version;

    if (!this.hasPrintedInitialRoutes) {
      this.printInitialRoutes(version, this.activeConfig);
      this.hasPrintedInitialRoutes = true;
    }

    this.debug(`applied snapshot version=${version}`);
  }


  public getMetrics() {
    const uptimeMs = Date.now() - this.metrics.startedAt;

    return {
      inflight: this.metrics.inflight,
      totalRequests: this.metrics.totalRequests,
      totalErrors: this.metrics.totalErrors,
      uptimeSec: Math.floor(uptimeMs / 1000),
      activeConfigVersion: this.activeVersion,
    };
  }

  public async start(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.server.listen(this.port, () => {
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse) {
    this.metrics.inflight += 1;
    this.metrics.totalRequests += 1;
    const requestStartedAt = Date.now();
    let resolvedRoute: ReturnType<CompiledWorkerConfig['resolve']> = null;
    let incomingMethod = 'GET';
    let incomingUrl = '/';
    let upstreamMethod = 'GET';
    let upstreamUrl = '/';
    let upstreamHeaders: Record<string, string> = {};

    try {
      const method = req.method ?? 'GET';
      const requestUrl = new URL(req.url ?? '/', 'http://frontier-worker.local');
      const hostHeader = req.headers.host;
      incomingMethod = method;
      incomingUrl = buildIncomingUrl(hostHeader, requestUrl);

      this.debug(`incoming request method=${method} host=${hostHeader ?? '<missing>'} path=${requestUrl.pathname}${requestUrl.search} activeConfigVersion=${this.activeVersion}`);

      if (!this.activeConfig) {
        this.debug('rejecting request because no active configuration is loaded');
        res.writeHead(503).end('worker has no active configuration');
        return;
      }

      const route = this.activeConfig.resolve(hostHeader, requestUrl.pathname);
      resolvedRoute = route;

      if (!route) {
        this.debug(`no route match for host=${hostHeader ?? '<missing>'} path=${requestUrl.pathname}`);
        res.writeHead(404).end('no route for request');
        return;
      }

      const upstreamPath = buildUpstreamPath(route.upstream.basePath, route.pathPrefix, requestUrl.pathname);
      upstreamUrl = `${route.upstream.protocol}://${route.upstream.host}:${route.upstream.port}${upstreamPath}${requestUrl.search}`;
      upstreamHeaders = buildRequestHeaders(req.headers);
      const requestOrigin = getSingleHeaderValue(req.headers.origin);
      upstreamMethod = method;

      if (isCorsPreflightRequest(method, req.headers) && route.cors.enabled) {
        if (!requestOrigin || !isCorsOriginAllowed(route.cors, requestOrigin)) {
          res.writeHead(403).end('cors origin is not allowed');
          await this.reportRequestLog(route, {
            incomingMethod: method,
            incomingUrl,
            incomingHeaders: req.headers,
            upstreamMethod: method,
            upstreamUrl,
            upstreamHeaders,
            responseStatusCode: 403,
            requestTimeMs: Date.now() - requestStartedAt,
          });
          return;
        }

        const preflightHeaders = buildCorsHeaders(route.cors, requestOrigin, req.headers['access-control-request-headers']);
        this.debug(`cors preflight accepted origin=${requestOrigin} path=${requestUrl.pathname}`);
        res.writeHead(204, preflightHeaders).end();
        await this.reportRequestLog(route, {
          incomingMethod: method,
          incomingUrl,
          incomingHeaders: req.headers,
          upstreamMethod: method,
          upstreamUrl,
          upstreamHeaders,
          responseStatusCode: 204,
          requestTimeMs: Date.now() - requestStartedAt,
        });
        return;
      }

      if (route.cors.enabled && requestOrigin && !isCorsOriginAllowed(route.cors, requestOrigin)) {
        this.debug(`cors rejected origin=${requestOrigin} path=${requestUrl.pathname}`);
        res.writeHead(403).end('cors origin is not allowed');
        await this.reportRequestLog(route, {
          incomingMethod: method,
          incomingUrl,
          incomingHeaders: req.headers,
          upstreamMethod: method,
          upstreamUrl,
          upstreamHeaders,
          responseStatusCode: 403,
          requestTimeMs: Date.now() - requestStartedAt,
        });
        return;
      }

      this.debug(`resolved request host=${hostHeader ?? '<missing>'} path=${requestUrl.pathname} routePrefix=${route.pathPrefix} upstream=${upstreamUrl}`);
      this.debug(`upstream request method=${method} url=${upstreamUrl}`);

      // Read the request body for hook processing
      const requestBody = method === 'GET' || method === 'HEAD' ? undefined : await this.readRequestBody(req);

      // Prepare hook request data
      const clientRequestData = await buildRequestType(method, incomingUrl, req.headers, requestBody, true);
      const hookRequestData = await buildRequestType(method, upstreamUrl, upstreamHeaders, requestBody, false);

      // Execute pre-hooks if available
      const preHookResult = await executePreHooks(
        this.functionClient,
        route.preHooks,
        clientRequestData,
        hookRequestData,
        route.pathRuleId,
        (msg) => this.debug(msg),
      );

      // Check if pre-hook execution failed
      if (preHookResult.error === true) {
        res.writeHead(preHookResult.statusCode, {
          'content-type': 'application/json',
          'x-error': 'pre-hook failed',
        }).end(JSON.stringify({ error: preHookResult.message }));

        await this.reportRequestLog(route, {
          incomingMethod: method,
          incomingUrl,
          incomingHeaders: req.headers,
          upstreamMethod: method,
          upstreamUrl,
          upstreamHeaders,
          responseStatusCode: preHookResult.statusCode,
          requestTimeMs: Date.now() - requestStartedAt,
        });
        return;
      }

      let modifiedRequest = preHookResult.modifiedRequest;
      const shortCircuitResponse = preHookResult.shortCircuitResponse;

      // If pre-hook returned a short-circuit response, send it directly
      if (shortCircuitResponse) {
        this.debug(`short-circuit response from pre-hook, status=${shortCircuitResponse.statusCode}`);
        const responseHeaders = { ...shortCircuitResponse.headers };
        if (route.cors.enabled && requestOrigin) {
          Object.assign(responseHeaders, buildCorsHeaders(route.cors, requestOrigin));
        }
        if (shortCircuitResponse.statusText) {
          res.statusMessage = shortCircuitResponse.statusText;
        }
        res.writeHead(shortCircuitResponse.statusCode, responseHeaders);
        res.end(BodyUtils.plainObjectToBody(shortCircuitResponse.body));

        await this.reportRequestLog(route, {
          incomingMethod: method,
          incomingUrl,
          incomingHeaders: req.headers,
          upstreamMethod: method,
          upstreamUrl,
          upstreamHeaders,
          responseStatusCode: shortCircuitResponse.statusCode,
          requestTimeMs: Date.now() - requestStartedAt,
        });
        return;
      }

      // Execute upstream request with potentially modified request data
      console.log(`[worker][upstream] request: method=${modifiedRequest.method} url=${upstreamUrl}`);
      const upstreamRequestOptions = requestTypeToProxyRequest(modifiedRequest);
      const upstreamFetchOptions: RequestInit = {
        method: upstreamRequestOptions.method,
        headers: upstreamRequestOptions.headers,
        body: upstreamRequestOptions.body,
      };
      if (route.upstream.protocol === 'https' && route.upstream.sslVerify === false) {
        this.debug(`ssl verification disabled for upstream ${route.upstream.host}:${route.upstream.port}`);
      }
      const upstreamRes = await fetchWithOptionalInsecureTls(
        upstreamUrl,
        upstreamFetchOptions,
        route.upstream.protocol === 'https' && route.upstream.sslVerify === false,
      );
      console.log(`[worker][upstream] response: method=${modifiedRequest.method} url=${upstreamUrl} status=${upstreamRes.status}`);

      // Read upstream response body as buffer (not text - in case it's compressed)
      let upstreamResponseBody: unknown;
      const responseBuffer = await upstreamRes.arrayBuffer();

      // If upstream response is gzip-compressed, decompress it first
      const upstreamContentEncoding = getSingleHeaderValue(upstreamRes.headers['content-encoding']);
      const isUpstreamGzipped = upstreamContentEncoding && upstreamContentEncoding.includes('gzip');

      let bodyBuffer = Buffer.from(responseBuffer as any);
      if (isUpstreamGzipped) {
        this.debug(`upstream response is gzip-compressed, decompressing`);
        try {
          bodyBuffer = await gunzipAsync(bodyBuffer) as any;
        } catch (e) {
          this.debug(`failed to decompress upstream response: ${e}`);
          console.error('[worker][upstream] failed to decompress gzip response:', e);
        }
      }

      // Convert decompressed buffer to string
      const bodyText = bodyBuffer.toString('utf-8');
      try {
        upstreamResponseBody = JSON.parse(bodyText);
      } catch {
        upstreamResponseBody = bodyText;
      }

      // Prepare upstream response for hook processing
      const upstreamResponseData: ResponseType = {
        type: 'response',
        statusCode: upstreamRes.status,
        statusText: upstreamRes.statusText,
        headers: HeadersUtils.headersToPlainObject(upstreamRes.headers),
        body: await BodyUtils.bodyToPlainObject(upstreamResponseBody ?? null),
      };

      // Execute post-hooks if available
      const finalResponse = await executePostHooks(
        this.functionClient,
        route.postHooks,
        clientRequestData,
        modifiedRequest,
        upstreamResponseData,
        route.pathRuleId,
        (msg) => this.debug(msg),
      );

      const responseHeaders = HeadersUtils.headersToPlainObject(upstreamRes.headers);

      // Since we've decoded the upstream response, remove content-encoding header
      // (we'll recalculate it based on our response)
      delete responseHeaders['content-encoding'];
      delete responseHeaders['content-length'];
      delete responseHeaders['transfer-encoding'];

      if (route.cors.enabled && requestOrigin) {
        Object.assign(responseHeaders, buildCorsHeaders(route.cors, requestOrigin));
      }

      const responseHeadersSimple: Record<string, string> = {};

      // Apply modified headers from post-hooks if present (validate first)
      if (finalResponse.headers) {
        for (const [name, values] of Object.entries(finalResponse.headers)) {
          if (typeof name === 'string' && /^[a-zA-Z0-9\-]+$/.test(name) && Array.isArray(values) && values.length > 0) {
            responseHeadersSimple[name] = values.join(',');
          }
        }
      }

      this.debug(`upstream response status=${finalResponse.statusCode} upstream=${upstreamUrl}`);

      // Check if client accepts gzip encoding
      const acceptEncoding = getSingleHeaderValue(req.headers['accept-encoding']);
      const supportsGzip = acceptsEncoding(acceptEncoding, 'gzip');
      this.debug(`client accepts gzip: ${supportsGzip} (accept-encoding: ${acceptEncoding})`);

      const bodyToSend = BodyUtils.plainObjectToBody(finalResponse.body);
      if (bodyToSend) {
        if (finalResponse.statusText) {
          res.statusMessage = finalResponse.statusText;
        }

        const compressionResult = await compressResponseBody(bodyToSend, responseHeadersSimple, {
          supportsGzip,
          onDebug: (msg) => this.debug(msg),
        });

        res.writeHead(finalResponse.statusCode, compressionResult.headers);
        res.end(compressionResult.body);
      } else {
        if (finalResponse.statusText) {
          res.statusMessage = finalResponse.statusText;
        }
        res.writeHead(finalResponse.statusCode, responseHeaders);
        res.end();
      }

      await this.reportRequestLog(route, {
        incomingMethod: method,
        incomingUrl,
        incomingHeaders: req.headers,
        upstreamMethod: modifiedRequest.method,
        upstreamUrl,
        upstreamHeaders: requestTypeHeadersToRecord(modifiedRequest.headers),
        responseStatusCode: finalResponse.statusCode,
        requestTimeMs: Date.now() - requestStartedAt,
      });
    } catch (error) {
      this.metrics.totalErrors += 1;
      this.debug('upstream request failed', error);
      console.log('error', error);

      if (!res.headersSent) {
        res.writeHead(502).end('upstream request failed');
      } else {
        res.end();
      }

      await this.reportRequestLog(resolvedRoute, {
        incomingMethod,
        incomingUrl,
        incomingHeaders: req.headers,
        upstreamMethod,
        upstreamUrl,
        upstreamHeaders,
        responseStatusCode: res.statusCode || 502,
        requestTimeMs: Date.now() - requestStartedAt,
      });
    } finally {
      this.metrics.inflight -= 1;
    }
  }

  private async reportRequestLog(
    route: ReturnType<CompiledWorkerConfig['resolve']>,
    payload: Omit<RequestLogPayload, 'domainGroupId' | 'pathRuleId' | 'logPolicyId'>,
  ) {
    if (!route || !route.log.enabled || !route.log.logPolicyId || !this.options?.onRequestLog) {
      return;
    }

    try {
      await this.options.onRequestLog({
        domainGroupId: route.domainGroupId,
        pathRuleId: route.pathRuleId,
        logPolicyId: route.log.logPolicyId,
        ...payload,
      });
    } catch (error) {
      console.error('[worker][proxy] request log reporting failed', error);
      this.debug('request log reporting failed', error);
    }
  }

  private debug(message: string, error?: unknown) {
    if (!this.debugEnabled) {
      return;
    }

    if (error) {
      console.debug(`[worker][proxy] ${message}`, error);
      return;
    }

    console.debug(`[worker][proxy] ${message}`);
  }

  private async readRequestBody(req: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const chunks: Uint8Array[] = [];

      req.on('data', (chunk) => {
        chunks.push(chunk);
      });

      req.on('end', () => {
        try {
          const body = Buffer.concat(chunks);
          if (body.length === 0) {
            resolve(undefined);
            return;
          }

          // Try to parse as JSON, fall back to raw string
          try {
            const parsed = JSON.parse(body.toString('utf-8'));
            resolve(parsed);
          } catch {
            resolve(body.toString('utf-8'));
          }
        } catch (error) {
          reject(error);
        }
      });

      req.on('error', (error) => {
        reject(error);
      });
    });
  }

  private printInitialRoutes(version: number, config: CompiledWorkerConfig) {
    const routes = config.describeRoutes();
    console.log(`[worker][routes] initial route table loaded (configVersion=${version})`);

    if (routes.length === 0) {
      console.log('[worker][routes] no routes configured');
      return;
    }

    for (const route of routes) {
      const hosts = route.domains.length > 0 ? route.domains : ['<no-domain-mapping>'];

      for (const host of hosts) {
        console.log(
          `[worker][routes] domainGroup=${route.domainGroupId} host=${host} match=${route.pathPrefix} upstream=${route.upstreamHost}:${route.upstreamPort}${route.upstreamBasePath} target=${route.upstreamIndex}/${route.upstreamCount}`,
        );
      }
    }
  }
}

function buildRequestHeaders(headers: IncomingHttpHeaders): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [name, value] of Object.entries(headers)) {
    if (!value || name === 'host' || HOP_BY_HOP_HEADERS.has(name.toLowerCase())) {
      continue;
    }

    // Validate header name
    if (!/^[a-zA-Z0-9\-]+$/.test(name)) {
      continue;
    }

    // Validate header value
    const headerValue = Array.isArray(value) ? value.join(',') : String(value);
    if (typeof headerValue !== 'string' || headerValue.length === 0) {
      continue;
    }
    result[name] = headerValue;
  }

  return result;
}

async function buildRequestType(
  method: string,
  urlString: string,
  headers: IncomingHttpHeaders | Record<string, string>,
  body: unknown,
  includeHost: boolean,
): Promise<RequestType> {
  const url = new URL(urlString);
  const query: RequestType['url']['query'] = {};

  url.searchParams.forEach((value, key) => {
    if (query[key]) {
      query[key].push(value);
      return;
    }

    query[key] = [value];
  });

  const headerEntries = Object.entries(headers);
  const requestHeaders: RequestType['headers'] = {};
  for (const [name, value] of headerEntries) {
    const lowerName = name.toLowerCase();
    if (!value || HOP_BY_HOP_HEADERS.has(lowerName) || !/^[a-zA-Z0-9\-]+$/.test(name)) {
      continue;
    }

    if (lowerName === 'host' && !includeHost) {
      continue;
    }

    const headerValue = Array.isArray(value) ? value.join(',') : String(value);
    if (headerValue.length === 0) {
      continue;
    }

    requestHeaders[lowerName] = [headerValue];
  }

  if (includeHost) {
    const host = getSingleHeaderValue((headers as IncomingHttpHeaders).host);
    if (host) {
      requestHeaders.host = [host];
    }
  }

  return {
    type: 'request',
    method,
    url: {
      scheme: url.protocol.replace(':', ''),
      host: url.hostname,
      path: url.pathname.endsWith('/') && url.pathname.length > 1 ? url.pathname.slice(0, -1) : (url.pathname || '/'),
      port: url.port ? Number.parseInt(url.port, 10) : (url.protocol === 'https:' ? 443 : url.protocol === 'http:' ? 80 : 0),
      query,
    },
    headers: requestHeaders,
    body: await BodyUtils.bodyToPlainObject(body ?? null),
  };
}

function requestTypeToProxyRequest(request: RequestType): {
  method: string;
  headers: Record<string, string>;
  body?: string;
} {
  const headers: Record<string, string> = {};

  for (const [name, values] of Object.entries(request.headers)) {
    if (!/^[a-zA-Z0-9\-]+$/.test(name) || values.length === 0) {
      continue;
    }

    headers[name] = values.join(',');
  }

  const body = BodyUtils.plainObjectToBody(request.body);

  return {
    method: request.method,
    headers,
    body: body.length > 0 ? body : undefined,
  };
}

function requestTypeHeadersToRecord(headers: RequestType['headers']): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [name, values] of Object.entries(headers)) {
    if (!/^[a-zA-Z0-9\-]+$/.test(name) || values.length === 0) {
      continue;
    }

    result[name] = values.join(',');
  }

  return result;
}

async function fetchWithOptionalInsecureTls(
  url: string,
  options: RequestInit,
  insecureTls: boolean,
): Promise<Response> {
  if (!insecureTls) {
    return fetch(url, options);
  }

  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== 'https:') {
    return fetch(url, options);
  }

  const nodeHeaders = options.headers && !Array.isArray(options.headers)
    ? Object.fromEntries(Object.entries(options.headers as Record<string, string>).map(([key, value]) => [key, String(value)]))
    : undefined;
  const bodyValue = options.body !== undefined ? String(options.body) : undefined;

  const response = await new Promise<{
    statusCode: number;
    statusText: string;
    headers: IncomingHttpHeaders;
    body: Buffer;
  }>((resolve, reject) => {
    const request = httpsRequest(parsedUrl, {
      method: options.method,
      headers: nodeHeaders,
      rejectUnauthorized: false,
    }, (upstreamResponse) => {
      const chunks: Buffer[] = [];

      upstreamResponse.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });

      upstreamResponse.on('end', () => {
        resolve({
          statusCode: upstreamResponse.statusCode ?? 502,
          statusText: upstreamResponse.statusMessage ?? '',
          headers: upstreamResponse.headers,
          body: Buffer.concat(chunks),
        });
      });
    });

    request.on('error', reject);
    if (bodyValue) {
      request.write(bodyValue);
    }
    request.end();
  });

  return new Response(new Uint8Array(response.body), {
    status: response.statusCode,
    statusText: response.statusText,
    headers: toHeaders(response.headers),
  });
}

function toHeaders(headers: IncomingHttpHeaders): Headers {
  const result = new Headers();

  for (const [name, value] of Object.entries(headers)) {
    if (!value) {
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => result.append(name, item));
      continue;
    }

    result.set(name, String(value));
  }

  return result;
}

function buildResponseHeadersType(headers: IncomingHttpHeaders): ResponseType['headers'] {
  const result: ResponseType['headers'] = {};

  for (const [name, value] of Object.entries(headers)) {
    if (!value || HOP_BY_HOP_HEADERS.has(name.toLowerCase())) {
      continue;
    }

    if (!/^[a-zA-Z0-9\-]+$/.test(name)) {
      continue;
    }

    const values = Array.isArray(value) ? value.map((item) => String(item)) : [String(value)];
    if (values.length === 0) {
      continue;
    }

    result[name] = values;
  }

  return result;
}

function buildResponseHeaders(headers: IncomingHttpHeaders): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [name, value] of Object.entries(headers)) {
    if (!value || HOP_BY_HOP_HEADERS.has(name.toLowerCase())) {
      continue;
    }

    // Validate header name - skip invalid ones to prevent "incorrect header check" errors
    if (!/^[a-zA-Z0-9\-]+$/.test(name)) {
      continue;
    }

    // Validate header value - skip invalid ones
    const headerValue = Array.isArray(value) ? value.join(',') : String(value);
    if (typeof headerValue !== 'string' || headerValue.length === 0) {
      continue;
    }
    result[name] = headerValue;
  }

  return result;
}

function getSingleHeaderValue(value: string | string[] | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return Array.isArray(value) ? value[0] : value;
}

function acceptsEncoding(headerValue: string | undefined, encoding: string): boolean {
  if (!headerValue) {
    return false;
  }

  const normalizedEncoding = encoding.toLowerCase();
  for (const item of headerValue.split(',').map(value => value.trim().toLowerCase())) {
    if (!item) {
      continue;
    }

    const [name, ...params] = item.split(';').map(value => value.trim());
    if (name !== normalizedEncoding && name !== '*') {
      continue;
    }

    const qParam = params.find(param => param.startsWith('q='));
    if (!qParam) {
      return true;
    }

    const qValue = Number.parseFloat(qParam.slice(2));
    if (Number.isFinite(qValue) && qValue > 0) {
      return true;
    }
  }

  return false;
}

function isCorsPreflightRequest(method: string, headers: IncomingHttpHeaders): boolean {
  return method === 'OPTIONS' && Boolean(headers.origin) && Boolean(headers['access-control-request-method']);
}

export function isCorsOriginAllowed(policy: RouteCorsPolicy, origin: string): boolean {
  if (!policy.enabled) {
    return false;
  }

  return policy.allowedOrigins.includes('*') || policy.allowedOrigins.includes(origin);
}

export function buildCorsHeaders(
  policy: RouteCorsPolicy,
  origin: string,
  requestHeaders?: string | string[],
): Record<string, string> {
  const allowOrigin = policy.allowedOrigins.includes('*') && !policy.allowCredentials
    ? '*'
    : origin;

  const result: Record<string, string> = {
    'access-control-allow-origin': allowOrigin,
    'access-control-allow-methods': 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-max-age': '600',
    vary: 'Origin',
  };

  const requestedHeaders = getSingleHeaderValue(requestHeaders);
  // Sanitize requested headers: only allow valid header names (alphanumeric, dash, underscore)
  const sanitizedHeaders = requestedHeaders && requestedHeaders.trim().length > 0
    ? requestedHeaders.split(',').map(h => h.trim()).filter(h => /^[a-zA-Z0-9\-_]+$/.test(h)).join(',')
    : '*';
  result['access-control-allow-headers'] = sanitizedHeaders.length > 0 ? sanitizedHeaders : '*';

  if (policy.allowCredentials) {
    result['access-control-allow-credentials'] = 'true';
  }

  return result;
}

function isDebugEnabled(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'debug';
}

function buildIncomingUrl(hostHeader: string | undefined, requestUrl: URL): string {
  if (!hostHeader) {
    return `${requestUrl.pathname}${requestUrl.search}`;
  }

  return `http://${hostHeader}${requestUrl.pathname}${requestUrl.search}`;
}
