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
import { resolvePreviewStoragePath } from "../../../lib/mediaPreviewPath";
import {
  isSupabaseRenderImageUrl,
  resolveMediaPreviewTrustedHosts,
} from "../../../lib/mediaPreviewTrustPolicy";
import {
  MEDIA_STORAGE_LIMIT_EXCEEDED_MESSAGE,
  isMediaStorageQuotaExceededError,
} from "../../../lib/mediaStorageQuota";
import { assertUserScopedMediaStoragePath } from "../../../lib/mediaStoragePath";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { requireApiUser } from "../../../lib/server/api/auth";
import { reconcileOwnedGenerationOutputSlot } from "../../../lib/server/api/generationOutputConvergence";
import {
  createSignedMediaUrl,
  insertMediaFileRow,
  type MediaLibraryFileType,
  MAX_AUDIO_MEDIA_BYTES,
  maxBytesForMediaFileType,
  MAX_IMAGE_MEDIA_BYTES,
  removeScopedMediaStorageObject,
  resolveDetectedMediaMimeType,
  resolveMediaStorageExtension,
  uploadMediaBufferToStoragePath,
} from "../../../lib/server/mediaIngest";
import { enforceApiRateLimit } from "../../../lib/server/api/rateLimit";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";
import { extractImageDimensionsFromBuffer } from "../../../lib/server/imageDimensions";
import {
  admitImageBufferForProductUse,
  type ImageAdmissionAcceptedResult,
} from "../../../lib/server/imageAdmission";
import {
  upsertVideoPosterVariantFromBuffer,
  upsertVideoPreviewVariantFromBuffer,
} from "../../../lib/server/videoPosterVariant";
const FETCH_TIMEOUT_MS = 60000;
const DNS_TIMEOUT_MS = 2500;
const MAX_REDIRECTS = 4;
const MAX_IMAGE_BYTES = MAX_IMAGE_MEDIA_BYTES;
const MAX_VIDEO_BYTES = maxBytesForMediaFileType("video");
const MAX_AUDIO_BYTES = MAX_AUDIO_MEDIA_BYTES;
const MAX_REMOTE_IMAGE_FETCH_BYTES = MAX_VIDEO_BYTES;
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);
const VIDEO_PREVIEW_MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  mp4: "video/mp4",
  webm: "video/webm",
};
const GENERATED_MEDIA_REQUIRES_GENERATION_ID_ERROR =
  "Generated media is missing durable generation tracking.";
const MEDIA_COPY_FROM_URL_RATE_LIMIT = {
  keyPrefix: "media-copy-from-url",
  maxRequests: 8,
  windowMs: 10 * 60 * 1000,
} as const;

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
  posterUrlHint?: unknown;
  metadata?: unknown;
};

type CopyFromUrlResponse =
  | {
      mediaFileId: string | null;
      storagePath: string;
      fileType: MediaLibraryFileType;
      fileSize: number;
      delivery: {
        previewStoragePath: string | null;
        previewPosterStoragePath: string | null;
        fullStoragePath: string | null;
        previewUrl: string | null;
        previewPosterUrl: string | null;
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
  fileType: MediaLibraryFileType;
  metadata: Record<string, unknown> | null;
  thumbVariantPath: string | null;
  posterVariantPath: string | null;
  previewVariantPath: string | null;
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

const normalizeOwnedStoragePathHint = ({
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

const parseSource = (value: unknown): "upload" | "ai_studio" =>
  asOptionalString(value) === "ai_studio" ? "ai_studio" : "upload";

const parseMode = (value: unknown): MediaLibraryFileType => {
  const parsed = asOptionalString(value);
  if (parsed === "video") return "video";
  if (parsed === "audio") return "audio";
  return "image";
};

const parseFileTypeHint = (value: unknown): MediaLibraryFileType | undefined => {
  const parsed = asOptionalString(value);
  if (parsed === "image" || parsed === "video" || parsed === "audio") return parsed;
  return undefined;
};

const normalizePosterSourceUrl = (
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

const fetchPosterSource = async (
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

const persistVideoPosterVariant = async ({
  userId,
  mediaFileId,
  posterSourceUrl,
  req,
}: {
  userId: string;
  mediaFileId: string;
  posterSourceUrl: string;
  req: NextApiRequest;
}): Promise<string | null> => {
  const fetched = await fetchPosterSource(req, posterSourceUrl);
  const mimeType = resolveDetectedMediaMimeType({
    contentType: fetched.contentType,
    buffer: fetched.buffer,
    fileType: "image",
  });
  const extension = resolveExtension(mimeType, posterSourceUrl);
  const storagePath = assertUserScopedMediaStoragePath({
    path: `${userId}/variants/videos/${mediaFileId}/poster_720.${extension}`,
    userId,
    label: "AI Studio copied video poster storage path",
  });

  await uploadMediaBufferToStoragePath({
    storagePath,
    buffer: fetched.buffer,
    mimeType,
    upsert: true,
  });

  const dimensions = extractImageDimensionsFromBuffer(fetched.buffer);

  const { error: variantError } = await getSupabaseAdmin()
    .from("media_asset_variants")
    .upsert(
      {
        media_file_id: mediaFileId,
        user_id: userId,
        variant_kind: "poster_720",
        storage_path: storagePath,
        mime_type: mimeType,
        width: dimensions?.width ?? null,
        height: dimensions?.height ?? null,
        byte_size: fetched.buffer.byteLength,
        status: "ready",
        metadata: {
          generated_by: "media-copy-from-url",
          poster_source: posterSourceUrl.startsWith("data:image/")
            ? "inline_data_url"
            : "remote_url",
        },
      },
      {
        onConflict: "media_file_id,variant_kind",
      }
    );
  if (variantError) {
    throw variantError;
  }

  const { error: updateError } = await getSupabaseAdmin()
    .from("media_files")
    .update({
      poster_variant_path: storagePath,
    })
    .eq("id", mediaFileId)
    .eq("user_id", userId);
  if (updateError) {
    throw updateError;
  }

  return storagePath;
};

const persistVideoPreviewVariantReference = async ({
  userId,
  mediaFileId,
  previewStoragePath,
}: {
  userId: string;
  mediaFileId: string;
  previewStoragePath: string;
}): Promise<string> => {
  const storagePath = assertUserScopedMediaStoragePath({
    path: previewStoragePath,
    userId,
    label: "AI Studio copied video preview storage path",
  });
  const mimeType = inferVideoPreviewVariantMimeType(storagePath);

  const { error: variantError } = await getSupabaseAdmin()
    .from("media_asset_variants")
    .upsert(
      {
        media_file_id: mediaFileId,
        user_id: userId,
        variant_kind: "preview_loop_360p",
        storage_path: storagePath,
        mime_type: mimeType,
        width: null,
        height: null,
        byte_size: null,
        status: "ready",
        metadata: {
          generated_by: "media-copy-from-url",
          preview_source: "existing_storage_object",
        },
      },
      {
        onConflict: "media_file_id,variant_kind",
      }
    );
  if (variantError) {
    throw variantError;
  }

  const { error: updateError } = await getSupabaseAdmin()
    .from("media_files")
    .update({
      preview_variant_path: storagePath,
    })
    .eq("id", mediaFileId)
    .eq("user_id", userId);
  if (updateError) {
    throw updateError;
  }

  return storagePath;
};

const hydrateVideoPreviewVariant = async ({
  userId,
  mediaFileId,
  previewStoragePath,
  videoBuffer,
  videoMimeType,
  filename,
  source,
  generationId,
  outputIndex,
}: {
  userId: string;
  mediaFileId: string;
  previewStoragePath: string | null;
  videoBuffer: Buffer;
  videoMimeType: string | null;
  filename: string;
  source: string;
  generationId: string | null | undefined;
  outputIndex: number;
}): Promise<string | null> => {
  if (previewStoragePath) {
    return await persistVideoPreviewVariantReference({
      userId,
      mediaFileId,
      previewStoragePath,
    });
  }
  return await upsertVideoPreviewVariantFromBuffer({
    supabaseAdmin: getSupabaseAdmin(),
    userId,
    mediaFileId,
    videoBuffer,
    videoMimeType,
    filename,
    metadata: {
      generated_by: "media-copy-from-url",
      preview_source: "video_buffer",
      source,
      generation_id: generationId ?? null,
      output_index: outputIndex,
    },
  });
};

const sanitizeFilename = (value: string) => value.replace(/[^\w.-]+/g, "_");

const clampPrompt = (value?: string | null) => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "ai-studio-generation";
  return trimmed.length > 48 ? `${trimmed.slice(0, 48).trim()}...` : trimmed;
};

const extensionFromUrl = (url: string) => {
  const resolveFromPathLike = (value: string) => {
    const sanitized = value.split("?")[0]?.split("#")[0] ?? value;
    const base = sanitized.split("/").pop() ?? "";
    const ext = base.includes(".") ? (base.split(".").pop() ?? "") : "";
    return ext.replace(/[^a-z0-9]+/gi, "").toLowerCase();
  };
  try {
    const parsed = new URL(url);
    const base = parsed.pathname.split("/").pop() ?? "";
    const ext = base.includes(".") ? (base.split(".").pop() ?? "") : "";
    return ext.replace(/[^a-z0-9]+/gi, "").toLowerCase();
  } catch {
    return resolveFromPathLike(url);
  }
};

const resolveVideoPreviewVariantCandidatePath = ({
  fileType,
  previewStoragePath,
  fullStoragePath,
}: {
  fileType: MediaLibraryFileType;
  previewStoragePath: string | null | undefined;
  fullStoragePath: string | null | undefined;
}): string | null => {
  if (fileType !== "video") return null;
  const canonicalPreviewPath = asCanonicalStoragePath(previewStoragePath ?? null);
  if (!canonicalPreviewPath) return null;
  const canonicalFullPath = asCanonicalStoragePath(fullStoragePath ?? null);
  if (canonicalFullPath && canonicalPreviewPath === canonicalFullPath) {
    return null;
  }
  return canonicalPreviewPath;
};

const shouldFetchExistingVideoForDerivativeHydration = ({
  fileType,
  posterVariantPath,
  previewVariantPath,
  previewVariantCandidatePath,
  posterUrlHint,
}: {
  fileType: MediaLibraryFileType;
  posterVariantPath: string | null;
  previewVariantPath: string | null;
  previewVariantCandidatePath: string | null;
  posterUrlHint: string | null;
}): boolean => {
  if (fileType !== "video") return false;
  const needsPosterFromBuffer = !posterVariantPath && !posterUrlHint;
  const needsPreviewFromBuffer = !previewVariantPath && !previewVariantCandidatePath;
  return needsPosterFromBuffer || needsPreviewFromBuffer;
};

const inferVideoPreviewVariantMimeType = (storagePath: string): string | null => {
  const extension = extensionFromUrl(storagePath);
  return VIDEO_PREVIEW_MIME_TYPE_BY_EXTENSION[extension] ?? null;
};

const buildFilename = (promptText: string | null | undefined, extension: string, index: number) => {
  const base = sanitizeFilename(clampPrompt(promptText));
  return `${base}-${index + 1}.${extension}`;
};

const resolveFileType = (
  contentType: string | null,
  fallbackMode: MediaLibraryFileType,
  fileTypeHint?: MediaLibraryFileType
): MediaLibraryFileType => {
  if (contentType?.startsWith("video/")) return "video";
  if (contentType?.startsWith("audio/")) return "audio";
  if (contentType?.startsWith("image/")) return "image";
  if (fileTypeHint) return fileTypeHint;
  return fallbackMode;
};

const resolveExtension = (contentType: string | null, url: string): string =>
  (contentType ? resolveMediaStorageExtension(contentType, "") : "") ||
  extensionFromUrl(url) ||
  "bin";

const readExistingAiStudioMediaRowByOutputIndex = async ({
  userId,
  generationId,
  index,
}: {
  userId: string;
  generationId: string;
  index: number;
}): Promise<ExistingMediaRow | null> => {
  const { data: canonicalOutput, error: canonicalOutputError } = await getSupabaseAdmin()
    .from("ai_generation_outputs")
    .select("media_file_id")
    .eq("generation_id", generationId)
    .eq("user_id", userId)
    .eq("output_index", index)
    .limit(1)
    .maybeSingle();
  if (!canonicalOutputError) {
    const mediaFileId = asOptionalString(asRecord(canonicalOutput).media_file_id);
    if (mediaFileId) {
      const { data: canonicalMedia, error: canonicalMediaError } = await getSupabaseAdmin()
        .from("media_files")
        .select(
          "id, storage_path, file_type, metadata, thumb_variant_path, poster_variant_path, preview_variant_path"
        )
        .eq("user_id", userId)
        .eq("id", mediaFileId)
        .limit(1)
        .maybeSingle();
      if (!canonicalMediaError && canonicalMedia) {
        const id = asOptionalString(canonicalMedia.id);
        if (id) {
          return {
            id,
            storagePath: asCanonicalStoragePath(asOptionalString(canonicalMedia.storage_path)),
            fileType: (() => {
              const fileTypeRaw = asOptionalString(canonicalMedia.file_type)?.toLowerCase();
              if (fileTypeRaw === "video") return "video" as const;
              if (fileTypeRaw === "audio") return "audio" as const;
              return "image" as const;
            })(),
            metadata: asObjectMetadata(canonicalMedia.metadata),
            thumbVariantPath: asCanonicalStoragePath(
              asOptionalString(canonicalMedia.thumb_variant_path)
            ),
            posterVariantPath: asCanonicalStoragePath(
              asOptionalString(canonicalMedia.poster_variant_path)
            ),
            previewVariantPath: asCanonicalStoragePath(
              asOptionalString(canonicalMedia.preview_variant_path)
            ),
          };
        }
      }
    }
  }

  const readByMetadataField = async (
    metadataField: "generation_output_index" | "index"
  ): Promise<ExistingMediaRow | null> => {
    const { data, error } = await getSupabaseAdmin()
      .from("media_files")
      .select(
        "id, storage_path, file_type, metadata, thumb_variant_path, poster_variant_path, preview_variant_path"
      )
      .eq("user_id", userId)
      .eq("source", "ai_studio")
      .eq("source_ref", generationId)
      .contains("metadata", { [metadataField]: index })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const id = asOptionalString(data.id);
    if (!id) return null;
    return {
      id,
      storagePath: asCanonicalStoragePath(asOptionalString(data.storage_path)),
      fileType: (() => {
        const fileTypeRaw = asOptionalString(data.file_type)?.toLowerCase();
        if (fileTypeRaw === "video") return "video" as const;
        if (fileTypeRaw === "audio") return "audio" as const;
        return "image" as const;
      })(),
      metadata: asObjectMetadata(data.metadata),
      thumbVariantPath: asCanonicalStoragePath(asOptionalString(data.thumb_variant_path)),
      posterVariantPath: asCanonicalStoragePath(asOptionalString(data.poster_variant_path)),
      previewVariantPath: asCanonicalStoragePath(asOptionalString(data.preview_variant_path)),
    };
  };

  const legacyIndexedRow =
    (await readByMetadataField("generation_output_index")) ?? (await readByMetadataField("index"));
  if (legacyIndexedRow) {
    return legacyIndexedRow;
  }
  return null;
};

const signStoragePath = async (storagePath: string | null): Promise<string | null> => {
  if (!storagePath) return null;
  try {
    return await createSignedMediaUrl(storagePath);
  } catch {
    return null;
  }
};

const sanitizePreviewUrlHint = (value: string | null): string | null => {
  if (!value) return null;
  return isSupabaseRenderImageUrl(value) ? null : value;
};

const resolveDelivery = async ({
  row,
  storagePath,
  previewStoragePathHint,
  fullStoragePathHint,
  previewUrlHint,
  fullUrlHint,
}: {
  row?: {
    storage_path?: string | null;
    file_type?: string | null;
    metadata?: Record<string, unknown> | null;
    thumb_variant_path?: string | null;
    poster_variant_path?: string | null;
    preview_variant_path?: string | null;
  } | null;
  storagePath: string | null;
  previewStoragePathHint: string | null;
  fullStoragePathHint: string | null;
  previewUrlHint: string | null;
  fullUrlHint: string | null;
}) => {
  const authoritativeStoragePath =
    asCanonicalStoragePath(row?.storage_path) ??
    storagePath ??
    asCanonicalStoragePath(fullStoragePathHint) ??
    null;
  const authoritativePreviewStoragePath =
    (row
      ? resolvePreviewStoragePath({
          storage_path: row.storage_path ?? null,
          file_type: row.file_type ?? null,
          metadata: row.metadata ?? null,
          thumb_variant_path: row.thumb_variant_path ?? null,
          poster_variant_path: row.poster_variant_path ?? null,
          preview_variant_path: row.preview_variant_path ?? null,
        })
      : null) ?? null;
  const previewStoragePath =
    authoritativePreviewStoragePath ??
    asCanonicalStoragePath(previewStoragePathHint) ??
    authoritativeStoragePath ??
    null;
  const previewPosterStoragePath =
    row?.file_type === "video"
      ? (asCanonicalStoragePath(row.poster_variant_path) ??
        asCanonicalStoragePath(row.thumb_variant_path))
      : null;
  const fullStoragePath = authoritativeStoragePath ?? previewStoragePath ?? null;
  const [signedPreviewUrl, signedPreviewPosterUrl, signedFullUrl] = await Promise.all([
    signStoragePath(previewStoragePath),
    signStoragePath(previewPosterStoragePath),
    signStoragePath(fullStoragePath),
  ]);
  const safePreviewUrlHint = sanitizePreviewUrlHint(previewUrlHint);
  const safeFullUrlHint = sanitizePreviewUrlHint(fullUrlHint);
  const previewUrl = signedPreviewUrl ?? safePreviewUrlHint ?? safeFullUrlHint ?? null;
  const previewPosterUrl = signedPreviewPosterUrl ?? null;
  const fullUrl = signedFullUrl ?? safeFullUrlHint ?? previewUrl ?? null;
  return {
    previewStoragePath,
    previewPosterStoragePath,
    fullStoragePath,
    previewUrl,
    previewPosterUrl,
    fullUrl,
  };
};

const logVideoVariantHydrationFailure = async ({
  userId,
  mediaFileId,
  variantKind,
  source,
  generationId,
  outputIndex,
  error,
}: {
  userId: string;
  mediaFileId: string;
  variantKind: "poster" | "preview";
  source: "upload" | "ai_studio";
  generationId?: string | null;
  outputIndex: number;
  error: unknown;
}) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message ?? error)
        : String(error);
  const { error: eventError } = await getSupabaseAdmin()
    .from("media_events")
    .insert({
      user_id: userId,
      event_type: "variant_hydration_failed",
      entity_type: "media_file",
      entity_id: mediaFileId,
      metadata: {
        variant_kind: variantKind,
        source,
        generation_id: generationId ?? null,
        output_index: outputIndex,
        message,
      },
    });
  if (eventError) {
    console.warn("[media/copy-from-url] media_events insert failed", eventError.message);
  }
};

const isDuplicateInsertError = (error: { code?: string; message?: string } | null | undefined) =>
  error?.code === "23505" ||
  String(error?.message ?? "")
    .toLowerCase()
    .includes("duplicate");

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CopyFromUrlResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;
  if (
    !enforceApiRateLimit(req, res, {
      ...MEDIA_COPY_FROM_URL_RATE_LIMIT,
      keyPrefix: `${MEDIA_COPY_FROM_URL_RATE_LIMIT.keyPrefix}:${user.id}`,
    })
  ) {
    return;
  }

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
  const previewStoragePathHintResult = normalizeOwnedStoragePathHint({
    value: input.previewStoragePathHint,
    userId: user.id,
    label: "Preview storage path hint",
  });
  if (!previewStoragePathHintResult.ok) {
    return res.status(422).json({
      error: "Invalid preview storage path hint.",
      details: previewStoragePathHintResult.error,
    });
  }
  const fullStoragePathHintResult = normalizeOwnedStoragePathHint({
    value: input.fullStoragePathHint,
    userId: user.id,
    label: "Full storage path hint",
  });
  if (!fullStoragePathHintResult.ok) {
    return res.status(422).json({
      error: "Invalid full storage path hint.",
      details: fullStoragePathHintResult.error,
    });
  }
  const previewStoragePathHint = previewStoragePathHintResult.path;
  const fullStoragePathHint = fullStoragePathHintResult.path;
  const previewUrlHint = asOptionalString(input.previewUrlHint);
  const fullUrlHint = asOptionalString(input.fullUrlHint);
  const posterUrlHint = normalizePosterSourceUrl(mode, input.posterUrlHint);
  const promptText = asOptionalString(input.promptText);
  const provider = asOptionalString(input.provider);
  const modelId = asOptionalString(input.modelId);
  const metadata = asObjectMetadata(input.metadata);

  if (source === "ai_studio" && !generationId) {
    return res.status(400).json({ error: GENERATED_MEDIA_REQUIRES_GENERATION_ID_ERROR });
  }

  try {
    if (source === "ai_studio" && generationId) {
      const existing = await readExistingAiStudioMediaRowByOutputIndex({
        userId: user.id,
        generationId,
        index,
      });
      if (existing) {
        const previewVariantPath = resolveVideoPreviewVariantCandidatePath({
          fileType: existing.fileType,
          previewStoragePath: previewStoragePathHint,
          fullStoragePath: fullStoragePathHint ?? existing.storagePath,
        });
        // Regression-window video rows can already exist without browse derivatives.
        // Fall through so the fetched video buffer can repair missing poster/preview assets.
        if (
          shouldFetchExistingVideoForDerivativeHydration({
            fileType: existing.fileType,
            posterVariantPath: existing.posterVariantPath,
            previewVariantPath: existing.previewVariantPath,
            previewVariantCandidatePath: previewVariantPath,
            posterUrlHint,
          })
        ) {
          // continue into the fetched-buffer path below
        } else {
          let durablePosterStoragePath = existing.posterVariantPath;
          if (!existing.posterVariantPath && existing.fileType === "video") {
            if (posterUrlHint) {
              try {
                durablePosterStoragePath = await persistVideoPosterVariant({
                  userId: user.id,
                  mediaFileId: existing.id,
                  posterSourceUrl: posterUrlHint,
                  req,
                });
              } catch (error) {
                await logVideoVariantHydrationFailure({
                  userId: user.id,
                  mediaFileId: existing.id,
                  variantKind: "poster",
                  source,
                  generationId,
                  outputIndex: index,
                  error,
                });
              }
            }
          }
          let durablePreviewVariantPath = existing.previewVariantPath;
          if (!durablePreviewVariantPath && previewVariantPath) {
            try {
              durablePreviewVariantPath = await persistVideoPreviewVariantReference({
                userId: user.id,
                mediaFileId: existing.id,
                previewStoragePath: previewVariantPath,
              });
            } catch (error) {
              await logVideoVariantHydrationFailure({
                userId: user.id,
                mediaFileId: existing.id,
                variantKind: "preview",
                source,
                generationId,
                outputIndex: index,
                error,
              });
            }
          }
          try {
            await reconcileOwnedGenerationOutputSlot({
              generationId,
              userId: user.id,
              outputIndex: index,
              mediaFileId: existing.id,
              resultUrl: parsedUrl.toString(),
              metadata: {
                media_copy_route: true,
                media_copy_existing: true,
              },
            });
          } catch {
            // best-effort canonical output-slot convergence only
          }
          const delivery = await resolveDelivery({
            row: {
              storage_path: existing.storagePath,
              file_type: existing.fileType,
              metadata: existing.metadata,
              thumb_variant_path: existing.thumbVariantPath,
              poster_variant_path: durablePosterStoragePath,
              preview_variant_path: durablePreviewVariantPath,
            },
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
    }

    const effectiveFileType = resolveFileType(null, mode, fileTypeHint);
    const maxBytes =
      effectiveFileType === "video"
        ? MAX_VIDEO_BYTES
        : effectiveFileType === "audio"
          ? MAX_AUDIO_BYTES
          : MAX_REMOTE_IMAGE_FETCH_BYTES;
    const fetched = await fetchUrlWithRedirectValidation({
      startUrl: parsedUrl,
      maxBytes,
    });
    const fileType = resolveFileType(fetched.contentType, mode, fileTypeHint);
    const detectedMimeType = resolveDetectedMediaMimeType({
      contentType: fetched.contentType,
      buffer: fetched.buffer,
      fileType,
    });

    let storageBuffer = fetched.buffer;
    let mimeType = detectedMimeType;
    let admittedImage: ImageAdmissionAcceptedResult | null = null;
    if (fileType === "image") {
      const admission = await admitImageBufferForProductUse({
        buffer: fetched.buffer,
        mimeType: detectedMimeType,
      });
      if (admission.status === "rejected") {
        return res.status(413).json({ error: admission.userMessage });
      }
      admittedImage = admission;
      storageBuffer = admission.buffer;
      mimeType = admission.mimeType;
    }

    const extension = resolveExtension(mimeType, fetched.finalUrl.toString());
    const rootFolder = source === "ai_studio" ? "generations" : "uploads";
    const typeFolder = fileType === "video" ? "videos" : fileType === "audio" ? "audio" : "images";
    const storageName = `${randomUUID()}-${index}.${extension}`;
    const storagePath = assertUserScopedMediaStoragePath({
      path: `${user.id}/${rootFolder}/${typeFolder}/${storageName}`,
      userId: user.id,
      label: "AI Studio media copy storage path",
    });

    const imageDimensions =
      fileType === "image"
        ? (admittedImage?.dimensions ?? extractImageDimensionsFromBuffer(storageBuffer))
        : null;
    const imageAdmissionMetadata = admittedImage
      ? {
          ...admittedImage.metadata,
          admitted_storage_path: storagePath,
        }
      : null;
    const canonicalMetadata = withCanonicalImageDimensions(
      {
        provider: provider ?? null,
        model_id: modelId ?? null,
        prompt: promptText ?? null,
        generation_output_index: index,
        index,
        ...metadata,
        ...(imageAdmissionMetadata ? { image_admission: imageAdmissionMetadata } : {}),
      },
      imageDimensions
    );
    const friendlyName = buildFilename(promptText, extension, index);

    try {
      await uploadMediaBufferToStoragePath({
        storagePath,
        buffer: storageBuffer,
        mimeType,
      });
    } catch {
      return res.status(500).json({
        error: "Upload failed",
      });
    }

    const { data, error: insertError } = await insertMediaFileRow({
      userId: user.id,
      filename: friendlyName,
      storagePath,
      fileType,
      fileSize: storageBuffer.byteLength,
      source,
      sourceRef: generationId ?? null,
      promptId: promptId ?? null,
      metadata: canonicalMetadata,
    });

    if (insertError) {
      if (isMediaStorageQuotaExceededError(insertError)) {
        await removeScopedMediaStorageObject(storagePath);
        return res.status(409).json({
          error: MEDIA_STORAGE_LIMIT_EXCEEDED_MESSAGE,
          details:
            "Delete media, upgrade your plan, or add recurring storage before saving more files.",
        });
      }
      const duplicateInsert = isDuplicateInsertError(insertError);
      if (duplicateInsert && source === "ai_studio" && generationId) {
        const existing = await readExistingAiStudioMediaRowByOutputIndex({
          userId: user.id,
          generationId,
          index,
        });
        if (existing) {
          await removeScopedMediaStorageObject(storagePath);
          try {
            await reconcileOwnedGenerationOutputSlot({
              generationId,
              userId: user.id,
              outputIndex: index,
              mediaFileId: existing.id,
              resultUrl: parsedUrl.toString(),
              metadata: {
                media_copy_route: true,
                media_copy_existing: true,
              },
            });
          } catch {
            // best-effort canonical output-slot convergence only
          }
          let durablePosterStoragePath = existing.posterVariantPath;
          if (!existing.posterVariantPath && existing.fileType === "video") {
            if (posterUrlHint) {
              try {
                durablePosterStoragePath = await persistVideoPosterVariant({
                  userId: user.id,
                  mediaFileId: existing.id,
                  posterSourceUrl: posterUrlHint,
                  req,
                });
              } catch (error) {
                await logVideoVariantHydrationFailure({
                  userId: user.id,
                  mediaFileId: existing.id,
                  variantKind: "poster",
                  source,
                  generationId,
                  outputIndex: index,
                  error,
                });
              }
            } else {
              durablePosterStoragePath = await upsertVideoPosterVariantFromBuffer({
                supabaseAdmin: getSupabaseAdmin(),
                userId: user.id,
                mediaFileId: existing.id,
                videoBuffer: fetched.buffer,
                videoMimeType: mimeType,
                filename: friendlyName,
                metadata: {
                  generated_by: "media-copy-from-url",
                  poster_source: "video_buffer",
                  source,
                  generation_id: generationId ?? null,
                  output_index: index,
                },
              }).catch(async () => {
                await logVideoVariantHydrationFailure({
                  userId: user.id,
                  mediaFileId: existing.id,
                  variantKind: "poster",
                  source,
                  generationId,
                  outputIndex: index,
                  error: new Error("buffer_poster_generation_failed"),
                });
                return null;
              });
            }
          }
          const previewVariantPath = resolveVideoPreviewVariantCandidatePath({
            fileType: existing.fileType,
            previewStoragePath: previewStoragePathHint,
            fullStoragePath: fullStoragePathHint ?? existing.storagePath,
          });
          let durablePreviewVariantPath = existing.previewVariantPath;
          if (!durablePreviewVariantPath && existing.fileType === "video") {
            try {
              durablePreviewVariantPath = await hydrateVideoPreviewVariant({
                userId: user.id,
                mediaFileId: existing.id,
                previewStoragePath: previewVariantPath,
                videoBuffer: fetched.buffer,
                videoMimeType: mimeType,
                filename: friendlyName,
                source,
                generationId,
                outputIndex: index,
              });
            } catch (error) {
              await logVideoVariantHydrationFailure({
                userId: user.id,
                mediaFileId: existing.id,
                variantKind: "preview",
                source,
                generationId,
                outputIndex: index,
                error,
              });
            }
          }
          const delivery = await resolveDelivery({
            row: {
              storage_path: existing.storagePath,
              file_type: existing.fileType,
              metadata: existing.metadata,
              thumb_variant_path: existing.thumbVariantPath,
              poster_variant_path: durablePosterStoragePath,
              preview_variant_path: durablePreviewVariantPath,
            },
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
            fileSize: storageBuffer.byteLength,
            delivery,
          });
        }
      }
      return res.status(500).json({
        error: "Failed to persist media record",
      });
    }

    const insertedMediaFileId = asOptionalString(data?.id);
    const previewVariantPath = resolveVideoPreviewVariantCandidatePath({
      fileType,
      previewStoragePath: previewStoragePathHint,
      fullStoragePath: fullStoragePathHint ?? storagePath,
    });
    let durablePreviewVariantPath = asOptionalString(data?.preview_variant_path);
    if (insertedMediaFileId && fileType === "video" && !durablePreviewVariantPath) {
      try {
        durablePreviewVariantPath = await hydrateVideoPreviewVariant({
          userId: user.id,
          mediaFileId: insertedMediaFileId,
          previewStoragePath: previewVariantPath,
          videoBuffer: fetched.buffer,
          videoMimeType: mimeType,
          filename: friendlyName,
          source,
          generationId,
          outputIndex: index,
        });
      } catch (error) {
        await logVideoVariantHydrationFailure({
          userId: user.id,
          mediaFileId: insertedMediaFileId,
          variantKind: "preview",
          source,
          generationId,
          outputIndex: index,
          error,
        });
      }
    }
    let durablePosterStoragePath = asOptionalString(data?.poster_variant_path);
    if (insertedMediaFileId && fileType === "video" && !durablePosterStoragePath) {
      if (posterUrlHint) {
        try {
          durablePosterStoragePath = await persistVideoPosterVariant({
            userId: user.id,
            mediaFileId: insertedMediaFileId,
            posterSourceUrl: posterUrlHint,
            req,
          });
        } catch (error) {
          await logVideoVariantHydrationFailure({
            userId: user.id,
            mediaFileId: insertedMediaFileId,
            variantKind: "poster",
            source,
            generationId,
            outputIndex: index,
            error,
          });
        }
      } else {
        durablePosterStoragePath = await upsertVideoPosterVariantFromBuffer({
          supabaseAdmin: getSupabaseAdmin(),
          userId: user.id,
          mediaFileId: insertedMediaFileId,
          videoBuffer: fetched.buffer,
          videoMimeType: mimeType,
          filename: friendlyName,
          metadata: {
            generated_by: "media-copy-from-url",
            poster_source: "video_buffer",
            source,
            generation_id: generationId ?? null,
            output_index: index,
          },
        }).catch(async () => {
          await logVideoVariantHydrationFailure({
            userId: user.id,
            mediaFileId: insertedMediaFileId,
            variantKind: "poster",
            source,
            generationId,
            outputIndex: index,
            error: new Error("buffer_poster_generation_failed"),
          });
          return null;
        });
      }
    }
    const delivery = await resolveDelivery({
      row: {
        storage_path: asOptionalString(data?.storage_path),
        file_type: asOptionalString(data?.file_type),
        metadata: asObjectMetadata(data?.metadata),
        thumb_variant_path: asOptionalString(data?.thumb_variant_path),
        poster_variant_path: durablePosterStoragePath,
        preview_variant_path: durablePreviewVariantPath,
      },
      storagePath,
      previewStoragePathHint,
      fullStoragePathHint,
      previewUrlHint,
      fullUrlHint,
    });
    if (source === "ai_studio" && generationId && insertedMediaFileId) {
      try {
        await reconcileOwnedGenerationOutputSlot({
          generationId,
          userId: user.id,
          outputIndex: index,
          mediaFileId: insertedMediaFileId,
          resultUrl: parsedUrl.toString(),
          metadata: {
            media_copy_route: true,
            media_copy_existing: false,
          },
        });
      } catch {
        // best-effort canonical output-slot convergence only
      }
    }

    return res.status(200).json({
      mediaFileId: insertedMediaFileId,
      storagePath,
      fileType,
      fileSize: storageBuffer.byteLength,
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
    if (message === "Fetched media exceeds size limit.") {
      return res.status(413).json({ error: message });
    }
    await logApiRouteException({
      req,
      error,
      routeLabel: "media-copy-from-url",
      user,
    });
    return res.status(500).json({ error: "Unable to copy media from URL." });
  }
}
