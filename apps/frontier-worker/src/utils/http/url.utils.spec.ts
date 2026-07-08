import { describe, it, expect } from 'vitest';
import { UrlUtils } from './url.utils.js';

describe('UrlUtils', () => {
    describe('urlToPlainObject', () => {
        it('should convert URL to RequestUrl with http scheme', () => {
            const url = new URL('http://example.com/path?page=1');
            const result = UrlUtils.urlToPlainObject(url);
            
            expect(result.scheme).toBe('http');
            expect(result.host).toBe('example.com');
            expect(result.path).toBe('/path');
            expect(result.port).toBe(80);
            expect(result.query).toEqual({ page: ['1'] });
        });

        it('should convert URL to RequestUrl with https scheme', () => {
            const url = new URL('https://api.example.com/v1/users?limit=10&offset=0');
            const result = UrlUtils.urlToPlainObject(url);
            
            expect(result.scheme).toBe('https');
            expect(result.host).toBe('api.example.com');
            expect(result.path).toBe('/v1/users');
            expect(result.port).toBe(443);
            expect(result.query).toEqual({ limit: ['10'], offset: ['0'] });
        });

        it('should convert URL with custom port', () => {
            const url = new URL('http://localhost:3000/api');
            const result = UrlUtils.urlToPlainObject(url);
            
            expect(result.scheme).toBe('http');
            expect(result.host).toBe('localhost');
            expect(result.path).toBe('/api');
            expect(result.port).toBe(3000);
            expect(result.query).toEqual({});
        });

        it('should handle URL without port (default ports)', () => {
            const httpUrl = new URL('http://example.com');
            const httpsUrl = new URL('https://example.com');
            
            expect(UrlUtils.urlToPlainObject(httpUrl).port).toBe(80);
            expect(UrlUtils.urlToPlainObject(httpsUrl).port).toBe(443);
        });

        it('should handle URL with no path', () => {
            const url = new URL('https://example.com');
            const result = UrlUtils.urlToPlainObject(url);
            
            expect(result.path).toBe('/');
        });

        it('should handle URL with trailing slash', () => {
            const url = new URL('https://example.com/path/');
            const result = UrlUtils.urlToPlainObject(url);
            
            expect(result.path).toBe('/path');
        });

        it('should handle URL with multiple query parameters with same name', () => {
            const url = new URL('https://example.com?key=value1&key=value2');
            const result = UrlUtils.urlToPlainObject(url);
            
            expect(result.query).toEqual({ key: ['value1', 'value2'] });
        });

        it('should handle URL with empty query string', () => {
            const url = new URL('https://example.com/path');
            const result = UrlUtils.urlToPlainObject(url);
            
            expect(result.query).toEqual({});
        });

        it('should handle URL with hash/fragment', () => {
            const url = new URL('https://example.com/path#section');
            const result = UrlUtils.urlToPlainObject(url);
            
            expect(result.path).toBe('/path');
            expect(result.query).toEqual({});
        });
    });

    describe('plainObjectToUrl', () => {
        it('should convert RequestUrl to URL with http', () => {
            const requestUrl = {
                scheme: 'http',
                host: 'example.com',
                path: '/path',
                port: 80,
                query: { page: ['1'] },
            };
            
            const result = UrlUtils.plainObjectToUrl(requestUrl);
            
            expect(result.protocol).toBe('http:');
            expect(result.hostname).toBe('example.com');
            expect(result.pathname).toBe('/path');
            expect(result.search).toBe('?page=1');
        });

        it('should convert RequestUrl to URL with https', () => {
            const requestUrl = {
                scheme: 'https',
                host: 'api.example.com',
                path: '/v1/users',
                port: 443,
                query: { limit: ['10'], offset: ['0'] },
            };
            
            const result = UrlUtils.plainObjectToUrl(requestUrl);
            
            expect(result.protocol).toBe('https:');
            expect(result.hostname).toBe('api.example.com');
            expect(result.pathname).toBe('/v1/users');
            expect(result.search).toContain('limit=10');
            expect(result.search).toContain('offset=0');
        });

        it('should convert RequestUrl with port 0 (no port in URL)', () => {
            const requestUrl = {
                scheme: 'http',
                host: 'example.com',
                path: '/',
                port: 0,
                query: {},
            };
            
            const result = UrlUtils.plainObjectToUrl(requestUrl);
            expect(result.host).toBe('example.com');
        });

        it('should convert RequestUrl with custom port', () => {
            const requestUrl = {
                scheme: 'http',
                host: 'localhost',
                path: '/api',
                port: 3000,
                query: {},
            };
            
            const result = UrlUtils.plainObjectToUrl(requestUrl);
            expect(result.host).toBe('localhost:3000');
        });

        it('should handle empty query', () => {
            const requestUrl = {
                scheme: 'https',
                host: 'example.com',
                path: '/path',
                port: 443,
                query: {},
            };
            
            const result = UrlUtils.plainObjectToUrl(requestUrl);
            expect(result.search).toBe('');
        });

        it('should handle multiple query parameter values', () => {
            const requestUrl = {
                scheme: 'https',
                host: 'example.com',
                path: '/',
                port: 443,
                query: { key: ['value1', 'value2'] },
            };
            
            const result = UrlUtils.plainObjectToUrl(requestUrl);
            expect(result.search).toBe('?key=value1&key=value2');
        });
    });

    describe('roundtrip conversion', () => {
        it('should convert URL to RequestUrl and back', () => {
            const original = new URL('https://example.com:8080/api/users?id=1&id=2');
            const requestUrl = UrlUtils.urlToPlainObject(original);
            const result = UrlUtils.plainObjectToUrl(requestUrl);
            
            expect(result.protocol).toBe(original.protocol);
            expect(result.hostname).toBe(original.hostname);
            expect(result.port).toBe(original.port);
            expect(result.pathname).toBe(original.pathname);
        });

        it('should maintain query parameters through roundtrip', () => {
            const original = new URL('https://example.com?sort=asc&sort=desc&filter=active');
            const requestUrl = UrlUtils.urlToPlainObject(original);
            const result = UrlUtils.plainObjectToUrl(requestUrl);
            
            const originalSort = original.searchParams.getAll('sort');
            const resultSort = result.searchParams.getAll('sort');
            
            expect(resultSort).toEqual(originalSort);
        });
    });
});
