import { isIP } from "node:net";
import type { NextApiRequest } from "next";
import { isTrustedMediaDirectPreviewUrl } from "../../mediaPreviewTrustPolicy";
import {
  isBlockedPrivateNetworkAddress,
  isLocalhostName,
  resolvePublicNetworkHostAddresses,
} from "./publicNetworkUrlGuard";

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

  if (isLocalhostName(parsedUrl.hostname)) {
    if (process.env.NODE_ENV === "production") {
      throw new TrustedRemoteMediaUrlError("Localhost media URLs are not allowed in production.");
    }
    return parsedUrl;
  }

  if (isBlockedPrivateNetworkAddress(parsedUrl.hostname)) {
    throw new TrustedRemoteMediaUrlError(`${label} points to a private network address.`);
  }

  if (isIP(parsedUrl.hostname) === 0) {
    const addresses = await resolvePublicNetworkHostAddresses(parsedUrl.hostname);
    if (!addresses || !addresses.length) {
      throw new TrustedRemoteMediaUrlError(`Unable to resolve ${label} host.`);
    }
    if (addresses.some((address) => isBlockedPrivateNetworkAddress(address))) {
      throw new TrustedRemoteMediaUrlError(`${label} host resolved to a private network address.`);
    }
  }

  return parsedUrl;
};
