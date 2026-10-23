export const DEFAULT_FRONTIER_API_URL = 'http://localhost:3000';

const WEBSOCKET_PATH = '/api/workers/websocket';
const LOG_INGEST_PATH = '/api/workers/logs';

export type ControlPlaneUrls = {
  websocketUrl: string;
  logIngestUrl: string;
};

type ControlPlaneEnv = {
  FRONTIER_API_URL?: string;
  /** @deprecated full websocket URL - use `FRONTIER_API_URL` instead */
  FRONTIER_CONTROL_PLANE_URL?: string;
  /** @deprecated full log ingest URL - use `FRONTIER_API_URL` instead */
  FRONTIER_WORKER_LOG_INGEST_URL?: string;
};

/**
 * Both endpoints the worker talks to, derived from frontier-api's base URL
 * (`FRONTIER_API_URL`, e.g. `http://frontier-api:8080`). The base may carry
 * a path, so frontier-api mounted under a prefix (`http://aio/frontier`)
 * works the same as a standalone one: the websocket and log endpoints are
 * appended to it instead of replacing it.
 *
 * The older full-URL variables still win when set, so existing deployments
 * keep working. Without `FRONTIER_API_URL`, the base is derived from
 * `FRONTIER_CONTROL_PLANE_URL` (minus its websocket path) for the log URL.
 */
export function resolveControlPlaneUrls(
  env: ControlPlaneEnv,
): ControlPlaneUrls {
  const legacyWebsocketUrl = nonEmpty(env.FRONTIER_CONTROL_PLANE_URL);
  const baseUrl =
    nonEmpty(env.FRONTIER_API_URL) ??
    (legacyWebsocketUrl
      ? stripPathSuffix(legacyWebsocketUrl, WEBSOCKET_PATH)
      : DEFAULT_FRONTIER_API_URL);

  return {
    websocketUrl:
      legacyWebsocketUrl ?? joinPath(baseUrl, WEBSOCKET_PATH, websocketScheme),
    logIngestUrl:
      nonEmpty(env.FRONTIER_WORKER_LOG_INGEST_URL) ??
      joinPath(baseUrl, LOG_INGEST_PATH, httpScheme),
  };
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function websocketScheme(protocol: string): string {
  if (protocol === 'http:') return 'ws:';
  if (protocol === 'https:') return 'wss:';
  return protocol;
}

function httpScheme(protocol: string): string {
  if (protocol === 'ws:') return 'http:';
  if (protocol === 'wss:') return 'https:';
  return protocol;
}

function joinPath(
  baseUrl: string,
  path: string,
  scheme: (protocol: string) => string,
): string {
  const url = new URL(baseUrl);

  if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) {
    throw new Error(
      `FRONTIER_API_URL must be an http(s):// or ws(s):// URL, got "${baseUrl}"`,
    );
  }

  url.protocol = scheme(url.protocol);
  url.pathname = `${url.pathname.replace(/\/+$/, '')}${path}`;
  url.search = '';
  url.hash = '';

  return url.toString();
}

function stripPathSuffix(url: string, suffix: string): string {
  const parsed = new URL(url);
  const pathname = parsed.pathname.replace(/\/+$/, '');
  parsed.pathname = pathname.endsWith(suffix)
    ? pathname.slice(0, -suffix.length)
    : '';
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
}
