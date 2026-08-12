import { createServer as createHttpServer, request as httpRequest, type IncomingHttpHeaders } from 'node:http';
import { createServer as createNetServer, type AddressInfo } from 'node:net';
import { randomBytes } from 'node:crypto';
import { HttpProxyServer } from './http-proxy.server.js';
import { FunctionClient } from './function-client.js';
import type { WorkerConfigSnapshot } from '../types/worker-config.types.js';

type UpstreamRequest = {
  method: string;
  headers: IncomingHttpHeaders;
  body: Buffer;
};

const FUNCTION_WORKER_CONFIG = {
  type: 'remote' as const,
  url: 'http://function.local',
  auth: {
    type: 'openid-client-credentials' as const,
    token_endpoint: '',
    client_id: '',
    client_secret: '',
  },
};

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createNetServer();
    srv.listen(0, '127.0.0.1', () => {
      const address = srv.address() as AddressInfo | null;
      srv.close(() => {
        if (!address) {
          reject(new Error('failed to allocate a free port'));
          return;
        }
        resolve(address.port);
      });
    });
  });
}

async function startUpstream(): Promise<{
  port: number;
  requests: UpstreamRequest[];
  close: () => Promise<void>;
}> {
  const requests: UpstreamRequest[] = [];

  const server = createHttpServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      requests.push({ method: req.method ?? 'GET', headers: req.headers, body: Buffer.concat(chunks) });
      res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
    });
  });

  const port = await new Promise<number>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
  });

  return {
    port,
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function sendRequest(
  port: number,
  options: { path: string; headers?: Record<string, string>; bodyChunks: Buffer[] },
): Promise<{ statusCode: number; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port,
        method: 'POST',
        path: options.path,
        headers: {
          host: 'worker.test',
          ...options.headers,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, body: Buffer.concat(chunks) }));
      },
    );
    req.on('error', reject);

    for (const chunk of options.bodyChunks) {
      req.write(chunk);
    }
    req.end();
  });
}

function chunkBuffer(buffer: Buffer, chunkSize: number): Buffer[] {
  const chunks: Buffer[] = [];
  for (let offset = 0; offset < buffer.length; offset += chunkSize) {
    chunks.push(buffer.subarray(offset, offset + chunkSize));
  }
  return chunks;
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
              id: 'rule-plain',
              domainGroupId: 'dg-1',
              name: 'plain',
              path: '/plain',
              order: 1,
              cachePolicyId: null,
              upstreamGroupId: 'ug-1',
            },
            {
              id: 'rule-hooked',
              domainGroupId: 'dg-1',
              name: 'hooked',
              path: '/hooked',
              order: 2,
              cachePolicyId: null,
              upstreamGroupId: 'ug-1',
              preHookId: 'hook-1',
            },
          ],
        },
      },
    },
    domainGroupDomainsByDomain: {
      ids: ['worker.test'],
      entities: {
        'worker.test': { id: 'dgd-1', domainGroupId: 'dg-1', domainName: 'worker.test' },
      },
    },
    cachePolicies: { ids: [], entities: {} },
    corsPolicies: { ids: [], entities: {} },
    logPolicies: { ids: [], entities: {} },
    hooks: {
      ids: ['hook-1'],
      entities: {
        'hook-1': { id: 'hook-1', name: 'test-hook', functionId: 'fn-1' },
      },
    },
    upstreamGroups: {
      ids: ['ug-1'],
      entities: {
        'ug-1': {
          id: 'ug-1',
          domainGroupId: 'dg-1',
          name: 'upstreams',
          upstreams: [
            { id: 'up-1', upstreamGroupId: 'ug-1', name: 'svc', host: '127.0.0.1', port: upstreamPort, path: '/' },
          ],
        },
      },
    },
  };
}

describe('HttpProxyServer request body handling', () => {
  let upstream: Awaited<ReturnType<typeof startUpstream>>;
  let proxy: HttpProxyServer;
  let proxyPort: number;
  let functionClient: FunctionClient;

  beforeEach(async () => {
    upstream = await startUpstream();
    proxyPort = await getFreePort();

    functionClient = new FunctionClient({ function_worker: FUNCTION_WORKER_CONFIG });

    proxy = new HttpProxyServer(proxyPort, {
      functionClient,
      functionConfigs: { function_worker: FUNCTION_WORKER_CONFIG },
    });
    proxy.setSnapshot(1, buildSnapshot(upstream.port));
    await proxy.start();
  });

  afterEach(async () => {
    await proxy.stop();
    await upstream.close();
  });

  it('streams a large upload straight through to the upstream without buffering when no pre-hook is configured', async () => {
    // Includes plenty of byte sequences that are not valid UTF-8, to prove nothing decodes/re-encodes them.
    const payload = randomBytes(512 * 1024);

    const response = await sendRequest(proxyPort, {
      path: '/plain',
      headers: { 'content-type': 'application/octet-stream' },
      bodyChunks: chunkBuffer(payload, 64 * 1024),
    });

    expect(response.statusCode).toBe(200);
    expect(upstream.requests).toHaveLength(1);
    const upstreamRequest = upstream.requests[0];

    // No content-length is forwarded because the body was never buffered up-front; undici streams it
    // as chunked transfer-encoding instead of collecting it into memory first.
    expect(upstreamRequest.headers['transfer-encoding']).toBe('chunked');
    expect(upstreamRequest.headers['content-length']).toBeUndefined();

    // Bytes must arrive byte-for-byte identical.
    expect(Buffer.compare(upstreamRequest.body, payload)).toBe(0);
  });

  it('buffers the body into a Uint8Array for the pre-hook (unmangled) when a pre-hook is configured', async () => {
    const payload = randomBytes(256 * 1024);
    let capturedBody: unknown;

    const executeHookSpy = vi.spyOn(functionClient, 'executeHook').mockImplementation(async (_hook, hookPayload: any) => {
      capturedBody = hookPayload.payload.upstreamRequest.body;
      return {
        statusCode: 201,
        headers: {},
        body: hookPayload.payload.upstreamRequest,
      };
    });

    const response = await sendRequest(proxyPort, {
      path: '/hooked',
      headers: { 'content-type': 'application/octet-stream' },
      bodyChunks: chunkBuffer(payload, 64 * 1024),
    });

    expect(response.statusCode).toBe(200);
    expect(executeHookSpy).toHaveBeenCalled();

    // The pre-hook must see the full body materialized as a binary.uint8array, matching the original bytes exactly.
    expect((capturedBody as any)?.type).toBe('binary.uint8array');
    expect(Buffer.compare(Buffer.from((capturedBody as any).payload), payload)).toBe(0);

    // Because a pre-hook ran, the buffered bytes are sent upstream as a fixed-length body (content-length, not chunked).
    expect(upstream.requests).toHaveLength(1);
    const upstreamRequest = upstream.requests[0];
    expect(upstreamRequest.headers['content-length']).toBe(String(payload.byteLength));
    expect(upstreamRequest.headers['transfer-encoding']).toBeUndefined();
    expect(Buffer.compare(upstreamRequest.body, payload)).toBe(0);
  });

  it('decodes a JSON body for the pre-hook as a parsed object (type: json), not raw bytes', async () => {
    const payloadObject = { hello: 'world', nested: { count: 3 } };
    let capturedBody: unknown;

    vi.spyOn(functionClient, 'executeHook').mockImplementation(async (_hook, hookPayload: any) => {
      capturedBody = hookPayload.payload.upstreamRequest.body;
      return {
        statusCode: 201,
        headers: {},
        body: hookPayload.payload.upstreamRequest,
      };
    });

    const response = await sendRequest(proxyPort, {
      path: '/hooked',
      headers: { 'content-type': 'application/json' },
      bodyChunks: [Buffer.from(JSON.stringify(payloadObject), 'utf-8')],
    });

    expect(response.statusCode).toBe(200);
    expect((capturedBody as any)?.type).toBe('json');
    expect((capturedBody as any)?.payload).toEqual(payloadObject);
  });

  it('decodes a text/plain body for the pre-hook as a string (type: text)', async () => {
    let capturedBody: unknown;

    vi.spyOn(functionClient, 'executeHook').mockImplementation(async (_hook, hookPayload: any) => {
      capturedBody = hookPayload.payload.upstreamRequest.body;
      return {
        statusCode: 201,
        headers: {},
        body: hookPayload.payload.upstreamRequest,
      };
    });

    const response = await sendRequest(proxyPort, {
      path: '/hooked',
      headers: { 'content-type': 'text/plain' },
      bodyChunks: [Buffer.from('just some plain text', 'utf-8')],
    });

    expect(response.statusCode).toBe(200);
    expect((capturedBody as any)?.type).toBe('text');
    expect((capturedBody as any)?.payload).toBe('just some plain text');
  });

  it('falls back to raw bytes for the pre-hook when Content-Type claims JSON but the body is not valid JSON', async () => {
    let capturedBody: unknown;

    vi.spyOn(functionClient, 'executeHook').mockImplementation(async (_hook, hookPayload: any) => {
      capturedBody = hookPayload.payload.upstreamRequest.body;
      return {
        statusCode: 201,
        headers: {},
        body: hookPayload.payload.upstreamRequest,
      };
    });

    const response = await sendRequest(proxyPort, {
      path: '/hooked',
      headers: { 'content-type': 'application/json' },
      bodyChunks: [Buffer.from('not actually json', 'utf-8')],
    });

    expect(response.statusCode).toBe(200);
    expect((capturedBody as any)?.type).toBe('binary.uint8array');
    expect(Buffer.from((capturedBody as any).payload).toString('utf-8')).toBe('not actually json');
  });

  it('does not buffer GET requests and forwards them without a body', async () => {
    const response = await new Promise<{ statusCode: number }>((resolve, reject) => {
      const req = httpRequest(
        {
          host: '127.0.0.1',
          port: proxyPort,
          method: 'GET',
          path: '/plain',
          headers: { host: 'worker.test' },
        },
        (res) => {
          res.resume();
          res.on('end', () => resolve({ statusCode: res.statusCode ?? 0 }));
        },
      );
      req.on('error', reject);
      req.end();
    });

    expect(response.statusCode).toBe(200);
    expect(upstream.requests).toHaveLength(1);
    expect(upstream.requests[0].body.length).toBe(0);
  });
});
