import type { RequestType } from "../http/request.type.js";
import type { ResponseType } from "../http/response.type.js";

export interface PostHookPayload {
    upstreamRequest: RequestType;
    clientRequest: RequestType;
    response: ResponseType;
}

export interface PostHookType {
    type: 'fsarch.frontier.post_hook';
    payload: PostHookPayload;
    metadata: Record<string, unknown>;
}
