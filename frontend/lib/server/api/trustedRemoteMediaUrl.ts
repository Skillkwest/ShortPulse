import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { NextApiRequest } from "next";
import { isTrustedMediaDirectPreviewUrl } from "../../mediaPreviewTrustPolicy";

const DNS_TIMEOUT_MS = 2500;

const normalizeHostname = (value: string): string => value.trim().toLowerCase().replace(/\.$/, "");

const isLocalHostname = (hostname: string): boolean => {
  const normalized = normalizeHostname(hostname);
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
};

const isPrivateIpv4 = (hostname: string): boolean => {
  const parts = hostname.split(".").map((segment) => Number(segment));
  if (
    parts.length !== 4 ||
    parts.some((value) => !Number.isInteger(value) || value < 0 || value > 255)
  ) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  return false;
};

const isPrivateIpv6 = (hostname: string): boolean => {
  const normalized = hostname.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9")) return true;
  if (normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
  return false;
};

const isBlockedPrivateAddress = (hostname: string): boolean => {
  const normalized = normalizeHostname(hostname);
  const ipVersion = isIP(normalized);
  if (ipVersion === 4) return isPrivateIpv4(normalized);
  if (ipVersion === 6) return isPrivateIpv6(normalized);
  return false;
};

const resolveHostAddresses = async (hostname: string): Promise<string[] | null> => {
  try {
    const records = await Promise.race([
      dnsLookup(hostname, { all: true }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("dns_lookup_timeout")), DNS_TIMEOUT_MS);
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

const resolveRequestOrigin = (req: NextApiRequest): string | null => {
  const rawHost = req.headers.host;
  const host = Array.isArray(rawHost) ? rawHost[0]?.trim() : rawHost?.trim();
  if (!host) return null;
  const rawForwardedProto = req.headers["x-forwarded-proto"];
  const forwardedProto = Array.isArray(rawForwardedProto)
    ? rawForwardedProto[0]?.trim()
    : rawForwardedProto?.trim();
  const protocol = (forwardedProto || "http").toLowerCase();
  if (protocol !== "http" && protocol !== "https") return null;
  return `${protocol}://${host}`;
};

const parseUrlFromRequest = (rawUrl: string, req: NextApiRequest): URL | null => {
  try {
    if (rawUrl.startsWith("/")) {
      const origin = resolveRequestOrigin(req);
      if (!origin) return null;
      return new URL(rawUrl, origin);
    }
    return new URL(rawUrl);
  } catch {
    return null;
  }
};

export class TrustedRemoteMediaUrlError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "TrustedRemoteMediaUrlError";
    this.statusCode = statusCode;
  }
}

export const assertTrustedRemoteMediaUrl = async ({
  rawUrl,
  req,
  userId,
  requireUserScope = false,
  label = "source URL",
}: {
  rawUrl: string;
  req: NextApiRequest;
  userId?: string | null;
  requireUserScope?: boolean;
  label?: string;
}): Promise<URL> => {
  const parsedUrl = parseUrlFromRequest(rawUrl, req);
  if (!parsedUrl) {
    throw new TrustedRemoteMediaUrlError(`Invalid ${label}.`);
  }

  const normalizedUrl = parsedUrl.toString();
  if (!isTrustedMediaDirectPreviewUrl(normalizedUrl, { userId, requireUserScope })) {
    throw new TrustedRemoteMediaUrlError(
      requireUserScope
        ? `${label} is not a trusted user-scoped media URL.`
        : `${label} is not a trusted media URL.`
    );
  }

  if (isLocalHostname(parsedUrl.hostname)) {
    if (process.env.NODE_ENV === "production") {
      throw new TrustedRemoteMediaUrlError("Localhost media URLs are not allowed in production.");
    }
    return parsedUrl;
  }

  if (isBlockedPrivateAddress(parsedUrl.hostname)) {
    throw new TrustedRemoteMediaUrlError(`${label} points to a private network address.`);
  }

  if (isIP(parsedUrl.hostname) === 0) {
    const addresses = await resolveHostAddresses(parsedUrl.hostname);
    if (!addresses || !addresses.length) {
      throw new TrustedRemoteMediaUrlError(`Unable to resolve ${label} host.`);
    }
    if (addresses.some((address) => isBlockedPrivateAddress(address))) {
      throw new TrustedRemoteMediaUrlError(`${label} host resolved to a private network address.`);
    }
  }

  return parsedUrl;
};
