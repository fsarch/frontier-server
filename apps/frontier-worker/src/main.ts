import { ControlPlaneClient } from './control-plane/control-plane.client';
import { HttpProxyServer } from './runtime/http-proxy.server';

const workerPort = parseInt(process.env.FRONTIER_WORKER_PORT ?? '8080', 10);
const controlPlaneUrl = process.env.FRONTIER_CONTROL_PLANE_URL ?? 'ws://localhost:3000/api/workers/websocket';
const workerAuthToken = process.env.FRONTIER_WORKER_AUTH_TOKEN ?? 'Test';
const heartbeatIntervalMs = parseInt(process.env.FRONTIER_WORKER_HEARTBEAT_MS ?? '10000', 10);

async function bootstrap() {
  const proxyServer = new HttpProxyServer(workerPort);
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
