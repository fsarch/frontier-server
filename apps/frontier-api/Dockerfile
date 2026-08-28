# syntax=docker/dockerfile:1

FROM node:24.20.0-trixie-slim AS base

WORKDIR /usr/src/app

COPY package*.json ./
COPY apps/frontier-api/package*.json ./apps/frontier-api/


FROM base AS deps

ENV NODE_ENV=production

RUN npm ci --fetch-timeout=300000 --workspace apps/frontier-api --include-workspace-root=false


FROM base AS builder

RUN npm ci --fetch-timeout=300000 --workspace apps/frontier-api --include-workspace-root=false

COPY apps/frontier-api ./apps/frontier-api

RUN npm --workspace apps/frontier-api run build


FROM base

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

COPY --from=deps /usr/src/app ./
COPY --from=builder /usr/src/app/apps/frontier-api/dist ./apps/frontier-api/dist
COPY --from=builder /usr/src/app/apps/frontier-api/config ./apps/frontier-api/config

WORKDIR /usr/src/app/apps/frontier-api

# Preloads OpenTelemetry auto-instrumentation (HTTP/Express/Nest) before the
# app's own module graph loads — required for `tracing.enabled: true` in
# config.yaml to actually instrument anything, no-op otherwise. See
# https://github.com/fsarch/server#tracing-opentelemetry
CMD ["node", "--import", "@fsarch/server/register", "dist/main"]
