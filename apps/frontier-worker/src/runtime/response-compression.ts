import { gzip as zlibGzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(zlibGzip);

export type CompressionOptions = {
  supportsGzip: boolean;
  minSizeBytes?: number;
  onDebug?: (message: string) => void;
};

export type CompressionResult = {
  body: string | Buffer;
  headers: Record<string, string>;
};

/**
 * Handles response body compression based on client accept-encoding and size thresholds.
 * Updates headers and returns the body to send (compressed or uncompressed).
 */
export async function compressResponseBody(
  bodyToSend: string,
  responseHeaders: Record<string, string>,
  options: CompressionOptions,
): Promise<CompressionResult> {
  const { supportsGzip, minSizeBytes = 100, onDebug } = options;

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

    // Update headers for gzip response
    const headers = { ...responseHeaders };
    headers['content-encoding'] = 'gzip';
    headers['content-length'] = compressedSize.toString();
    delete headers['transfer-encoding'];

    // Update vary header to indicate response varies by Accept-Encoding
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
    // Fallback: send uncompressed if compression fails
    const errorMessage = e instanceof Error ? e.message : String(e);
    onDebug?.(`compression failed: ${errorMessage}, sending uncompressed as fallback`);
    console.error('[worker][response-compression] compression failed:', e);
    return { body: bodyToSend, headers: responseHeaders };
  }
}
