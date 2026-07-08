import type { RequestType } from "../../types/http/request.type.js";
import { UrlUtils } from "./url.utils.js";
import { HeadersUtils } from "./headers.utils.js";
import { BodyUtils } from "./body.utils.js";

/**
 * Converts a standard Request object to a RequestType plain object
 */
async function requestToPlainObject(request: Request): Promise<RequestType> {
    const url = new URL(request.url);
    const headers = HeadersUtils.headersToPlainObject(request.headers);
    const body = await BodyUtils.bodyToPlainObject(request.body);

    return {
        type: 'request',
        method: request.method,
        url: UrlUtils.urlToPlainObject(url),
        headers,
        body,
    };
}

/**
 * Converts a RequestType plain object to a standard Request object
 */
function plainObjectToRequest(requestType: RequestType): Request {
    const url = new URL(
        `${requestType.url.scheme}://${requestType.url.host}` +
        (requestType.url.port ? `:${requestType.url.port}` : '') +
        requestType.url.path
    );

    // Add query parameters
    for (const [key, values] of Object.entries(requestType.url.query)) {
        for (const value of values) {
            url.searchParams.append(key, value);
        }
    }

    const headers = HeadersUtils.plainObjectToHeaders(requestType.headers);

    const body = BodyUtils.plainObjectToBody(requestType.body);

    // In Node.js, Request constructor doesn't allow body for GET/HEAD methods
    const requestInit: RequestInit = {
        method: requestType.method,
        headers,
    };

    // Only set body if method allows it (not GET or HEAD)
    if (body && !['GET', 'HEAD'].includes(requestType.method)) {
        requestInit.body = body;
    }

    return new Request(url.toString(), requestInit);
}

export const RequestUtils = {
    requestToPlainObject,
    plainObjectToRequest,
};
