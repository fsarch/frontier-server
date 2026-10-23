import { describe, expect, it } from 'vitest';
import { resolveControlPlaneUrls } from './control-plane-urls.js';

describe('resolveControlPlaneUrls', () => {
  it('defaults to a local frontier-api', () => {
    expect(resolveControlPlaneUrls({})).toEqual({
      websocketUrl: 'ws://localhost:3000/api/workers/websocket',
      logIngestUrl: 'http://localhost:3000/api/workers/logs',
    });
  });

  it('derives both endpoints from the base URL', () => {
    expect(
      resolveControlPlaneUrls({ FRONTIER_API_URL: 'http://frontier-api:8080' }),
    ).toEqual({
      websocketUrl: 'ws://frontier-api:8080/api/workers/websocket',
      logIngestUrl: 'http://frontier-api:8080/api/workers/logs',
    });
  });

  it('keeps a path prefix on the base URL', () => {
    expect(
      resolveControlPlaneUrls({ FRONTIER_API_URL: 'http://aio/frontier' }),
    ).toEqual({
      websocketUrl: 'ws://aio/frontier/api/workers/websocket',
      logIngestUrl: 'http://aio/frontier/api/workers/logs',
    });
  });

  it('ignores trailing slashes, query and hash', () => {
    expect(
      resolveControlPlaneUrls({
        FRONTIER_API_URL: 'http://aio/frontier//?x=1#y',
      }),
    ).toEqual({
      websocketUrl: 'ws://aio/frontier/api/workers/websocket',
      logIngestUrl: 'http://aio/frontier/api/workers/logs',
    });
  });

  it('maps https to wss', () => {
    expect(
      resolveControlPlaneUrls({ FRONTIER_API_URL: 'https://api.example.com' }),
    ).toEqual({
      websocketUrl: 'wss://api.example.com/api/workers/websocket',
      logIngestUrl: 'https://api.example.com/api/workers/logs',
    });
  });

  it('accepts a ws(s):// base URL', () => {
    expect(
      resolveControlPlaneUrls({ FRONTIER_API_URL: 'wss://api.example.com/x' }),
    ).toEqual({
      websocketUrl: 'wss://api.example.com/x/api/workers/websocket',
      logIngestUrl: 'https://api.example.com/x/api/workers/logs',
    });
  });

  it('rejects other schemes', () => {
    expect(() =>
      resolveControlPlaneUrls({ FRONTIER_API_URL: 'ftp://api.example.com' }),
    ).toThrow(/FRONTIER_API_URL/);
  });

  describe('deprecated full URLs', () => {
    it('still uses FRONTIER_CONTROL_PLANE_URL and derives the log URL from it', () => {
      expect(
        resolveControlPlaneUrls({
          FRONTIER_CONTROL_PLANE_URL:
            'wss://api.example.com/api/workers/websocket',
        }),
      ).toEqual({
        websocketUrl: 'wss://api.example.com/api/workers/websocket',
        logIngestUrl: 'https://api.example.com/api/workers/logs',
      });
    });

    it('keeps a prefix in front of the websocket path for the log URL', () => {
      expect(
        resolveControlPlaneUrls({
          FRONTIER_CONTROL_PLANE_URL: 'ws://aio/frontier/api/workers/websocket',
        }).logIngestUrl,
      ).toBe('http://aio/frontier/api/workers/logs');
    });

    it('falls back to the origin for a websocket URL with another path', () => {
      expect(
        resolveControlPlaneUrls({
          FRONTIER_CONTROL_PLANE_URL: 'ws://api.example.com/custom',
        }),
      ).toEqual({
        websocketUrl: 'ws://api.example.com/custom',
        logIngestUrl: 'http://api.example.com/api/workers/logs',
      });
    });

    it('overrides what FRONTIER_API_URL would derive', () => {
      expect(
        resolveControlPlaneUrls({
          FRONTIER_API_URL: 'http://frontier-api:8080',
          FRONTIER_CONTROL_PLANE_URL: 'ws://other/ws',
          FRONTIER_WORKER_LOG_INGEST_URL: 'http://logs/ingest',
        }),
      ).toEqual({
        websocketUrl: 'ws://other/ws',
        logIngestUrl: 'http://logs/ingest',
      });
    });

    it('treats empty values as unset', () => {
      expect(
        resolveControlPlaneUrls({
          FRONTIER_API_URL: 'http://frontier-api:8080',
          FRONTIER_CONTROL_PLANE_URL: '',
          FRONTIER_WORKER_LOG_INGEST_URL: ' ',
        }),
      ).toEqual({
        websocketUrl: 'ws://frontier-api:8080/api/workers/websocket',
        logIngestUrl: 'http://frontier-api:8080/api/workers/logs',
      });
    });
  });
});
