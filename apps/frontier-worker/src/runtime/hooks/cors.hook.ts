import { PostHookPayload } from '../models/post-hook-payload.js';
import type { RouteCorsPolicy } from '../http-proxy.server.js';
import type { ResponseType } from '../../types/http/response.type.js';
import type { RequestType } from '../../types/http/request.type.js';

/**
 * Extrahiere den Origin-Header aus einem RequestType.
 * Nützlich für CORS-Processing, wenn die Request-Daten als RequestType vorliegen.
 */
export function getOriginFromRequest(request: RequestType): string | undefined {
  const headers = request.headers;
  const originValue = headers['origin'] || headers.origin;
  
  if (!originValue) {
    return undefined;
  }
  
  const value = Array.isArray(originValue) ? originValue[0] : originValue;
  return value ?? undefined;
}

/**
 * Build CORS headers for a given policy and origin.
 * This is a helper function used by buildCorsResponse.
 */
export function buildCorsHeaders(
  policy: RouteCorsPolicy,
  origin: string,
  requestHeaders?: string | string[],
): Record<string, string[]> {
  const allowOrigin = policy.allowedOrigins.includes('*') && !policy.allowCredentials
    ? '*'
    : origin;

  const result: Record<string, string[]> = {
    'access-control-allow-origin': [allowOrigin],
    'access-control-allow-methods': ['GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS'],
    'access-control-max-age': ['600'],
    'vary': ['Origin'],
  };

  const requestedHeaders = Array.isArray(requestHeaders) ? requestHeaders[0] : requestHeaders;
  const sanitizedHeaders = requestedHeaders && requestedHeaders.trim().length > 0
    ? requestedHeaders.split(',').map(h => h.trim()).filter(h => /^[a-zA-Z0-9\-_]+$/.test(h)).join(',')
    : '*';
  
  result['access-control-allow-headers'] = [sanitizedHeaders.length > 0 ? sanitizedHeaders : '*'];

  if (policy.allowCredentials) {
    result['access-control-allow-credentials'] = ['true'];
  }

  return result;
}

/**
 * Build CORS headers for HTTP response (Record<string, string> format).
 * This is used when setting headers directly on ServerResponse.
 */
export function buildCorsHeadersForHttp(
  policy: RouteCorsPolicy,
  origin: string,
  requestHeaders?: string | string[],
): Record<string, string> {
  const corsHeaders = buildCorsHeaders(policy, origin, requestHeaders);
  const result: Record<string, string> = {};
  for (const [key, values] of Object.entries(corsHeaders)) {
    if (values.length > 0) {
      result[key] = values[0];
    }
  }
  return result;
}

/**
 * Erstellt eine Response mit CORS-Headern aus einem PostHookPayload.
 * Der Origin wird automatisch aus dem clientRequest extrahiert.
 * Die upstream Headers werden aus corsPayload.payload.response.headers entnommen.
 */
export function buildCorsResponse(
  corsPayload: PostHookPayload,
  corsPolicy: RouteCorsPolicy,
): ResponseType {
  // Extrahiere Origin aus dem clientRequest im Payload
  const origin = getOriginFromRequest(corsPayload.payload.clientRequest);
  
  // Extrahiere die Headers aus der Response im Payload
  const responseHeaders = { ...corsPayload.payload.response.headers };
  
  if (corsPolicy.enabled && origin) {
    Object.assign(responseHeaders, buildCorsHeaders(corsPolicy, origin));
  }
  
  return {
    ...corsPayload.payload.response,
    headers: responseHeaders,
  };
}
