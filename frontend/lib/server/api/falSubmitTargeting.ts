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

const toNormalizedList = (values: Set<string>): string[] =>
  Array.from(values)
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

const matchAllowlistEntry = (subject: string, entry: string): boolean => {
  if (entry === "*") return true;
  if (entry.endsWith("*")) {
    return subject.startsWith(entry.slice(0, -1));
  }
  return subject === entry;
};

export const isWebhookCanaryEligible = ({
  flags,
  userId,
  modelId,
}: {
  flags: FalRuntimeFlags;
  userId?: string | null;
  modelId?: string | null;
}): boolean => {
  const userAllowlist = toNormalizedList(flags.webhookCanaryUserAllowlist);
  const modelAllowlist = toNormalizedList(flags.webhookCanaryModelAllowlist);
  if (!userAllowlist.length && !modelAllowlist.length) return true;

  const normalizedUserId = (userId ?? "").trim().toLowerCase();
  const normalizedModelId = (modelId ?? "").trim().toLowerCase();

  const userEligible = userAllowlist.length
    ? Boolean(normalizedUserId) &&
      userAllowlist.some((entry) => matchAllowlistEntry(normalizedUserId, entry))
    : true;
  const modelEligible = modelAllowlist.length
    ? Boolean(normalizedModelId) &&
      modelAllowlist.some((entry) => matchAllowlistEntry(normalizedModelId, entry))
    : true;

  return userEligible && modelEligible;
};

export const resolveWebhookCallbackUrl = (
  flags: FalRuntimeFlags,
  context?: { userId?: string | null; modelId?: string | null }
): string | null => {
  const baseUrl = flags.publicApiBaseUrl;
  if (!flags.webhookEnabled || flags.integrationMode === "legacy" || !baseUrl) return null;
  if (!isWebhookCanaryEligible({ flags, userId: context?.userId, modelId: context?.modelId })) {
    return null;
  }
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
