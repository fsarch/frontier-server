import type { IncomingHttpHeaders } from 'http';
import { appendForwardedHeaders } from './http-proxy.server.js';

describe('appendForwardedHeaders', () => {
  it('sets x-forwarded headers when none are present', () => {
    const upstreamHeaders: Record<string, string> = {};
    const incomingHeaders: IncomingHttpHeaders = {};

    appendForwardedHeaders(upstreamHeaders, incomingHeaders, 'api.example.com:8080', '/api/', false);

    expect(upstreamHeaders['x-forwarded-host']).toBe('api.example.com:8080');
    expect(upstreamHeaders['x-forwarded-proto']).toBe('http');
    expect(upstreamHeaders['x-forwarded-port']).toBe('8080');
    expect(upstreamHeaders['x-forwarded-prefix']).toBe('/api');
  });

  it('appends to existing forwarded chain values', () => {
    const upstreamHeaders: Record<string, string> = {
      'x-forwarded-host': 'edge.example.com',
      'x-forwarded-proto': 'https',
      'x-forwarded-port': '443',
      'x-forwarded-prefix': '/edge',
    };
    const incomingHeaders: IncomingHttpHeaders = {
      'x-forwarded-proto': 'https',
      'x-forwarded-port': '443',
    };

    appendForwardedHeaders(upstreamHeaders, incomingHeaders, 'worker.internal:3000', '/api', false);

    expect(upstreamHeaders['x-forwarded-host']).toBe('edge.example.com, worker.internal:3000');
    expect(upstreamHeaders['x-forwarded-proto']).toBe('https, https');
    expect(upstreamHeaders['x-forwarded-port']).toBe('443, 443');
    expect(upstreamHeaders['x-forwarded-prefix']).toBe('/edge, /api');
  });

  it('uses tls socket state when x-forwarded-proto is missing and defaults prefix for catch-all routes', () => {
    const upstreamHeaders: Record<string, string> = {};
    const incomingHeaders: IncomingHttpHeaders = {
      host: 'secure.example.com',
    };

    appendForwardedHeaders(upstreamHeaders, incomingHeaders, 'secure.example.com', '*', true);

    expect(upstreamHeaders['x-forwarded-proto']).toBe('https');
    expect(upstreamHeaders['x-forwarded-port']).toBe('443');
    expect(upstreamHeaders['x-forwarded-prefix']).toBe('/');
  });

  it('supports ipv6 host header with explicit port', () => {
    const upstreamHeaders: Record<string, string> = {};
    const incomingHeaders: IncomingHttpHeaders = {};

    appendForwardedHeaders(upstreamHeaders, incomingHeaders, '[::1]:9090', '/v1', false);

    expect(upstreamHeaders['x-forwarded-port']).toBe('9090');
  });
});

