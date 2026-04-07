#!/usr/bin/env zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

debug_enabled() {
  local value="${FRONTIER_WORKER_DEBUG:-false}"
  [[ "$value" == "1" || "$value:l" == "true" || "$value:l" == "debug" ]]
}

debug_log() {
  if debug_enabled; then
	echo "[worker-local][debug] $1"
  fi
}

export FRONTIER_WORKER_PORT="${FRONTIER_WORKER_PORT:-8080}"
export FRONTIER_CONTROL_PLANE_URL="${FRONTIER_CONTROL_PLANE_URL:-ws://localhost:8081/api/workers/websocket}"
export FRONTIER_WORKER_AUTH_TOKEN="${FRONTIER_WORKER_AUTH_TOKEN:-Test}"
export FRONTIER_WORKER_HEARTBEAT_MS="${FRONTIER_WORKER_HEARTBEAT_MS:-10000}"
export FRONTIER_WORKER_DEBUG="${FRONTIER_WORKER_DEBUG:-true}"

echo "[worker-local] FRONTIER_WORKER_PORT=$FRONTIER_WORKER_PORT"
echo "[worker-local] FRONTIER_CONTROL_PLANE_URL=$FRONTIER_CONTROL_PLANE_URL"
echo "[worker-local] FRONTIER_WORKER_AUTH_TOKEN=<redacted>"
echo "[worker-local] FRONTIER_WORKER_HEARTBEAT_MS=$FRONTIER_WORKER_HEARTBEAT_MS"
echo "[worker-local] FRONTIER_WORKER_DEBUG=$FRONTIER_WORKER_DEBUG"

debug_log "SCRIPT_DIR=$SCRIPT_DIR"
debug_log "REPO_ROOT=$REPO_ROOT"

if [[ -n "${PORT:-}" ]]; then
  debug_log "PORT is set to '$PORT' (used by API, not by worker data-plane)"
fi

if [[ "$FRONTIER_CONTROL_PLANE_URL" != ws://* && "$FRONTIER_CONTROL_PLANE_URL" != wss://* ]]; then
  echo "[worker-local][warn] FRONTIER_CONTROL_PLANE_URL does not look like a websocket URL: $FRONTIER_CONTROL_PLANE_URL"
fi

if command -v lsof >/dev/null 2>&1; then
  if lsof -nP -iTCP:"$FRONTIER_WORKER_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
	echo "[worker-local][warn] port $FRONTIER_WORKER_PORT already has a listener"
  else
	debug_log "port $FRONTIER_WORKER_PORT is currently free"
  fi
fi

if command -v curl >/dev/null 2>&1; then
  local_api_http="http://127.0.0.1:8081/"
  if curl -sS --max-time 1 "$local_api_http" >/dev/null 2>&1; then
	debug_log "local API endpoint reachable at $local_api_http"
  else
	echo "[worker-local][warn] local API endpoint not reachable at $local_api_http (control-plane URL: $FRONTIER_CONTROL_PLANE_URL)"
  fi
fi

echo "[worker-local] starting worker against local API..."
cd "$REPO_ROOT"
exec npm --workspace apps/frontier-worker run start:dev

