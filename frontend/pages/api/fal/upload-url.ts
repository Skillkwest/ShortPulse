/**
 * Authenticated Fal CDN staging route for Fal-owned image/audio inputs.
 * Centralizes URL, binary, and caller-owned storage-path staging so Lip Sync
 * does not fork provider media authority. This route is temporarily above the
 * file-size guideline; the next structural split should move fetch/upload
 * helpers into `lib/server/api/falCdnUpload.ts` without changing the route
 * contract.
 */
import { Buffer } from "node:buffer";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { NextApiRequest, NextApiResponse } from "next";
import { assertUserScopedMediaStoragePath } from "../../../lib/mediaStoragePath";
import { FAL_UPLOAD_COMPATIBILITY_TARGET_OMNIHUMAN_V15_IMAGE } from "../../../lib/model-runtime/falUploadCompatibilityTargets";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { enforceApiRateLimit } from "../../../lib/server/api/rateLimit";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";
import {
  normalizeOmniHumanImageInput,
  type FalUploadCompatibilityTarget,
} from "../../../lib/server/omniHumanMediaCompatibility";
import { readProviderApiKey } from "../../../lib/server/providerIntegration/providerRuntimeConfig";

const FAL_UPLOAD_INITIATE_ENDPOINT =
  process.env.SHORTPULSE_FAL_UPLOAD_INITIATE_URL?.trim() ||
  "https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3";
const SOURCE_FETCH_TIMEOUT_MS = 30_000;
const DNS_LOOKUP_TIMEOUT_MS = 2_500;
const MAX_SOURCE_REDIRECTS = 3;
const MAX_UPLOAD_BYTES = 90 * 1024 * 1024;
const FAL_CDN_VERIFY_TIMEOUT_MS = 10_000;
const FAL_UPLOAD_INITIATE_TIMEOUT_MS = 15_000;
const FAL_UPLOAD_PUT_TIMEOUT_MS = 30_000;
const MEDIA_LIBRARY_BUCKET = "media_library";

type FalUploadMediaKind = "image" | "audio";

export const config = {
  api: {
    bodyParser: false,
  },
};

type SuccessResponse = {
  url: string;
  fileName: string | null;
  mimeType: string | null;
};

type ErrorResponse = {
  error: string;
  details?: string;
};

type FalInitiateUploadResponse = {
  upload_url?: unknown;
  file_url?: unknown;
};

class FalUploadRequestError extends Error {
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

const normalizeHostname = (hostname: string): string =>
  hostname
    .trim()
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^\[(.*)\]$/, "$1");

const isPrivateIpv4Address = (hostname: string): boolean => {
  const match = normalizeHostname(hostname).match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const octets = match.slice(1).map((segment) => Number.parseInt(segment, 10));
  if (octets.some((octet) => !Number.isFinite(octet) || octet < 0 || octet > 255)) return false;
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
  const normalized = normalizeHostname(hostname);
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe8")) return true;
  if (normalized.startsWith("fe9")) return true;
  if (normalized.startsWith("fea")) return true;
  if (normalized.startsWith("feb")) return true;
  return false;
};

const isBlockedPrivateAddress = (hostname: string): boolean => {
  const normalized = normalizeHostname(hostname);
  const ipVersion = isIP(normalized);
  if (ipVersion === 4) return isPrivateIpv4Address(normalized);
  if (ipVersion === 6) return isPrivateIpv6Address(normalized);
  return false;
};

const isLocalOrPrivateHostname = (hostname: string): boolean => {
  const normalized = normalizeHostname(hostname);
  if (normalized === "localhost" || normalized.endsWith(".localhost")) return true;
  return isBlockedPrivateAddress(normalized);
};

const resolveHostAddresses = async (hostname: string): Promise<string[] | null> => {
  try {
    const records = await Promise.race([
      dnsLookup(hostname, { all: true }),
      new Promise<never>((_, reject) => {
        globalThis.setTimeout(() => reject(new Error("dns_lookup_timeout")), DNS_LOOKUP_TIMEOUT_MS);
      }),
    ]);
    return records
      .map((record) => (typeof record.address === "string" ? record.address : ""))
      .filter((address) => address.length > 0);
  } catch {
    return null;
  }
};

const assertPublicNetworkUrl = async (sourceUrl: URL): Promise<void> => {
  if (isLocalOrPrivateHostname(sourceUrl.hostname)) {
    throw new FalUploadRequestError("fileUrl cannot target a local or private-network host.");
  }
  if (isIP(normalizeHostname(sourceUrl.hostname)) !== 0) return;

  const addresses = await resolveHostAddresses(sourceUrl.hostname);
  if (!addresses?.length) {
    throw new FalUploadRequestError("fileUrl host could not be resolved.");
  }
  if (addresses.some((address) => isBlockedPrivateAddress(address))) {
    throw new FalUploadRequestError("fileUrl host resolved to a private-network address.");
  }
};

const parseSafeHttpUrl = async (value: string): Promise<URL> => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new FalUploadRequestError("fileUrl must be a valid http(s) URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new FalUploadRequestError("fileUrl must use http or https.");
  }
  await assertPublicNetworkUrl(parsed);
  return parsed;
};

const inferFileNameFromUrl = (sourceUrl: URL): string | null => {
  const lastSegment = sourceUrl.pathname.split("/").filter(Boolean).pop() ?? "";
  return asNonEmptyString(lastSegment);
};

const isRedirectStatus = (status: number): boolean =>
  status === 301 || status === 302 || status === 303 || status === 307 || status === 308;

const fetchPublicSource = async (sourceUrl: URL, signal: AbortSignal): Promise<Response> => {
  let currentUrl = sourceUrl;
  for (let redirectCount = 0; redirectCount <= MAX_SOURCE_REDIRECTS; redirectCount += 1) {
    await assertPublicNetworkUrl(currentUrl);
    const sourceResponse = await fetch(currentUrl.toString(), {
      method: "GET",
      redirect: "manual",
      signal,
    });

    if (!isRedirectStatus(sourceResponse.status)) return sourceResponse;

    const location = sourceResponse.headers.get("location");
    if (!location) {
      throw new FalUploadRequestError("Source URL redirected without a Location header.");
    }
    try {
      currentUrl = await parseSafeHttpUrl(new URL(location, currentUrl).toString());
    } catch (error) {
      if (error instanceof FalUploadRequestError) throw error;
      throw new FalUploadRequestError("Source URL redirected to an invalid URL.");
    }
  }

  throw new FalUploadRequestError("Source URL redirected too many times.");
};

const readResponseBodyWithLimit = async (
  response: Response | Blob,
  maxBytes: number
): Promise<Buffer> => {
  const rawContentLength = "headers" in response ? response.headers.get("content-length") : null;
  const contentLength = Number(rawContentLength);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new FalUploadRequestError("Source file exceeds the maximum upload size.", 413);
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > maxBytes) {
    throw new FalUploadRequestError("Source file exceeds the maximum upload size.", 413);
  }
  return Buffer.from(arrayBuffer);
};

const readRawRequestBody = async (req: NextApiRequest): Promise<Buffer> =>
  await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let done = false;

    const fail = (error: unknown) => {
      if (done) return;
      done = true;
      reject(error);
    };

    req.on("data", (chunk) => {
      if (done) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.byteLength;
      if (totalBytes > MAX_UPLOAD_BYTES) {
        if (typeof req.destroy === "function") req.destroy();
        fail(new FalUploadRequestError("Upload body exceeds the maximum upload size.", 413));
        return;
      }
      chunks.push(buffer);
    });
    req.on("end", () => {
      if (done) return;
      done = true;
      resolve(Buffer.concat(chunks));
    });
    req.on("error", fail);
  });

const isJsonRequest = (req: NextApiRequest): boolean =>
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
}): Promise<SuccessResponse> => {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), SOURCE_FETCH_TIMEOUT_MS);
  try {
    const sourceResponse = await fetchPublicSource(sourceUrl, controller.signal);
    if (!sourceResponse.ok) {
      throw new FalUploadRequestError(`Source fetch failed (${sourceResponse.status}).`, 400);
    }
    const sourceMimeType = resolveSourceUploadMimeType({
      sourceMimeType: asNonEmptyString(sourceResponse.headers.get("content-type")),
      mediaKind,
      fileName,
      sourceUrl,
    });
    const sourceBuffer = await readResponseBodyWithLimit(sourceResponse, MAX_UPLOAD_BYTES);
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
  if (size !== null && size > MAX_UPLOAD_BYTES) {
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
}): Promise<SuccessResponse> => {
  const storageObject = await downloadStorageObjectWithLimit({ storagePath, userId });
  const storageBuffer = await readResponseBodyWithLimit(storageObject, MAX_UPLOAD_BYTES);
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

const FAL_UPLOAD_URL_RATE_LIMIT = {
  keyPrefix: "fal-upload-url",
  maxRequests: 12,
  windowMs: 10 * 60 * 1000,
} as const;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let user: Awaited<ReturnType<typeof requireApiUser>>;
  try {
    user = await requireApiUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "fal-upload-url.auth",
      scope: "generation",
    });
    return res.status(500).json({
      error: "Fal upload failed",
    });
  }
  if (!user) return;
  const userId = user.id;
  if (
    !enforceApiRateLimit(req, res, {
      ...FAL_UPLOAD_URL_RATE_LIMIT,
      keyPrefix: `${FAL_UPLOAD_URL_RATE_LIMIT.keyPrefix}:${userId}`,
    })
  ) {
    return;
  }

  try {
    const apiKey = readProviderApiKey("fal");
    const bodyBuffer = await readRawRequestBody(req);
    const result = isJsonRequest(req)
      ? await (async () => {
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
          const sourceUrl = await parseSafeHttpUrl(fileUrl);
          return await uploadRemoteSourceToFal({
            apiKey,
            sourceUrl,
            fileName,
            mediaKind,
            compatibilityTarget,
          });
        })()
      : await (async () => {
          const fileName = asNonEmptyString(req.headers["x-shortpulse-upload-filename"]);
          const mimeType = asNonEmptyString(req.headers["content-type"]);
          const compatibilityTarget = resolveCompatibilityTarget(
            req.headers["x-shortpulse-fal-compatibility-target"]
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
        })();

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof FalUploadRequestError) {
      return res.status(error.statusCode).json({
        error: "Fal upload failed",
        details: error.message,
      });
    }
    if (error instanceof SyntaxError && isJsonRequest(req)) {
      return res.status(400).json({
        error: "Invalid upload request",
        details: "Request body must be valid JSON.",
      });
    }
    await logApiRouteException({
      req,
      error,
      routeLabel: "fal-upload-url",
      user,
    });
    return res.status(500).json({
      error: "Fal upload failed",
    });
  }
}
