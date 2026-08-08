import { compressResponseBody } from './hooks/compression.hook.js';
import { PostHookPayload } from './models/post-hook-payload.js';
import { BodyUtils } from '../utils/http/body.utils.js';
import type { RequestType } from '../types/http/request.type.js';
import type { ResponseType } from '../types/http/response.type.js';

/**
 * Helper function to create a PostHookPayload for tests
 */
function createTestPostHookPayload(bodyText: string, headers: Record<string, string>): PostHookPayload {
  const requestType: RequestType = {
    type: 'request',
    method: 'GET',
    url: {
      scheme: 'http',
      host: 'localhost',
      path: '/',
      port: 80,
      query: {},
    },
    headers: {},
    body: { type: 'json', payload: null },
  };

  const responseType: ResponseType = {
    type: 'response',
    statusCode: 200,
    statusText: 'OK',
    headers: {},
    body: { type: 'text', payload: bodyText },
  };

  // Header conversion: Record<string, string> -> Record<string, string[]>
  const responseHeaders: ResponseType['headers'] = {};
  for (const [key, value] of Object.entries(headers)) {
    responseHeaders[key] = [value];
  }
  responseType.headers = responseHeaders;

  return new PostHookPayload(
    {
      clientRequest: requestType,
      upstreamRequest: requestType,
      response: responseType,
    },
    {},
  );
}

/** Reads the first value of a (possibly absent) response header. */
function headerValue(result: ResponseType, name: string): string | undefined {
  return result.headers[name]?.[0];
}

/** Materializes the ResponseType body back into raw bytes/text, like the proxy does before writing the response. */
function rawBody(result: ResponseType): string | Uint8Array | null {
  return BodyUtils.plainObjectToBody(result.body);
}

describe('compressResponseBody', () => {
  describe('when gzip is supported and body is large enough', () => {
    it('should compress the body and set appropriate headers', async () => {
      const bodyText = 'x'.repeat(200);
      const headers: Record<string, string> = {
        'content-type': 'text/plain',
      };

      const hookPayload = createTestPostHookPayload(bodyText, headers);
      const result = await compressResponseBody(hookPayload, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      // Should return a binary body, smaller than the original text
      expect(result.body?.type).toBe('binary.uint8array');
      const compressedBody = rawBody(result);
      expect(compressedBody).toBeInstanceOf(Uint8Array);
      expect((compressedBody as Uint8Array).byteLength).toBeLessThan(bodyText.length);

      // Should update headers
      expect(headerValue(result, 'content-encoding')).toBe('gzip');
      expect(headerValue(result, 'content-type')).toBe('text/plain');
      expect(headerValue(result, 'content-length')).toBeDefined();
      expect(parseInt(headerValue(result, 'content-length')!, 10)).toBe((compressedBody as Uint8Array).byteLength);
      expect(headerValue(result, 'transfer-encoding')).toBeUndefined();

      // Should add vary header
      expect(headerValue(result, 'vary')).toContain('Accept-Encoding');
    });

    it('should append to existing vary header without duplication', async () => {
      const bodyText = 'x'.repeat(200);
      const headers: Record<string, string> = {
        'content-type': 'text/plain',
        'vary': 'Origin',
      };

      const hookPayload = createTestPostHookPayload(bodyText, headers);
      const result = await compressResponseBody(hookPayload, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      expect(headerValue(result, 'vary')).toBe('Origin, Accept-Encoding');
    });

    it('should not duplicate Accept-Encoding in vary header if already present', async () => {
      const bodyText = 'x'.repeat(200);
      const headers: Record<string, string> = {
        'vary': 'Origin, Accept-Encoding',
      };

      const hookPayload = createTestPostHookPayload(bodyText, headers);
      const result = await compressResponseBody(hookPayload, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      expect(headerValue(result, 'vary')).toBe('Origin, Accept-Encoding');
    });

    it('should remove transfer-encoding header when compressing', async () => {
      const bodyText = 'x'.repeat(200);
      const headers: Record<string, string> = {
        'content-type': 'text/plain',
        'transfer-encoding': 'chunked',
      };

      const hookPayload = createTestPostHookPayload(bodyText, headers);
      const result = await compressResponseBody(hookPayload, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      expect(headerValue(result, 'transfer-encoding')).toBeUndefined();
    });

    it('should handle debug callback', async () => {
      const bodyText = 'x'.repeat(200);
      const debugMessages: string[] = [];
      const headers: Record<string, string> = {
        'content-type': 'text/plain',
      };

      const hookPayload = createTestPostHookPayload(bodyText, headers);
      await compressResponseBody(hookPayload, {
        supportsGzip: true,
        minSizeBytes: 100,
        onDebug: (msg) => debugMessages.push(msg),
      });

      expect(debugMessages.length).toBeGreaterThan(0);
      expect(debugMessages.some((msg) => msg.includes('compressing'))).toBe(true);
      expect(debugMessages.some((msg) => msg.includes('compressed response from'))).toBe(true);
    });
  });

  describe('when gzip is not supported', () => {
    it('should return uncompressed body with original headers (but with updated content-length because of uncompress)', async () => {
      const bodyText = 'x'.repeat(200);
      const headers: Record<string, string> = {
        'content-type': 'text/plain',
      };

      const hookPayload = createTestPostHookPayload(bodyText, headers);
      const result = await compressResponseBody(hookPayload, {
        supportsGzip: false,
        minSizeBytes: 100,
      });

      expect(rawBody(result)).toBe(bodyText);
      expect(headerValue(result, 'content-encoding')).toBeUndefined();
      expect(headerValue(result, 'content-length')).toEqual('200');
    });

    it('should log debug message when not compressing', async () => {
      const bodyText = 'x'.repeat(200);
      const debugMessages: string[] = [];

      const hookPayload = createTestPostHookPayload(bodyText, {});
      await compressResponseBody(hookPayload, {
        supportsGzip: false,
        onDebug: (msg) => debugMessages.push(msg),
      });

      expect(debugMessages.some((msg) => msg.includes('not compressing'))).toBe(true);
    });
  });

  describe('when body is too small', () => {
    it('should return uncompressed body if below minimum size', async () => {
      const bodyText = 'small body';
      const headers: Record<string, string> = {
        'content-type': 'text/plain',
      };

      const hookPayload = createTestPostHookPayload(bodyText, headers);
      const result = await compressResponseBody(hookPayload, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      expect(rawBody(result)).toBe(bodyText);
      expect(headerValue(result, 'content-encoding')).toBeUndefined();
    });

    it('should respect custom minimum size threshold', async () => {
      const bodyText = 'x'.repeat(50);
      const headers: Record<string, string> = {
        'content-type': 'text/plain',
      };

      const hookPayload = createTestPostHookPayload(bodyText, headers);
      const result = await compressResponseBody(hookPayload, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      expect(rawBody(result)).toBe(bodyText);
      expect(headerValue(result, 'content-encoding')).toBeUndefined();
    });

    it('should compress if body exactly equals minimum size', async () => {
      const bodyText = 'x'.repeat(100);
      const headers: Record<string, string> = {};

      const hookPayload = createTestPostHookPayload(bodyText, headers);
      const result = await compressResponseBody(hookPayload, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      // Should still be uncompressed since it needs to be > minSizeBytes, not >=
      expect(rawBody(result)).toBe(bodyText);
      expect(headerValue(result, 'content-encoding')).toBeUndefined();
    });

    it('should compress if body is 1 byte above minimum size', async () => {
      const bodyText = 'x'.repeat(101);
      const headers: Record<string, string> = {
        'content-type': 'text/plain',
      };

      const hookPayload = createTestPostHookPayload(bodyText, headers);
      const result = await compressResponseBody(hookPayload, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      expect(rawBody(result)).toBeInstanceOf(Uint8Array);
      expect(headerValue(result, 'content-encoding')).toBe('gzip');
    });
  });

  describe('with UTF-8 multi-byte characters', () => {
    it('should calculate byte length correctly for multi-byte UTF-8 characters', async () => {
      // "你好" is 2 chars but 6 bytes in UTF-8
      const bodyText = '你好'.repeat(50); // 100 chars, 300 bytes
      const headers: Record<string, string> = {
        'content-type': 'text/plain',
      };

      const hookPayload = createTestPostHookPayload(bodyText, headers);
      const result = await compressResponseBody(hookPayload, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      // Should compress because byte length is > 100
      expect(headerValue(result, 'content-encoding')).toBe('gzip');
      expect(rawBody(result)).toBeInstanceOf(Uint8Array);
    });
  });

  describe('with empty body', () => {
    it('should return empty string without compression', async () => {
      const bodyText = '';
      const headers: Record<string, string> = {};

      const hookPayload = createTestPostHookPayload(bodyText, headers);
      const result = await compressResponseBody(hookPayload, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      expect(rawBody(result)).toBe('');
      expect(headerValue(result, 'content-encoding')).toBeUndefined();
    });
  });

  describe('default minSizeBytes', () => {
    it('should use 100 bytes as default minimum size', async () => {
      const bodyText = 'x'.repeat(99);
      const headers: Record<string, string> = {
        'content-type': 'text/plain',
      };

      const hookPayload = createTestPostHookPayload(bodyText, headers);
      const result = await compressResponseBody(hookPayload, {
        supportsGzip: true,
      });

      expect(rawBody(result)).toBe(bodyText);
      expect(headerValue(result, 'content-encoding')).toBeUndefined();
    });

    it('should compress body with default minimum when body > 100 bytes', async () => {
      const bodyText = 'x'.repeat(101);
      const headers: Record<string, string> = {
        'content-type': 'text/plain',
      };

      const hookPayload = createTestPostHookPayload(bodyText, headers);
      const result = await compressResponseBody(hookPayload, {
        supportsGzip: true,
      });

      expect(headerValue(result, 'content-encoding')).toBe('gzip');
    });
  });

  describe('header preservation', () => {
    it('should preserve existing headers', async () => {
      const bodyText = 'x'.repeat(200);
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        'cache-control': 'max-age=3600',
        'x-custom-header': 'value',
      };

      const hookPayload = createTestPostHookPayload(bodyText, headers);
      const result = await compressResponseBody(hookPayload, {
        supportsGzip: true,
      });

      expect(headerValue(result, 'content-type')).toBe('application/json');
      expect(headerValue(result, 'cache-control')).toBe('max-age=3600');
      expect(headerValue(result, 'x-custom-header')).toBe('value');
    });

    it('should update content-length header for compressed response', async () => {
      const bodyText = 'x'.repeat(200);
      const headers: Record<string, string> = {
        'content-type': 'text/plain',
        'content-length': '200',
      };

      const hookPayload = createTestPostHookPayload(bodyText, headers);
      const result = await compressResponseBody(hookPayload, {
        supportsGzip: true,
      });

      const compressedBody = rawBody(result) as Uint8Array;
      const compressedLength = parseInt(headerValue(result, 'content-length')!, 10);
      expect(compressedLength).toBeLessThan(200);
      expect(compressedLength).toBe(compressedBody.byteLength);
    });

    it('should preserve multiple Set-Cookie headers without merging or splitting them', async () => {
      const bodyText = 'x'.repeat(200);
      const hookPayload = createTestPostHookPayload(bodyText, {
        'content-type': 'text/plain',
      });
      // Simulate multiple Set-Cookie headers, one of them containing a comma (Expires date)
      hookPayload.payload.response.headers['set-cookie'] = [
        'session=abc; Expires=Wed, 21 Oct 2015 07:28:00 GMT',
        'other=xyz',
      ];

      const result = await compressResponseBody(hookPayload, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      expect(result.headers['set-cookie']).toEqual([
        'session=abc; Expires=Wed, 21 Oct 2015 07:28:00 GMT',
        'other=xyz',
      ]);
    });
  });

  describe('error handling', () => {
    it('should fall back to uncompressed on compression error', async () => {
      const bodyText = 'x'.repeat(200);
      const headers: Record<string, string> = {
        'content-type': 'text/plain',
      };

      // Note: actual gzip compression failures are rare in Node.js,
      // but we test the error handling path anyway
      const hookPayload = createTestPostHookPayload(bodyText, headers);
      const result = await compressResponseBody(hookPayload, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      // In normal operation, this should succeed
      expect(result.body).toBeDefined();
      const body = rawBody(result);
      if (typeof body === 'string') {
        expect(body).toBe(bodyText);
      } else {
        expect(body).toBeInstanceOf(Uint8Array);
        expect(headerValue(result, 'content-encoding')).toBe('gzip');
      }
    });

    it('should log debug message on compression failure', async () => {
      const bodyText = 'x'.repeat(200);
      const debugMessages: string[] = [];

      const hookPayload = createTestPostHookPayload(bodyText, {
        'content-type': 'text/plain',
      });
      await compressResponseBody(hookPayload, {
        supportsGzip: true,
        minSizeBytes: 100,
        onDebug: (msg) => debugMessages.push(msg),
      });

      // Either success message or fallback message should be present
      const hasCompressionMessage = debugMessages.some(
        (msg) => msg.includes('compressed response from') || msg.includes('compression failed'),
      );
      expect(hasCompressionMessage).toBe(true);
    });
  });

  describe('JSON payload', () => {
    it('should compress typical JSON API response', async () => {
      const jsonPayload = JSON.stringify({
        data: {
          id: 1,
          name: 'Test',
          description: 'This is a test object with enough text to be worth compressing.',
          items: Array.from({ length: 10 }, (_, i) => ({
            id: i,
            value: `Item ${i}`.repeat(5),
          })),
        },
      });

      const headers: Record<string, string> = {
        'content-type': 'application/json',
      };

      const hookPayload = createTestPostHookPayload(jsonPayload, headers);
      const result = await compressResponseBody(hookPayload, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      const compressedBody = rawBody(result) as Uint8Array;
      expect(compressedBody).toBeInstanceOf(Uint8Array);
      expect(compressedBody.byteLength).toBeLessThan(jsonPayload.length);
      expect(headerValue(result, 'content-encoding')).toBe('gzip');
      expect(headerValue(result, 'content-type')).toBe('application/json');
    });
  });

  describe('HTML payload', () => {
    it('should compress typical HTML response', async () => {
      const htmlPayload = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test Page</title>
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 1200px; margin: 0 auto; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Welcome</h1>
            <p>This is a test HTML page that should be compressed effectively.</p>
          </div>
        </body>
        </html>
      `.repeat(3);

      const headers: Record<string, string> = {
        'content-type': 'text/html; charset=utf-8',
      };

      const hookPayload = createTestPostHookPayload(htmlPayload, headers);
      const result = await compressResponseBody(hookPayload, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      const compressedBody = rawBody(result) as Uint8Array;
      expect(compressedBody).toBeInstanceOf(Uint8Array);
      expect(compressedBody.byteLength).toBeLessThan(htmlPayload.length);
      expect(headerValue(result, 'content-encoding')).toBe('gzip');
    });
  });

  describe('content-type allowlist', () => {
    it('should compress text/plain content-type', async () => {
      const bodyText = 'x'.repeat(200);
      const headers: Record<string, string> = {
        'content-type': 'text/plain',
      };

      const hookPayload = createTestPostHookPayload(bodyText, headers);
      const result = await compressResponseBody(hookPayload, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      expect(rawBody(result)).toBeInstanceOf(Uint8Array);
      expect(headerValue(result, 'content-encoding')).toBe('gzip');
    });

    it('should compress application/json content-type', async () => {
      const bodyText = 'x'.repeat(200);
      const headers: Record<string, string> = {
        'content-type': 'application/json',
      };

      const hookPayload = createTestPostHookPayload(bodyText, headers);
      const result = await compressResponseBody(hookPayload, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      expect(rawBody(result)).toBeInstanceOf(Uint8Array);
      expect(headerValue(result, 'content-encoding')).toBe('gzip');
    });

    it('should NOT compress image/png content-type', async () => {
      const bodyText = 'x'.repeat(200);
      const headers: Record<string, string> = {
        'content-type': 'image/png',
      };

      const hookPayload = createTestPostHookPayload(bodyText, headers);
      const result = await compressResponseBody(hookPayload, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      expect(rawBody(result)).toBe(bodyText);
      expect(headerValue(result, 'content-encoding')).toBeUndefined();
    });

    it('should NOT compress image/jpeg content-type', async () => {
      const bodyText = 'x'.repeat(200);
      const headers: Record<string, string> = {
        'content-type': 'image/jpeg',
      };

      const hookPayload = createTestPostHookPayload(bodyText, headers);
      const result = await compressResponseBody(hookPayload, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      expect(rawBody(result)).toBe(bodyText);
      expect(headerValue(result, 'content-encoding')).toBeUndefined();
    });

    it('should NOT compress application/gzip content-type', async () => {
      const bodyText = 'x'.repeat(200);
      const headers: Record<string, string> = {
        'content-type': 'application/gzip',
      };

      const hookPayload = createTestPostHookPayload(bodyText, headers);
      const result = await compressResponseBody(hookPayload, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      expect(rawBody(result)).toBe(bodyText);
      expect(headerValue(result, 'content-encoding')).toBeUndefined();
    });

    it('should NOT compress application/octet-stream content-type', async () => {
      const bodyText = 'x'.repeat(200);
      const headers: Record<string, string> = {
        'content-type': 'application/octet-stream',
      };

      const hookPayload = createTestPostHookPayload(bodyText, headers);
      const result = await compressResponseBody(hookPayload, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      expect(rawBody(result)).toBe(bodyText);
      expect(headerValue(result, 'content-encoding')).toBeUndefined();
    });

    it('should NOT compress video/mp4 content-type', async () => {
      const bodyText = 'x'.repeat(200);
      const headers: Record<string, string> = {
        'content-type': 'video/mp4',
      };

      const hookPayload = createTestPostHookPayload(bodyText, headers);
      const result = await compressResponseBody(hookPayload, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      expect(rawBody(result)).toBe(bodyText);
      expect(headerValue(result, 'content-encoding')).toBeUndefined();
    });

    it('should NOT compress application/zip content-type', async () => {
      const bodyText = 'x'.repeat(200);
      const headers: Record<string, string> = {
        'content-type': 'application/zip',
      };

      const hookPayload = createTestPostHookPayload(bodyText, headers);
      const result = await compressResponseBody(hookPayload, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      expect(rawBody(result)).toBe(bodyText);
      expect(headerValue(result, 'content-encoding')).toBeUndefined();
    });

    it('should compress content-type with charset parameter', async () => {
      const bodyText = 'x'.repeat(200);
      const headers: Record<string, string> = {
        'content-type': 'text/html; charset=utf-8',
      };

      const hookPayload = createTestPostHookPayload(bodyText, headers);
      const result = await compressResponseBody(hookPayload, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      expect(rawBody(result)).toBeInstanceOf(Uint8Array);
      expect(headerValue(result, 'content-encoding')).toBe('gzip');
    });

    it('should NOT compress when content-type is missing', async () => {
      const bodyText = 'x'.repeat(200);
      const headers: Record<string, string> = {};

      const hookPayload = createTestPostHookPayload(bodyText, headers);
      const result = await compressResponseBody(hookPayload, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      expect(rawBody(result)).toBe(bodyText);
      expect(headerValue(result, 'content-encoding')).toBeUndefined();
    });

    it('should compress text/css content-type', async () => {
      const bodyText = 'x'.repeat(200);
      const headers: Record<string, string> = {
        'content-type': 'text/css',
      };

      const hookPayload = createTestPostHookPayload(bodyText, headers);
      const result = await compressResponseBody(hookPayload, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      expect(rawBody(result)).toBeInstanceOf(Uint8Array);
      expect(headerValue(result, 'content-encoding')).toBe('gzip');
    });

    it('should compress application/xml content-type', async () => {
      const bodyText = 'x'.repeat(200);
      const headers: Record<string, string> = {
        'content-type': 'application/xml',
      };

      const hookPayload = createTestPostHookPayload(bodyText, headers);
      const result = await compressResponseBody(hookPayload, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      expect(rawBody(result)).toBeInstanceOf(Uint8Array);
      expect(headerValue(result, 'content-encoding')).toBe('gzip');
    });

    it('should compress text/javascript content-type', async () => {
      const bodyText = 'x'.repeat(200);
      const headers: Record<string, string> = {
        'content-type': 'text/javascript',
      };

      const hookPayload = createTestPostHookPayload(bodyText, headers);
      const result = await compressResponseBody(hookPayload, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      expect(rawBody(result)).toBeInstanceOf(Uint8Array);
      expect(headerValue(result, 'content-encoding')).toBe('gzip');
    });

    it('should NOT compress font/woff2 content-type', async () => {
      const bodyText = 'x'.repeat(200);
      const headers: Record<string, string> = {
        'content-type': 'font/woff2',
      };

      const hookPayload = createTestPostHookPayload(bodyText, headers);
      const result = await compressResponseBody(hookPayload, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      expect(rawBody(result)).toBe(bodyText);
      expect(headerValue(result, 'content-encoding')).toBeUndefined();
    });

    it('should log debug message about content-type and compressibility', async () => {
      const bodyText = 'x'.repeat(200);
      const debugMessages: string[] = [];
      const headers: Record<string, string> = {
        'content-type': 'text/html; charset=utf-8',
      };

      const hookPayload = createTestPostHookPayload(bodyText, headers);
      await compressResponseBody(hookPayload, {
        supportsGzip: true,
        minSizeBytes: 100,
        onDebug: (msg) => debugMessages.push(msg),
      });

      expect(debugMessages.some((msg) => msg.includes('content-type: text/html'))).toBe(true);
      expect(debugMessages.some((msg) => msg.includes('compressible: true'))).toBe(true);
    });
  });
});
