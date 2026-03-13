/**
 * Authenticated server-side URL copy route for Media Library persistence.
 * Used as a CORS-proof fallback when browser fetch is blocked.
 */
import { randomUUID } from "crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { NextApiRequest, NextApiResponse } from "next";
import { asCanonicalStoragePath } from "../../../lib/adaptive-media";
import { withCanonicalImageDimensions } from "../../../lib/mediaDimensionMetadata";
import { resolveMediaPreviewTrustedHosts } from "../../../lib/mediaPreviewTrustPolicy";
import { assertUserScopedMediaStoragePath } from "../../../lib/mediaStoragePath";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { requireApiUser } from "../../../lib/server/api/auth";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";
import { extractImageDimensionsFromBuffer } from "../../../lib/server/imageDimensions";
import { detectImageMimeType, detectVideoMimeType } from "../../../lib/server/uploadSignature";

const MEDIA_BUCKET = "media_library";
const FETCH_TIMEOUT_MS = 60000;
const DNS_TIMEOUT_MS = 2500;
const MAX_REDIRECTS = 4;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/avif",
]);

const ALLOWED_VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
]);

const CONTENT_TYPE_EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-m4v": "m4v",
};

type CopyFromUrlRequest = {
  url?: unknown;
  promptText?: unknown;
  mode?: unknown;
  source?: unknown;
  fileTypeHint?: unknown;
  provider?: unknown;
  modelId?: unknown;
  generationId?: unknown;
  promptId?: unknown;
  index?: unknown;
  previewStoragePathHint?: unknown;
  fullStoragePathHint?: unknown;
  previewUrlHint?: unknown;
  fullUrlHint?: unknown;
  metadata?: unknown;
};

type CopyFromUrlResponse =
  | {
      mediaFileId: string | null;
      storagePath: string;
      fileType: "image" | "video";
      fileSize: number;
      delivery: {
        previewStoragePath: string | null;
        fullStoragePath: string | null;
        previewUrl: string | null;
        fullUrl: string | null;
      };
    }
  | {
      error: string;
      details?: string;
    };

type ExistingMediaRow = {
  id: string;
  storagePath: string | null;
  fileType: "image" | "video";
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const asObjectMetadata = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const parseSource = (value: unknown): "upload" | "ai_studio" =>
  asOptionalString(value) === "ai_studio" ? "ai_studio" : "upload";

const parseMode = (value: unknown): "image" | "video" =>
  asOptionalString(value) === "video" ? "video" : "image";

const parseFileTypeHint = (value: unknown): "image" | "video" | undefined => {
  const parsed = asOptionalString(value);
  if (parsed === "image" || parsed === "video") return parsed;
  return undefined;
};

const parseIndex = (value: unknown): number => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

const normalizeHostname = (value: string): string => value.trim().toLowerCase().replace(/\.$/, "");

const isLocalHostname = (hostname: string): boolean => {
  const normalized = normalizeHostname(hostname);
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
};

const isAllowedProtocol = (url: URL): boolean =>
  url.protocol === "https:" || (url.protocol === "http:" && isLocalHostname(url.hostname));

const matchesHost = (hostname: string, allowedHost: string): boolean => {
  const normalizedHost = normalizeHostname(hostname);
  const normalizedAllowed = normalizeHostname(allowedHost);
  return normalizedHost === normalizedAllowed || normalizedHost.endsWith(`.${normalizedAllowed}`);
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
  const host = asOptionalString(req.headers.host);
  if (!host) return null;
  const forwardedProto = asOptionalString(req.headers["x-forwarded-proto"]);
  const protocol = forwardedProto ? forwardedProto.split(",")[0]?.trim().toLowerCase() : "http";
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

const parseRequestBody = (req: NextApiRequest): Record<string, unknown> | null => {
  try {
    if (typeof req.body === "string") {
      return asRecord(JSON.parse(req.body));
    }
    return asRecord(req.body);
  } catch {
    return null;
  }
};

const validateTrustedUrl = async (
  candidate: URL
): Promise<{ ok: true } | { ok: false; error: string }> => {
  if (!isAllowedProtocol(candidate)) {
    return { ok: false, error: "Only HTTPS URLs are allowed (HTTP allowed for localhost)." };
  }
  const trustedHosts = resolveMediaPreviewTrustedHosts();
  if (!trustedHosts.some((host) => matchesHost(candidate.hostname, host))) {
    return { ok: false, error: "URL host is not in the trusted media allowlist." };
  }
  if (isLocalHostname(candidate.hostname)) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, error: "Localhost media URLs are not allowed in production." };
    }
    return { ok: true };
  }
  if (isBlockedPrivateAddress(candidate.hostname)) {
    return { ok: false, error: "URL host is a private network address." };
  }
  if (isIP(candidate.hostname) === 0) {
    const addresses = await resolveHostAddresses(candidate.hostname);
    if (!addresses || !addresses.length) {
      return { ok: false, error: "Unable to resolve URL host." };
    }
    if (addresses.some((address) => isBlockedPrivateAddress(address))) {
      return { ok: false, error: "URL host resolved to a private network address." };
    }
  }
  return { ok: true };
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

const fetchUrlWithRedirectValidation = async ({
  startUrl,
  maxBytes,
}: {
  startUrl: URL;
  maxBytes: number;
}): Promise<{ buffer: Buffer; contentType: string | null; finalUrl: URL }> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    let current = startUrl;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const trustValidation = await validateTrustedUrl(current);
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

const sanitizeFilename = (value: string) => value.replace(/[^\w.-]+/g, "_");

const clampPrompt = (value?: string | null) => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "ai-studio-generation";
  return trimmed.length > 48 ? `${trimmed.slice(0, 48).trim()}...` : trimmed;
};

const extensionFromUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    const base = parsed.pathname.split("/").pop() ?? "";
    const ext = base.includes(".") ? (base.split(".").pop() ?? "") : "";
    return ext.replace(/[^a-z0-9]+/gi, "").toLowerCase();
  } catch {
    return "";
  }
};

const buildFilename = (promptText: string | null | undefined, extension: string, index: number) => {
  const base = sanitizeFilename(clampPrompt(promptText));
  return `${base}-${index + 1}.${extension}`;
};

const resolveFileType = (
  contentType: string | null,
  fallbackMode: "image" | "video",
  fileTypeHint?: "image" | "video"
): "image" | "video" => {
  if (contentType?.startsWith("video/")) return "video";
  if (contentType?.startsWith("image/")) return "image";
  if (fileTypeHint) return fileTypeHint;
  return fallbackMode;
};

const resolveExtension = (contentType: string | null, url: string): string =>
  (contentType && CONTENT_TYPE_EXTENSION[contentType]) || extensionFromUrl(url) || "bin";

const resolveMediaMimeType = ({
  contentType,
  buffer,
  fileType,
}: {
  contentType: string | null;
  buffer: Buffer;
  fileType: "image" | "video";
}): string => {
  if (fileType === "image") {
    const detected = detectImageMimeType(buffer);
    if (detected && ALLOWED_IMAGE_MIME_TYPES.has(detected)) return detected;
    if (contentType && ALLOWED_IMAGE_MIME_TYPES.has(contentType)) return contentType;
    throw new Error("Fetched URL did not return a supported image.");
  }
  const detected = detectVideoMimeType(buffer);
  if (detected && ALLOWED_VIDEO_MIME_TYPES.has(detected)) return detected;
  if (contentType && ALLOWED_VIDEO_MIME_TYPES.has(contentType)) return contentType;
  throw new Error("Fetched URL did not return a supported video.");
};

const readExistingAiStudioMediaRowByOutputIndex = async ({
  userId,
  generationId,
  index,
}: {
  userId: string;
  generationId: string;
  index: number;
}): Promise<ExistingMediaRow | null> => {
  const { data, error } = await getSupabaseAdmin()
    .from("media_files")
    .select("id, storage_path, file_type")
    .eq("user_id", userId)
    .eq("source", "ai_studio")
    .eq("source_ref", generationId)
    .contains("metadata", { generation_output_index: index })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const id = asOptionalString(data.id);
  if (!id) return null;
  return {
    id,
    storagePath: asCanonicalStoragePath(asOptionalString(data.storage_path)),
    fileType:
      asOptionalString(data.file_type)?.toLowerCase() === "video"
        ? ("video" as const)
        : ("image" as const),
  };
};

const signStoragePath = async (storagePath: string | null): Promise<string | null> => {
  if (!storagePath) return null;
  const { data, error } = await getSupabaseAdmin()
    .storage.from(MEDIA_BUCKET)
    .createSignedUrl(storagePath, 3600);
  if (error) return null;
  return asOptionalString(data?.signedUrl);
};

const resolveDelivery = async ({
  storagePath,
  previewStoragePathHint,
  fullStoragePathHint,
  previewUrlHint,
  fullUrlHint,
}: {
  storagePath: string | null;
  previewStoragePathHint: string | null;
  fullStoragePathHint: string | null;
  previewUrlHint: string | null;
  fullUrlHint: string | null;
}) => {
  const previewStoragePath = asCanonicalStoragePath(previewStoragePathHint) ?? storagePath ?? null;
  const fullStoragePath =
    asCanonicalStoragePath(fullStoragePathHint) ?? storagePath ?? previewStoragePath ?? null;
  const [signedPreviewUrl, signedFullUrl] = await Promise.all([
    signStoragePath(previewStoragePath),
    signStoragePath(fullStoragePath),
  ]);
  const previewUrl = signedPreviewUrl ?? previewUrlHint ?? fullUrlHint ?? null;
  const fullUrl = signedFullUrl ?? fullUrlHint ?? previewUrl ?? null;
  return {
    previewStoragePath,
    fullStoragePath,
    previewUrl,
    fullUrl,
  };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CopyFromUrlResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  const payload = parseRequestBody(req);
  if (!payload) {
    return res.status(400).json({ error: "Invalid JSON body." });
  }
  const input = payload as CopyFromUrlRequest;
  const rawUrl = asOptionalString(input.url);
  if (!rawUrl) {
    return res.status(400).json({ error: "Missing url." });
  }
  const parsedUrl = parseUrlFromRequest(rawUrl, req);
  if (!parsedUrl) {
    return res.status(400).json({ error: "Invalid url." });
  }

  const trustValidation = await validateTrustedUrl(parsedUrl);
  if (!trustValidation.ok) {
    return res.status(422).json({ error: "Untrusted media URL.", details: trustValidation.error });
  }

  const source = parseSource(input.source);
  const mode = parseMode(input.mode);
  const fileTypeHint = parseFileTypeHint(input.fileTypeHint);
  const index = parseIndex(input.index);
  const generationId = asOptionalString(input.generationId);
  const promptId = asOptionalString(input.promptId);
  const previewStoragePathHint = asOptionalString(input.previewStoragePathHint);
  const fullStoragePathHint = asOptionalString(input.fullStoragePathHint);
  const previewUrlHint = asOptionalString(input.previewUrlHint);
  const fullUrlHint = asOptionalString(input.fullUrlHint);
  const promptText = asOptionalString(input.promptText);
  const provider = asOptionalString(input.provider);
  const modelId = asOptionalString(input.modelId);
  const metadata = asObjectMetadata(input.metadata);

  try {
    if (source === "ai_studio" && generationId) {
      const existing = await readExistingAiStudioMediaRowByOutputIndex({
        userId: user.id,
        generationId,
        index,
      });
      if (existing) {
        const delivery = await resolveDelivery({
          storagePath: existing.storagePath,
          previewStoragePathHint,
          fullStoragePathHint,
          previewUrlHint,
          fullUrlHint,
        });
        return res.status(200).json({
          mediaFileId: existing.id,
          storagePath: existing.storagePath ?? "",
          fileType: existing.fileType,
          fileSize: 0,
          delivery,
        });
      }
    }

    const effectiveFileType = resolveFileType(null, mode, fileTypeHint);
    const maxBytes = effectiveFileType === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    const fetched = await fetchUrlWithRedirectValidation({
      startUrl: parsedUrl,
      maxBytes,
    });
    const fileType = resolveFileType(fetched.contentType, mode, fileTypeHint);
    const mimeType = resolveMediaMimeType({
      contentType: fetched.contentType,
      buffer: fetched.buffer,
      fileType,
    });
    const extension = resolveExtension(mimeType, fetched.finalUrl.toString());
    const rootFolder = source === "ai_studio" ? "generations" : "uploads";
    const typeFolder = fileType === "video" ? "videos" : "images";
    const storageName = `${randomUUID()}-${index}.${extension}`;
    const storagePath = assertUserScopedMediaStoragePath({
      path: `${user.id}/${rootFolder}/${typeFolder}/${storageName}`,
      userId: user.id,
      label: "AI Studio media copy storage path",
    });

    const imageDimensions =
      fileType === "image" ? extractImageDimensionsFromBuffer(fetched.buffer) : null;
    const canonicalMetadata = withCanonicalImageDimensions(
      {
        provider: provider ?? null,
        model_id: modelId ?? null,
        prompt: promptText ?? null,
        generation_output_index: index,
        index,
        ...metadata,
      },
      imageDimensions
    );
    const friendlyName = buildFilename(promptText, extension, index);

    const { error: uploadError } = await getSupabaseAdmin()
      .storage.from(MEDIA_BUCKET)
      .upload(storagePath, fetched.buffer, {
        upsert: false,
        contentType: mimeType,
      });
    if (uploadError) {
      return res.status(500).json({
        error: "Upload failed",
        details: uploadError.message,
      });
    }

    const { data, error: insertError } = await getSupabaseAdmin()
      .from("media_files")
      .insert({
        user_id: user.id,
        filename: friendlyName,
        storage_path: storagePath,
        file_type: fileType,
        file_size: fetched.buffer.byteLength,
        source,
        source_ref: generationId ?? null,
        prompt_id: promptId ?? null,
        metadata: canonicalMetadata,
      })
      .select("id")
      .single();

    if (insertError) {
      const duplicateInsert =
        insertError.code === "23505" ||
        String(insertError.message ?? "")
          .toLowerCase()
          .includes("duplicate");
      if (duplicateInsert && source === "ai_studio" && generationId) {
        const existing = await readExistingAiStudioMediaRowByOutputIndex({
          userId: user.id,
          generationId,
          index,
        });
        if (existing) {
          try {
            await getSupabaseAdmin().storage.from(MEDIA_BUCKET).remove([storagePath]);
          } catch {
            // best-effort cleanup
          }
          const delivery = await resolveDelivery({
            storagePath: existing.storagePath,
            previewStoragePathHint,
            fullStoragePathHint,
            previewUrlHint,
            fullUrlHint,
          });
          return res.status(200).json({
            mediaFileId: existing.id,
            storagePath: existing.storagePath ?? storagePath,
            fileType: existing.fileType,
            fileSize: fetched.buffer.byteLength,
            delivery,
          });
        }
      }
      return res.status(500).json({
        error: "Failed to persist media record",
        details: insertError.message,
      });
    }

    const delivery = await resolveDelivery({
      storagePath,
      previewStoragePathHint,
      fullStoragePathHint,
      previewUrlHint,
      fullUrlHint,
    });

    return res.status(200).json({
      mediaFileId: asOptionalString(data?.id),
      storagePath,
      fileType,
      fileSize: fetched.buffer.byteLength,
      delivery,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to copy media from URL.";
    if (
      message.includes("Untrusted media URL") ||
      message.includes("URL host") ||
      message.includes("Only HTTPS URLs are allowed") ||
      message.includes("private network")
    ) {
      return res.status(422).json({ error: message });
    }
    if (
      message.includes("Fetch failed (") ||
      message.includes("URL redirected too many times") ||
      message.includes("Fetched URL did not return a supported")
    ) {
      return res.status(422).json({ error: message });
    }
    await logApiRouteException({
      req,
      error,
      routeLabel: "media-copy-from-url",
      user,
    });
    return res.status(500).json({ error: "Unable to copy media from URL.", details: message });
  }
}
