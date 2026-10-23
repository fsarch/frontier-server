import { ControlPlaneClient } from './control-plane/control-plane.client.js';
import { resolveControlPlaneUrls } from './control-plane/control-plane-urls.js';
import { loadWorkerConfig } from './runtime/config-loader.js';
import { FunctionClient } from './runtime/function-client.js';
import {
  HttpProxyServer,
  RequestLogPayload,
} from './runtime/http-proxy.server.js';
import { createRateLimitStore } from './runtime/rate-limit/create-rate-limit-store.js';
import { RateLimiter } from './runtime/rate-limit/rate-limiter.js';
import { shutdownTracing } from './tracing/tracing.js';

const workerPort = parseInt(process.env.FRONTIER_WORKER_PORT ?? '8080', 10);
const { websocketUrl: controlPlaneUrl, logIngestUrl: workerLogIngestUrl } =
  resolveControlPlaneUrls(process.env);
const workerAuthToken = process.env.FRONTIER_WORKER_AUTH_TOKEN ?? 'Test';
const heartbeatIntervalMs = parseInt(
  process.env.FRONTIER_WORKER_HEARTBEAT_MS ?? '10000',
  10,
);
const configPath = process.env.FRONTIER_WORKER_CONFIG_PATH;

async function bootstrap() {
  console.log(
    `[worker] initializing worker auth=${process.env.FRONTIER_WORKER_AUTH_TOKEN ? 'env' : 'default'} controlPlaneUrl=${controlPlaneUrl} logIngestUrl=${workerLogIngestUrl}`,
  );

  // Load function configurations
  const { functionConfigs, rateLimit } = await loadWorkerConfig(configPath);
  console.log(
    `[worker] loaded function configs: worker=${functionConfigs.function_worker ? 'configured' : 'not configured'}`,
  );

  const functionClient = new FunctionClient(functionConfigs);

  const rateLimiter = new RateLimiter(createRateLimitStore(rateLimit.store), {
    trustForwardedFor: rateLimit.trust_forwarded_for,
  });
  console.log(
    `[worker] rate limit store=${rateLimit.store.type} trustForwardedFor=${rateLimit.trust_forwarded_for}`,
  );

  const proxyServer = new HttpProxyServer(workerPort, {
    onRequestLog: async (payload) => {
      await postRequestLog(payload);
    },
    functionClient,
    functionConfigs,
    rateLimiter,
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
    await rateLimiter.close();
    await shutdownTracing();
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
  const response = await fetch(workerLogIngestUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-worker-token': workerAuthToken,
    },
    body: JSON.stringify(payload),
  });

  if (response.status >= 300) {
    const responseText = await response.text();
    const errorDetails = responseText ? ` (${responseText})` : '';
    console.error(
      `[worker] log ingest failed: status=${response.status}, token=${workerAuthToken ? 'set' : 'empty'}, url=${workerLogIngestUrl}, details=${errorDetails}`,
    );
    throw new Error(
      `log ingest failed status=${response.status}${errorDetails} url=${workerLogIngestUrl}`,
    );
  }
}
