import type { SubmitTarget } from "../falIntegration/contracts";
import { isTrustedFalProviderUrl } from "../falIntegration/providerTrustPolicy";
import { readCanonicalProviderRequestId } from "../providerIntegration/canonicalProviderPayload";
import type { FalRuntimeFlags } from "./falRuntimeFlags";

type JsonValue = Record<string, unknown>;

export const readProviderRequestId = (payload: JsonValue): string | null => {
  return readCanonicalProviderRequestId(payload, { allowGenericId: true });
};

const isFalQueueUrl = (value: string): boolean => {
  try {
    new URL(value);
    return isTrustedFalProviderUrl(value);
  } catch {
    return false;
  }
};

const appendFalWebhookParam = (targetUrl: string, webhookUrl: string): string => {
  const parsed = new URL(targetUrl);
  if (!parsed.searchParams.get("fal_webhook")) {
    parsed.searchParams.set("fal_webhook", webhookUrl);
  }
  return parsed.toString();
};

export const resolveWebhookCallbackUrl = (flags: FalRuntimeFlags): string | null => {
  const baseUrl = flags.publicApiBaseUrl;
  if (!flags.webhookEnabled || flags.integrationMode === "legacy" || !baseUrl) return null;
  try {
    return new URL("/api/fal/webhook", baseUrl).toString();
  } catch {
    return null;
  }
};

export const withWebhookTargets = (
  targets: SubmitTarget[],
  webhookUrl: string | null
): SubmitTarget[] => {
  if (!webhookUrl) return targets;
  return targets.map((target) => {
    if (!isFalQueueUrl(target.submitUrl)) return target;
    return {
      ...target,
      submitUrl: appendFalWebhookParam(target.submitUrl, webhookUrl),
    };
  });
};
