import { PostHookPayload } from "../models/post-hook-payload.js";
import { applyCachePolicyToResponse } from "../../utils/http/cache-control.utils.js";
import type { CompiledCachePolicy } from "../compiled-config.js";

/**
 * Erstellt eine Response mit Cache-Headern aus einem PostHookPayload.
 * Wendet die CachePolicy auf die Response an, um Cache-Control Header
 * innerhalb der definierten Grenzen zu setzen.
 *
 * @param payload - Der PostHookPayload mit der Response
 * @param cachePolicy - Die anzuwendende CachePolicy
 * @returns Response mit angepasstem Cache-Control Header
 */
export function buildCacheResponse(
  payload: PostHookPayload,
  cachePolicy: CompiledCachePolicy,
) {
  const response = payload.payload.response;

  // Apply cache policy to set/restrict cache-control header
  return applyCachePolicyToResponse(response, cachePolicy);
}
