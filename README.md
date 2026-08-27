# Frontier Server

Frontier Server is the gateway layer of the FSARCH project.

This repository is a monorepo with two NestJS-based applications:

- `frontier-api`: the control plane for configuration and management tasks.
- `frontier-worker`: the data plane worker that executes gateway/proxy behavior and processes end-user requests.

## Architecture Overview

- `frontier-api` provides APIs for gateway configuration and orchestrates workers.
- `frontier-worker` connects to the API/control channel and runs the actual request handling logic.
- Together they split management concerns (API) from runtime execution (Worker).

## Repository Structure

- `apps/frontier-api` - API service, configuration, database access, auth, and admin endpoints.
- `apps/frontier-worker` - Worker runtime and communication client.

## Docker Images

Each app publishes to its own Docker Hub repository (matching the
`fsarch/helm-charts` chart names, not the `apps/*` directory names -
`frontier-api` publishes as `frontier-server` to match this repo's own
name):

- `https://hub.docker.com/r/fsarch/frontier-server` for `apps/frontier-api`
- `https://hub.docker.com/r/fsarch/frontier-worker` for `apps/frontier-worker`

Tags: `latest` (floating, off `main`), `<version>` and `stable` (off `vX.Y.Z`
release tags).

Example pull commands:

```bash
docker pull fsarch/frontier-server:stable
docker pull fsarch/frontier-worker:stable
```

## Prerequisites

- Node.js (LTS recommended)
- npm with workspace support

## Getting Started

1. Install dependencies from the repository root:

```bash
npm install
```

2. Prepare API configuration:

- Copy `apps/frontier-api/config/config.template.yml` to `apps/frontier-api/config/config.yml` if needed.
- Adjust values for database, auth, and remote events.

3. Start the API service:

```bash
npm --workspace apps/frontier-api run start:dev
```

4. Start the worker in a second terminal:

```bash
npm --workspace apps/frontier-worker run start:dev
```

## Common Commands

```bash
npm --workspace apps/frontier-api run build
npm --workspace apps/frontier-api run test
npm --workspace apps/frontier-worker run build
npm --workspace apps/frontier-worker run test
```

## Tracing

Both apps support OpenTelemetry distributed tracing, off by default:

- `frontier-api` gets it automatically from `@fsarch/server` - enable via
  the `tracing:` section of `config.yml` (see `apps/frontier-api/README.md`).
- `frontier-worker` is env-var configured (`FRONTIER_WORKER_TRACING_*`, see
  `apps/frontier-worker/README.md`).

Trace context propagates across the control-plane/data-plane boundary (W3C
`traceparent`), so a trace started at `frontier-api` continues into
`frontier-worker` and vice versa when both have tracing enabled.

## Notes

- The API exposes Swagger docs at `/docs` when running.
- The worker currently connects to the API websocket endpoint at `ws://localhost:3000/api/workers/websocket`.

