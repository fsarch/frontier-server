import { PostHookPayload } from '../models/post-hook-payload.js';
import { BodyUtils } from '../../utils/http/body.utils.js';
import { gzip as zlibGzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(zlibGzip);

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
 * Konvertiere ResponseType headers (string[]) zu Record<string, string> (erste Wert)
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
 * Führt Response-Body-Kompression durch, basierend auf dem PostHookPayload.
 * Extrahiere body und headers automatisch aus dem Payload.
 * 
 * @param hookPayload - Der PostHookPayload mit clientRequest, upstreamRequest und response
 * @param options - Kompressionsoptionen (supportsGzip, minSizeBytes, onDebug)
 * @returns CompressionResult mit komprimiertem/unkomprimiertem Body und Headern
 */
export async function compressResponseBody(
  hookPayload: PostHookPayload,
  options: CompressionOptions,
): Promise<CompressionResult> {
  const { supportsGzip, minSizeBytes = 100, onDebug } = options;
  
  // Extrahiere body und headers aus dem Payload
  const bodyToSend = BodyUtils.plainObjectToBody(hookPayload.payload.response.body);
  const responseHeaders = headersToRecord(hookPayload.payload.response.headers);
  
  // Nur Strings können komprimiert werden - Uint8Array wird direkt zurückgegeben
  if (bodyToSend instanceof Uint8Array) {
    onDebug?.('not compressing binary response body');
    return { body: bodyToSend, headers: responseHeaders };
  }
  
  // Return uncompressed if client doesn't support gzip or body is too small
  if (!supportsGzip || Buffer.byteLength(bodyToSend, 'utf8') <= minSizeBytes) {
    onDebug?.(
      `not compressing response, supportsGzip=${supportsGzip} bodySize=${Buffer.byteLength(bodyToSend, 'utf8')} minSize=${minSizeBytes}`,
    );
    return { body: bodyToSend, headers: responseHeaders };
  }

  const bodySize = Buffer.byteLength(bodyToSend, 'utf8');
  onDebug?.(`compressing response, body size: ${bodySize}`);

  try {
    const compressed = (await gzipAsync(bodyToSend)) as Buffer;
    const compressedSize = compressed.length;

    // Update headers für gzip response
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
