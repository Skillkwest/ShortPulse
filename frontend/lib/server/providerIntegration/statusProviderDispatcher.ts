/**
 * Provider-aware status/result request dispatcher.
 * Centralizes provider-specific request patterns behind one contract.
 */

import { isFalProviderKey, isKieProviderKey } from "./providerKey";
import {
  resolveProviderConfiguredStatusBaseUrls,
  resolveProviderResponseProbeUrls,
} from "./statusProviderTopology";

const REQUEST_ID_TEMPLATE_TOKEN = "{requestId}";

const resolveTemplateRequestUrl = ({
  templateUrl,
  requestId,
}: {
  templateUrl: string;
  requestId: string;
}): string | null => {
  if (!templateUrl.includes(REQUEST_ID_TEMPLATE_TOKEN)) return null;
  return templateUrl.replaceAll(REQUEST_ID_TEMPLATE_TOKEN, encodeURIComponent(requestId));
};

/**
 * Resolves trusted status base URLs for a provider.
 */
export const resolveProviderStatusBaseUrls = ({
  provider,
  configuredBaseUrls,
  modelId,
}: {
  provider: string;
  configuredBaseUrls: string[];
  modelId?: string | null;
}): string[] =>
  resolveProviderConfiguredStatusBaseUrls({
    provider,
    configuredBaseUrls,
    modelId,
  });

/**
 * Resolves trusted response-probe URLs for a provider.
 */
export const resolveProviderResponseUrls = ({
  provider,
  responseUrls,
  modelId,
}: {
  provider: string;
  responseUrls: string[];
  modelId?: string | null;
}): string[] =>
  resolveProviderResponseProbeUrls({
    provider,
    responseUrls,
    modelId,
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
    const statusUrl = resolveTemplateRequestUrl({
      templateUrl: baseUrl,
      requestId,
    });
    if (!statusUrl) {
      throw new Error("Kie status dispatch requires a {requestId} status URL template.");
    }
    return await fetch(statusUrl, {
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
    const resultUrl = resolveTemplateRequestUrl({
      templateUrl: baseUrl,
      requestId,
    });
    if (!resultUrl) {
      throw new Error("Kie result dispatch requires a {requestId} status URL template.");
    }
    return await fetch(resultUrl, {
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
