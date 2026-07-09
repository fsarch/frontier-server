import { describe, expect, it, vi } from 'vitest';
import type { RequestType } from '../types/http/request.type.js';
import type { ResponseType } from '../types/http/response.type.js';
import { FunctionClient } from './function-client.js';

function createClient() {
  return new FunctionClient({
    function_worker: {
      type: 'remote',
      url: 'https://functions.example',
      auth: {
        type: 'openid-client-credentials',
        token_endpoint: 'https://auth.example/token',
        client_id: 'client-id',
        client_secret: 'client-secret',
      },
    },
  });
}

function createRequest(path: string): RequestType {
  return {
    type: 'request',
    method: 'POST',
    url: {
      scheme: 'https',
      host: 'example.com',
      path,
      port: 443,
      query: {},
    },
    headers: {
      'content-type': ['application/json'],
    },
    body: {
      type: 'json',
      payload: { hello: 'world' },
    },
  };
}

function createResponse(): ResponseType {
  return {
    type: 'response',
    statusCode: 200,
    statusText: 'OK',
    headers: {
      'content-type': ['application/json'],
    },
    body: {
      type: 'json',
      payload: { ok: true },
    },
  };
}

describe('FunctionClient pre-hook handling', () => {
  it('executes a returned request', async () => {
    const client = createClient();
    const originalRequest = createRequest('/original');
    const modifiedRequest = createRequest('/modified');

    vi.spyOn(client, 'executeHook').mockResolvedValueOnce({
      statusCode: 201,
      headers: {},
      body: modifiedRequest,
    });

    const result = await client.executePreHooks(
      { enabled: true, functions: [{ id: 'hook-1', name: 'hook', functionId: 'fn-1' }] },
      originalRequest,
      originalRequest,
    );

    expect(result.shortCircuitResponse).toBeUndefined();
    expect(result.modifiedRequest).toEqual(modifiedRequest);
  });

  it('returns a returned response', async () => {
    const client = createClient();
    const request = createRequest('/original');
    const response = createResponse();

    vi.spyOn(client, 'executeHook').mockResolvedValueOnce({
      statusCode: 201,
      headers: {},
      body: response,
    });

    const result = await client.executePreHooks(
      { enabled: true, functions: [{ id: 'hook-1', name: 'hook', functionId: 'fn-1' }] },
      request,
      request,
    );

    expect(result.modifiedRequest).toEqual(request);
    expect(result.shortCircuitResponse).toEqual(response);
  });

  it('fails with 500 for invalid output', async () => {
    const client = createClient();
    const request = createRequest('/original');

    vi.spyOn(client, 'executeHook').mockResolvedValueOnce({
      statusCode: 201,
      headers: {},
      body: { unexpected: true },
    });

    const result = await client.executePreHooks(
      { enabled: true, functions: [{ id: 'hook-1', name: 'hook', functionId: 'fn-1' }] },
      request,
      request,
    );

    expect(result.shortCircuitResponse?.statusCode).toBe(500);
    expect(result.shortCircuitResponse?.body.type).toBe('json');
    expect(result.shortCircuitResponse?.body.payload).toMatchObject({
      error: 'Pre-hook must return either a request or a response.',
      hook: 'hook-1',
      hookName: 'hook',
    });
  });
});
