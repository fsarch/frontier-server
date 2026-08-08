import type { HeadersType } from "../../types/http/shared.type.js";
import { Headers as UndiciHeaders } from "undici";

/**
 * Converts a Headers object to a HeadersType (Record<string, string[]>)
 * Supports multiple header values for the same key
 * In Node.js, Headers.get() returns comma-separated values
 */
function headersToPlainObject(headers: Headers | UndiciHeaders): HeadersType {
    const result: HeadersType = {};
    // Use forEach to iterate through all header names
    headers.forEach((_value, key) => {
        const lowerKey = key.toLowerCase();

        // Set-Cookie must never be split on ",": per RFC 6265 a single cookie value
        // may itself contain a comma (e.g. an Expires date), and multiple Set-Cookie
        // headers must not be folded into one. Headers.get() combines them with ", "
        // regardless, so use the dedicated accessor instead of splitting.
        if (lowerKey === 'set-cookie') {
            result[lowerKey] = headers.getSetCookie();
            return;
        }

        // In Node.js, get() returns comma-separated values for multiple headers
        const values = headers.get(key)?.split(', ').filter(v => v !== undefined) || [];
        result[lowerKey] = values;
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
