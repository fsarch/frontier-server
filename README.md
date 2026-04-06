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

Images are published to Docker Hub:

- `https://hub.docker.com/repository/docker/fsarch/frontier-server`

The project uses the following tags:

- `latest-api` for `frontier-api`
- `latest-worker` for `frontier-worker`

Example pull commands:

```bash
docker pull fsarch/frontier-server:latest-api
docker pull fsarch/frontier-server:latest-worker
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

## Notes

- The API exposes Swagger docs at `/docs` when running.
- The worker currently connects to the API websocket endpoint at `ws://localhost:3000/api/workers/websocket`.

