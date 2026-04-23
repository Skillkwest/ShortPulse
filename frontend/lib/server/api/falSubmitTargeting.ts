import type { SubmitTarget } from "../falIntegration/contracts";
import { isTrustedFalProviderUrl } from "../falIntegration/providerTrustPolicy";
import { readCanonicalProviderRequestId } from "../providerIntegration/canonicalProviderPayload";
import type { FalRuntimeFlags } from "./falRuntimeFlags";

type JsonValue = Record<string, unknown>;
type HeaderValue = string | string[] | undefined;
type HeaderBag = Record<string, HeaderValue>;

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

const appendFalWebhookParams = (targetUrl: string, webhookUrl: string): string => {
  const parsed = new URL(targetUrl);
  if (!parsed.searchParams.get("webhook_url")) {
    parsed.searchParams.set("webhook_url", webhookUrl);
  }
  if (!parsed.searchParams.get("fal_webhook")) {
    parsed.searchParams.set("fal_webhook", webhookUrl);
  }
  return parsed.toString();
};

const readHeaderValue = (value: HeaderValue): string | null => {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : null;
  }
  return typeof value === "string" ? value : null;
};

const readForwardedValue = (value: HeaderValue): string | null => {
  const header = readHeaderValue(value);
  if (!header) return null;
  const firstValue = header
    .split(",")
    .map((entry) => entry.trim())
    .find((entry) => entry.length > 0);
  return firstValue ?? null;
};

const isLoopbackHostname = (hostname: string): boolean =>
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname === "::1" ||
  hostname === "[::1]" ||
  hostname === "0.0.0.0";

const readHostHostname = (host: string): string => {
  try {
    return new URL(`http://${host}`).hostname;
  } catch {
    return host.split(":")[0] ?? host;
  }
};

const resolveRequestBaseUrl = (headers?: HeaderBag | null): string | null => {
  if (!headers) return null;
  const host = readForwardedValue(headers["x-forwarded-host"]) ?? readHeaderValue(headers.host);
  if (!host) return null;
  const proto =
    readForwardedValue(headers["x-forwarded-proto"]) ??
    (isLoopbackHostname(readHostHostname(host)) ? "http" : "https");
  try {
    const parsed = new URL(`${proto}://${host}`);
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
};

export const readQueuedWebhookCallbackUrl = (metadata: unknown): string | null => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const rawValue = (metadata as Record<string, unknown>).fal_webhook_callback_url;
  if (typeof rawValue !== "string" || !rawValue.trim()) return null;
  try {
    const parsed = new URL(rawValue.trim());
    if (!parsed.protocol.startsWith("http")) return null;
    return parsed.toString();
  } catch {
    return null;
  }
};

export const resolveWebhookCallbackUrl = (
  flags: FalRuntimeFlags,
  context?: {
    userId?: string | null;
    modelId?: string | null;
    requestHeaders?: HeaderBag | null;
  }
): string | null => {
  void context?.userId;
  void context?.modelId;
  const requestBaseUrl = resolveRequestBaseUrl(context?.requestHeaders);
  const requestHostname = requestBaseUrl ? new URL(requestBaseUrl).hostname : null;
  const baseUrl =
    requestHostname && !isLoopbackHostname(requestHostname)
      ? requestBaseUrl
      : flags.publicApiBaseUrl;
  if (flags.integrationMode === "legacy" || !baseUrl) return null;
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
      submitUrl: appendFalWebhookParams(target.submitUrl, webhookUrl),
    };
  });
};
