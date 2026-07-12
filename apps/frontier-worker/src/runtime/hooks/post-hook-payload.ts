import { HookPayload } from './hook-payload.js';
import type { RequestType } from '../../types/http/request.type.js';
import type { ResponseType } from '../../types/http/response.type.js';

export interface PostHookPayloadData {
  clientRequest: RequestType;
  upstreamRequest: RequestType;
  response: ResponseType;
}

export class PostHookPayload extends HookPayload<PostHookPayloadData> {
  constructor(
    payload: PostHookPayloadData,
    metadata: Record<string, unknown> = {},
  ) {
    super('fsarch.frontier.post_hook', payload, metadata);
  }
}
