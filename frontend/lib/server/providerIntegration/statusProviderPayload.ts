/**
 * Provider-aware status/result payload parsing helpers.
 * Encapsulates provider-specific payload shape handling behind a stable contract.
 */

import {
  asString,
  extractResponseUrl,
  findContentPolicyMessage,
  hasMediaPayload,
} from "../falIntegration/falAdapter";
import { asProviderRecord, readCanonicalProviderStatus } from "./canonicalProviderPayload";
import { isFalProviderKey, isKieProviderKey } from "./providerKey";

const readKieContentPolicyMessage = (payload: unknown): string | null => {
  const root = asProviderRecord(payload);
  const fallbackMessage =
    asString(root.content_policy_message) ??
    asString(root.contentPolicyMessage) ??
    asString(root.moderation_message) ??
    asString(root.moderationMessage) ??
    asString(root.safety_message) ??
    asString(root.safetyMessage) ??
    asString(root.error_message) ??
    asString(root.errorMessage);
  if (fallbackMessage) return fallbackMessage;
  const nestedCandidates = [
    asProviderRecord(root.error),
    asProviderRecord(root.detail),
    asProviderRecord(root.data),
    asProviderRecord(root.result),
  ];
  for (const candidate of nestedCandidates) {
    const message =
      asString(candidate.content_policy_message) ??
      asString(candidate.contentPolicyMessage) ??
      asString(candidate.moderation_message) ??
      asString(candidate.moderationMessage) ??
      asString(candidate.safety_message) ??
      asString(candidate.safetyMessage) ??
      asString(candidate.error_message) ??
      asString(candidate.errorMessage) ??
      asString(candidate.message);
    if (message) return message;
  }
  return null;
};

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
  if (isFalProviderKey(provider) || isKieProviderKey(provider)) {
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
  if (isFalProviderKey(provider) || isKieProviderKey(provider)) {
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
  if (isFalProviderKey(provider) || isKieProviderKey(provider)) {
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
  if (isKieProviderKey(provider)) {
    return readKieContentPolicyMessage(payload);
  }
  throw new Error(`Unsupported provider for content-policy parsing: ${provider}`);
};
