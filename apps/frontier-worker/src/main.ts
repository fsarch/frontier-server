import { ControlPlaneClient } from './control-plane/control-plane.client';
import { HttpProxyServer, RequestLogPayload } from './runtime/http-proxy.server';
import { request as httpRequest } from 'undici';

const workerPort = parseInt(process.env.FRONTIER_WORKER_PORT ?? '8080', 10);
const controlPlaneUrl = process.env.FRONTIER_CONTROL_PLANE_URL ?? 'ws://localhost:3000/api/workers/websocket';
const workerAuthToken = process.env.FRONTIER_WORKER_AUTH_TOKEN ?? 'Test';
const heartbeatIntervalMs = parseInt(process.env.FRONTIER_WORKER_HEARTBEAT_MS ?? '10000', 10);
const workerLogIngestUrl = process.env.FRONTIER_WORKER_LOG_INGEST_URL ?? deriveWorkerLogIngestUrl(controlPlaneUrl);

async function bootstrap() {
  console.log(`[worker] initializing worker auth=${process.env.FRONTIER_WORKER_AUTH_TOKEN ? 'env' : 'default'} logIngestUrl=${workerLogIngestUrl}`);
  const proxyServer = new HttpProxyServer(workerPort, {
    onRequestLog: async (payload) => {
      await postRequestLog(payload);
    },
  });
  await proxyServer.start();

  const controlPlane = new ControlPlaneClient({
    url: controlPlaneUrl,
    authToken: workerAuthToken,
    heartbeatIntervalMs,
    onSnapshot: (version, snapshot) => {
      proxyServer.setSnapshot(version, snapshot);
      console.log(`[worker] applied config version=${version}`);
    },
    collectHeartbeatPayload: () => proxyServer.getMetrics(),
  });

  controlPlane.start();
  console.log(`[worker] listening on :${workerPort}`);

  const shutdown = async () => {
    controlPlane.stop();
    await proxyServer.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    shutdown().catch(() => process.exit(1));
  });

  process.on('SIGTERM', () => {
    shutdown().catch(() => process.exit(1));
  });
}

bootstrap().catch((error) => {
  console.error('[worker] fatal bootstrap error', error);
  process.exit(1);
});

async function postRequestLog(payload: RequestLogPayload): Promise<void> {
  const response = await httpRequest(workerLogIngestUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-worker-token': workerAuthToken,
    },
    body: JSON.stringify(payload),
  });

  if (response.statusCode >= 300) {
    const responseText = await response.body.text();
    const errorDetails = responseText ? ` (${responseText})` : '';
    throw new Error(`log ingest failed status=${response.statusCode}${errorDetails} url=${workerLogIngestUrl}`);
  }

  await response.body.text();
}

function deriveWorkerLogIngestUrl(websocketUrl: string): string {
  const parsed = new URL(websocketUrl);

  if (parsed.protocol === 'ws:') {
    parsed.protocol = 'http:';
  }

  if (parsed.protocol === 'wss:') {
    parsed.protocol = 'https:';
  }

  parsed.pathname = '/api/workers/logs';
  parsed.search = '';

  return parsed.toString();
}


