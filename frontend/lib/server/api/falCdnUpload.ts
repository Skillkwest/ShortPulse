/**
 * Fal CDN staging helpers for provider-owned image/audio inputs.
 * Keeps remote URL, caller-owned storage-path, and direct binary upload mechanics
 * out of the route handler while preserving the `/api/fal/upload-url` contract.
 */
import { Buffer } from "node:buffer";
import type { NextApiRequest } from "next";
import { assertUserScopedMediaStoragePath } from "../../mediaStoragePath";
import { FAL_UPLOAD_COMPATIBILITY_TARGET_OMNIHUMAN_V15_IMAGE } from "../../model-runtime/falUploadCompatibilityTargets";
import {
  fetchPublicProviderSource,
  parseSafeProviderHttpUrl,
  readProviderBodyWithLimit,
} from "./providerUploadSafety";
import { getSupabaseAdmin } from "./supabaseAdmin";
import {
  normalizeOmniHumanImageInput,
  type FalUploadCompatibilityTarget,
} from "../omniHumanMediaCompatibility";

const FAL_UPLOAD_INITIATE_ENDPOINT =
  process.env.SHORTPULSE_FAL_UPLOAD_INITIATE_URL?.trim() ||
  "https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3";
const SOURCE_FETCH_TIMEOUT_MS = 30_000;
export const FAL_CDN_UPLOAD_MAX_BYTES = 90 * 1024 * 1024;
const FAL_CDN_VERIFY_TIMEOUT_MS = 10_000;
const FAL_UPLOAD_INITIATE_TIMEOUT_MS = 15_000;
const FAL_UPLOAD_PUT_TIMEOUT_MS = 30_000;
const MEDIA_LIBRARY_BUCKET = "media_library";

type FalUploadMediaKind = "image" | "audio";

export type FalCdnUploadResponse = {
  url: string;
  fileName: string | null;
  mimeType: string | null;
};

type FalInitiateUploadResponse = {
  upload_url?: unknown;
  file_url?: unknown;
};

export class FalUploadRequestError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "FalUploadRequestError";
    this.statusCode = statusCode;
  }
}

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const resolveMediaKind = (value: unknown): FalUploadMediaKind | null => {
  const normalized = asNonEmptyString(value)?.toLowerCase();
  if (normalized === "image" || normalized === "audio") return normalized;
  return null;
};

const resolveCompatibilityTarget = (value: unknown): FalUploadCompatibilityTarget => {
  const normalized = asNonEmptyString(value)?.toLowerCase();
  if (normalized === FAL_UPLOAD_COMPATIBILITY_TARGET_OMNIHUMAN_V15_IMAGE) {
    return FAL_UPLOAD_COMPATIBILITY_TARGET_OMNIHUMAN_V15_IMAGE;
  }
  return null;
};

const inferFileNameFromUrl = (sourceUrl: URL): string | null => {
  const lastSegment = sourceUrl.pathname.split("/").filter(Boolean).pop() ?? "";
  return asNonEmptyString(lastSegment);
};

export const isFalUploadJsonRequest = (req: NextApiRequest): boolean =>
  req.headers["content-type"]?.toLowerCase().includes("application/json") ?? false;

const readJsonResponse = async (response: Response): Promise<Record<string, unknown>> => {
  const rawText = await response.text().catch(() => "");
  if (!rawText.trim()) return {};
  try {
    return JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    return {};
  }
};

const readFalErrorDetail = async (response: Response): Promise<string | null> => {
  const payload = await readJsonResponse(response);
  const detail = asNonEmptyString(payload.detail) ?? asNonEmptyString(payload.message);
  return detail ?? null;
};

const isAbortLikeError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { name?: unknown; message?: unknown };
  if (maybeError.name === "AbortError") return true;
  return (
    typeof maybeError.message === "string" &&
    /\babort(?:ed)?\b|signal is aborted|timed out|timeout/i.test(maybeError.message)
  );
};

const fetchWithTimeout = async ({
  url,
  init,
  timeoutMs,
  timeoutMessage,
}: {
  url: string;
  init: RequestInit;
  timeoutMs: number;
  timeoutMessage: string;
}): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (isAbortLikeError(error)) {
      throw new FalUploadRequestError(timeoutMessage, 502);
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
};

const inferMimeTypeFromPath = (
  storagePathOrName: string,
  mediaKind: FalUploadMediaKind
): string => {
  const normalized = storagePathOrName.trim().toLowerCase();
  if (mediaKind === "image") {
    if (/\.(?:jpg|jpeg)(?:$|[?#])/i.test(normalized)) return "image/jpeg";
    if (/\.webp(?:$|[?#])/i.test(normalized)) return "image/webp";
    return "image/png";
  }
  if (/\.wav(?:$|[?#])/i.test(normalized)) return "audio/wav";
  if (/\.m4a(?:$|[?#])/i.test(normalized)) return "audio/mp4";
  if (/\.aac(?:$|[?#])/i.test(normalized)) return "audio/aac";
  if (/\.flac(?:$|[?#])/i.test(normalized)) return "audio/flac";
  if (/\.(?:ogg|oga)(?:$|[?#])/i.test(normalized)) return "audio/ogg";
  if (/\.webm(?:$|[?#])/i.test(normalized)) return "audio/webm";
  return "audio/mpeg";
};

const inferMediaKindFromMimeType = (mimeType: string | null): FalUploadMediaKind | null => {
  const normalized = mimeType?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (normalized.startsWith("image/")) return "image";
  if (normalized.startsWith("audio/")) return "audio";
  return null;
};

const isGenericBinaryMimeType = (mimeType: string | null): boolean => {
  const normalized = mimeType?.split(";")[0]?.trim().toLowerCase() ?? "";
  return normalized === "application/octet-stream" || normalized === "binary/octet-stream";
};

const resolveSourceUploadMimeType = ({
  sourceMimeType,
  mediaKind,
  fileName,
  sourceUrl,
}: {
  sourceMimeType: string | null;
  mediaKind: FalUploadMediaKind | null;
  fileName: string | null;
  sourceUrl: URL;
}): string | null => {
  if (!mediaKind) return sourceMimeType;
  if (!sourceMimeType || isGenericBinaryMimeType(sourceMimeType)) {
    return inferMimeTypeFromPath(fileName ?? sourceUrl.pathname, mediaKind);
  }
  const sourceKind = inferMediaKindFromMimeType(sourceMimeType);
  if (sourceKind !== mediaKind) {
    throw new FalUploadRequestError(
      `Source URL returned ${sourceMimeType}; expected ${mediaKind} media.`
    );
  }
  return sourceMimeType;
};

const resolveFileNameFromStoragePath = (storagePath: string): string | null => {
  const lastSegment = storagePath.split("/").filter(Boolean).pop() ?? "";
  return asNonEmptyString(lastSegment);
};

const assertContentTypeMatchesKind = ({
  contentType,
  mediaKind,
}: {
  contentType: string | null;
  mediaKind: FalUploadMediaKind | null;
}) => {
  if (!mediaKind || !contentType) return;
  const normalized = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!normalized) return;
  if (!normalized.startsWith(`${mediaKind}/`)) {
    throw new FalUploadRequestError(
      `Fal CDN upload returned ${contentType}; expected ${mediaKind} media.`,
      502
    );
  }
};

const verifyFalCdnUploadUrl = async ({
  fileUrl,
  mediaKind,
}: {
  fileUrl: string;
  mediaKind: FalUploadMediaKind | null;
}) => {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), FAL_CDN_VERIFY_TIMEOUT_MS);
  try {
    const headResponse = await fetch(fileUrl, {
      method: "HEAD",
      signal: controller.signal,
    }).catch((error) => {
      if (error instanceof Error && error.name === "AbortError") throw error;
      return null;
    });
    if (headResponse?.ok) {
      assertContentTypeMatchesKind({
        contentType: headResponse.headers?.get("content-type") ?? null,
        mediaKind,
      });
      return;
    }

    const getResponse = await fetch(fileUrl, {
      method: "GET",
      headers: {
        Range: "bytes=0-0",
      },
      signal: controller.signal,
    });
    if (!getResponse.ok) {
      throw new FalUploadRequestError(
        `Fal CDN uploaded file was not fetchable (${getResponse.status}).`,
        502
      );
    }
    assertContentTypeMatchesKind({
      contentType: getResponse.headers?.get("content-type") ?? null,
      mediaKind,
    });
  } catch (error) {
    if (error instanceof FalUploadRequestError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new FalUploadRequestError("Fal CDN uploaded file verification timed out.", 502);
    }
    throw new FalUploadRequestError("Fal CDN uploaded file verification failed.", 502);
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
};

const resolveUploadFileName = ({
  fileName,
  sourceUrl,
  mimeType,
}: {
  fileName: string | null;
  sourceUrl?: URL;
  mimeType: string | null;
}): string => {
  const inferred = fileName ?? (sourceUrl ? inferFileNameFromUrl(sourceUrl) : null);
  if (inferred) return inferred;
  const extension = mimeType?.split("/")[1]?.split(";")[0]?.trim() || "bin";
  return `shortpulse-fal-upload-${Date.now()}.${extension}`;
};

const uploadBufferToFalCdn = async ({
  apiKey,
  fileBuffer,
  fileName,
  mimeType,
  mediaKind,
}: {
  apiKey: string;
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string | null;
  mediaKind?: FalUploadMediaKind | null;
}): Promise<string> => {
  const resolvedMimeType = mimeType ?? "application/octet-stream";
  const expectedMediaKind = mediaKind ?? inferMediaKindFromMimeType(resolvedMimeType);
  const initiateResponse = await fetchWithTimeout({
    url: FAL_UPLOAD_INITIATE_ENDPOINT,
    timeoutMs: FAL_UPLOAD_INITIATE_TIMEOUT_MS,
    timeoutMessage: "Fal CDN upload initiate timed out.",
    init: {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content_type: resolvedMimeType,
        file_name: fileName,
      }),
    },
  });

  const initiatePayload = (await readJsonResponse(initiateResponse)) as FalInitiateUploadResponse;
  if (!initiateResponse.ok) {
    const errorPayload = initiatePayload as FalInitiateUploadResponse & {
      detail?: unknown;
      message?: unknown;
    };
    throw new FalUploadRequestError(
      (asNonEmptyString(errorPayload.detail) ??
        asNonEmptyString(errorPayload.message) ??
        `Fal upload initiate failed (${initiateResponse.status}).`) as string,
      initiateResponse.status || 502
    );
  }

  const uploadUrl = asNonEmptyString(initiatePayload.upload_url);
  const fileUrl = asNonEmptyString(initiatePayload.file_url);
  if (!uploadUrl || !fileUrl) {
    throw new Error("Fal upload initiate response did not include upload and file URLs.");
  }

  const uploadResponse = await fetchWithTimeout({
    url: uploadUrl,
    timeoutMs: FAL_UPLOAD_PUT_TIMEOUT_MS,
    timeoutMessage: "Fal CDN upload timed out.",
    init: {
      method: "PUT",
      headers: {
        "Content-Type": resolvedMimeType,
      },
      body: new Blob([fileBuffer], { type: resolvedMimeType }),
    },
  });
  if (!uploadResponse.ok) {
    const detail = await readFalErrorDetail(uploadResponse);
    throw new FalUploadRequestError(
      detail ?? `Fal CDN upload failed (${uploadResponse.status}).`,
      uploadResponse.status || 502
    );
  }

  await verifyFalCdnUploadUrl({
    fileUrl,
    mediaKind: expectedMediaKind,
  });

  return fileUrl;
};

const normalizeUploadForCompatibilityTarget = async ({
  fileBuffer,
  fileName,
  mimeType,
  mediaKind,
  compatibilityTarget,
}: {
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string | null;
  mediaKind: FalUploadMediaKind | null;
  compatibilityTarget: FalUploadCompatibilityTarget;
}): Promise<{
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string | null;
}> => {
  if (
    compatibilityTarget !== FAL_UPLOAD_COMPATIBILITY_TARGET_OMNIHUMAN_V15_IMAGE ||
    mediaKind !== "image"
  ) {
    return { fileBuffer, fileName, mimeType };
  }
  let normalized: Awaited<ReturnType<typeof normalizeOmniHumanImageInput>>;
  try {
    normalized = await normalizeOmniHumanImageInput({
      buffer: fileBuffer,
      mimeType,
      fileName,
    });
  } catch {
    throw new FalUploadRequestError(
      "Lip Sync image could not be converted to a provider-compatible JPEG.",
      400
    );
  }
  return {
    fileBuffer: normalized.buffer,
    fileName: normalized.fileName,
    mimeType: normalized.mimeType,
  };
};

const uploadRemoteSourceToFal = async ({
  apiKey,
  sourceUrl,
  fileName,
  mediaKind,
  compatibilityTarget,
}: {
  apiKey: string;
  sourceUrl: URL;
  fileName: string | null;
  mediaKind: FalUploadMediaKind | null;
  compatibilityTarget: FalUploadCompatibilityTarget;
}): Promise<FalCdnUploadResponse> => {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), SOURCE_FETCH_TIMEOUT_MS);
  try {
    const sourceResponse = await fetchPublicProviderSource(sourceUrl, {
      signal: controller.signal,
    });
    if (!sourceResponse.ok) {
      throw new FalUploadRequestError(`Source fetch failed (${sourceResponse.status}).`, 400);
    }
    const sourceMimeType = resolveSourceUploadMimeType({
      sourceMimeType: asNonEmptyString(sourceResponse.headers.get("content-type")),
      mediaKind,
      fileName,
      sourceUrl,
    });
    const sourceBuffer = await readProviderBodyWithLimit(sourceResponse, FAL_CDN_UPLOAD_MAX_BYTES);
    const resolvedFileName = resolveUploadFileName({
      fileName,
      sourceUrl,
      mimeType: sourceMimeType,
    });
    const normalizedUpload = await normalizeUploadForCompatibilityTarget({
      fileBuffer: sourceBuffer,
      fileName: resolvedFileName,
      mimeType: sourceMimeType,
      mediaKind,
      compatibilityTarget,
    });
    const uploadedUrl = await uploadBufferToFalCdn({
      apiKey,
      fileBuffer: normalizedUpload.fileBuffer,
      fileName: normalizedUpload.fileName,
      mimeType: normalizedUpload.mimeType,
      mediaKind: mediaKind ?? inferMediaKindFromMimeType(normalizedUpload.mimeType),
    });
    return {
      url: uploadedUrl,
      fileName: normalizedUpload.fileName,
      mimeType: normalizedUpload.mimeType,
    };
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
};

const downloadStorageObjectWithLimit = async ({
  storagePath,
  userId,
}: {
  storagePath: string;
  userId: string;
}): Promise<Blob> => {
  let safeStoragePath: string;
  try {
    safeStoragePath = assertUserScopedMediaStoragePath({
      path: storagePath,
      userId,
      label: "Fal upload storage path",
    });
  } catch (error) {
    throw new FalUploadRequestError(
      error instanceof Error ? error.message : "Fal upload storage path is invalid."
    );
  }
  const { data, error } = await getSupabaseAdmin()
    .storage.from(MEDIA_LIBRARY_BUCKET)
    .download(safeStoragePath);
  if (error || !data) {
    throw new FalUploadRequestError(
      error?.message
        ? `Storage source fetch failed: ${error.message}`
        : "Storage source not found.",
      400
    );
  }
  const size = typeof data.size === "number" ? data.size : null;
  if (size !== null && size > FAL_CDN_UPLOAD_MAX_BYTES) {
    throw new FalUploadRequestError("Source file exceeds the maximum upload size.", 413);
  }
  return data;
};

const uploadStorageSourceToFal = async ({
  apiKey,
  storagePath,
  fileName,
  mediaKind,
  userId,
  compatibilityTarget,
}: {
  apiKey: string;
  storagePath: string;
  fileName: string | null;
  mediaKind: FalUploadMediaKind;
  userId: string;
  compatibilityTarget: FalUploadCompatibilityTarget;
}): Promise<FalCdnUploadResponse> => {
  const storageObject = await downloadStorageObjectWithLimit({ storagePath, userId });
  const storageBuffer = await readProviderBodyWithLimit(storageObject, FAL_CDN_UPLOAD_MAX_BYTES);
  const storageMimeType =
    asNonEmptyString((storageObject as { type?: unknown }).type) ??
    inferMimeTypeFromPath(fileName ?? storagePath, mediaKind);
  assertContentTypeMatchesKind({
    contentType: storageMimeType,
    mediaKind,
  });
  const resolvedFileName =
    fileName ??
    resolveFileNameFromStoragePath(storagePath) ??
    resolveUploadFileName({ fileName: null, mimeType: storageMimeType });
  const normalizedUpload = await normalizeUploadForCompatibilityTarget({
    fileBuffer: storageBuffer,
    fileName: resolvedFileName,
    mimeType: storageMimeType,
    mediaKind,
    compatibilityTarget,
  });
  const uploadedUrl = await uploadBufferToFalCdn({
    apiKey,
    fileBuffer: normalizedUpload.fileBuffer,
    fileName: normalizedUpload.fileName,
    mimeType: normalizedUpload.mimeType,
    mediaKind,
  });
  return {
    url: uploadedUrl,
    fileName: normalizedUpload.fileName,
    mimeType: normalizedUpload.mimeType,
  };
};

export const stageFalCdnJsonUpload = async ({
  apiKey,
  bodyBuffer,
  userId,
}: {
  apiKey: string;
  bodyBuffer: Buffer;
  userId: string;
}): Promise<FalCdnUploadResponse> => {
  const payload = JSON.parse(bodyBuffer.toString("utf8")) as Record<string, unknown>;
  const fileUrl = asNonEmptyString(payload.fileUrl);
  const fileName = asNonEmptyString(payload.fileName);
  const storagePath = asNonEmptyString(payload.storagePath);
  const mediaKind = resolveMediaKind(payload.mediaKind);
  const compatibilityTarget = resolveCompatibilityTarget(payload.compatibilityTarget);
  if (storagePath) {
    if (!mediaKind) {
      throw new FalUploadRequestError(
        "mediaKind must be 'image' or 'audio' when storagePath is provided."
      );
    }
    return await uploadStorageSourceToFal({
      apiKey,
      storagePath,
      fileName,
      mediaKind,
      userId,
      compatibilityTarget,
    });
  }
  if (!fileUrl) {
    throw new FalUploadRequestError("fileUrl or storagePath is required.");
  }
  const sourceUrl = await parseSafeProviderHttpUrl(fileUrl);
  return await uploadRemoteSourceToFal({
    apiKey,
    sourceUrl,
    fileName,
    mediaKind,
    compatibilityTarget,
  });
};

export const stageFalCdnBinaryUpload = async ({
  apiKey,
  bodyBuffer,
  headers,
}: {
  apiKey: string;
  bodyBuffer: Buffer;
  headers: NextApiRequest["headers"];
}): Promise<FalCdnUploadResponse> => {
  const fileName = asNonEmptyString(headers["x-shortpulse-upload-filename"]);
  const mimeType = asNonEmptyString(headers["content-type"]);
  const compatibilityTarget = resolveCompatibilityTarget(
    headers["x-shortpulse-fal-compatibility-target"]
  );
  if (!bodyBuffer.length) {
    throw new FalUploadRequestError("Binary upload body is empty.");
  }
  const resolvedFileName = resolveUploadFileName({
    fileName,
    mimeType,
  });
  const normalizedUpload = await normalizeUploadForCompatibilityTarget({
    fileBuffer: bodyBuffer,
    fileName: resolvedFileName,
    mimeType,
    mediaKind: inferMediaKindFromMimeType(mimeType),
    compatibilityTarget,
  });
  const uploadedUrl = await uploadBufferToFalCdn({
    apiKey,
    fileBuffer: normalizedUpload.fileBuffer,
    fileName: normalizedUpload.fileName,
    mimeType: normalizedUpload.mimeType,
    mediaKind: inferMediaKindFromMimeType(normalizedUpload.mimeType),
  });
  return {
    url: uploadedUrl,
    fileName: normalizedUpload.fileName,
    mimeType: normalizedUpload.mimeType,
  };
};
