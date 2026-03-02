/**
 * Provider-aware status/result payload parsing helpers.
 * Encapsulates provider-specific payload shape handling behind a stable contract.
 */

import {
  extractMediaPayloadUrls,
  extractResponseUrl,
  findContentPolicyMessage,
  hasMediaPayload,
} from "../falIntegration/falAdapter";
import { asProviderRecord, readCanonicalProviderStatus } from "./canonicalProviderPayload";
import { normalizeKieEnvelopePayload } from "./kieEnvelopeNormalizer";
import { extractKieResultMediaUrls } from "./kieResultMediaContracts";
import {
  kiePayloadHasMedia,
  readKieContentPolicyMessage,
  readKieLifecycleStatus,
  readKieResponseUrl,
  validateKieStatusPayloadForModel,
} from "./kieStatusContracts";
import { isFalProviderKey, isKieProviderKey } from "./providerKey";

/**
 * Reads normalized lifecycle status from a provider payload.
 */
export const readProviderLifecycleStatus = ({
  provider,
  modelId,
  payload,
}: {
  provider: string;
  modelId?: string | null;
  payload: unknown;
}): string | null => {
  if (isFalProviderKey(provider)) {
    return readCanonicalProviderStatus(payload);
  }
  if (isKieProviderKey(provider)) {
    const normalizedPayload = normalizeKieEnvelopePayload(payload);
    if (validateKieStatusPayloadForModel({ modelId, payload: normalizedPayload })) return null;
    return readKieLifecycleStatus(normalizedPayload);
  }
  throw new Error(`Unsupported provider for payload status parsing: ${provider}`);
};

/**
 * Reads a provider response URL when present.
 */
export const readProviderResponseUrl = ({
  provider,
  modelId,
  payload,
}: {
  provider: string;
  modelId?: string | null;
  payload: unknown;
}): string | null => {
  if (isFalProviderKey(provider)) {
    return extractResponseUrl(asProviderRecord(payload));
  }
  if (isKieProviderKey(provider)) {
    const normalizedPayload = normalizeKieEnvelopePayload(payload);
    if (validateKieStatusPayloadForModel({ modelId, payload: normalizedPayload })) return null;
    return readKieResponseUrl(normalizedPayload);
  }
  throw new Error(`Unsupported provider for response URL parsing: ${provider}`);
};

/**
 * Returns true when provider payload contains usable media URLs.
 */
export const providerPayloadHasMedia = ({
  provider,
  modelId,
  payload,
}: {
  provider: string;
  modelId?: string | null;
  payload: unknown;
}): boolean => {
  if (isFalProviderKey(provider)) {
    return hasMediaPayload(asProviderRecord(payload));
  }
  if (isKieProviderKey(provider)) {
    return kiePayloadHasMedia({ modelId, payload: normalizeKieEnvelopePayload(payload) });
  }
  throw new Error(`Unsupported provider for media payload parsing: ${provider}`);
};

/**
 * Reads normalized media URLs from provider payloads.
 */
export const readProviderMediaUrls = ({
  provider,
  modelId,
  payload,
}: {
  provider: string;
  modelId?: string | null;
  payload: unknown;
}): string[] => {
  if (isFalProviderKey(provider)) {
    return extractMediaPayloadUrls(asProviderRecord(payload));
  }
  if (isKieProviderKey(provider)) {
    const normalizedPayload = normalizeKieEnvelopePayload(payload);
    if (validateKieStatusPayloadForModel({ modelId, payload: normalizedPayload })) return [];
    return extractKieResultMediaUrls({ modelId, payload: normalizedPayload });
  }
  throw new Error(`Unsupported provider for media URL parsing: ${provider}`);
};

/**
 * Reads provider content-policy failure messages when present.
 */
export const readProviderContentPolicyMessage = ({
  provider,
  payload,
}: {
  provider: string;
  payload: unknown;
}): string | null => {
  if (isFalProviderKey(provider)) {
    return findContentPolicyMessage(asProviderRecord(payload));
  }
  if (isKieProviderKey(provider)) {
    return readKieContentPolicyMessage(normalizeKieEnvelopePayload(payload));
  }
  throw new Error(`Unsupported provider for content-policy parsing: ${provider}`);
};
