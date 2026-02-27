/**
 * Provider-aware status/result payload parsing helpers.
 * Encapsulates provider-specific payload shape handling behind a stable contract.
 */

import {
  extractResponseUrl,
  findContentPolicyMessage,
  hasMediaPayload,
} from "../falIntegration/falAdapter";
import { asProviderRecord, readCanonicalProviderStatus } from "./canonicalProviderPayload";
import { isFalProviderKey } from "./providerKey";

/**
 * Reads normalized lifecycle status from a provider payload.
 */
export const readProviderLifecycleStatus = ({
  provider,
  payload,
}: {
  provider: string;
  payload: unknown;
}): string | null => {
  if (isFalProviderKey(provider)) {
    return readCanonicalProviderStatus(payload);
  }
  throw new Error(`Unsupported provider for payload status parsing: ${provider}`);
};

/**
 * Reads a provider response URL when present.
 */
export const readProviderResponseUrl = ({
  provider,
  payload,
}: {
  provider: string;
  payload: unknown;
}): string | null => {
  if (isFalProviderKey(provider)) {
    return extractResponseUrl(asProviderRecord(payload));
  }
  throw new Error(`Unsupported provider for response URL parsing: ${provider}`);
};

/**
 * Returns true when provider payload contains usable media URLs.
 */
export const providerPayloadHasMedia = ({
  provider,
  payload,
}: {
  provider: string;
  payload: unknown;
}): boolean => {
  if (isFalProviderKey(provider)) {
    return hasMediaPayload(asProviderRecord(payload));
  }
  throw new Error(`Unsupported provider for media payload parsing: ${provider}`);
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
  throw new Error(`Unsupported provider for content-policy parsing: ${provider}`);
};
