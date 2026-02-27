/**
 * Provider-aware status/result request dispatcher.
 * Centralizes provider-specific status endpoint patterns behind one contract.
 */

import { filterTrustedFalProviderUrls } from "../falIntegration/providerTrustPolicy";
import { isFalProviderKey } from "./providerKey";

/**
 * Resolves trusted status base URLs for a provider.
 */
export const resolveProviderStatusBaseUrls = ({
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
 * Dispatches a status request to a provider endpoint.
 */
export const dispatchProviderStatusRequest = async ({
  provider,
  baseUrl,
  requestId,
  apiKey,
  signal,
}: {
  provider: string;
  baseUrl: string;
  requestId: string;
  apiKey: string;
  signal: AbortSignal;
}): Promise<Response> => {
  if (isFalProviderKey(provider)) {
    return await fetch(`${baseUrl}/${requestId}/status`, {
      method: "GET",
      headers: { Authorization: `Key ${apiKey}` },
      signal,
    });
  }
  throw new Error(`Unsupported provider for status dispatch: ${provider}`);
};

/**
 * Dispatches a result request to a provider endpoint.
 */
export const dispatchProviderResultRequest = async ({
  provider,
  baseUrl,
  requestId,
  apiKey,
  signal,
}: {
  provider: string;
  baseUrl: string;
  requestId: string;
  apiKey: string;
  signal: AbortSignal;
}): Promise<Response> => {
  if (isFalProviderKey(provider)) {
    return await fetch(`${baseUrl}/${requestId}`, {
      method: "GET",
      headers: { Authorization: `Key ${apiKey}` },
      signal,
    });
  }
  throw new Error(`Unsupported provider for result dispatch: ${provider}`);
};
