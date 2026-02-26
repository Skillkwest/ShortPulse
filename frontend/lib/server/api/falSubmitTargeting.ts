import type { SubmitTarget } from "../falIntegration/contracts";
import type { FalRuntimeFlags } from "./falRuntimeFlags";

type JsonValue = Record<string, unknown>;

export const readProviderRequestId = (payload: JsonValue): string | null => {
  const requestId = payload?.request_id ?? payload?.requestId;
  if (typeof requestId !== "string") return null;
  const trimmed = requestId.trim();
  return trimmed.length ? trimmed : null;
};

const isFalQueueUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.hostname.endsWith("fal.run") || parsed.hostname.endsWith("fal.ai");
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
