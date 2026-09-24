# syntax=docker/dockerfile:1

FROM node:24.20.0-trixie-slim AS base

RUN corepack enable

WORKDIR /usr/src/app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontier-api/package.json ./apps/frontier-api/
COPY apps/frontier-worker/package.json ./apps/frontier-worker/


FROM base AS deps

ENV NODE_ENV=production

RUN apt-get update && \
    apt-get install -y node-gyp && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
RUN pnpm install --filter ./apps/frontier-api --frozen-lockfile --prod


FROM base AS builder

RUN apt-get update && \
    apt-get install -y node-gyp && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
RUN pnpm install --filter ./apps/frontier-api --frozen-lockfile

COPY apps/frontier-api ./apps/frontier-api

RUN pnpm --filter ./apps/frontier-api run build


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
