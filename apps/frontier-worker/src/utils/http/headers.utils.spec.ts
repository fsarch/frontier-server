import { describe, it, expect } from 'vitest';
import { HeadersUtils } from './headers.utils.js';

describe('HeadersUtils', () => {
    describe('headersToPlainObject', () => {
        it('should convert Headers to HeadersType', () => {
            const headers = new Headers();
            headers.set('Content-Type', 'application/json');
            headers.set('Authorization', 'Bearer token');
            
            const result = HeadersUtils.headersToPlainObject(headers);
            
            // Keys are lowercase in the result
            expect(result['content-type']).toEqual(['application/json']);
            expect(result['authorization']).toEqual(['Bearer token']);
        });

        it('should handle multiple headers with same name', () => {
            const headers = new Headers();
            headers.set('Accept', 'application/json');
            headers.append('Accept', 'text/plain');
            
            const result = HeadersUtils.headersToPlainObject(headers);
            
            // Should return both values (keys are lowercase)
            expect(result['accept']).toEqual(['application/json', 'text/plain']);
        });

        it('should handle empty Headers', () => {
            const headers = new Headers();
            const result = HeadersUtils.headersToPlainObject(headers);
            expect(Object.keys(result)).toHaveLength(0);
        });
    });

    describe('plainObjectToHeaders', () => {
        it('should convert HeadersType to Headers', () => {
            const headersType = {
                'Content-Type': ['application/json'],
                'Authorization': ['Bearer token'],
            };
            
            const result = HeadersUtils.plainObjectToHeaders(headersType);
            
            expect(result.get('Content-Type')).toBe('application/json');
            expect(result.get('Authorization')).toBe('Bearer token');
        });

        it('should handle multiple values in array', () => {
            const headersType = {
                'accept': ['application/json', 'text/plain'],
            };
            
            const result = HeadersUtils.plainObjectToHeaders(headersType);
            // In Node.js, Headers.get() returns comma-separated values
            expect(result.get('accept')).toBe('application/json, text/plain');
        });

        it('should handle empty arrays', () => {
            const headersType = {
                'Accept': [],
            };
            
            const result = HeadersUtils.plainObjectToHeaders(headersType);
            expect(result.has('Accept')).toBe(false);
        });

        it('should handle empty object', () => {
            const result = HeadersUtils.plainObjectToHeaders({});
            expect(result instanceof Headers).toBe(true);
            // Check that there are no headers
            expect(result.get('any-key')).toBeNull();
        });
    });

    describe('roundtrip conversion', () => {
        it('should convert Headers to HeadersType and back', () => {
            const original = new Headers();
            original.set('X-Custom-Header', 'value');
            original.set('Content-Type', 'application/json');
            
            const plainObject = HeadersUtils.headersToPlainObject(original);
            const result = HeadersUtils.plainObjectToHeaders(plainObject);
            
            // Keys are case-insensitive in Headers, but stored as lowercase in plain object
            expect(result.get('x-custom-header')).toBe('value');
            expect(result.get('content-type')).toBe('application/json');
        });

        it('should preserve multiple header values through roundtrip', () => {
            const original = new Headers();
            original.append('X-Custom-Header', 'abc');
            original.append('X-Custom-Header', 'def');
            
            const plainObject = HeadersUtils.headersToPlainObject(original);
            const result = HeadersUtils.plainObjectToHeaders(plainObject);
            
            // Should preserve all values (case-insensitive, comma-separated)
            expect(result.get('x-custom-header')).toBe('abc, def');
        });
    });
});
