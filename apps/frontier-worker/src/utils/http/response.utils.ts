import type { ResponseType } from "../../types/http/response.type.js";
import { HeadersUtils } from "./headers.utils.js";
import { BodyUtils } from "./body.utils.js";

/**
 * Converts a standard Response object to a ResponseType plain object
 */
async function responseToPlainObject(response: Response): Promise<ResponseType> {
    const headers = HeadersUtils.headersToPlainObject(response.headers);
    const body = await BodyUtils.bodyToPlainObject(response.body);

    return {
        type: 'response',
        statusCode: response.status,
        statusText: response.statusText,
        headers,
        body,
    };
}

/**
 * Converts a ResponseType plain object to a standard Response object
 */
function plainObjectToResponse(responseType: ResponseType): Response {
    const headers = HeadersUtils.plainObjectToHeaders(responseType.headers);
    const body = BodyUtils.plainObjectToBody(responseType.body);

    // In Node.js, Response constructor doesn't allow body for 204, 205, 304 status codes
    // For these status codes, we need to omit the body
    const responseInit: ResponseInit = {
        status: responseType.statusCode,
        statusText: responseType.statusText,
        headers,
    };

    // body can be null, string, or Uint8Array - all are valid BodyInit types
    // Uint8Array is a valid BodyInit type (via BufferSource)
    return new Response(body as BodyInit || null, responseInit);
}

export const ResponseUtils = {
    responseToPlainObject,
    plainObjectToResponse,
};
