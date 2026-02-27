/**
 * Provider-aware recovery probe dispatcher.
 * Routes recovery probe calls to the correct provider implementation without leaking provider-specific logic into recovery orchestration.
 */

import type { ProviderProbeObservation } from "../falIntegration/recoveryProviderProbe";
import { probeProviderResult } from "../falIntegration/recoveryProviderProbe";
import { isFalProviderKey } from "./providerKey";

/**
 * Dispatches a recovery provider probe by provider key.
 */
export const probeGenerationProviderResult = async ({
  provider,
  requestId,
  modelId,
  apiKey,
}: {
  provider: string;
  requestId: string;
  modelId: string;
  apiKey: string;
}): Promise<ProviderProbeObservation> => {
  if (isFalProviderKey(provider)) {
    return await probeProviderResult({
      requestId,
      modelId,
      apiKey,
    });
  }
  throw new Error(`Unsupported recovery provider for probe dispatch: ${provider}`);
};
