import type { Request } from "../http/request.type.js";

export interface PreHookPayload {
    upstreamRequest: Request;
    clientRequest: Request;
}

export interface PreHookType {
    type: 'fsarch.frontier.pre_hook';
    payload: PreHookPayload;
    metadata: Record<string, unknown>;
}
