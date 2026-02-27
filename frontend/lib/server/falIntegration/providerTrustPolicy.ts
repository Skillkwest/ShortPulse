/**
 * Fal provider trust policy for outbound provider URLs.
 * Centralizes host/protocol validation so request auth headers never go to untrusted origins.
 */

const DEFAULT_TRUSTED_HOSTS = ["fal.run", "fal.ai"];

const normalizeHostname = (hostname: string): string =>
  hostname.trim().toLowerCase().replace(/\.$/, "");

const parseTrustedHosts = (): string[] => {
  const raw = process.env.SHORTPULSE_FAL_TRUSTED_HOSTS;
  if (!raw?.trim()) return DEFAULT_TRUSTED_HOSTS;
  const parsed = raw
    .split(",")
    .map((entry) => normalizeHostname(entry))
    .filter((entry) => entry.length > 0);
  return parsed.length ? parsed : DEFAULT_TRUSTED_HOSTS;
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

export const isTrustedFalProviderUrl = (url: string): boolean => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;
  if (isPrivateOrLocalHost(parsed.hostname)) return false;
  return matchesTrustedHost(parsed.hostname, parseTrustedHosts());
};

export const assertTrustedFalProviderUrl = (url: string, context: string): void => {
  if (!isTrustedFalProviderUrl(url)) {
    throw new Error(`Untrusted Fal provider URL blocked (${context}): ${url}`);
  }
};

export const filterTrustedFalProviderUrls = (
  urls: string[],
  options?: { dedupe?: boolean }
): string[] => {
  const filtered = urls.filter((url) => isTrustedFalProviderUrl(url));
  if (options?.dedupe === false) return filtered;
  return Array.from(new Set(filtered));
};
