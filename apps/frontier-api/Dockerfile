# syntax=docker/dockerfile:1

FROM node:24.14.1-trixie-slim AS deps

WORKDIR /usr/src/app

COPY package*.json ./
COPY apps/frontier-api/package*.json ./apps/frontier-api/

RUN npm ci --fetch-timeout=300000 --workspace apps/frontier-api --include-workspace-root=false


FROM node:24.14.1-trixie-slim AS builder

WORKDIR /usr/src/app

COPY package*.json ./
COPY apps/frontier-api/package*.json ./apps/frontier-api/

RUN npm ci --fetch-timeout=300000 --workspace apps/frontier-api --include-workspace-root=false

COPY apps/frontier-api ./apps/frontier-api

RUN npm --workspace apps/frontier-api run build


FROM node:24.14.1-trixie-slim AS runner

ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /usr/src/app

COPY package*.json ./
COPY apps/frontier-api/package*.json ./apps/frontier-api/

RUN npm ci --omit=dev --fetch-timeout=300000 --workspace apps/frontier-api --include-workspace-root=false \
    && npm cache clean --force

COPY --from=builder /usr/src/app/apps/frontier-api/dist ./apps/frontier-api/dist
COPY --from=builder /usr/src/app/apps/frontier-api/config ./apps/frontier-api/config

WORKDIR /usr/src/app/apps/frontier-api

EXPOSE 8080

CMD ["node", "dist/main"]

