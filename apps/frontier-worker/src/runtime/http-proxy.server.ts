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
  private server: Server;

  constructor(private readonly port: number) {
    this.server = createServer(this.handleRequest.bind(this));
  }

  public setSnapshot(version: number, snapshot: WorkerConfigSnapshot) {
    this.activeConfig = new CompiledWorkerConfig(snapshot);
    this.activeVersion = version;
    this.debug(`applied snapshot version=${version}`);
  }

  public getActiveVersion(): number {
    return this.activeVersion;
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

    try {
      const method = req.method ?? 'GET';
      const requestUrl = new URL(req.url ?? '/', 'http://frontier-worker.local');
      const hostHeader = req.headers.host;

      this.debug(`incoming request method=${method} host=${hostHeader ?? '<missing>'} path=${requestUrl.pathname}${requestUrl.search} activeConfigVersion=${this.activeVersion}`);

      if (!this.activeConfig) {
        this.debug('rejecting request because no active configuration is loaded');
        res.writeHead(503).end('worker has no active configuration');
        return;
      }

      const route = this.activeConfig.resolve(hostHeader, requestUrl.pathname);

      if (!route) {
        this.debug(`no route match for host=${hostHeader ?? '<missing>'} path=${requestUrl.pathname}`);
        res.writeHead(404).end('no route for request');
        return;
      }

      const upstreamPath = buildUpstreamPath(route.upstream.basePath, route.pathPrefix, requestUrl.pathname);
      const upstreamUrl = `http://${route.upstream.host}:${route.upstream.port}${upstreamPath}${requestUrl.search}`;

      this.debug(`resolved request host=${hostHeader ?? '<missing>'} path=${requestUrl.pathname} routePrefix=${route.pathPrefix} upstream=${upstreamUrl}`);

      const upstreamRes = await proxyRequest(upstreamUrl, {
        method,
        headers: buildRequestHeaders(req.headers),
        body: method === 'GET' || method === 'HEAD' ? undefined : req,
      });

      const responseHeaders = buildResponseHeaders(upstreamRes.headers as IncomingHttpHeaders);
      this.debug(`upstream response status=${upstreamRes.statusCode} upstream=${upstreamUrl}`);
      res.writeHead(upstreamRes.statusCode, responseHeaders);

      if (upstreamRes.body) {
        await pipeline(upstreamRes.body, res);
      } else {
        res.end();
      }
    } catch (error) {
      this.metrics.totalErrors += 1;
      this.debug('upstream request failed', error);

      if (!res.headersSent) {
        res.writeHead(502).end('upstream request failed');
      } else {
        res.end();
      }
    } finally {
      this.metrics.inflight -= 1;
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

function isDebugEnabled(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'debug';
}

