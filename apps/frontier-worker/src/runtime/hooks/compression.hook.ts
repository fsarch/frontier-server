import { PostHookPayload } from '../models/post-hook-payload.js';
import { BodyUtils } from '../../utils/http/body.utils.js';
import { gzip as zlibGzip } from 'zlib';
import { promisify } from 'util';

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

export type CompressionResult = {
  body: string | Buffer | Uint8Array;
  headers: Record<string, string>;
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
 * Convert ResponseType headers (string[]) to Record<string, string> (first value)
 */
function headersToRecord(headers: Record<string, string[]>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, values] of Object.entries(headers)) {
    if (values.length > 0) {
      result[key] = values[0];
    }
  }
  return result;
}

/**
 * Perform response body compression based on the PostHookPayload.
 * Automatically extract body and headers from the payload.
 *
 * @param hookPayload - The PostHookPayload with clientRequest, upstreamRequest, and response
 * @param options - Compression options (supportsGzip, minSizeBytes, onDebug)
 * @returns CompressionResult with compressed/uncompressed body and headers
 */
export async function compressResponseBody(
  hookPayload: PostHookPayload,
  options: CompressionOptions,
): Promise<CompressionResult> {
  const { supportsGzip, minSizeBytes = 100, onDebug } = options;

  // Extract body and headers from the payload
  const bodyToSend = BodyUtils.plainObjectToBody(hookPayload.payload.response.body);
  const responseHeaders = headersToRecord(hookPayload.payload.response.headers);

  responseHeaders['content-length'] = Buffer.byteLength(bodyToSend, 'utf8').toString();
  delete responseHeaders['content-encoding'];

  // Only strings can be compressed - Uint8Array is returned directly
  if (bodyToSend instanceof Uint8Array) {
    onDebug?.('not compressing binary response body');
    return { body: bodyToSend, headers: responseHeaders };
  }

  // Check if the content type is compressible
  const contentType = extractContentType(responseHeaders['content-type']);
  const isCompressible = isCompressibleContentType(contentType);
  onDebug?.(`content-type: ${contentType}, compressible: ${isCompressible}`);

  // Return uncompressed if client doesn't support gzip, body is too small, or content-type is not compressible
  if (!supportsGzip || Buffer.byteLength(bodyToSend, 'utf8') <= minSizeBytes || !isCompressible) {
    onDebug?.(
      `not compressing response, supportsGzip=${supportsGzip} bodySize=${Buffer.byteLength(bodyToSend, 'utf8')} minSize=${minSizeBytes} contentType=${contentType} compressible=${isCompressible}`,
    );
    return { body: bodyToSend, headers: responseHeaders };
  }

  const bodySize = Buffer.byteLength(bodyToSend, 'utf8');
  onDebug?.(`compressing response, body size: ${bodySize}`);

  try {
    const compressed = (await gzipAsync(bodyToSend)) as Buffer;
    const compressedSize = compressed.length;

    // Update headers for gzip response
    const headers = { ...responseHeaders };
    headers['content-encoding'] = 'gzip';
    headers['content-length'] = compressedSize.toString();
    delete headers['transfer-encoding'];

    // Update vary header
    if (headers['vary']) {
      if (!headers['vary'].includes('Accept-Encoding')) {
        headers['vary'] += ', Accept-Encoding';
      }
    } else {
      headers['vary'] = 'Accept-Encoding';
    }

    onDebug?.(`compressed response from ${bodySize} to ${compressedSize} bytes`);
    return { body: compressed, headers };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    onDebug?.(`compression failed: ${errorMessage}, sending uncompressed as fallback`);
    console.error('[worker][compression.hook] compression failed:', e);
    return { body: bodyToSend, headers: responseHeaders };
  }
}
