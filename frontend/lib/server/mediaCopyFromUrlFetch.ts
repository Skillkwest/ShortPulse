/**
 * URL parsing, trust validation, and capped fetch helpers for media copy persistence.
 */
import { isIP } from "node:net";
import type { NextApiRequest } from "next";
import { asCanonicalStoragePath } from "../adaptive-media";
import {
  isSupabaseRenderImageUrl,
  resolveMediaPreviewTrustedHosts,
} from "../mediaPreviewTrustPolicy";
import { assertUserScopedMediaStoragePath } from "../mediaStoragePath";
import { MAX_IMAGE_MEDIA_BYTES, type MediaLibraryFileType } from "./mediaIngest";
import {
  isBlockedPrivateNetworkAddress,
  isLocalhostName,
  normalizePublicNetworkHostname,
  resolvePublicNetworkHostAddresses,
} from "./api/publicNetworkUrlGuard";
import { isTrustedFalProviderUrl } from "./falIntegration/providerTrustPolicy";
import { isTrustedKieProviderMediaUrl } from "./providerIntegration/providerRuntimeConfig";

const FETCH_TIMEOUT_MS = 60000;
const MAX_REDIRECTS = 4;
const MAX_IMAGE_BYTES = MAX_IMAGE_MEDIA_BYTES;
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

export type UrlTrustValidator = (
  candidate: URL
) => Promise<{ ok: true } | { ok: false; error: string }>;

export const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export const asOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export const asObjectMetadata = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

export const toSafeUserScopedPath = ({
  path,
  userId,
  label,
}: {
  path: string | null;
  userId: string;
  label: string;
}): string | null => {
  const canonicalPath = asCanonicalStoragePath(path);
  if (!canonicalPath) return null;
  try {
    return assertUserScopedMediaStoragePath({
      path: canonicalPath,
      userId,
      label,
    });
  } catch {
    return null;
  }
};

export const normalizeOwnedStoragePathHint = ({
  value,
  userId,
  label,
}: {
  value: unknown;
  userId: string;
  label: string;
}): { ok: true; path: string | null } | { ok: false; error: string } => {
  const parsed = asCanonicalStoragePath(asOptionalString(value));
  if (!parsed) {
    return { ok: true, path: null };
  }
  try {
    return {
      ok: true,
      path: assertUserScopedMediaStoragePath({
        path: parsed,
        userId,
        label,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : `${label}: invalid storage path.`,
    };
  }
};

export const parseSource = (value: unknown): "upload" | "ai_studio" =>
  asOptionalString(value) === "ai_studio" ? "ai_studio" : "upload";

export const parseMode = (value: unknown): MediaLibraryFileType => {
  const parsed = asOptionalString(value);
  if (parsed === "video") return "video";
  if (parsed === "audio") return "audio";
  return "image";
};

export const parseFileTypeHint = (value: unknown): MediaLibraryFileType | undefined => {
  const parsed = asOptionalString(value);
  if (parsed === "image" || parsed === "video" || parsed === "audio") return parsed;
  return undefined;
};

export const normalizePosterSourceUrl = (
  fileType: MediaLibraryFileType,
  value: unknown
): string | null => {
  if (fileType !== "video") return null;
  const parsed = asOptionalString(value);
  if (!parsed) return null;
  if (/^(?:data:image\/|https?:\/\/)/i.test(parsed)) {
    return parsed;
  }
  return null;
};

export const parseIndex = (value: unknown): number => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

const matchesHost = (hostname: string, allowedHost: string): boolean => {
  const normalizedHost = normalizePublicNetworkHostname(hostname);
  const normalizedAllowed = normalizePublicNetworkHostname(allowedHost);
  return normalizedHost === normalizedAllowed || normalizedHost.endsWith(`.${normalizedAllowed}`);
};

const isAllowedProtocol = (url: URL): boolean =>
  url.protocol === "https:" || (url.protocol === "http:" && isLocalhostName(url.hostname));

const resolveRequestOrigin = (req: NextApiRequest): string | null => {
  const host = asOptionalString(req.headers.host);
  if (!host) return null;
  const forwardedProto = asOptionalString(req.headers["x-forwarded-proto"]);
  const protocol = forwardedProto ? forwardedProto.split(",")[0]?.trim().toLowerCase() : "http";
  if (protocol !== "http" && protocol !== "https") return null;
  return `${protocol}://${host}`;
};

export const parseUrlFromRequest = (rawUrl: string, req: NextApiRequest): URL | null => {
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

export const parseRequestBody = (req: NextApiRequest): Record<string, unknown> | null => {
  try {
    if (typeof req.body === "string") {
      return asRecord(JSON.parse(req.body));
    }
    return asRecord(req.body);
  } catch {
    return null;
  }
};

export const validateTrustedUrl = async (
  candidate: URL
): Promise<{ ok: true } | { ok: false; error: string }> => {
  if (!isAllowedProtocol(candidate)) {
    return { ok: false, error: "Only HTTPS URLs are allowed (HTTP allowed for localhost)." };
  }
  const trustedHosts = resolveMediaPreviewTrustedHosts();
  if (!trustedHosts.some((host) => matchesHost(candidate.hostname, host))) {
    return { ok: false, error: "URL host is not in the trusted media allowlist." };
  }
  if (isLocalhostName(candidate.hostname)) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, error: "Localhost media URLs are not allowed in production." };
    }
    return { ok: true };
  }
  if (isBlockedPrivateNetworkAddress(candidate.hostname)) {
    return { ok: false, error: "URL host is a private network address." };
  }
  if (isIP(candidate.hostname) === 0) {
    const addresses = await resolvePublicNetworkHostAddresses(candidate.hostname);
    if (!addresses || !addresses.length) {
      return { ok: false, error: "Unable to resolve URL host." };
    }
    if (addresses.some((address) => isBlockedPrivateNetworkAddress(address))) {
      return { ok: false, error: "URL host resolved to a private network address." };
    }
  }
  return { ok: true };
};

const validatePublicFetchDestination = async (
  candidate: URL
): Promise<{ ok: true } | { ok: false; error: string }> => {
  if (!isAllowedProtocol(candidate)) {
    return { ok: false, error: "Only HTTPS URLs are allowed (HTTP allowed for localhost)." };
  }
  if (isLocalhostName(candidate.hostname)) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, error: "Localhost media URLs are not allowed in production." };
    }
    return { ok: true };
  }
  if (isBlockedPrivateNetworkAddress(candidate.hostname)) {
    return { ok: false, error: "URL host is a private network address." };
  }
  if (isIP(candidate.hostname) === 0) {
    const addresses = await resolvePublicNetworkHostAddresses(candidate.hostname);
    if (!addresses || !addresses.length) {
      return { ok: false, error: "Unable to resolve URL host." };
    }
    if (addresses.some((address) => isBlockedPrivateNetworkAddress(address))) {
      return { ok: false, error: "URL host resolved to a private network address." };
    }
  }
  return { ok: true };
};

export const validateTrustedGeneratedMediaUrl = async (
  candidate: URL
): Promise<{ ok: true } | { ok: false; error: string }> => {
  const directPreviewValidation = await validateTrustedUrl(candidate);
  if (directPreviewValidation.ok) {
    return directPreviewValidation;
  }
  const candidateUrl = candidate.toString();
  if (!isTrustedFalProviderUrl(candidateUrl) && !isTrustedKieProviderMediaUrl(candidateUrl)) {
    return directPreviewValidation;
  }
  return validatePublicFetchDestination(candidate);
};

const readResponseBodyWithCap = async (response: Response, maxBytes: number): Promise<Buffer> => {
  const contentLengthHeader = response.headers.get("content-length");
  const contentLength = contentLengthHeader ? Number.parseInt(contentLengthHeader, 10) : null;
  if (contentLength && Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error("Fetched media exceeds size limit.");
  }
  const reader = response.body?.getReader?.();
  if (!reader) {
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > maxBytes) {
      throw new Error("Fetched media exceeds size limit.");
    }
    return Buffer.from(arrayBuffer);
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      throw new Error("Fetched media exceeds size limit.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
};

export const fetchUrlWithRedirectValidation = async ({
  startUrl,
  maxBytes,
  validateUrl = validateTrustedUrl,
}: {
  startUrl: URL;
  maxBytes: number;
  validateUrl?: UrlTrustValidator;
}): Promise<{ buffer: Buffer; contentType: string | null; finalUrl: URL }> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    let current = startUrl;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const trustValidation = await validateUrl(current);
      if (!trustValidation.ok) {
        throw new Error(trustValidation.error);
      }
      const response = await fetch(current.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
      });
      if (REDIRECT_STATUS_CODES.has(response.status)) {
        if (hop >= MAX_REDIRECTS) {
          throw new Error("URL redirected too many times.");
        }
        const location = asOptionalString(response.headers.get("location"));
        if (!location) {
          throw new Error("URL redirect is missing a location.");
        }
        current = new URL(location, current);
        continue;
      }
      if (!response.ok) {
        throw new Error(`Fetch failed (${response.status}).`);
      }
      const buffer = await readResponseBodyWithCap(response, maxBytes);
      const contentType =
        asOptionalString(response.headers.get("content-type"))?.split(";")[0] ?? null;
      return { buffer, contentType, finalUrl: current };
    }
    throw new Error("URL redirected too many times.");
  } finally {
    clearTimeout(timeoutId);
  }
};

const parseInlineImageDataUrl = (
  value: string
): { buffer: Buffer; contentType: string | null } | null => {
  const match = value.match(/^data:(image\/[a-z0-9.+-]+)?;base64,(.+)$/i);
  if (!match) return null;
  const estimatedByteLength = Math.floor((match[2].length * 3) / 4);
  if (estimatedByteLength > MAX_IMAGE_BYTES) {
    throw new Error("Fetched media exceeds size limit.");
  }
  try {
    const buffer = Buffer.from(match[2], "base64");
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      throw new Error("Fetched media exceeds size limit.");
    }
    return {
      buffer,
      contentType: match[1] ?? null,
    };
  } catch (decodeError) {
    if (decodeError instanceof Error && decodeError.message.includes("size limit")) {
      throw decodeError;
    }
    return null;
  }
};

export const fetchPosterSource = async (
  req: NextApiRequest,
  posterSourceUrl: string
): Promise<{ buffer: Buffer; contentType: string | null }> => {
  const inlineData = parseInlineImageDataUrl(posterSourceUrl);
  if (inlineData) {
    return inlineData;
  }

  const parsedPosterUrl = parseUrlFromRequest(posterSourceUrl, req);
  if (!parsedPosterUrl) {
    throw new Error("Invalid poster url.");
  }
  const trustValidation = await validateTrustedUrl(parsedPosterUrl);
  if (!trustValidation.ok) {
    throw new Error(`Untrusted poster URL. ${trustValidation.error}`);
  }
  const fetched = await fetchUrlWithRedirectValidation({
    startUrl: parsedPosterUrl,
    maxBytes: MAX_IMAGE_BYTES,
  });
  return {
    buffer: fetched.buffer,
    contentType: fetched.contentType,
  };
};

export const sanitizePreviewUrlHint = (value: string | null): string | null => {
  if (!value) return null;
  return isSupabaseRenderImageUrl(value) ? null : value;
};
