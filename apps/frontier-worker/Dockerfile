# syntax=docker/dockerfile:1

FROM node:24.20.0-trixie-slim AS base

WORKDIR /usr/src/app

COPY package*.json ./
COPY apps/frontier-worker/package*.json ./apps/frontier-worker/


FROM base AS deps

ENV NODE_ENV=production

RUN apt-get update && \
    apt-get install -y node-gyp && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
RUN npm ci --fetch-timeout=300000 --workspace apps/frontier-worker --include-workspace-root=false


FROM base AS builder

RUN apt-get update && \
    apt-get install -y node-gyp && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
RUN npm ci --fetch-timeout=300000 --workspace apps/frontier-worker --include-workspace-root=false

COPY apps/frontier-worker ./apps/frontier-worker

RUN npm --workspace apps/frontier-worker run build


FROM base

ENV NODE_ENV=production
ENV FRONTIER_WORKER_PORT=8080

EXPOSE 8080

COPY --from=deps /usr/src/app ./
COPY --from=builder /usr/src/app/apps/frontier-worker/dist ./apps/frontier-worker/dist

WORKDIR /usr/src/app/apps/frontier-worker

CMD ["node", "--import", "./dist/tracing/register.js", "dist/main"]
