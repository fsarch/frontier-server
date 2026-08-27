# frontier-worker

`frontier-worker` is the runtime execution component of the FSARCH API gateway stack.

It is responsible for data-plane concerns, including:

- Establishing a worker connection to the control plane (`frontier-api`)
- Executing proxy/gateway behavior at runtime
- Processing user traffic and request flows
- Applying configuration received from the API service

## Runtime Behavior

The worker bootstraps by opening a websocket connection to the API and exchanging control events.

Current default websocket target in source code:

- `ws://localhost:3000/api/workers/websocket`

The worker runtime follows a split control/data-plane approach:

- Control plane (`WebSocket`): auth, bootstrap, config snapshots, heartbeat
- Data plane (`HTTP`): incoming traffic proxying and request forwarding

## Worker Environment

- `FRONTIER_WORKER_PORT` (default `8080`) - data-plane HTTP ingress
- `FRONTIER_CONTROL_PLANE_URL` (default `ws://localhost:3000/api/workers/websocket`)
- `FRONTIER_WORKER_AUTH_TOKEN` (default `Test`)
- `FRONTIER_WORKER_HEARTBEAT_MS` (default `10000`)
- `FRONTIER_WORKER_TRACING_ENABLED` (default `false`) - enables OpenTelemetry tracing
- `FRONTIER_WORKER_TRACING_SERVICE_NAME` (default `frontier-worker`)
- `FRONTIER_WORKER_TRACING_SERVICE_VERSION` (optional)
- `FRONTIER_WORKER_TRACING_SAMPLE_RATIO` (default `1`) - `0`-`1`
- `FRONTIER_WORKER_TRACING_EXPORTER` (default `console`) - `console` | `otlp-http` | `otlp-grpc`
- `FRONTIER_WORKER_TRACING_EXPORTER_URL` (required for `otlp-http`/`otlp-grpc`)
- `FRONTIER_WORKER_TRACING_EXPORTER_HEADERS` (optional, JSON object string, e.g. `{"authorization":"Bearer ..."}`)

## Tracing

When `FRONTIER_WORKER_TRACING_ENABLED=true`, the worker exports OpenTelemetry traces the same
way `frontier-api` does (see `@fsarch/server`'s built-in tracing) - a server span per proxied
request (raw `http.Server` instrumentation) and a client span per outgoing call (upstream
forward + request-log ingest, both go through `undici`/global `fetch`). Trace context propagates
automatically from the incoming request to the outgoing upstream call, so a `frontier-worker` span
shows up as a child of whatever called it and a parent of the upstream call, as long as the caller
and upstream participate in the same trace (W3C `traceparent` propagation).

Tracing is wired up via `node --import ./dist/tracing/register.js` (see the `start*` scripts and
`Dockerfile`) rather than a normal import in `main.ts`, because ESM built-in modules (`http`,
`undici`) need OpenTelemetry's loader hook registered before they are first imported anywhere in
the process.

## Control Plane Events (MVP)

- Worker -> API: `auth`, `bootstrap`, `heartbeat`
- API -> Worker: `bootstrap` reply (`version`, `checksum`, `snapshot`), push event `CONFIG_SNAPSHOT`

The worker applies each new snapshot atomically and immediately serves new routes.

## Run Locally

From repository root:

```bash
npm install
npm --workspace apps/frontier-worker run start:dev
npm --workspace apps/frontier-worker run start:local
```

`start:local` sets local defaults for:

- `FRONTIER_WORKER_PORT=8080`
- `FRONTIER_CONTROL_PLANE_URL=ws://localhost:3000/api/workers/websocket`
- `FRONTIER_WORKER_AUTH_TOKEN=Test`
- `FRONTIER_WORKER_HEARTBEAT_MS=10000`

## Docker Image

The worker image is published on Docker Hub:

- `https://hub.docker.com/repository/docker/fsarch/frontier-server`

Tag used for this service:

- `latest-worker`

Example pull command:

```bash
docker pull fsarch/frontier-server:latest-worker
```

## Useful Scripts

```bash
npm --workspace apps/frontier-worker run build
npm --workspace apps/frontier-worker run lint
npm --workspace apps/frontier-worker run test
```

## Integration Note

For local development, start `frontier-api` before `frontier-worker` so the websocket endpoint is available.

