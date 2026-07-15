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
            
            expect(result.type).toBe('text');
            expect(result.payload).toBe('plain text');
        });

        it('should convert null body to null', async () => {
            const result = await BodyUtils.bodyToPlainObject(null);
            
            expect(result).toBeNull();
        });

        it('should convert undefined body to null', async () => {
            const result = await BodyUtils.bodyToPlainObject(undefined);
            
            expect(result).toBeNull();
        });

        it('should convert empty string to BodyType', async () => {
            const result = await BodyUtils.bodyToPlainObject('');
            
            expect(result.type).toBe('text');
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
                type: 'text',
                payload: 'plain text',
            };
            
            const result = BodyUtils.plainObjectToBody(bodyType);
            expect(result).toBe('plain text');
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

        it('should convert text body to plain text string', () => {
            const bodyType = {
                type: 'text',
                payload: 'plain text',
            };

            const result = BodyUtils.plainObjectToBody(bodyType);
            expect(result).toBe('plain text');
        });

        it('should convert binary.uint8array BodyType to Uint8Array', () => {
            const binaryData = new Uint8Array([1, 2, 3, 4, 5]);
            const bodyType = {
                type: 'binary.uint8array',
                payload: binaryData,
            };

            const result = BodyUtils.plainObjectToBody(bodyType);
            expect(result).toBeInstanceOf(Uint8Array);
            expect(result).toEqual(binaryData);
        });
    });

    describe('bodyToPlainObject with binary data', () => {
        it('should convert Uint8Array to binary.uint8array BodyType', async () => {
            const binaryData = new Uint8Array([10, 20, 30, 40]);
            const result = await BodyUtils.bodyToPlainObject(binaryData);

            expect(result.type).toBe('binary.uint8array');
            expect(result.payload).toBeInstanceOf(Uint8Array);
            expect(result.payload).toEqual(binaryData);
        });

        it('should convert ArrayBuffer to binary.uint8array BodyType', async () => {
            const arrayBuffer = new ArrayBuffer(4);
            const uint8View = new Uint8Array(arrayBuffer);
            uint8View[0] = 1;
            uint8View[1] = 2;
            uint8View[2] = 3;
            uint8View[3] = 4;

            const result = await BodyUtils.bodyToPlainObject(arrayBuffer);

            expect(result.type).toBe('binary.uint8array');
            expect(result.payload).toBeInstanceOf(Uint8Array);
            expect(result.payload).toEqual(new Uint8Array([1, 2, 3, 4]));
        });

        it('should convert empty Uint8Array to binary.uint8array BodyType', async () => {
            const emptyData = new Uint8Array([]);
            const result = await BodyUtils.bodyToPlainObject(emptyData);

            expect(result.type).toBe('binary.uint8array');
            expect(result.payload).toBeInstanceOf(Uint8Array);
            expect(result.payload).toHaveLength(0);
        });
    });

    describe('roundtrip conversion with binary data', () => {
        it('should convert Uint8Array to BodyType and back to Uint8Array', async () => {
            const original = new Uint8Array([255, 128, 64, 32]);
            const bodyType = await BodyUtils.bodyToPlainObject(original);
            const result = BodyUtils.plainObjectToBody(bodyType);

            expect(result).toBeInstanceOf(Uint8Array);
            expect(result).toEqual(original);
        });

        it('should convert ArrayBuffer to BodyType and back to Uint8Array', async () => {
            const original = new ArrayBuffer(8);
            const view = new Uint8Array(original);
            for (let i = 0; i < 8; i++) {
                view[i] = i * 32;
            }

            const bodyType = await BodyUtils.bodyToPlainObject(original);
            const result = BodyUtils.plainObjectToBody(bodyType);

            expect(result).toBeInstanceOf(Uint8Array);
            expect(result).toEqual(view);
        });
    });
});
