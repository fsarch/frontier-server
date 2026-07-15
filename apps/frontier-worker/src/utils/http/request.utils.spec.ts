import { describe, it, expect } from 'vitest';
import { RequestUtils } from './request.utils.js';
import type { RequestType } from '../../types/http/request.type.js';

describe('RequestUtils', () => {
    describe('requestToPlainObject', () => {
        it('should convert Request to RequestType with GET method', async () => {
            const url = new URL('https://api.example.com/users?page=1&limit=10');
            const headers = new Headers();
            headers.set('Content-Type', 'application/json');
            headers.set('Authorization', 'Bearer token');
            
            const request = new Request(url.toString(), {
                method: 'GET',
                headers,
            });
            
            const result = await RequestUtils.requestToPlainObject(request);
            
            expect(result.method).toBe('GET');
            expect(result.url.scheme).toBe('https');
            expect(result.url.host).toBe('api.example.com');
            expect(result.url.path).toBe('/users');
            expect(result.url.port).toBe(443);
            expect(result.url.query).toEqual({ page: ['1'], limit: ['10'] });
            // Headers keys are lowercase in HeadersType
            expect(result.headers['content-type']).toEqual(['application/json']);
            expect(result.headers['authorization']).toEqual(['Bearer token']);
            expect(result.body).toBeNull();
        });

        it('should convert Request to RequestType with POST method and body', async () => {
            const url = new URL('http://localhost:3000/api/data');
            const headers = new Headers();
            headers.set('Content-Type', 'application/json');
            
            const request = new Request(url.toString(), {
                method: 'POST',
                headers,
                body: JSON.stringify({ key: 'value', num: 42 }),
            });
            
            const result = await RequestUtils.requestToPlainObject(request);
            
            expect(result.method).toBe('POST');
            expect(result.url.scheme).toBe('http');
            expect(result.url.host).toBe('localhost');
            expect(result.url.port).toBe(3000);
            expect(result.url.path).toBe('/api/data');
            expect(result.body.type).toBe('json');
            expect(result.body.payload).toEqual({ key: 'value', num: 42 });
        });

        it('should handle Request with no query parameters', async () => {
            const url = new URL('https://example.com/path');
            const request = new Request(url.toString(), { method: 'GET' });
            
            const result = await RequestUtils.requestToPlainObject(request);
            
            expect(result.url.query).toEqual({});
        });

        it('should handle Request with empty body', async () => {
            const url = new URL('https://example.com');
            const request = new Request(url.toString(), {
                method: 'POST',
                body: '',
            });
            
            const result = await RequestUtils.requestToPlainObject(request);
            // Empty string body is preserved as empty string
            expect(result.body.type).toBe('text');
            expect(result.body.payload).toBe('');
        });

        it('should handle Request with null body', async () => {
            const url = new URL('https://example.com');
            const request = new Request(url.toString(), {
                method: 'GET',
                body: null,
            });
            
            const result = await RequestUtils.requestToPlainObject(request);
            expect(result.body).toBeNull();
        });
    });

    describe('plainObjectToRequest', () => {
        it('should convert RequestType to Request with GET', () => {
            const requestType: RequestType = {
                method: 'GET',
                url: {
                    scheme: 'https',
                    host: 'api.example.com',
                    path: '/users',
                    port: 443,
                    query: { page: ['1'] },
                },
                headers: {
                    'Content-Type': ['application/json'],
                },
                body: {
                    type: 'json',
                    payload: null,
                },
            };
            
            const result = RequestUtils.plainObjectToRequest(requestType);
            
            expect(result.method).toBe('GET');
            expect(result.url).toBe('https://api.example.com/users?page=1');
            expect(result.headers.get('Content-Type')).toBe('application/json');
        });

        it('should convert RequestType to Request with POST and body', async () => {
            const requestType: RequestType = {
                method: 'POST',
                url: {
                    scheme: 'http',
                    host: 'localhost',
                    path: '/api/data',
                    port: 3000,
                    query: {},
                },
                headers: {
                    'Content-Type': ['application/json'],
                    'X-Custom': ['custom-value'],
                },
                body: {
                    type: 'json',
                    payload: { key: 'value', num: 42 },
                },
            };
            
            const result = RequestUtils.plainObjectToRequest(requestType);
            
            expect(result.method).toBe('POST');
            expect(result.url).toBe('http://localhost:3000/api/data');
            expect(result.headers.get('Content-Type')).toBe('application/json');
            expect(result.headers.get('X-Custom')).toBe('custom-value');
            // In Node.js, request.body is a ReadableStream
            const resultBodyText = await result.text();
            expect(resultBodyText).toBe('{"key":"value","num":42}');
        });

        it('should handle RequestType with multiple query parameters', () => {
            const requestType: RequestType = {
                method: 'GET',
                url: {
                    scheme: 'https',
                    host: 'example.com',
                    path: '/search',
                    port: 443,
                    query: { q: ['test'], page: ['1'], sort: ['asc'] },
                },
                headers: {},
                body: {
                    type: 'json',
                    payload: null,
                },
            };
            
            const result = RequestUtils.plainObjectToRequest(requestType);
            expect(result.url).toContain('q=test');
            expect(result.url).toContain('page=1');
            expect(result.url).toContain('sort=asc');
        });

        it('should handle RequestType with port 0', () => {
            const requestType: RequestType = {
                method: 'GET',
                url: {
                    scheme: 'http',
                    host: 'example.com',
                    path: '/',
                    port: 0,
                    query: {},
                },
                headers: {},
                body: {
                    type: 'json',
                    payload: null,
                },
            };
            
            const result = RequestUtils.plainObjectToRequest(requestType);
            // Port 0 means no port in URL
            expect(result.url).toBe('http://example.com/');
        });
    });

    describe('roundtrip conversion', () => {
        it('should convert Request to RequestType and back', async () => {
            const original = new Request('https://api.example.com/users?page=1', {
                method: 'GET',
                headers: new Headers({ 'Content-Type': 'application/json' }),
            });
            
            const requestType = await RequestUtils.requestToPlainObject(original);
            const result = RequestUtils.plainObjectToRequest(requestType);
            
            expect(result.method).toBe(original.method);
            expect(result.url).toContain('page=1');
            expect(result.headers.get('Content-Type')).toBe('application/json');
        });

        it('should maintain body through roundtrip for JSON', async () => {
            const bodyData = { test: 'data', nested: { key: 'value' } };
            const original = new Request('https://api.example.com', {
                method: 'POST',
                headers: new Headers({ 'Content-Type': 'application/json' }),
                body: JSON.stringify(bodyData),
            });
            
            const requestType = await RequestUtils.requestToPlainObject(original);
            const result = RequestUtils.plainObjectToRequest(requestType);
            
            // In Node.js, request.body is a ReadableStream
            const resultBodyText = await result.text();
            const parsed = JSON.parse(resultBodyText);
            expect(parsed).toEqual(bodyData);
        });

        it('should maintain binary.uint8array body through roundtrip', async () => {
            const binaryData = new Uint8Array([1, 2, 3, 4, 5]);
            const requestType: RequestType = {
                type: 'request',
                method: 'POST',
                url: {
                    scheme: 'https',
                    host: 'api.example.com',
                    path: '/upload',
                    port: 443,
                    query: {},
                },
                headers: {},
                body: {
                    type: 'binary.uint8array',
                    payload: binaryData,
                },
            };

            const result = RequestUtils.plainObjectToRequest(requestType);

            // For binary data, the body should be a Uint8Array
            const resultBody = await result.arrayBuffer();
            const resultBinary = new Uint8Array(resultBody);
            expect(resultBinary).toEqual(binaryData);
        });
    });
});
