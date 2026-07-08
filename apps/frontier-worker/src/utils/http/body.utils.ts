import type { BodyType, JsonBodyType } from "../../types/http/shared.type.js";

/**
 * Converts a body (string or unknown) to a BodyType plain object
 * Assumes JSON body type by default
 */
async function bodyToPlainObject(body: BodyInit | null | unknown): Promise<BodyType> {
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

    return {
        type: 'json',
        payload,
    };
}

/**
 * Converts a BodyType plain object to a string body
 */
function plainObjectToBody(bodyType: BodyType): string {
    if (bodyType.type === 'json') {
        if (bodyType.payload === null || bodyType.payload === undefined) {
            return '';
        }
        return JSON.stringify(bodyType.payload);
    }
    return String(bodyType.payload ?? '');
}

export const BodyUtils = {
    bodyToPlainObject,
    plainObjectToBody,
};
