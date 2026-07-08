import type { Request } from "../http/request.type.js";
import type { Response } from "../http/response.type.js";

export interface PostHookPayload {
    upstreamRequest: Request;
    clientRequest: Request;
    response: Response;
}

export interface PostHookType {
    type: 'fsarch.frontier.post_hook';
    payload: PostHookPayload;
    metadata: Record<string, unknown>;
}
