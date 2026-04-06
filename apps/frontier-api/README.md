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
