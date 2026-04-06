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

## Run Locally

From repository root:

```bash
npm install
npm --workspace apps/frontier-worker run start:dev
```

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

