/**
 * Provider-aware status topology resolution.
 * Owns provider endpoint base + timeout lookup so status/recovery paths stay adapter-driven.
 */

import { getFalModelProfileByModelId } from "../falIntegration/modelProfiles";
import { filterTrustedFalProviderUrls } from "../falIntegration/providerTrustPolicy";
import {
  assertKieRuntimeEnabledForModel,
  filterTrustedKieProviderUrls,
  readKieRuntimeFlags,
  resolveKieStatusBaseUrlsForModel,
} from "./providerRuntimeConfig";
import { isFalProviderKey, isKieProviderKey } from "./providerKey";

const DEFAULT_STATUS_TIMEOUT_MS = 60000;

/**
 * Resolves trusted status base URLs from explicit route configuration.
 */
export const resolveProviderConfiguredStatusBaseUrls = ({
  provider,
  configuredBaseUrls,
  modelId,
}: {
  provider: string;
  configuredBaseUrls: string[];
  modelId?: string | null;
}): string[] => {
  if (isFalProviderKey(provider)) {
    return filterTrustedFalProviderUrls(configuredBaseUrls);
  }
  if (isKieProviderKey(provider)) {
    const flags = readKieRuntimeFlags();
    if (!flags.enabled) {
      throw new Error("Kie provider is disabled by runtime flag.");
    }
    const normalizedModelId = modelId?.trim();
    if (!normalizedModelId) {
      throw new Error("Kie status base resolution requires modelId.");
    }
    assertKieRuntimeEnabledForModel({ modelId: normalizedModelId, flags });
    const candidateBaseUrls = configuredBaseUrls.length ? configuredBaseUrls : flags.statusBaseUrls;
    return filterTrustedKieProviderUrls(candidateBaseUrls, flags);
  }
  throw new Error(`Unsupported provider for status base resolution: ${provider}`);
};

/**
 * Resolves trusted response-probe URLs for provider result polling.
 */
export const resolveProviderResponseProbeUrls = ({
  provider,
  responseUrls,
  modelId,
}: {
  provider: string;
  responseUrls: string[];
  modelId?: string | null;
}): string[] => {
  if (isFalProviderKey(provider)) {
    return filterTrustedFalProviderUrls(responseUrls);
  }
  if (isKieProviderKey(provider)) {
    const flags = readKieRuntimeFlags();
    if (!flags.enabled) {
      throw new Error("Kie provider is disabled by runtime flag.");
    }
    const normalizedModelId = modelId?.trim();
    if (!normalizedModelId) {
      throw new Error("Kie response probe URL resolution requires modelId.");
    }
    assertKieRuntimeEnabledForModel({ modelId: normalizedModelId, flags });
    return filterTrustedKieProviderUrls(responseUrls, flags);
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
  if (isKieProviderKey(provider)) {
    return resolveKieStatusBaseUrlsForModel(modelId);
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
  if (isKieProviderKey(provider)) {
    const flags = readKieRuntimeFlags();
    assertKieRuntimeEnabledForModel({ modelId, flags });
    return flags.statusTimeoutMs || defaultTimeoutMs;
  }
  throw new Error(`Unsupported provider for model status timeout resolution: ${provider}`);
};
