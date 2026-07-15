import type { BodyType } from "../../types/http/shared.type.js";

/**
 * Converts a body (string or unknown) to a BodyType plain object
 * Assumes JSON body type by default
 */
async function bodyToPlainObject(body: BodyInit | null | unknown): Promise<BodyType | null> {
    // Handle null and undefined explicitly
    if (body === null || body === undefined) {
        return null;
    }

    // Handle Uint8Array and ArrayBuffer for binary data
    if (body instanceof Uint8Array) {
        return {
            type: 'binary.uint8array',
            payload: body,
        };
    }
    
    if (body instanceof ArrayBuffer) {
        return {
            type: 'binary.uint8array',
            payload: new Uint8Array(body),
        };
    }
    
    let payload: unknown = null;
    
    if (body instanceof ReadableStream) {
        // For streams, we need to read and parse
        const reader = body.getReader();
        const chunks: Uint8Array[] = [];
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }
        
        const concatenated = new Uint8Array(
            chunks.reduce((acc, chunk) => acc + chunk.length, 0)
        );
        let offset = 0;
        for (const chunk of chunks) {
            concatenated.set(chunk, offset);
            offset += chunk.length;
        }
        
        try {
            payload = JSON.parse(new TextDecoder().decode(concatenated));
        } catch {
            payload = new TextDecoder().decode(concatenated);
        }
    } else if (body instanceof Blob) {
        // In Node.js, Blob may not have .json() method, use .text() instead
        const blobText = await body.text().catch(() => '');
        try {
            payload = JSON.parse(blobText);
        } catch {
            payload = blobText || null;
        }
    } else if (typeof body === 'string') {
        try {
            payload = JSON.parse(body);
        } catch {
            payload = body;
        }
    } else if (body !== null && body !== undefined) {
        payload = body;
    }

    if (typeof payload === 'string') {
        return {
            type: 'text',
            payload,
        };
    }

    return {
        type: 'json',
        payload,
    };
}

/**
 * Converts a BodyType plain object to a string or Uint8Array body
 */
function plainObjectToBody(bodyType: BodyType | null): string | Uint8Array | null {
    if (bodyType === null) {
        return null;
    }

    if (bodyType.type === 'text') {
        return bodyType.payload;
    }

    if (bodyType.type === 'binary.uint8array') {
        return bodyType.payload;
    }

    if (bodyType.payload === null || bodyType.payload === undefined) {
        return '';
    }

    return JSON.stringify(bodyType.payload);
}

export const BodyUtils = {
    bodyToPlainObject,
    plainObjectToBody,
};
