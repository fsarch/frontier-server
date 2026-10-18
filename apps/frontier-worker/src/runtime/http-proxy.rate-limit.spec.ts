import {
  createServer as createHttpServer,
  request as httpRequest,
  type IncomingHttpHeaders,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import type { WorkerConfigSnapshot } from '../types/worker-config.types.js';
import { HttpProxyServer } from './http-proxy.server.js';
import { MemoryRateLimitStore } from './rate-limit/memory-rate-limit.store.js';
import type { RateLimitStore } from './rate-limit/rate-limit-store.js';
import { RateLimiter } from './rate-limit/rate-limiter.js';

async function listen(server: ReturnType<typeof createHttpServer>) {
  return new Promise<number>((resolve) => {
    server.listen(0, '127.0.0.1', () =>
      resolve((server.address() as AddressInfo).port),
    );
  });
}

async function startUpstream() {
  let requestCount = 0;
  const server = createHttpServer((_req, res) => {
    requestCount += 1;
    res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
  });
  const port = await listen(server);

  return {
    port,
    get requestCount() {
      return requestCount;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function send(
  port: number,
  options: {
    method?: string;
    path?: string;
    headers?: Record<string, string>;
  } = {},
): Promise<{ statusCode: number; headers: IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port,
        method: options.method ?? 'GET',
        path: options.path ?? '/limited',
        headers: { host: 'worker.test', ...options.headers },
      },
      (res) => {
        res.resume();
        res.on('end', () =>
          resolve({ statusCode: res.statusCode ?? 0, headers: res.headers }),
        );
      },
    );
    req.on('error', reject);
    req.end();
  });
}

function buildSnapshot(upstreamPort: number): WorkerConfigSnapshot {
  return {
    domainGroups: {
      ids: ['dg-1'],
      entities: {
        'dg-1': {
          id: 'dg-1',
          name: 'main',
          pathRules: [
            {
              id: 'rule-limited',
              domainGroupId: 'dg-1',
              name: 'limited',
              path: '/limited',
              order: 1,
              cachePolicyId: null,
              upstreamGroupId: 'ug-1',
              corsPolicyId: 'cors-1',
              rateLimitPolicyId: 'rl-1',
            },
            {
              id: 'rule-free',
              domainGroupId: 'dg-1',
              name: 'free',
              path: '/free',
              order: 2,
              cachePolicyId: null,
              upstreamGroupId: 'ug-1',
            },
          ],
        },
      },
    },
    domainGroupDomainsByDomain: {
      ids: ['worker.test'],
      entities: {
        'worker.test': {
          id: 'dgd-1',
          domainGroupId: 'dg-1',
          domainName: 'worker.test',
        },
      },
    },
    cachePolicies: { ids: [], entities: {} },
    corsPolicies: {
      ids: ['cors-1'],
      entities: {
        'cors-1': {
          id: 'cors-1',
          domainGroupId: 'dg-1',
          name: 'cors',
          enabled: true,
          allowCredentials: false,
          allowedOrigins: ['https://app.test'],
        },
      },
    },
    logPolicies: { ids: [], entities: {} },
    rateLimitPolicies: {
      ids: ['rl-1'],
      entities: {
        'rl-1': {
          id: 'rl-1',
          domainGroupId: 'dg-1',
          name: 'limit',
          enabled: true,
          limit: 2,
          windowSeconds: 60,
          keyType: 'ip',
        },
      },
    },
    hooks: { ids: [], entities: {} },
    upstreamGroups: {
      ids: ['ug-1'],
      entities: {
        'ug-1': {
          id: 'ug-1',
          domainGroupId: 'dg-1',
          name: 'upstreams',
          upstreams: [
            {
              id: 'up-1',
              upstreamGroupId: 'ug-1',
              name: 'svc',
              host: '127.0.0.1',
              port: upstreamPort,
              path: '/',
            },
          ],
        },
      },
    },
  };
}

describe('HttpProxyServer rate limiting', () => {
  let upstream: Awaited<ReturnType<typeof startUpstream>>;
  let proxy: HttpProxyServer;
  let proxyPort: number;

  async function startProxy(store: RateLimitStore) {
    const portProbe = createHttpServer();
    proxyPort = await listen(portProbe);
    await new Promise<void>((resolve) => portProbe.close(() => resolve()));

    proxy = new HttpProxyServer(proxyPort, {
      rateLimiter: new RateLimiter(store, { trustForwardedFor: false }),
    });
    proxy.setSnapshot(1, buildSnapshot(upstream.port));
    await proxy.start();
  }

  beforeEach(async () => {
    upstream = await startUpstream();
  });

  afterEach(async () => {
    await proxy.stop();
    await upstream.close();
  });

  it('answers with 429 once the limit is exceeded, without calling the upstream', async () => {
    await startProxy(new MemoryRateLimitStore());

    const first = await send(proxyPort);
    const second = await send(proxyPort);
    const third = await send(proxyPort);

    expect(first.statusCode).toBe(200);
    expect(first.headers['ratelimit-limit']).toBe('2');
    expect(first.headers['ratelimit-remaining']).toBe('1');
    expect(second.statusCode).toBe(200);
    expect(second.headers['ratelimit-remaining']).toBe('0');

    expect(third.statusCode).toBe(429);
    expect(third.headers['retry-after']).toBeDefined();
    expect(third.headers['ratelimit-remaining']).toBe('0');
    expect(upstream.requestCount).toBe(2);
  });

  it('adds CORS headers to the 429 so browsers can read it', async () => {
    await startProxy(new MemoryRateLimitStore());
    const headers = { origin: 'https://app.test' };

    await send(proxyPort, { headers });
    await send(proxyPort, { headers });
    const blocked = await send(proxyPort, { headers });

    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['access-control-allow-origin']).toBe(
      'https://app.test',
    );
  });

  it('does not count CORS preflight requests', async () => {
    await startProxy(new MemoryRateLimitStore());
    const preflightHeaders = {
      origin: 'https://app.test',
      'access-control-request-method': 'POST',
    };

    for (let i = 0; i < 3; i += 1) {
      const preflight = await send(proxyPort, {
        method: 'OPTIONS',
        headers: preflightHeaders,
      });
      expect(preflight.statusCode).toBe(204);
    }

    expect((await send(proxyPort)).statusCode).toBe(200);
  });

  it('leaves routes without a policy untouched', async () => {
    await startProxy(new MemoryRateLimitStore());

    for (let i = 0; i < 3; i += 1) {
      const response = await send(proxyPort, { path: '/free' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['ratelimit-limit']).toBeUndefined();
    }
  });

  it('lets requests through when the store fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await startProxy({
      increment: () => Promise.reject(new Error('store down')),
      close: async () => {},
    });

    for (let i = 0; i < 3; i += 1) {
      expect((await send(proxyPort)).statusCode).toBe(200);
    }
    errorSpy.mockRestore();
  });
});
