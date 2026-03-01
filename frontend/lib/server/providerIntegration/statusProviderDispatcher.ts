/**
 * Provider-aware status/result request dispatcher.
 * Centralizes provider-specific request patterns behind one contract.
 */

import { isFalProviderKey, isKieProviderKey } from "./providerKey";
import {
  resolveProviderConfiguredStatusBaseUrls,
  resolveProviderResponseProbeUrls,
} from "./statusProviderTopology";

/**
 * Resolves trusted status base URLs for a provider.
 */
export const resolveProviderStatusBaseUrls = ({
  provider,
  configuredBaseUrls,
}: {
  provider: string;
  configuredBaseUrls: string[];
}): string[] =>
  resolveProviderConfiguredStatusBaseUrls({
    provider,
    configuredBaseUrls,
  });

/**
 * Resolves trusted response-probe URLs for a provider.
 */
export const resolveProviderResponseUrls = ({
  provider,
  responseUrls,
}: {
  provider: string;
  responseUrls: string[];
}): string[] =>
  resolveProviderResponseProbeUrls({
    provider,
    responseUrls,
  });

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
  if (isKieProviderKey(provider)) {
    return await fetch(`${baseUrl}/${requestId}/status`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
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
  if (isKieProviderKey(provider)) {
    return await fetch(`${baseUrl}/${requestId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal,
    });
  }
  throw new Error(`Unsupported provider for result dispatch: ${provider}`);
};

/**
 * Dispatches a direct response-probe request to a provider URL.
 */
export const dispatchProviderResponseProbeRequest = async ({
  provider,
  responseUrl,
  apiKey,
  signal,
}: {
  provider: string;
  responseUrl: string;
  apiKey: string;
  signal: AbortSignal;
}): Promise<Response> => {
  if (isFalProviderKey(provider)) {
    return await fetch(responseUrl, {
      method: "GET",
      headers: { Authorization: `Key ${apiKey}` },
      signal,
    });
  }
  if (isKieProviderKey(provider)) {
    return await fetch(responseUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal,
    });
  }
  throw new Error(`Unsupported provider for response probe dispatch: ${provider}`);
};
