import type { RequestType } from "../http/request.type.js";

export interface PreHookPayload {
    upstreamRequest: RequestType;
    clientRequest: RequestType;
}

export interface PreHookType {
    type: 'fsarch.frontier.pre_hook';
    payload: PreHookPayload;
    metadata: Record<string, unknown>;
}
