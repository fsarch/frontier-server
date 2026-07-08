import type { QueryParams, RequestUrl } from "../../types/http/request.type.js";

/**
 * Converts a URL object to a RequestUrl plain object
 */
function urlToPlainObject(url: URL): RequestUrl {
    const searchParams = new URLSearchParams(url.search);
    const query: QueryParams = {};
    
    searchParams.forEach((value, key) => {
        if (query[key]) {
            query[key].push(value);
        } else {
            query[key] = [value];
        }
    });

    // Remove trailing slash from path
    const path = url.pathname.endsWith('/') && url.pathname.length > 1
        ? url.pathname.slice(0, -1)
        : url.pathname;

    return {
        scheme: url.protocol.replace(':', ''),
        host: url.hostname,
        path: path || '/',
        port: url.port ? parseInt(url.port, 10) : (url.protocol === 'https:' ? 443 : url.protocol === 'http:' ? 80 : 0),
        query,
    };
}

/**
 * Converts a RequestUrl plain object to a URL object
 */
function plainObjectToUrl(requestUrl: RequestUrl): URL {
    const portString = requestUrl.port === 0 ? '' : `:${requestUrl.port}`;
    const baseUrl = `${requestUrl.scheme}://${requestUrl.host}${portString}${requestUrl.path}`;
    
    const url = new URL(baseUrl);
    
    // Add query parameters
    for (const [key, values] of Object.entries(requestUrl.query)) {
        for (const value of values) {
            url.searchParams.append(key, value);
        }
    }
    
    return url;
}

export const UrlUtils = {
    urlToPlainObject,
    plainObjectToUrl,
};
