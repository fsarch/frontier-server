import { FunctionClient } from './function-client.js';
import { CompiledHooks } from './compiled-config.js';

export type HookRequestData = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
};

export type HookResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
};

export type PreHookExecutionResult = {
  modifiedRequest: HookRequestData;
  shortCircuitResponse?: HookResponse;
  error?: false;
};

export type PreHookErrorResult = {
  error: true;
  statusCode: number;
  message: string;
};

export type PostHookExecutionResult = HookResponse;

/**
 * Executes pre-hooks for a request if the function client and hooks are available.
 * Pre-hooks can modify the request or short-circuit the entire request.
 *
 * @returns { modifiedRequest, shortCircuitResponse } or error result
 */
export async function executePreHooks(
  functionClient: FunctionClient | null,
  preHooks: CompiledHooks,
  hookRequestData: HookRequestData,
  routePathRuleId: string,
  onDebug?: (message: string) => void,
): Promise<PreHookExecutionResult | PreHookErrorResult> {
  if (!functionClient || !preHooks.enabled || preHooks.functions.length === 0) {
    return { modifiedRequest: hookRequestData, error: false };
  }

  onDebug?.(`executing pre-hooks for route: ${routePathRuleId}`);

  try {
    const preHookResult = await functionClient.executePreHooks(preHooks, hookRequestData);
    return {
      modifiedRequest: preHookResult.modifiedRequest,
      shortCircuitResponse: preHookResult.shortCircuitResponse,
      error: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    onDebug?.(`pre-hook execution failed: ${error}`);
    console.error(`[worker][hooks] pre-hook execution failed: ${errorMessage}`);

    return {
      error: true,
      statusCode: 500,
      message: `Pre-hook execution failed: ${errorMessage}`,
    };
  }
}

/**
 * Executes post-hooks for a response if the function client and hooks are available.
 * Post-hooks can modify the response.
 *
 * @returns modified response, or original response if hooks fail
 */
export async function executePostHooks(
  functionClient: FunctionClient | null,
  postHooks: CompiledHooks,
  hookRequestData: HookRequestData,
  upstreamResponseData: HookResponse,
  routePathRuleId: string,
  onDebug?: (message: string) => void,
): Promise<PostHookExecutionResult> {
  if (!functionClient || !postHooks.enabled || postHooks.functions.length === 0) {
    return upstreamResponseData;
  }

  onDebug?.(`executing post-hooks for route: ${routePathRuleId}`);

  try {
    const finalResponse = await functionClient.executePostHooks(
      postHooks,
      hookRequestData,
      upstreamResponseData,
    );
    return finalResponse;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    onDebug?.(`post-hook execution failed: ${error}`);
    console.error(`[worker][hooks] post-hook execution failed: ${errorMessage}`);

    // Add error header to response but continue with original upstream response
    const errorResponse = { ...upstreamResponseData };
    if (!errorResponse.headers) {
      errorResponse.headers = {};
    }
    errorResponse.headers['x-error'] = 'post-hook failed';

    return errorResponse;
  }
}
