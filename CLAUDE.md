# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

npm-workspaces monorepo (lerna is present but only used for versioning, not publishing/running) with two independent NestJS-flavored apps under `apps/`:

- `apps/frontier-api` — the **control plane**: NestJS app (built on the private `@fsarch/server` framework), owns configuration state in a Postgres/CockroachDB database via TypeORM, exposes admin/config REST APIs + Swagger, and pushes config to workers over a WebSocket.
- `apps/frontier-worker` — the **data plane**: a plain Node.js runtime (no NestJS) that connects to `frontier-api` over WebSocket to receive config, compiles it into an in-memory route table, and runs a raw `http` proxy server that serves end-user traffic.

Both apps are ESM (`"type": "module"`), TypeScript with `NodeNext` module resolution — **relative imports must use explicit `.js` extensions**, even though the source is `.ts`.

`@fsarch/server` is a private package published to GitHub Packages under the `@fsarch` scope; installing dependencies requires npm to be configured with a token for `npm.pkg.github.com` (see `.github/workflows/test.yml` for the exact `.npmrc` setup CI uses).

## Commands

Run from the repo root unless noted. Both apps are npm workspaces, so `npm --workspace apps/<app> run <script>` works from the root, or `cd` into the app dir and drop the `--workspace` flag.

```bash
# install (root, installs both workspaces)
npm install

# frontier-api
npm --workspace apps/frontier-api run start:dev     # dev server (port 3000 / $PORT), Swagger at /docs
npm --workspace apps/frontier-api run build          # uses `fsarch-server build` (from @fsarch/server CLI)
npm --workspace apps/frontier-api run lint
npm --workspace apps/frontier-api run test           # vitest run (unit specs: **/*.spec.ts)
npm --workspace apps/frontier-api run test:watch
npm --workspace apps/frontier-api run test:e2e       # vitest run -c vitest.e2e.config.ts (**/*.e2e-spec.ts)

# frontier-worker
npm --workspace apps/frontier-worker run start:dev   # tsc --watch + node --watch dist/main.js
npm --workspace apps/frontier-worker run start:local # ./scripts/start-local.zsh, sets local env defaults
npm --workspace apps/frontier-worker run build
npm --workspace apps/frontier-worker run lint
npm --workspace apps/frontier-worker run test        # vitest run (src/**/*.spec.ts)
```

Run a single test file directly with vitest, e.g.:

```bash
npx vitest run src/runtime/compiled-config.spec.ts --config apps/frontier-worker/vitest.config.ts
```

(or `cd apps/<app> && npx vitest run <path-to-spec>`).

For local end-to-end development, start `frontier-api` first — `frontier-worker` needs the websocket endpoint (`ws://localhost:3000/api/workers/websocket` by default) available to bootstrap.

Both apps read YAML config from `config/config.yml`, copied from the committed `config/config.template.yml` (gitignored once created).

## Architecture

### Domain model (owned by frontier-api, shared conceptually with frontier-worker)

Configuration is organized around a `DomainGroup`:

- `DomainGroup` has many `DomainGroupDomain` (hostnames routed to this group) and many `PathRule`s (ordered path-matching rules).
- Each `PathRule` points at an `UpstreamGroup` (which has one or more `Upstream`s, load-balanced round-robin) and optionally at a `CachePolicy`, `CorsPolicy`, `LogPolicy`, and pre/post `Hook`s.
- `Hook`s reference a `functionId` executed on a remote function server (OAuth2 client-credentials auth) — used to run custom pre/post request logic.

Each of these entities follows the same three-file pattern under `apps/frontier-api/src/api/domain-group/**`: `*.controller.ts` (REST endpoints), `*.service.ts` (TypeORM repository access), `*.module.ts` (wiring). DB entities live in `apps/frontier-api/src/database/entities`, TypeORM migrations in `apps/frontier-api/src/database/migrations` and are registered in `apps/frontier-api/src/database/index.ts` (`DATABASE_OPTIONS`) — **new entities/migrations must be added there** or they won't be picked up.

### Control plane ↔ data plane protocol

- `WorkerBootstrapService` (frontier-api) assembles the **entire** config graph into one normalized `WorkerConfigSnapshot` (entity maps keyed by id, e.g. `{ entities, ids }`), and hashes it (SHA-256) to a checksum used for change detection/versioning.
- `WebsocketGateway` (`/api/workers/websocket`) authenticates workers via a shared static token (`workers.websocket.auth_token` in config), replies to a worker's `bootstrap` request with `{ version, checksum, snapshot }`, and on a poll interval (`workers.websocket.config_check_interval_ms`) diffs the checksum and pushes a `CONFIG_SNAPSHOT` event to all connected workers when it changes. `heartbeat` is a simple request/reply keepalive that also carries worker metrics.
- `ControlPlaneClient` (frontier-worker) is the WebSocket client counterpart: connects, auths, requests `bootstrap`, applies pushed `CONFIG_SNAPSHOT` events, auto-reconnects with exponential backoff, and reports heartbeat metrics.
- Workers also POST request logs back to the API over plain HTTP (`FRONTIER_WORKER_LOG_INGEST_URL`, derived from the control-plane URL as `.../api/workers/logs` by default), gated per-route by whether a `LogPolicy` is enabled.

### frontier-worker request pipeline

1. `CompiledWorkerConfig` (`runtime/compiled-config.ts`) turns a raw `WorkerConfigSnapshot` into an efficient lookup structure: hostname → domain group → ordered path rules → round-robin upstream list. Path matching supports exact/prefix rules, catch-all (`*`), and suffix-wildcard (`*.ext`) patterns; `resolve(host, path)` is the hot-path route lookup called per request.
2. `HttpProxyServer` (`runtime/http-proxy.server.ts`) is a raw Node `http` server (not Express/Nest) that, per request: resolves the route, handles CORS preflight/origin checks, runs pre-hooks (`FunctionClient`, can short-circuit with a response or rewrite the outgoing request), forwards to the upstream via `undici.fetch` (with an insecure-TLS dispatcher available per-upstream when `sslVerify` is disabled), decompresses gzip upstream responses, runs post-hooks, then applies the built-in CORS and cache-policy response hooks, then compresses the response for the client if `Accept-Encoding` allows it — finally reports the request log.
3. `FunctionClient` (`runtime/function-client.ts`) is the client for the external "function server" that executes hook logic remotely (OAuth2 client-credentials token, cached until near-expiry); pre/post hook payloads and results are validated against the shared `RequestType`/`ResponseType` shapes (`types/http/*.type.ts`) before being trusted.

### Config files

- `apps/frontier-api/config/config.yml`: `uac` (static user/permission list), `auth` (JWT/JWK), `database` (Postgres/CockroachDB + optional SSL/CA), `workers.websocket` (auth token + poll interval), `remote-events`, `function_server`/`function_worker` (remote hook execution + OAuth2 creds).
- `apps/frontier-worker/config/config.yml`: only `function_worker` (remote hook execution + OAuth2 creds) — everything else (port, control-plane URL, auth token, heartbeat interval) is environment-variable driven, see `apps/frontier-worker/README.md` for the full list and `scripts/start-local.zsh` for local defaults.

## Docker

Images are published to Docker Hub as `fsarch/frontier-server` with tags `latest-api` and `latest-worker` (see `.github/workflows/docker-images.yml` and each app's `Dockerfile`).