import { HookPayload } from './hook-payload.js';
import type { RequestType } from '../../types/http/request.type.js';

export interface PreHookPayloadData {
  clientRequest: RequestType;
  upstreamRequest: RequestType;
}

export class PreHookPayload extends HookPayload<PreHookPayloadData> {
  constructor(
    payload: PreHookPayloadData,
    metadata: Record<string, unknown> = {},
  ) {
    super('fsarch.frontier.pre_hook', payload, metadata);
  }
}
