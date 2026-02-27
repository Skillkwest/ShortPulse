/**
 * Provider-aware status topology resolution.
 * Owns provider endpoint base + timeout lookup so status/recovery paths stay adapter-driven.
 */

import { getFalModelProfileByModelId } from "../falIntegration/modelProfiles";
import { filterTrustedFalProviderUrls } from "../falIntegration/providerTrustPolicy";
import { isFalProviderKey } from "./providerKey";

const DEFAULT_STATUS_TIMEOUT_MS = 60000;

/**
 * Resolves trusted status base URLs from explicit route configuration.
 */
export const resolveProviderConfiguredStatusBaseUrls = ({
  provider,
  configuredBaseUrls,
}: {
  provider: string;
  configuredBaseUrls: string[];
}): string[] => {
  if (isFalProviderKey(provider)) {
    return filterTrustedFalProviderUrls(configuredBaseUrls);
  }
  throw new Error(`Unsupported provider for status base resolution: ${provider}`);
};

/**
 * Resolves trusted response-probe URLs for provider result polling.
 */
export const resolveProviderResponseProbeUrls = ({
  provider,
  responseUrls,
}: {
  provider: string;
  responseUrls: string[];
}): string[] => {
  if (isFalProviderKey(provider)) {
    return filterTrustedFalProviderUrls(responseUrls);
  }
  throw new Error(`Unsupported provider for response probe URL resolution: ${provider}`);
};

/**
 * Resolves trusted status base URLs from provider model topology.
 */
export const resolveProviderModelStatusBaseUrls = ({
  provider,
  modelId,
}: {
  provider: string;
  modelId: string;
}): string[] => {
  if (isFalProviderKey(provider)) {
    const profile = getFalModelProfileByModelId(modelId);
    const baseUrls = profile?.statusBases?.length
      ? profile.statusBases
      : [`https://queue.fal.run/${modelId}/requests`];
    return filterTrustedFalProviderUrls(baseUrls);
  }
  throw new Error(`Unsupported provider for model status base resolution: ${provider}`);
};

/**
 * Resolves provider status timeout for a model with sensible fallback.
 */
export const resolveProviderModelStatusTimeoutMs = ({
  provider,
  modelId,
  defaultTimeoutMs = DEFAULT_STATUS_TIMEOUT_MS,
}: {
  provider: string;
  modelId: string;
  defaultTimeoutMs?: number;
}): number => {
  if (isFalProviderKey(provider)) {
    return getFalModelProfileByModelId(modelId)?.timeoutMs ?? defaultTimeoutMs;
  }
  throw new Error(`Unsupported provider for model status timeout resolution: ${provider}`);
};
