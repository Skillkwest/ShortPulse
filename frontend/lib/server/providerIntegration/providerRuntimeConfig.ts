/**
 * Provider runtime config and dark-path guards.
 * Keeps provider enablement, key lookup, and trust policy centralized.
 */

import { getModelConfig } from "../../model-runtime/pricing";
import { KIE_SUPPORTED_MODEL_IDS, isKnownKieModelId } from "../../model-runtime/providerModelIds";
import type { SubmitTarget } from "../falIntegration/contracts";
import { isFalProviderKey, isKieProviderKey, normalizeProviderKey } from "./providerKey";

const DEFAULT_KIE_TRUSTED_HOSTS = ["kie.ai"];
const DEFAULT_KIE_STATUS_TIMEOUT_MS = 60000;

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
};

const parseInteger = (value: string | undefined, fallback: number, min: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, parsed);
};

const normalizeHostname = (hostname: string): string =>
  hostname.trim().toLowerCase().replace(/\.$/, "");

const normalizeAllowlistEntry = (entry: string): string => entry.trim().toLowerCase();

const isValidKieAllowlistEntry = (entry: string): boolean => {
  if (entry === "*") return true;
  if (entry.endsWith("*")) {
    const prefix = entry.slice(0, -1);
    if (!(prefix.startsWith("kie-ai/") && prefix.length > "kie-ai/".length)) {
      return false;
    }
    return KIE_SUPPORTED_MODEL_IDS.some((modelId) => modelId.startsWith(prefix));
  }
  return isKnownKieModelId(entry);
};

const parseAllowlist = (value: string | undefined): Set<string> => {
  if (!value?.trim()) return new Set<string>();
  return new Set(
    value
      .split(",")
      .map((entry) => normalizeAllowlistEntry(entry))
      .filter((entry) => entry.length > 0)
      .filter((entry) => isValidKieAllowlistEntry(entry))
  );
};

const parseTrustedHosts = (value: string | undefined): string[] => {
  if (!value?.trim()) return DEFAULT_KIE_TRUSTED_HOSTS;
  const parsed = value
    .split(",")
    .map((entry) => normalizeHostname(entry))
    .filter((entry) => entry.length > 0);
  return parsed.length ? parsed : DEFAULT_KIE_TRUSTED_HOSTS;
};

const normalizeHttpsUrl = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return null;
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
};

const parseUrlList = (value: string | undefined): string[] => {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((entry) => normalizeHttpsUrl(entry))
    .filter((entry): entry is string => Boolean(entry));
};

const matchAllowlistEntry = (modelId: string, entry: string): boolean => {
  if (entry === "*") return true;
  if (entry.endsWith("*")) {
    return modelId.startsWith(entry.slice(0, -1));
  }
  return modelId === entry;
};

const isPrivateIpv4 = (hostname: string): boolean => {
  const parts = hostname.split(".").map((value) => Number(value));
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }
  if (parts[0] === 10) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  return false;
};

const isPrivateOrLocalHost = (hostname: string): boolean => {
  const normalized = normalizeHostname(hostname);
  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd")
  ) {
    return true;
  }
  return isPrivateIpv4(normalized);
};

const matchesTrustedHost = (hostname: string, trustedHosts: string[]): boolean => {
  const normalized = normalizeHostname(hostname);
  return trustedHosts.some(
    (allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`)
  );
};

export type KieRuntimeFlags = {
  enabled: boolean;
  modelAllowlist: Set<string>;
  trustedHosts: string[];
  submitUrls: string[];
  statusBaseUrls: string[];
  statusTimeoutMs: number;
};

/**
 * Reads Kie runtime controls. All Kie integration is disabled unless explicitly enabled.
 */
export const readKieRuntimeFlags = (): KieRuntimeFlags => ({
  enabled: parseBoolean(process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED, false),
  modelAllowlist: parseAllowlist(process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST),
  trustedHosts: parseTrustedHosts(process.env.SHORTPULSE_KIE_TRUSTED_HOSTS),
  submitUrls: parseUrlList(process.env.SHORTPULSE_KIE_SUBMIT_URLS),
  statusBaseUrls: parseUrlList(process.env.SHORTPULSE_KIE_STATUS_BASE_URLS),
  statusTimeoutMs: parseInteger(
    process.env.SHORTPULSE_KIE_STATUS_TIMEOUT_MS,
    DEFAULT_KIE_STATUS_TIMEOUT_MS,
    1000
  ),
});

/**
 * Returns true when the model is allowlisted under Kie runtime flags.
 */
export const isKieModelAllowlisted = (
  modelId: string,
  flags: KieRuntimeFlags = readKieRuntimeFlags()
): boolean => {
  if (!flags.modelAllowlist.size) return false;
  for (const entry of flags.modelAllowlist) {
    if (matchAllowlistEntry(modelId, entry)) return true;
  }
  return false;
};

/**
 * Asserts Kie dark-path runtime availability for a model.
 */
export const assertKieRuntimeEnabledForModel = ({
  modelId,
  flags = readKieRuntimeFlags(),
}: {
  modelId: string;
  flags?: KieRuntimeFlags;
}): void => {
  if (!flags.enabled) {
    throw new Error("Kie provider is disabled by runtime flag.");
  }
  if (!isKieModelAllowlisted(modelId, flags)) {
    throw new Error(`Kie model is not allowlisted: ${modelId}`);
  }
};

/**
 * Returns true when a URL is trusted for Kie provider calls.
 */
export const isTrustedKieProviderUrl = (
  url: string,
  flags: KieRuntimeFlags = readKieRuntimeFlags()
): boolean => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;
  if (isPrivateOrLocalHost(parsed.hostname)) return false;
  return matchesTrustedHost(parsed.hostname, flags.trustedHosts);
};

/**
 * Throws when a Kie provider URL is untrusted.
 */
export const assertTrustedKieProviderUrl = (
  url: string,
  context: string,
  flags: KieRuntimeFlags = readKieRuntimeFlags()
): void => {
  if (!isTrustedKieProviderUrl(url, flags)) {
    throw new Error(`Untrusted Kie provider URL blocked (${context}): ${url}`);
  }
};

/**
 * Filters to trusted Kie provider URLs with optional dedupe.
 */
export const filterTrustedKieProviderUrls = (
  urls: string[],
  flags: KieRuntimeFlags = readKieRuntimeFlags(),
  options?: { dedupe?: boolean }
): string[] => {
  const filtered = urls.filter((url) => isTrustedKieProviderUrl(url, flags));
  if (options?.dedupe === false) return filtered;
  return Array.from(new Set(filtered));
};

/**
 * Resolves canonical provider key from model config, defaulting to Fal.
 */
export const resolveProviderFromModelId = ({
  modelId,
  fallback = "fal",
}: {
  modelId: string;
  fallback?: string;
}): string => {
  const configuredProvider = getModelConfig(modelId)?.provider;
  if (typeof configuredProvider === "string" && configuredProvider.trim().length) {
    return normalizeProviderKey(configuredProvider);
  }
  return normalizeProviderKey(fallback);
};

/**
 * Resolves provider key from persisted generation context.
 */
export const resolveProviderFromGenerationContext = ({
  provider,
  modelId,
  fallback = "fal",
}: {
  provider?: string | null;
  modelId: string;
  fallback?: string;
}): string => {
  if (typeof provider === "string" && provider.trim().length) {
    return normalizeProviderKey(provider);
  }
  return resolveProviderFromModelId({ modelId, fallback });
};

/**
 * Reads provider API keys from server env. Throws when missing.
 */
export const readProviderApiKey = (provider: string): string => {
  if (isFalProviderKey(provider)) {
    const falKey = process.env.FAL_KEY?.trim();
    if (!falKey) throw new Error("FAL_KEY is not set on the server.");
    return falKey;
  }
  if (isKieProviderKey(provider)) {
    const kieKey =
      process.env.KIE_API_KEY?.trim() ?? process.env.SHORTPULSE_KIE_API_KEY?.trim() ?? "";
    if (!kieKey) throw new Error("KIE_API_KEY is not set on the server.");
    return kieKey;
  }
  throw new Error(`Unsupported provider for API key resolution: ${provider}`);
};

/**
 * Resolves trusted Kie submit targets for a model.
 */
export const resolveKieSubmitTargetsForModel = (
  modelId: string,
  flags: KieRuntimeFlags = readKieRuntimeFlags()
): SubmitTarget[] => {
  assertKieRuntimeEnabledForModel({ modelId, flags });
  return filterTrustedKieProviderUrls(flags.submitUrls, flags).map((submitUrl) => ({
    submitUrl,
  }));
};

/**
 * Resolves trusted Kie status bases for a model.
 */
export const resolveKieStatusBaseUrlsForModel = (
  modelId: string,
  flags: KieRuntimeFlags = readKieRuntimeFlags()
): string[] => {
  assertKieRuntimeEnabledForModel({ modelId, flags });
  const baseCandidates = flags.statusBaseUrls.length ? flags.statusBaseUrls : flags.submitUrls;
  return filterTrustedKieProviderUrls(baseCandidates, flags);
};
