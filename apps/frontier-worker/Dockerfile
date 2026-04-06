# syntax=docker/dockerfile:1

FROM node:24.14.1-trixie-slim AS deps

WORKDIR /usr/src/app

COPY package*.json ./
COPY apps/frontier-worker/package*.json ./apps/frontier-worker/

RUN npm ci --fetch-timeout=300000 --workspace apps/frontier-worker --include-workspace-root=false


FROM node:24.14.1-trixie-slim AS builder

WORKDIR /usr/src/app

COPY package*.json ./
COPY apps/frontier-worker/package*.json ./apps/frontier-worker/

RUN npm ci --fetch-timeout=300000 --workspace apps/frontier-worker --include-workspace-root=false

COPY apps/frontier-worker ./apps/frontier-worker

RUN npm --workspace apps/frontier-worker run build


FROM node:24.14.1-trixie-slim AS runner

ENV NODE_ENV=production

WORKDIR /usr/src/app

COPY package*.json ./
COPY apps/frontier-worker/package*.json ./apps/frontier-worker/

RUN npm ci --omit=dev --fetch-timeout=300000 --workspace apps/frontier-worker --include-workspace-root=false \
    && npm cache clean --force

COPY --from=builder /usr/src/app/apps/frontier-worker/dist ./apps/frontier-worker/dist

WORKDIR /usr/src/app/apps/frontier-worker

CMD ["node", "dist/main"]

