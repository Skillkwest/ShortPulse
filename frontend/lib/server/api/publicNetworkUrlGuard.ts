/**
 * Shared public-network URL guard primitives for server-side remote media fetches.
 * Centralizes DNS/private-address checks without owning provider-specific upload policy.
 */
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

const DEFAULT_DNS_LOOKUP_TIMEOUT_MS = 2_500;

export const normalizePublicNetworkHostname = (hostname: string): string =>
  hostname
    .trim()
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^\[(.*)\]$/, "$1");

export const isLocalhostName = (hostname: string): boolean => {
  const normalized = normalizePublicNetworkHostname(hostname);
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
};

export const isLocalhostOrSubdomain = (hostname: string): boolean => {
  const normalized = normalizePublicNetworkHostname(hostname);
  return normalized === "localhost" || normalized.endsWith(".localhost");
};

const isPrivateIpv4Address = (hostname: string): boolean => {
  const match = normalizePublicNetworkHostname(hostname).match(
    /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
  );
  if (!match) return false;
  const octets = match.slice(1).map((segment) => Number.parseInt(segment, 10));
  if (octets.some((octet) => !Number.isFinite(octet) || octet < 0 || octet > 255)) {
    return false;
  }
  const [first, second] = octets;
  if (first === 0) return true;
  if (first === 10) return true;
  if (first === 127) return true;
  if (first === 169 && second === 254) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  if (first === 100 && second >= 64 && second <= 127) return true;
  if (first === 198 && (second === 18 || second === 19)) return true;
  return false;
};

const isPrivateIpv6Address = (hostname: string): boolean => {
  const normalized = normalizePublicNetworkHostname(hostname);
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe8")) return true;
  if (normalized.startsWith("fe9")) return true;
  if (normalized.startsWith("fea")) return true;
  if (normalized.startsWith("feb")) return true;
  return false;
};

export const isBlockedPrivateNetworkAddress = (hostname: string): boolean => {
  const normalized = normalizePublicNetworkHostname(hostname);
  const ipVersion = isIP(normalized);
  if (ipVersion === 4) return isPrivateIpv4Address(normalized);
  if (ipVersion === 6) return isPrivateIpv6Address(normalized);
  return false;
};

export const resolvePublicNetworkHostAddresses = async (
  hostname: string,
  timeoutMs = DEFAULT_DNS_LOOKUP_TIMEOUT_MS
): Promise<string[] | null> => {
  try {
    const records = await Promise.race([
      dnsLookup(hostname, { all: true }),
      new Promise<never>((_, reject) => {
        globalThis.setTimeout(() => reject(new Error("dns_lookup_timeout")), timeoutMs);
      }),
    ]);
    if (!Array.isArray(records)) {
      const singleAddress = (records as { address?: string }).address;
      return singleAddress ? [singleAddress] : [];
    }
    return records
      .map((record) => (typeof record.address === "string" ? record.address : ""))
      .filter((address) => address.length > 0);
  } catch {
    return null;
  }
};

export const assertPublicNetworkUrl = async <TError extends Error = Error>(
  sourceUrl: URL,
  {
    label = "fileUrl",
    dnsLookupTimeoutMs = DEFAULT_DNS_LOOKUP_TIMEOUT_MS,
    createError = (message: string) => new Error(message) as TError,
  }: {
    label?: string;
    dnsLookupTimeoutMs?: number;
    createError?: (message: string) => TError;
  } = {}
): Promise<void> => {
  if (
    isLocalhostOrSubdomain(sourceUrl.hostname) ||
    isBlockedPrivateNetworkAddress(sourceUrl.hostname)
  ) {
    throw createError(`${label} cannot target a local or private-network host.`);
  }
  if (isIP(normalizePublicNetworkHostname(sourceUrl.hostname)) !== 0) return;

  const addresses = await resolvePublicNetworkHostAddresses(sourceUrl.hostname, dnsLookupTimeoutMs);
  if (!addresses?.length) {
    throw createError(`${label} host could not be resolved.`);
  }
  if (addresses.some((address) => isBlockedPrivateNetworkAddress(address))) {
    throw createError(`${label} host resolved to a private-network address.`);
  }
};
