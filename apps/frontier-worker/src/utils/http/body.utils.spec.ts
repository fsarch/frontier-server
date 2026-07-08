import { describe, it, expect } from 'vitest';
import { BodyUtils } from './body.utils.js';

describe('BodyUtils', () => {
    describe('bodyToPlainObject', () => {
        it('should convert string to BodyType', async () => {
            const body = '{"key": "value"}';
            const result = await BodyUtils.bodyToPlainObject(body);
            
            expect(result.type).toBe('json');
            expect(result.payload).toEqual({ key: 'value' });
        });

        it('should convert plain string to BodyType', async () => {
            const body = 'plain text';
            const result = await BodyUtils.bodyToPlainObject(body);
            
            expect(result.type).toBe('json');
            expect(result.payload).toBe('plain text');
        });

        it('should convert null body to BodyType', async () => {
            const result = await BodyUtils.bodyToPlainObject(null);
            
            expect(result.type).toBe('json');
            expect(result.payload).toBeNull();
        });

        it('should convert undefined body to BodyType', async () => {
            const result = await BodyUtils.bodyToPlainObject(undefined);
            
            expect(result.type).toBe('json');
            expect(result.payload).toBeNull();
        });

        it('should convert empty string to BodyType', async () => {
            const result = await BodyUtils.bodyToPlainObject('');
            
            expect(result.type).toBe('json');
            // Empty string is preserved as empty string, not null
            expect(result.payload).toBe('');
        });

        it('should convert object to BodyType', async () => {
            const body = { foo: 'bar', num: 42 };
            const result = await BodyUtils.bodyToPlainObject(body);
            
            expect(result.type).toBe('json');
            expect(result.payload).toEqual(body);
        });

        it('should convert Blob to BodyType', async () => {
            const blob = new Blob(['{"test": true}'], { type: 'application/json' });
            const result = await BodyUtils.bodyToPlainObject(blob);
            
            expect(result.type).toBe('json');
            expect(result.payload).toEqual({ test: true });
        });
    });

    describe('plainObjectToBody', () => {
        it('should convert BodyType with object payload to string', () => {
            const bodyType = {
                type: 'json',
                payload: { key: 'value', num: 42 },
            };
            
            const result = BodyUtils.plainObjectToBody(bodyType);
            expect(result).toBe('{"key":"value","num":42}');
        });

        it('should convert BodyType with string payload to string', () => {
            const bodyType = {
                type: 'json',
                payload: 'plain text',
            };
            
            const result = BodyUtils.plainObjectToBody(bodyType);
            expect(result).toBe('"plain text"');
        });

        it('should convert BodyType with null payload to empty string', () => {
            const bodyType = {
                type: 'json',
                payload: null,
            };
            
            const result = BodyUtils.plainObjectToBody(bodyType);
            expect(result).toBe('');
        });

        it('should convert BodyType with undefined payload to empty string', () => {
            const bodyType = {
                type: 'json',
                payload: undefined,
            };
            
            const result = BodyUtils.plainObjectToBody(bodyType);
            expect(result).toBe('');
        });

        it('should convert BodyType with empty object payload to string', () => {
            const bodyType = {
                type: 'json',
                payload: {},
            };
            
            const result = BodyUtils.plainObjectToBody(bodyType);
            expect(result).toBe('{}');
        });

        it('should convert BodyType with array payload to string', () => {
            const bodyType = {
                type: 'json',
                payload: [1, 2, 3],
            };
            
            const result = BodyUtils.plainObjectToBody(bodyType);
            expect(result).toBe('[1,2,3]');
        });
    });

    describe('roundtrip conversion', () => {
        it('should convert object to BodyType and back to JSON string', async () => {
            const original = { name: 'test', value: 123, nested: { key: 'val' } };
            const bodyType = await BodyUtils.bodyToPlainObject(JSON.stringify(original));
            const result = BodyUtils.plainObjectToBody(bodyType);
            
            const parsed = JSON.parse(result);
            expect(parsed).toEqual(original);
        });

        it('should convert array to BodyType and back to JSON string', async () => {
            const original = [1, 'two', { three: 3 }];
            const bodyType = await BodyUtils.bodyToPlainObject(JSON.stringify(original));
            const result = BodyUtils.plainObjectToBody(bodyType);
            
            const parsed = JSON.parse(result);
            expect(parsed).toEqual(original);
        });
    });
});
