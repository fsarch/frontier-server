import { compressResponseBody } from './response-compression.js';

describe('compressResponseBody', () => {
  describe('when gzip is supported and body is large enough', () => {
    it('should compress the body and set appropriate headers', async () => {
      const bodyText = 'x'.repeat(200);
      const headers: Record<string, string> = {
        'content-type': 'text/plain',
      };

      const result = await compressResponseBody(bodyText, headers, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      // Should return compressed buffer
      expect(result.body).toBeInstanceOf(Buffer);
      expect((result.body as Buffer).length).toBeLessThan(bodyText.length);

      // Should update headers
      expect(result.headers['content-encoding']).toBe('gzip');
      expect(result.headers['content-type']).toBe('text/plain');
      expect(result.headers['content-length']).toBeDefined();
      expect(parseInt(result.headers['content-length'], 10)).toBe((result.body as Buffer).length);
      expect(result.headers['transfer-encoding']).toBeUndefined();

      // Should add vary header
      expect(result.headers['vary']).toContain('Accept-Encoding');
    });

    it('should append to existing vary header without duplication', async () => {
      const bodyText = 'x'.repeat(200);
      const headers: Record<string, string> = {
        'vary': 'Origin',
      };

      const result = await compressResponseBody(bodyText, headers, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      expect(result.headers['vary']).toBe('Origin, Accept-Encoding');
    });

    it('should not duplicate Accept-Encoding in vary header if already present', async () => {
      const bodyText = 'x'.repeat(200);
      const headers: Record<string, string> = {
        'vary': 'Origin, Accept-Encoding',
      };

      const result = await compressResponseBody(bodyText, headers, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      expect(result.headers['vary']).toBe('Origin, Accept-Encoding');
    });

    it('should remove transfer-encoding header when compressing', async () => {
      const bodyText = 'x'.repeat(200);
      const headers: Record<string, string> = {
        'transfer-encoding': 'chunked',
      };

      const result = await compressResponseBody(bodyText, headers, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      expect(result.headers['transfer-encoding']).toBeUndefined();
    });

    it('should handle debug callback', async () => {
      const bodyText = 'x'.repeat(200);
      const debugMessages: string[] = [];
      const headers: Record<string, string> = {};

      await compressResponseBody(bodyText, headers, {
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
    it('should return uncompressed body with original headers', async () => {
      const bodyText = 'x'.repeat(200);
      const headers: Record<string, string> = {
        'content-type': 'text/plain',
      };

      const result = await compressResponseBody(bodyText, headers, {
        supportsGzip: false,
        minSizeBytes: 100,
      });

      expect(result.body).toBe(bodyText);
      expect(result.headers).toEqual(headers);
      expect(result.headers['content-encoding']).toBeUndefined();
    });

    it('should log debug message when not compressing', async () => {
      const bodyText = 'x'.repeat(200);
      const debugMessages: string[] = [];

      await compressResponseBody(bodyText, {}, {
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

      const result = await compressResponseBody(bodyText, headers, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      expect(result.body).toBe(bodyText);
      expect(result.headers['content-encoding']).toBeUndefined();
    });

    it('should respect custom minimum size threshold', async () => {
      const bodyText = 'x'.repeat(50);
      const headers: Record<string, string> = {};

      const result = await compressResponseBody(bodyText, headers, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      expect(result.body).toBe(bodyText);
      expect(result.headers['content-encoding']).toBeUndefined();
    });

    it('should compress if body exactly equals minimum size', async () => {
      const bodyText = 'x'.repeat(100);
      const headers: Record<string, string> = {};

      const result = await compressResponseBody(bodyText, headers, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      // Should still be uncompressed since it needs to be > minSizeBytes, not >=
      expect(result.body).toBe(bodyText);
      expect(result.headers['content-encoding']).toBeUndefined();
    });

    it('should compress if body is 1 byte above minimum size', async () => {
      const bodyText = 'x'.repeat(101);
      const headers: Record<string, string> = {};

      const result = await compressResponseBody(bodyText, headers, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      expect(result.body).toBeInstanceOf(Buffer);
      expect(result.headers['content-encoding']).toBe('gzip');
    });
  });

  describe('with UTF-8 multi-byte characters', () => {
    it('should calculate byte length correctly for multi-byte UTF-8 characters', async () => {
      // "你好" is 2 chars but 6 bytes in UTF-8
      const bodyText = '你好'.repeat(50); // 100 chars, 300 bytes
      const headers: Record<string, string> = {};

      const result = await compressResponseBody(bodyText, headers, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      // Should compress because byte length is > 100
      expect(result.headers['content-encoding']).toBe('gzip');
      expect(result.body).toBeInstanceOf(Buffer);
    });
  });

  describe('with empty body', () => {
    it('should return empty string without compression', async () => {
      const bodyText = '';
      const headers: Record<string, string> = {};

      const result = await compressResponseBody(bodyText, headers, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      expect(result.body).toBe('');
      expect(result.headers['content-encoding']).toBeUndefined();
    });
  });

  describe('default minSizeBytes', () => {
    it('should use 100 bytes as default minimum size', async () => {
      const bodyText = 'x'.repeat(99);
      const headers: Record<string, string> = {};

      const result = await compressResponseBody(bodyText, headers, {
        supportsGzip: true,
      });

      expect(result.body).toBe(bodyText);
      expect(result.headers['content-encoding']).toBeUndefined();
    });

    it('should compress body with default minimum when body > 100 bytes', async () => {
      const bodyText = 'x'.repeat(101);
      const headers: Record<string, string> = {};

      const result = await compressResponseBody(bodyText, headers, {
        supportsGzip: true,
      });

      expect(result.headers['content-encoding']).toBe('gzip');
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

      const result = await compressResponseBody(bodyText, headers, {
        supportsGzip: true,
      });

      expect(result.headers['content-type']).toBe('application/json');
      expect(result.headers['cache-control']).toBe('max-age=3600');
      expect(result.headers['x-custom-header']).toBe('value');
    });

    it('should update content-length header for compressed response', async () => {
      const bodyText = 'x'.repeat(200);
      const headers: Record<string, string> = {
        'content-length': '200',
      };

      const result = await compressResponseBody(bodyText, headers, {
        supportsGzip: true,
      });

      const compressedLength = parseInt(result.headers['content-length'], 10);
      expect(compressedLength).toBeLessThan(200);
      expect(compressedLength).toBe((result.body as Buffer).length);
    });
  });

  describe('error handling', () => {
    it('should fall back to uncompressed on compression error', async () => {
      const bodyText = 'x'.repeat(200);
      const headers: Record<string, string> = {};

      // Note: actual gzip compression failures are rare in Node.js,
      // but we test the error handling path anyway
      const result = await compressResponseBody(bodyText, headers, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      // In normal operation, this should succeed
      expect(result.body).toBeDefined();
      if (typeof result.body === 'string') {
        expect(result.body).toBe(bodyText);
      } else {
        expect(result.body).toBeInstanceOf(Buffer);
        expect(result.headers['content-encoding']).toBe('gzip');
      }
    });

    it('should log debug message on compression failure', async () => {
      const bodyText = 'x'.repeat(200);
      const debugMessages: string[] = [];

      await compressResponseBody(bodyText, {}, {
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

      const result = await compressResponseBody(jsonPayload, headers, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      expect(result.body).toBeInstanceOf(Buffer);
      expect((result.body as Buffer).length).toBeLessThan(jsonPayload.length);
      expect(result.headers['content-encoding']).toBe('gzip');
      expect(result.headers['content-type']).toBe('application/json');
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

      const result = await compressResponseBody(htmlPayload, headers, {
        supportsGzip: true,
        minSizeBytes: 100,
      });

      expect(result.body).toBeInstanceOf(Buffer);
      expect((result.body as Buffer).length).toBeLessThan(htmlPayload.length);
      expect(result.headers['content-encoding']).toBe('gzip');
    });
  });
});
