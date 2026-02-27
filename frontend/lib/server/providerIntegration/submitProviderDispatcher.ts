/**
 * Provider-aware submit dispatcher.
 * Routes submit calls through provider-specific engines behind a stable contract.
 */

import type { SubmitPayload, SubmitTarget } from "../falIntegration/contracts";
import { submitWithFallbackTargets } from "../falIntegration/submitEngine";
import { readCanonicalProviderRequestId } from "./canonicalProviderPayload";
import { isFalProviderKey } from "./providerKey";

export type ProviderSubmitResult = {
  response: Response;
  data: Record<string, unknown>;
  targetUrl: string;
  targetIndex: number;
  providerRequestId: string | null;
};

/**
 * Dispatches a generation submit request to the correct provider adapter.
 */
export const dispatchProviderSubmit = async ({
  provider,
  targets,
  payload,
  apiKey,
  signal,
  requestStartTimeoutSeconds,
  maxAttemptsPerTarget,
}: {
  provider: string;
  targets: SubmitTarget[];
  payload: SubmitPayload;
  apiKey: string;
  signal: AbortSignal;
  requestStartTimeoutSeconds?: number;
  maxAttemptsPerTarget?: number;
}): Promise<ProviderSubmitResult> => {
  if (isFalProviderKey(provider)) {
    const result = await submitWithFallbackTargets({
      targets,
      payload,
      apiKey,
      signal,
      requestStartTimeoutSeconds,
      maxAttemptsPerTarget,
    });
    return {
      ...result,
      providerRequestId: readCanonicalProviderRequestId(result.data, { allowGenericId: true }),
    };
  }
  throw new Error(`Unsupported provider for submit dispatch: ${provider}`);
};
