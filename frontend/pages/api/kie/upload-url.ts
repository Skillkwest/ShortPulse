import { Buffer } from "node:buffer";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { NextApiRequest, NextApiResponse } from "next";
import { assertUserScopedMediaStoragePath } from "../../../lib/mediaStoragePath";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { enforceApiRateLimit } from "../../../lib/server/api/rateLimit";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";
import {
  admitKieMotionControlCharacterImage,
  KieMotionControlMediaAdmissionError,
} from "../../../lib/server/kieMotionControlMediaAdmission";
import {
  admitKieSeedanceReferenceImage,
  KieSeedanceImageAdmissionError,
} from "../../../lib/server/kieSeedanceImageAdmission";
import { readProviderApiKey } from "../../../lib/server/providerIntegration/providerRuntimeConfig";

const KIE_FILE_URL_UPLOAD_ENDPOINT =
  process.env.SHORTPULSE_KIE_FILE_URL_UPLOAD_URL?.trim() ||
  "https://kieai.redpandaai.co/api/file-url-upload";
const KIE_FILE_STREAM_UPLOAD_ENDPOINT =
  process.env.SHORTPULSE_KIE_FILE_STREAM_UPLOAD_URL?.trim() ||
  "https://kieai.redpandaai.co/api/file-stream-upload";
const SOURCE_FETCH_TIMEOUT_MS = 30_000;
const DNS_LOOKUP_TIMEOUT_MS = 2_500;
const MAX_SOURCE_REDIRECTS = 3;
const MAX_RAW_UPLOAD_BYTES = 100 * 1024 * 1024;
const MAX_REMOTE_SOURCE_BYTES = 100 * 1024 * 1024;
const MEDIA_LIBRARY_BUCKET = "media_library";
const KIE_IMAGE_UPLOAD_PATH = "shortpulse/kie-video/images";

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

type UploadTransport = "url_upload" | "remote_stream_upload" | "binary_stream_upload";
type KieUploadMediaKind = "image" | "video" | "audio";
type KieUploadAdmissionProfile =
  | "kie_motion_control_character_image"
  | "kie_seedance_reference_image";

type UploadDiagnostics = {
  transport: UploadTransport;
  contentType: string | null;
  bodyFormat: "empty" | "json_like" | "html_like" | "text_like" | "unavailable";
  bodyLength: number | null;
  parseSource: "text" | "json" | "none";
  jsonParsed: boolean;
  topLevelKeys: string[];
  dataKeys: string[];
  hasMessage: boolean;
  hasData: boolean;
  hasDownloadUrl: boolean;
  hasFileUrl: boolean;
  hasFileName: boolean;
  hasMimeType: boolean;
};

type UploadAttemptResult = Awaited<ReturnType<typeof readUploadResponse>>;

type KieUploadDiagnosticsMetadata = {
  kie_upload_transport: UploadTransport;
  kie_upstream_status: number;
  kie_upstream_content_type: string | null;
  kie_upstream_body_format: UploadDiagnostics["bodyFormat"];
  kie_upstream_body_length: number | null;
  kie_upstream_parse_source: UploadDiagnostics["parseSource"];
  kie_upstream_json_parsed: boolean;
  kie_upstream_top_level_keys: string[];
  kie_upstream_data_keys: string[];
  kie_upstream_has_message: boolean;
  kie_upstream_has_data: boolean;
  kie_upstream_has_download_url: boolean;
  kie_upstream_has_file_url: boolean;
  kie_upstream_has_file_name: boolean;
  kie_upstream_has_mime_type: boolean;
};

class KieUploadRequestError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "KieUploadRequestError";
    this.statusCode = statusCode;
  }
}

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
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
  if (normalized === "localhost" || normalized.endsWith(".localhost")) {
    return true;
  }
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
    throw new KieUploadRequestError("fileUrl cannot target a local or private-network host.");
  }
  if (isIP(normalizeHostname(sourceUrl.hostname)) !== 0) return;

  const addresses = await resolveHostAddresses(sourceUrl.hostname);
  if (!addresses?.length) {
    throw new KieUploadRequestError("fileUrl host could not be resolved.");
  }
  if (addresses.some((address) => isBlockedPrivateAddress(address))) {
    throw new KieUploadRequestError("fileUrl host resolved to a private-network address.");
  }
};

const parseSafeHttpUrl = async (value: string): Promise<URL> => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new KieUploadRequestError("fileUrl must be a valid http(s) URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new KieUploadRequestError("fileUrl must use http or https.");
  }
  await assertPublicNetworkUrl(parsed);
  return parsed;
};

const inferFileNameFromUrl = (sourceUrl: URL): string | null => {
  const lastSegment = sourceUrl.pathname.split("/").filter(Boolean).pop() ?? "";
  return asNonEmptyString(lastSegment);
};

const inferFileNameFromStoragePath = (storagePath: string): string | null => {
  const lastSegment = storagePath.split("/").filter(Boolean).pop() ?? "";
  return asNonEmptyString(lastSegment);
};

const resolveMediaKind = (value: unknown): KieUploadMediaKind | null => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "image" || normalized === "video" || normalized === "audio") {
    return normalized;
  }
  return null;
};

const resolveAdmissionProfile = (value: unknown): KieUploadAdmissionProfile | null => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "kie_motion_control_character_image") return normalized;
  if (normalized === "kie_seedance_reference_image") return normalized;
  if (!normalized) return null;
  throw new KieUploadRequestError("admissionProfile is not supported.");
};

const assertAdmissionProfileAllowed = ({
  admissionProfile,
  mediaKind,
  uploadPath,
}: {
  admissionProfile: KieUploadAdmissionProfile | null;
  mediaKind: KieUploadMediaKind;
  uploadPath: string;
}): void => {
  if (!admissionProfile) return;
  if (
    (admissionProfile === "kie_motion_control_character_image" ||
      admissionProfile === "kie_seedance_reference_image") &&
    mediaKind === "image" &&
    uploadPath === KIE_IMAGE_UPLOAD_PATH
  ) {
    return;
  }
  throw new KieUploadRequestError("admissionProfile is only supported for Kie image uploads.");
};

const inferMimeTypeFromPath = (
  storagePathOrName: string,
  mediaKind: KieUploadMediaKind
): string => {
  const normalized = storagePathOrName.trim().toLowerCase();
  if (mediaKind === "image") {
    if (/\.(?:jpg|jpeg)(?:$|[?#])/i.test(normalized)) return "image/jpeg";
    if (/\.webp(?:$|[?#])/i.test(normalized)) return "image/webp";
    if (/\.gif(?:$|[?#])/i.test(normalized)) return "image/gif";
    return "image/png";
  }
  if (mediaKind === "video") {
    if (/\.mov(?:$|[?#])/i.test(normalized)) return "video/quicktime";
    if (/\.webm(?:$|[?#])/i.test(normalized)) return "video/webm";
    return "video/mp4";
  }
  if (/\.wav(?:$|[?#])/i.test(normalized)) return "audio/wav";
  if (/\.m4a(?:$|[?#])/i.test(normalized)) return "audio/mp4";
  if (/\.aac(?:$|[?#])/i.test(normalized)) return "audio/aac";
  if (/\.flac(?:$|[?#])/i.test(normalized)) return "audio/flac";
  if (/\.(?:ogg|oga)(?:$|[?#])/i.test(normalized)) return "audio/ogg";
  if (/\.webm(?:$|[?#])/i.test(normalized)) return "audio/webm";
  return "audio/mpeg";
};

const replaceFileExtension = (filename: string | null, extension: string): string => {
  const safeFilename = filename?.trim() || "upload";
  const withoutExtension = safeFilename.replace(/\.[^/.]+$/, "");
  return `${withoutExtension || "upload"}.${extension}`;
};

const admitUploadBufferForProvider = async ({
  admissionProfile,
  fileBuffer,
  fileName,
  mimeType,
}: {
  admissionProfile: KieUploadAdmissionProfile | null;
  fileBuffer: Buffer;
  fileName: string | null;
  mimeType: string | null;
}): Promise<{
  fileBuffer: Buffer;
  fileName: string | null;
  mimeType: string | null;
}> => {
  if (!admissionProfile) {
    return {
      fileBuffer,
      fileName,
      mimeType,
    };
  }

  if (admissionProfile === "kie_motion_control_character_image") {
    const admitted = await admitKieMotionControlCharacterImage({
      buffer: fileBuffer,
      filename: fileName ?? "motion-control-character",
      mimeType: mimeType ?? "application/octet-stream",
    });
    return {
      fileBuffer: admitted.buffer,
      fileName:
        admitted.filename ||
        replaceFileExtension(fileName, admitted.mimeType === "image/png" ? "png" : "jpg"),
      mimeType: admitted.mimeType,
    };
  }

  if (admissionProfile === "kie_seedance_reference_image") {
    const admitted = await admitKieSeedanceReferenceImage({
      buffer: fileBuffer,
      filename: fileName ?? "seedance-reference-image",
      mimeType: mimeType ?? "application/octet-stream",
    });
    return {
      fileBuffer: admitted.buffer,
      fileName:
        admitted.filename ||
        replaceFileExtension(fileName, admitted.mimeType === "image/png" ? "png" : "jpg"),
      mimeType: admitted.mimeType,
    };
  }

  return {
    fileBuffer,
    fileName,
    mimeType,
  };
};

const readUploadPayload = (
  payload: unknown
): {
  uploadedUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  detail: string | null;
  providerFailureDetail: string | null;
} => {
  const responsePayload = payload as {
    url?: unknown;
    downloadUrl?: unknown;
    fileUrl?: unknown;
    msg?: unknown;
    message?: unknown;
    error?: unknown;
    success?: unknown;
    code?: unknown;
    data?: {
      url?: unknown;
      downloadUrl?: unknown;
      fileUrl?: unknown;
      fileName?: unknown;
      mimeType?: unknown;
    };
  };
  const providerCode =
    typeof responsePayload?.code === "string" || typeof responsePayload?.code === "number"
      ? String(responsePayload.code).trim().toLowerCase()
      : "";
  const providerCodeIndicatesFailure =
    providerCode.length > 0 &&
    providerCode !== "0" &&
    providerCode !== "200" &&
    !providerCode.includes("success") &&
    !providerCode.includes("ok");
  const providerDeclaredFailure =
    responsePayload?.success === false || providerCodeIndicatesFailure;
  const detail =
    asNonEmptyString(responsePayload?.msg) ??
    asNonEmptyString(responsePayload?.message) ??
    asNonEmptyString(responsePayload?.error);
  return {
    uploadedUrl:
      asNonEmptyString(responsePayload?.data?.downloadUrl) ??
      asNonEmptyString(responsePayload?.data?.fileUrl) ??
      asNonEmptyString(responsePayload?.data?.url) ??
      asNonEmptyString(responsePayload?.downloadUrl) ??
      asNonEmptyString(responsePayload?.fileUrl) ??
      asNonEmptyString(responsePayload?.url),
    fileName:
      asNonEmptyString(responsePayload?.data?.fileName) ??
      asNonEmptyString((responsePayload as { fileName?: unknown })?.fileName),
    mimeType:
      asNonEmptyString(responsePayload?.data?.mimeType) ??
      asNonEmptyString((responsePayload as { mimeType?: unknown })?.mimeType),
    detail,
    providerFailureDetail: providerDeclaredFailure ? (detail ?? "Provider upload failed.") : null,
  };
};

const shouldFallbackUrlUploadToRemoteStream = (result: UploadAttemptResult): boolean => {
  if (result.diagnostics.transport !== "url_upload") return false;
  if (result.parsed.providerFailureDetail) return false;
  if (!result.upstream.ok) return result.upstream.status !== 401;
  return result.parsed.uploadedUrl === null;
};

const attemptKieUploadWithFallback = async ({
  apiKey,
  sourceUrl,
  uploadPath,
  fileName,
  admissionProfile = null,
}: {
  apiKey: string;
  sourceUrl: URL;
  uploadPath: string;
  fileName: string | null;
  admissionProfile?: KieUploadAdmissionProfile | null;
}): Promise<{
  result: UploadAttemptResult;
  primaryResult: UploadAttemptResult;
  fallbackResult: UploadAttemptResult | null;
}> => {
  if (admissionProfile) {
    const result = await uploadFileStreamToKie({
      apiKey,
      sourceUrl,
      uploadPath,
      fileName,
      admissionProfile,
    });
    return {
      result,
      primaryResult: result,
      fallbackResult: null,
    };
  }

  const primaryResult = await uploadFileUrlToKie({
    apiKey,
    fileUrl: sourceUrl.toString(),
    uploadPath,
    fileName,
  });

  if (!shouldFallbackUrlUploadToRemoteStream(primaryResult)) {
    return {
      result: primaryResult,
      primaryResult,
      fallbackResult: null,
    };
  }

  const fallbackResult = await uploadFileStreamToKie({
    apiKey,
    sourceUrl,
    uploadPath,
    fileName,
  });

  if (fallbackResult.upstream.ok && fallbackResult.parsed.uploadedUrl) {
    return {
      result: fallbackResult,
      primaryResult,
      fallbackResult,
    };
  }

  return {
    result: primaryResult,
    primaryResult,
    fallbackResult,
  };
};

const buildKieUploadFallbackMetadata = ({
  primaryResult,
  fallbackResult,
}: {
  primaryResult: UploadAttemptResult;
  fallbackResult: UploadAttemptResult | null;
}) =>
  fallbackResult
    ? {
        kie_upload_fallback_attempted: true,
        kie_upload_primary_transport: primaryResult.diagnostics.transport,
        kie_upload_primary_status: primaryResult.upstream.status,
        kie_upload_primary_has_uploaded_url: primaryResult.parsed.uploadedUrl !== null,
        kie_upload_fallback_transport: fallbackResult.diagnostics.transport,
        kie_upload_fallback_status: fallbackResult.upstream.status,
        kie_upload_fallback_has_uploaded_url: fallbackResult.parsed.uploadedUrl !== null,
      }
    : {
        kie_upload_fallback_attempted: false,
      };

const buildKieUploadDiagnosticsMetadata = ({
  upstreamStatus,
  diagnostics,
}: {
  upstreamStatus: number;
  diagnostics: UploadDiagnostics;
}): KieUploadDiagnosticsMetadata => ({
  kie_upload_transport: diagnostics.transport,
  kie_upstream_status: upstreamStatus,
  kie_upstream_content_type: diagnostics.contentType,
  kie_upstream_body_format: diagnostics.bodyFormat,
  kie_upstream_body_length: diagnostics.bodyLength,
  kie_upstream_parse_source: diagnostics.parseSource,
  kie_upstream_json_parsed: diagnostics.jsonParsed,
  kie_upstream_top_level_keys: diagnostics.topLevelKeys,
  kie_upstream_data_keys: diagnostics.dataKeys,
  kie_upstream_has_message: diagnostics.hasMessage,
  kie_upstream_has_data: diagnostics.hasData,
  kie_upstream_has_download_url: diagnostics.hasDownloadUrl,
  kie_upstream_has_file_url: diagnostics.hasFileUrl,
  kie_upstream_has_file_name: diagnostics.hasFileName,
  kie_upstream_has_mime_type: diagnostics.hasMimeType,
});

const responseHeaderValue = (headers: Response["headers"], name: string): string | null => {
  if (!headers || typeof headers.get !== "function") return null;
  return asNonEmptyString(headers.get(name));
};

const objectKeys = (value: unknown): string[] => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.keys(value as Record<string, unknown>).slice(0, 10);
};

const classifyRawBody = (
  rawText: string | null,
  jsonParsed: boolean
): UploadDiagnostics["bodyFormat"] => {
  if (rawText === null) {
    return jsonParsed ? "json_like" : "unavailable";
  }

  const trimmed = rawText.trim();
  if (!trimmed) return "empty";
  if (jsonParsed) return "json_like";
  if (trimmed.startsWith("<")) return "html_like";
  return "text_like";
};

const readUploadResponse = async ({
  upstream,
  transport,
}: {
  upstream: Response;
  transport: UploadTransport;
}) => {
  let payload: unknown = {};
  let rawText: string | null = null;
  let parseSource: UploadDiagnostics["parseSource"] = "none";
  let jsonParsed = false;

  if (typeof upstream.text === "function") {
    parseSource = "text";
    rawText = await upstream.text().catch(() => null);
    if (typeof rawText === "string" && rawText.trim().length > 0) {
      try {
        payload = JSON.parse(rawText);
        jsonParsed = true;
      } catch {
        payload = {};
      }
    }
  } else if (typeof upstream.json === "function") {
    parseSource = "json";
    try {
      payload = await upstream.json();
      jsonParsed = true;
    } catch {
      payload = {};
    }
  }

  const parsed = readUploadPayload(payload);
  const payloadObject =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as {
          msg?: unknown;
          data?: {
            downloadUrl?: unknown;
            fileUrl?: unknown;
            fileName?: unknown;
            mimeType?: unknown;
          };
        })
      : null;
  const dataPayload = payloadObject?.data;

  return {
    upstream,
    parsed,
    diagnostics: {
      transport,
      contentType: responseHeaderValue(upstream.headers, "content-type"),
      bodyFormat: classifyRawBody(rawText, jsonParsed),
      bodyLength: rawText === null ? null : rawText.length,
      parseSource,
      jsonParsed,
      topLevelKeys: objectKeys(payloadObject),
      dataKeys: objectKeys(dataPayload),
      hasMessage: asNonEmptyString(payloadObject?.msg) !== null,
      hasData: !!dataPayload && typeof dataPayload === "object" && !Array.isArray(dataPayload),
      hasDownloadUrl: asNonEmptyString(dataPayload?.downloadUrl) !== null,
      hasFileUrl: asNonEmptyString(dataPayload?.fileUrl) !== null,
      hasFileName: asNonEmptyString(dataPayload?.fileName) !== null,
      hasMimeType: asNonEmptyString(dataPayload?.mimeType) !== null,
    },
  };
};

const resolveUpstreamFailureDetail = ({
  status,
  detail,
  diagnostics,
}: {
  status: number;
  detail: string | null;
  diagnostics: UploadDiagnostics;
}): string => {
  if (detail) return detail;
  const responseShape =
    diagnostics.bodyFormat === "html_like"
      ? "an HTML"
      : diagnostics.bodyFormat === "text_like"
        ? "a plain-text"
        : diagnostics.bodyFormat === "empty"
          ? "an empty"
          : diagnostics.bodyFormat === "json_like"
            ? "a JSON"
            : "an unreadable";
  return `Upstream upload failed with status ${status} and returned ${responseShape} response.`;
};

const uploadFileUrlToKie = async ({
  apiKey,
  fileUrl,
  uploadPath,
  fileName,
}: {
  apiKey: string;
  fileUrl: string;
  uploadPath: string;
  fileName: string | null;
}) => {
  const upstream = await fetch(KIE_FILE_URL_UPLOAD_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileUrl,
      uploadPath,
      ...(fileName ? { fileName } : {}),
    }),
  });

  return await readUploadResponse({
    upstream,
    transport: "url_upload",
  });
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
      throw new KieUploadRequestError("Source URL redirected without a Location header.");
    }
    try {
      currentUrl = await parseSafeHttpUrl(new URL(location, currentUrl).toString());
    } catch (error) {
      if (error instanceof KieUploadRequestError) throw error;
      throw new KieUploadRequestError("Source URL redirected to an invalid URL.");
    }
  }

  throw new KieUploadRequestError("Source URL redirected too many times.");
};

const readResponseBodyWithLimit = async (
  response: Response | Blob,
  maxBytes: number
): Promise<Buffer> => {
  const rawContentLength = "headers" in response ? response.headers.get("content-length") : null;
  const contentLength = Number(rawContentLength);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new KieUploadRequestError("Source file exceeds the maximum upload size.", 413);
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > maxBytes) {
    throw new KieUploadRequestError("Source file exceeds the maximum upload size.", 413);
  }
  return Buffer.from(arrayBuffer);
};

const uploadFileStreamToKie = async ({
  apiKey,
  sourceUrl,
  uploadPath,
  fileName,
  admissionProfile = null,
}: {
  apiKey: string;
  sourceUrl: URL;
  uploadPath: string;
  fileName: string | null;
  admissionProfile?: KieUploadAdmissionProfile | null;
}) => {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), SOURCE_FETCH_TIMEOUT_MS);
  try {
    const sourceResponse = await fetchPublicSource(sourceUrl, controller.signal);
    if (!sourceResponse.ok) {
      throw new KieUploadRequestError(`Source fetch failed (${sourceResponse.status}).`);
    }

    const sourceBuffer = await readResponseBodyWithLimit(sourceResponse, MAX_REMOTE_SOURCE_BYTES);
    const sourceMimeType = asNonEmptyString(sourceResponse.headers.get("content-type"));
    const admittedSource = await admitUploadBufferForProvider({
      admissionProfile,
      fileBuffer: sourceBuffer,
      fileName: fileName ?? inferFileNameFromUrl(sourceUrl),
      mimeType: sourceMimeType,
    });
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([admittedSource.fileBuffer], {
        type: admittedSource.mimeType ?? "application/octet-stream",
      }),
      admittedSource.fileName ?? "upload"
    );
    formData.append("uploadPath", uploadPath);
    if (admittedSource.fileName) {
      formData.append("fileName", admittedSource.fileName);
    }

    const upstream = await fetch(KIE_FILE_STREAM_UPLOAD_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    return await readUploadResponse({
      upstream,
      transport: "remote_stream_upload",
    });
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
};

const uploadFileBufferToKie = async ({
  apiKey,
  fileBuffer,
  uploadPath,
  fileName,
  mimeType,
}: {
  apiKey: string;
  fileBuffer: Buffer;
  uploadPath: string;
  fileName: string | null;
  mimeType: string | null;
}) => {
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([fileBuffer], {
      type: mimeType ?? "application/octet-stream",
    }),
    fileName ?? "upload"
  );
  formData.append("uploadPath", uploadPath);
  if (fileName) {
    formData.append("fileName", fileName);
  }

  const upstream = await fetch(KIE_FILE_STREAM_UPLOAD_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  return await readUploadResponse({
    upstream,
    transport: "binary_stream_upload",
  });
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
      label: "Kie upload storage path",
    });
  } catch (error) {
    throw new KieUploadRequestError(
      error instanceof Error ? error.message : "Kie upload storage path is invalid."
    );
  }

  const { data, error } = await getSupabaseAdmin()
    .storage.from(MEDIA_LIBRARY_BUCKET)
    .download(safeStoragePath);
  if (error || !data) {
    throw new KieUploadRequestError(
      error?.message
        ? `Storage source fetch failed: ${error.message}`
        : "Storage source not found.",
      400
    );
  }
  const size = typeof data.size === "number" ? data.size : null;
  if (size !== null && size > MAX_RAW_UPLOAD_BYTES) {
    throw new KieUploadRequestError("Source file exceeds the maximum upload size.", 413);
  }
  return data;
};

const uploadStorageSourceToKie = async ({
  apiKey,
  storagePath,
  uploadPath,
  fileName,
  mediaKind,
  userId,
  admissionProfile = null,
}: {
  apiKey: string;
  storagePath: string;
  uploadPath: string;
  fileName: string | null;
  mediaKind: KieUploadMediaKind;
  userId: string;
  admissionProfile?: KieUploadAdmissionProfile | null;
}): Promise<UploadAttemptResult> => {
  assertAdmissionProfileAllowed({ admissionProfile, mediaKind, uploadPath });
  const storageObject = await downloadStorageObjectWithLimit({ storagePath, userId });
  const storageBuffer = await readResponseBodyWithLimit(storageObject, MAX_RAW_UPLOAD_BYTES);
  const storageMimeType =
    asNonEmptyString((storageObject as { type?: unknown }).type) ??
    inferMimeTypeFromPath(fileName ?? storagePath, mediaKind);
  const admittedSource = await admitUploadBufferForProvider({
    admissionProfile,
    fileBuffer: storageBuffer,
    fileName: fileName ?? inferFileNameFromStoragePath(storagePath),
    mimeType: storageMimeType,
  });
  return await uploadFileBufferToKie({
    apiKey,
    fileBuffer: admittedSource.fileBuffer,
    uploadPath,
    fileName: admittedSource.fileName,
    mimeType: admittedSource.mimeType,
  });
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
      if (totalBytes > MAX_RAW_UPLOAD_BYTES) {
        if (typeof req.destroy === "function") req.destroy();
        fail(new KieUploadRequestError("Upload body exceeds the maximum upload size.", 413));
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

const KIE_UPLOAD_URL_RATE_LIMIT = {
  keyPrefix: "kie-upload-url",
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
      routeLabel: "kie-upload-url.auth",
      scope: "generation",
    });
    return res.status(500).json({
      error: "Kie upload failed",
    });
  }
  if (!user) return;
  const userId = user.id;
  if (
    !enforceApiRateLimit(req, res, {
      ...KIE_UPLOAD_URL_RATE_LIMIT,
      keyPrefix: `${KIE_UPLOAD_URL_RATE_LIMIT.keyPrefix}:${userId}`,
    })
  ) {
    return;
  }

  try {
    const apiKey = readProviderApiKey("kie");
    const bodyBuffer = await readRawRequestBody(req);
    const { result, primaryResult, fallbackResult } = isJsonRequest(req)
      ? await (async () => {
          const payload = JSON.parse(bodyBuffer.toString("utf8")) as Record<string, unknown>;
          const fileUrl = asNonEmptyString(payload.fileUrl);
          const storagePath = asNonEmptyString(payload.storagePath);
          const uploadPath = asNonEmptyString(payload.uploadPath);
          const fileName = asNonEmptyString(payload.fileName);
          const mediaKind = resolveMediaKind(payload.mediaKind);
          const admissionProfile = resolveAdmissionProfile(payload.admissionProfile);
          if (!uploadPath) {
            throw new KieUploadRequestError("uploadPath is required.");
          }
          if (storagePath) {
            if (!mediaKind) {
              throw new KieUploadRequestError(
                "mediaKind must be 'image', 'video', or 'audio' when storagePath is provided."
              );
            }
            const storageResult = await uploadStorageSourceToKie({
              apiKey,
              storagePath,
              uploadPath,
              fileName,
              mediaKind,
              userId,
              admissionProfile,
            });
            return {
              result: storageResult,
              primaryResult: storageResult,
              fallbackResult: null,
            };
          }
          if (!fileUrl) {
            throw new KieUploadRequestError("fileUrl or storagePath is required.");
          }
          if (admissionProfile) {
            assertAdmissionProfileAllowed({ admissionProfile, mediaKind: "image", uploadPath });
          }
          const sourceUrl = await parseSafeHttpUrl(fileUrl);
          return await attemptKieUploadWithFallback({
            apiKey,
            sourceUrl,
            uploadPath,
            fileName,
            admissionProfile,
          });
        })()
      : await (async () => {
          const uploadPath = asNonEmptyString(req.headers["x-shortpulse-upload-path"]);
          const fileName = asNonEmptyString(req.headers["x-shortpulse-upload-filename"]);
          const mimeType = asNonEmptyString(req.headers["content-type"]);
          const admissionProfile = resolveAdmissionProfile(
            req.headers["x-shortpulse-admission-profile"]
          );
          if (!uploadPath) {
            throw new KieUploadRequestError("uploadPath is required for binary uploads.");
          }
          if (!bodyBuffer.length) {
            throw new KieUploadRequestError("Binary upload body is empty.");
          }
          if (admissionProfile) {
            assertAdmissionProfileAllowed({ admissionProfile, mediaKind: "image", uploadPath });
          }
          const admittedSource = await admitUploadBufferForProvider({
            admissionProfile,
            fileBuffer: bodyBuffer,
            fileName,
            mimeType,
          });
          return await uploadFileBufferToKie({
            apiKey,
            fileBuffer: admittedSource.fileBuffer,
            uploadPath,
            fileName: admittedSource.fileName,
            mimeType: admittedSource.mimeType,
          });
        })().then((uploadResult) => ({
          result: uploadResult,
          primaryResult: uploadResult,
          fallbackResult: null,
        }));

    if (!result.upstream.ok) {
      await logApiRouteException({
        req,
        error: new Error(`Kie upload upstream failed with status ${result.upstream.status}`),
        routeLabel: "kie-upload-url",
        user,
        metadata: {
          kie_upload_failure: "upstream_non_ok",
          ...buildKieUploadFallbackMetadata({
            primaryResult,
            fallbackResult,
          }),
          ...buildKieUploadDiagnosticsMetadata({
            upstreamStatus: result.upstream.status,
            diagnostics: result.diagnostics,
          }),
        },
      });
      return res.status(result.upstream.status).json({
        error: "Kie upload failed",
        details: resolveUpstreamFailureDetail({
          status: result.upstream.status,
          detail: result.parsed.detail,
          diagnostics: result.diagnostics,
        }),
      });
    }

    if (result.parsed.providerFailureDetail) {
      await logApiRouteException({
        req,
        error: new Error("Kie upload upstream reported provider failure"),
        routeLabel: "kie-upload-url",
        user,
        metadata: {
          kie_upload_failure: "upstream_provider_failure",
          ...buildKieUploadFallbackMetadata({
            primaryResult,
            fallbackResult,
          }),
          ...buildKieUploadDiagnosticsMetadata({
            upstreamStatus: result.upstream.status,
            diagnostics: result.diagnostics,
          }),
        },
      });
      return res.status(502).json({
        error: "Kie upload failed",
        details: result.parsed.providerFailureDetail,
      });
    }

    const uploadedUrl = result.parsed.uploadedUrl;
    if (!uploadedUrl) {
      await logApiRouteException({
        req,
        error: new Error("Kie upload succeeded without returned file URL"),
        routeLabel: "kie-upload-url",
        user,
        metadata: {
          kie_upload_failure: "missing_uploaded_url",
          ...buildKieUploadFallbackMetadata({
            primaryResult,
            fallbackResult,
          }),
          ...buildKieUploadDiagnosticsMetadata({
            upstreamStatus: result.upstream.status,
            diagnostics: result.diagnostics,
          }),
        },
      });
      return res.status(502).json({
        error: "Kie upload failed",
        details: "Upload succeeded but returned no file URL.",
      });
    }

    return res.status(200).json({
      url: uploadedUrl,
      fileName: result.parsed.fileName,
      mimeType: result.parsed.mimeType,
    });
  } catch (error) {
    if (
      error instanceof KieMotionControlMediaAdmissionError ||
      error instanceof KieSeedanceImageAdmissionError
    ) {
      return res.status(error.statusCode).json({
        error: "Invalid upload request",
        details: error.details,
      });
    }
    if (error instanceof KieUploadRequestError) {
      return res.status(error.statusCode).json({
        error: "Invalid upload request",
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
      routeLabel: "kie-upload-url",
      user,
    });
    return res.status(500).json({
      error: "Kie upload failed",
    });
  }
}
