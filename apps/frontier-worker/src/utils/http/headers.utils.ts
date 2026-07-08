import type { HeadersType } from "../../types/http/shared.type.js";

/**
 * Converts a Headers object to a HeadersType (Record<string, string[]>)
 * Supports multiple header values for the same key
 * In Node.js, Headers.get() returns comma-separated values
 */
function headersToPlainObject(headers: Headers): HeadersType {
    const result: HeadersType = {};
    // Use forEach to iterate through all header names
    headers.forEach((_value, key) => {
        // In Node.js, get() returns comma-separated values for multiple headers
        const values = headers.get(key)?.split(', ').filter(v => v !== undefined) || [];
        result[key.toLowerCase()] = values;
    });
    return result;
}

/**
 * Converts a HeadersType (Record<string, string[]>) to a Headers object
 * Supports multiple header values for the same key
 */
function plainObjectToHeaders(headers: HeadersType): Headers {
    const result = new Headers();
    for (const [key, values] of Object.entries(headers)) {
        for (const value of values) {
            result.append(key, value);
        }
    }
    return result;
}

export const HeadersUtils = {
    headersToPlainObject,
    plainObjectToHeaders,
};
