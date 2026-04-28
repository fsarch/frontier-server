import { createServer, IncomingHttpHeaders, IncomingMessage, Server, ServerResponse } from 'http';
import { pipeline } from 'stream/promises';
import { request as proxyRequest } from 'undici';
import { buildUpstreamPath, CompiledWorkerConfig } from './compiled-config';
import { WorkerConfigSnapshot } from '../types/worker-config.types';

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

  constructor(
    private readonly port: number,
    private readonly options?: HttpProxyServerOptions,
  ) {
    this.server = createServer(this.handleRequest.bind(this));
  }

  public setSnapshot(version: number, snapshot: WorkerConfigSnapshot) {
    this.activeConfig = new CompiledWorkerConfig(snapshot);
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
      const upstreamUrl = `http://${route.upstream.host}:${route.upstream.port}${upstreamPath}${requestUrl.search}`;
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

      const upstreamRes = await proxyRequest(upstreamUrl, {
        method,
        headers: upstreamHeaders,
        body: method === 'GET' || method === 'HEAD' ? undefined : req,
      });

      const responseHeaders = buildResponseHeaders(upstreamRes.headers as IncomingHttpHeaders);
      if (route.cors.enabled && requestOrigin) {
        Object.assign(responseHeaders, buildCorsHeaders(route.cors, requestOrigin));
      }
      this.debug(`upstream response status=${upstreamRes.statusCode} upstream=${upstreamUrl}`);
      res.writeHead(upstreamRes.statusCode, responseHeaders);

      if (upstreamRes.body) {
        await pipeline(upstreamRes.body, res);
      } else {
        res.end();
      }

      await this.reportRequestLog(route, {
        incomingMethod: method,
        incomingUrl,
        incomingHeaders: req.headers,
        upstreamMethod: method,
        upstreamUrl,
        upstreamHeaders,
        responseStatusCode: upstreamRes.statusCode,
        requestTimeMs: Date.now() - requestStartedAt,
      });
    } catch (error) {
      this.metrics.totalErrors += 1;
      this.debug('upstream request failed', error);

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

    result[name] = Array.isArray(value) ? value.join(',') : value;
  }

  return result;
}

function buildResponseHeaders(headers: IncomingHttpHeaders): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [name, value] of Object.entries(headers)) {
    if (!value || HOP_BY_HOP_HEADERS.has(name.toLowerCase())) {
      continue;
    }

    result[name] = Array.isArray(value) ? value.join(',') : value;
  }

  return result;
}

function getSingleHeaderValue(value: string | string[] | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return Array.isArray(value) ? value[0] : value;
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
  result['access-control-allow-headers'] = requestedHeaders && requestedHeaders.trim().length > 0
    ? requestedHeaders
    : '*';

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

