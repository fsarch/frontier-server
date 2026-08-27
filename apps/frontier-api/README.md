# frontier-api

`frontier-api` is the configuration and management service of the FSARCH gateway stack.

It is responsible for control-plane concerns, including:

- Managing gateway entities (for example domain groups, upstream groups, path rules, and cache policies)
- Providing authenticated administrative APIs
- Persisting and validating configuration data
- Coordinating with connected workers

## Tech Stack

- NestJS
- TypeORM
- PostgreSQL/CockroachDB-compatible configuration
- Swagger/OpenAPI for API documentation

## Configuration

This service reads configuration from `config/config.yml`.

- A template is provided in `config/config.template.yml`.
- Make sure database, auth, and remote event settings are valid for your environment.

## Tracing

`frontier-api` gets OpenTelemetry tracing for free from `@fsarch/server` (HTTP,
Express, Postgres and Nest guards/interceptors/handlers) - no code changes
needed, just a `tracing:` section in `config.yml`:

```yaml
tracing:
  enabled: true
  serviceName: frontier-api # defaults to the name passed to FsArchAppBuilder
  sampleRatio: 1.0 # 0.0 - 1.0, defaults to 1.0
  exporter:
    type: console # or otlp-http / otlp-grpc, see config.template.yml
```

Off by default. See `@fsarch/server`'s own README for the full exporter
reference and for `@Span()`/`withSpan()`/`getTracer()` to add manual spans
around specific business logic.

`frontier-worker`'s tracing is separate (env-var configured, see its own
README) but exports the same way and participates in the same traces via
W3C `traceparent` propagation across the control-plane/data-plane boundary.

## Run Locally

From repository root:

```bash
npm install
npm --workspace apps/frontier-api run start:dev
```

By default, the server listens on port `3000` (or `PORT` if set).

## API Documentation

When running, Swagger UI is available at:

- `http://localhost:3000/docs`

## Useful Scripts

```bash
npm --workspace apps/frontier-api run build
npm --workspace apps/frontier-api run lint
npm --workspace apps/frontier-api run test
npm --workspace apps/frontier-api run test:e2e
```
