import { PostHookPayload } from '../models/post-hook-payload.js';
import { BodyUtils } from '../../utils/http/body.utils.js';
import { gzip as zlibGzip } from 'zlib';
import { promisify } from 'util';
import type { ResponseType } from '../../types/http/response.type.js';
import type { HeadersType } from '../../types/http/shared.type.js';

const gzipAsync = promisify(zlibGzip);

// Allowlist of content types that can be gzip compressed
// Only text-based formats that significantly benefit from compression
const COMPRESSIBLE_CONTENT_TYPES = new Set([
  'text/plain',
  'text/html',
  'text/css',
  'text/javascript',
  'application/javascript',
  'application/json',
  'application/xml',
  'application/xhtml+xml',
  'application/rss+xml',
  'application/atomsvc+xml',
  'application/svg+xml',
]);

export type CompressionOptions = {
  supportsGzip: boolean;
  minSizeBytes?: number;
  onDebug?: (message: string) => void;
};

/**
 * Extract the content type from a header value (remove parameters like charset)
 */
function extractContentType(headerValue: string | undefined): string {
  if (!headerValue) {
    return 'application/octet-stream';
  }
  // Remove everything after ';' (e.g. charset parameter)
  return headerValue.split(';')[0].trim().toLowerCase();
}

/**
 * Check if a content type can be compressed
 */
function isCompressibleContentType(contentType: string): boolean {
  return COMPRESSIBLE_CONTENT_TYPES.has(contentType);
}

/**
 * Read the first value of a header (headers are stored as string[] to support
 * headers such as Set-Cookie that may legitimately occur more than once).
 */
function getHeaderValue(headers: HeadersType, name: string): string | undefined {
  return headers[name]?.[0];
}

/**
 * Perform response body compression based on the PostHookPayload.
 * Automatically extract body and headers from the payload.
 *
 * Mirrors the other built-in post-hooks (buildCorsResponse, buildCacheResponse):
 * it takes a PostHookPayload and returns a full ResponseType with the body/headers
 * adjusted, preserving multi-value headers like Set-Cookie unchanged.
 *
 * @param hookPayload - The PostHookPayload with clientRequest, upstreamRequest, and response
 * @param options - Compression options (supportsGzip, minSizeBytes, onDebug)
 * @returns ResponseType with compressed/uncompressed body and adjusted headers
 */
export async function compressResponseBody(
  hookPayload: PostHookPayload,
  options: CompressionOptions,
): Promise<ResponseType> {
  const { supportsGzip, minSizeBytes = 100, onDebug } = options;
  const response = hookPayload.payload.response;

  // Extract body from the payload; headers are cloned so we never mutate the input
  const bodyToSend = BodyUtils.plainObjectToBody(response.body);
  const headers = { ...response.headers };

  const rawSize = bodyToSend === null ? 0 : Buffer.byteLength(bodyToSend, 'utf8');
  headers['content-length'] = [rawSize.toString()];
  delete headers['content-encoding'];

  // Only strings can be compressed - binary/empty bodies are passed through as-is
  if (bodyToSend === null || bodyToSend instanceof Uint8Array) {
    onDebug?.('not compressing binary response body');
    return { ...response, headers, body: response.body };
  }

  // Check if the content type is compressible
  const contentType = extractContentType(getHeaderValue(headers, 'content-type'));
  const isCompressible = isCompressibleContentType(contentType);
  onDebug?.(`content-type: ${contentType}, compressible: ${isCompressible}`);

  // Return uncompressed if client doesn't support gzip, body is too small, or content-type is not compressible
  if (!supportsGzip || rawSize <= minSizeBytes || !isCompressible) {
    onDebug?.(
      `not compressing response, supportsGzip=${supportsGzip} bodySize=${rawSize} minSize=${minSizeBytes} contentType=${contentType} compressible=${isCompressible}`,
    );
    return { ...response, headers, body: response.body };
  }

  onDebug?.(`compressing response, body size: ${rawSize}`);

  try {
    const compressed = (await gzipAsync(bodyToSend)) as Buffer;

    // Update headers for gzip response
    headers['content-encoding'] = ['gzip'];
    headers['content-length'] = [compressed.length.toString()];
    delete headers['transfer-encoding'];

    // Update vary header
    const vary = getHeaderValue(headers, 'vary');
    headers['vary'] = vary
      ? (vary.includes('Accept-Encoding') ? [vary] : [`${vary}, Accept-Encoding`])
      : ['Accept-Encoding'];

    onDebug?.(`compressed response from ${rawSize} to ${compressed.length} bytes`);
    return {
      ...response,
      headers,
      body: await BodyUtils.bodyToPlainObject(compressed),
    };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    onDebug?.(`compression failed: ${errorMessage}, sending uncompressed as fallback`);
    console.error('[worker][compression.hook] compression failed:', e);
    return { ...response, headers, body: response.body };
  }
}