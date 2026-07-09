import { describe, it, expect } from 'vitest';
import { ResponseUtils } from './response.utils.js';
import type { ResponseType as ResponseType } from '../../types/http/response.type.js';

describe('ResponseUtils', () => {
    describe('responseToPlainObject', () => {
        it('should convert Response to ResponseType with status 200', async () => {
            const body = JSON.stringify({ data: 'test' });
            const headers = new Headers();
            headers.set('Content-Type', 'application/json');
            headers.set('X-Custom', 'value');

            const response = new Response(body, {
                status: 200,
                statusText: 'OK',
                headers,
            });

            const result = await ResponseUtils.responseToPlainObject(response);

            expect(result.statusCode).toBe(200);
            expect(result.statusText).toBe('OK');
            expect(result.headers['content-type']).toEqual(['application/json']);
            expect(result.headers['x-custom']).toEqual(['value']);
            expect(result.body.type).toBe('json');
            expect(result.body.payload).toEqual({ data: 'test' });
        });

        it('should convert Response to ResponseType with status 404', async () => {
            const body = JSON.stringify({ error: 'Not found' });
            const response = new Response(body, {
                status: 404,
                statusText: 'Not Found',
            });

            const result = await ResponseUtils.responseToPlainObject(response);

            expect(result.statusCode).toBe(404);
            expect(result.statusText).toBe('Not Found');
            expect(result.body.payload).toEqual({ error: 'Not found' });
        });

        it('should handle Response with empty body', async () => {
            const response = new Response(null, {
                status: 204,
                statusText: 'No Content',
            });

            const result = await ResponseUtils.responseToPlainObject(response);

            expect(result.statusCode).toBe(204);
            expect(result.statusText).toBe('No Content');
            expect(result.body.payload).toBeNull();
        });

        it('should handle Response with empty string body', async () => {
            const response = new Response('', {
                status: 200,
                statusText: 'OK',
            });

            const result = await ResponseUtils.responseToPlainObject(response);
            expect(result.body.payload).toBe('');
        });

        it('should handle Response with plain text body', async () => {
            const response = new Response('plain text response', {
                status: 200,
                statusText: 'OK',
                headers: new Headers({ 'Content-Type': 'text/plain' }),
            });

            const result = await ResponseUtils.responseToPlainObject(response);
            expect(result.body.type).toBe('text');
            expect(result.body.payload).toBe('plain text response');
        });

        it('should handle Response with multiple headers', async () => {
            const headers = new Headers();
            headers.set('Content-Type', 'application/json');
            headers.set('Cache-Control', 'max-age=3600');
            headers.set('X-Request-Id', 'abc-123');

            const response = new Response('{}', { headers });
            const result = await ResponseUtils.responseToPlainObject(response);

            expect(result.headers['content-type']).toEqual(['application/json']);
            expect(result.headers['cache-control']).toEqual(['max-age=3600']);
            expect(result.headers['x-request-id']).toEqual(['abc-123']);
        });
    });

    describe('plainObjectToResponse', () => {
        it('should convert ResponseType to Response with status 200', async () => {
            const responseType: ResponseType = {
                statusCode: 200,
                statusText: 'OK',
                headers: {
                    'content-type': ['application/json'],
                },
                body: {
                    type: 'json',
                    payload: { data: 'test' },
                },
            };

            const result = ResponseUtils.plainObjectToResponse(responseType);

            expect(result.status).toBe(200);
            expect(result.statusText).toBe('OK');
            expect(result.headers.get('Content-Type')).toBe('application/json');
            const resultBodyText = await result.text();
            expect(resultBodyText).toBe('{"data":"test"}');
        });

        it('should convert ResponseType to Response with status 404', async () => {
            const responseType: ResponseType = {
                statusCode: 404,
                statusText: 'Not Found',
                headers: {},
                body: {
                    type: 'json',
                    payload: { error: 'Not found' },
                },
            };

            const result = ResponseUtils.plainObjectToResponse(responseType);

            expect(result.status).toBe(404);
            expect(result.statusText).toBe('Not Found');
            const resultBodyText = await result.text();
            expect(resultBodyText).toBe('{"error":"Not found"}');
        });

        it('should handle ResponseType with null body', async () => {
            const responseType: ResponseType = {
                statusCode: 204,
                statusText: 'No Content',
                headers: {},
                body: {
                    type: 'json',
                    payload: null,
                },
            };

            const result = ResponseUtils.plainObjectToResponse(responseType);
            const resultBodyText = await result.text();
            expect(resultBodyText).toBe('');
        });

        it('should handle ResponseType with empty object body', async () => {
            const responseType: ResponseType = {
                statusCode: 200,
                statusText: 'OK',
                headers: {},
                body: {
                    type: 'json',
                    payload: {},
                },
            };

            const result = ResponseUtils.plainObjectToResponse(responseType);
            const resultBodyText = await result.text();
            expect(resultBodyText).toBe('{}');
        });

        it('should handle ResponseType with multiple headers', () => {
            const responseType: ResponseType = {
                statusCode: 200,
                statusText: 'OK',
                headers: {
                    'content-type': ['application/json'],
                    'cache-control': ['max-age=3600'],
                    'x-request-id': ['abc-123'],
                },
                body: {
                    type: 'json',
                    payload: null,
                },
            };

            const result = ResponseUtils.plainObjectToResponse(responseType);

            expect(result.headers.get('Content-Type')).toBe('application/json');
            expect(result.headers.get('Cache-Control')).toBe('max-age=3600');
            expect(result.headers.get('X-Request-Id')).toBe('abc-123');
        });

        it('should handle ResponseType with array payload', async () => {
            const responseType: ResponseType = {
                statusCode: 200,
                statusText: 'OK',
                headers: {},
                body: {
                    type: 'json',
                    payload: [1, 2, 3],
                },
            };

            const result = ResponseUtils.plainObjectToResponse(responseType);
            const resultBodyText = await result.text();
            expect(resultBodyText).toBe('[1,2,3]');
        });
    });

    describe('roundtrip conversion', () => {
        it('should convert Response to ResponseType and back', async () => {
            const originalBody = JSON.stringify({ test: 'data' });
            const original = new Response(originalBody, {
                status: 200,
                statusText: 'OK',
                headers: new Headers({ 'Content-Type': 'application/json' }),
            });

            const responseType = await ResponseUtils.responseToPlainObject(original);
            const result = ResponseUtils.plainObjectToResponse(responseType);

            expect(result.status).toBe(original.status);
            expect(result.statusText).toBe(original.statusText);
            expect(result.headers.get('Content-Type')).toBe('application/json');
            const resultBodyText = await result.text();
            expect(resultBodyText).toBe(originalBody);
        });

        it('should maintain JSON body through roundtrip', async () => {
            const bodyData = { test: 'data', nested: { key: 'value' }, items: [1, 2, 3] };
            const originalBody = JSON.stringify(bodyData);
            const original = new Response(originalBody, {
                status: 201,
                statusText: 'Created',
            });

            const responseType = await ResponseUtils.responseToPlainObject(original);
            const result = ResponseUtils.plainObjectToResponse(responseType);

            const resultBodyText = await result.text();
            const parsed = JSON.parse(resultBodyText);
            expect(parsed).toEqual(bodyData);
        });

        it('should maintain all headers through roundtrip', async () => {
            const original = new Response('{}', {
                status: 200,
                statusText: 'OK',
                headers: new Headers({
                    'Content-Type': 'application/json',
                    'X-Custom-1': 'value1',
                    'X-Custom-2': 'value2',
                }),
            });

            const responseType = await ResponseUtils.responseToPlainObject(original);
            const result = ResponseUtils.plainObjectToResponse(responseType);

            expect(result.headers.get('Content-Type')).toBe('application/json');
            expect(result.headers.get('X-Custom-1')).toBe('value1');
            expect(result.headers.get('X-Custom-2')).toBe('value2');
        });
    });
});
