import { Buffer } from "node:buffer";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
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

const prefersStreamUpload = (sourceUrl: URL): boolean => {
  const pathname = sourceUrl.pathname.toLowerCase();
  if (pathname.includes("/storage/v1/object/sign/")) return true;

  const signedQueryKeys = ["token", "x-amz-signature", "x-amz-security-token", "signature", "sig"];
  return signedQueryKeys.some((key) => sourceUrl.searchParams.has(key));
};

const readUploadPayload = (
  payload: unknown
): {
  uploadedUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  detail: string | null;
} => {
  const responsePayload = payload as {
    msg?: unknown;
    data?: {
      downloadUrl?: unknown;
      fileUrl?: unknown;
      fileName?: unknown;
      mimeType?: unknown;
    };
  };
  return {
    uploadedUrl:
      asNonEmptyString(responsePayload?.data?.downloadUrl) ??
      asNonEmptyString(responsePayload?.data?.fileUrl),
    fileName: asNonEmptyString(responsePayload?.data?.fileName),
    mimeType: asNonEmptyString(responsePayload?.data?.mimeType),
    detail: asNonEmptyString(responsePayload?.msg),
  };
};

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

const readResponseBodyWithLimit = async (response: Response, maxBytes: number): Promise<Buffer> => {
  const contentLength = Number(response.headers.get("content-length"));
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
}: {
  apiKey: string;
  sourceUrl: URL;
  uploadPath: string;
  fileName: string | null;
}) => {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), SOURCE_FETCH_TIMEOUT_MS);
  try {
    const sourceResponse = await fetchPublicSource(sourceUrl, controller.signal);
    if (!sourceResponse.ok) {
      throw new Error(`Source fetch failed (${sourceResponse.status}).`);
    }

    const sourceBuffer = await readResponseBodyWithLimit(sourceResponse, MAX_REMOTE_SOURCE_BYTES);
    const sourceMimeType = asNonEmptyString(sourceResponse.headers.get("content-type"));
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([sourceBuffer], {
        type: sourceMimeType ?? "application/octet-stream",
      }),
      fileName ?? inferFileNameFromUrl(sourceUrl) ?? "upload"
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  try {
    const apiKey = readProviderApiKey("kie");
    const bodyBuffer = await readRawRequestBody(req);
    const result = isJsonRequest(req)
      ? await (async () => {
          const payload = JSON.parse(bodyBuffer.toString("utf8")) as Record<string, unknown>;
          const fileUrl = asNonEmptyString(payload.fileUrl);
          const uploadPath = asNonEmptyString(payload.uploadPath);
          const fileName = asNonEmptyString(payload.fileName);
          if (!fileUrl || !uploadPath) {
            throw new KieUploadRequestError("fileUrl and uploadPath are required.");
          }
          const sourceUrl = await parseSafeHttpUrl(fileUrl);
          return prefersStreamUpload(sourceUrl)
            ? await uploadFileStreamToKie({
                apiKey,
                sourceUrl,
                uploadPath,
                fileName,
              })
            : await uploadFileUrlToKie({
                apiKey,
                fileUrl: sourceUrl.toString(),
                uploadPath,
                fileName,
              });
        })()
      : await (async () => {
          const uploadPath = asNonEmptyString(req.headers["x-shortpulse-upload-path"]);
          const fileName = asNonEmptyString(req.headers["x-shortpulse-upload-filename"]);
          const mimeType = asNonEmptyString(req.headers["content-type"]);
          if (!uploadPath) {
            throw new KieUploadRequestError("uploadPath is required for binary uploads.");
          }
          if (!bodyBuffer.length) {
            throw new KieUploadRequestError("Binary upload body is empty.");
          }
          return await uploadFileBufferToKie({
            apiKey,
            fileBuffer: bodyBuffer,
            uploadPath,
            fileName,
            mimeType,
          });
        })();

    if (!result.upstream.ok) {
      return res.status(result.upstream.status).json({
        error: "Kie upload failed",
        details: result.parsed.detail ?? "Unknown upstream error",
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
          kie_upload_transport: result.diagnostics.transport,
          kie_upstream_status: result.upstream.status,
          kie_upstream_content_type: result.diagnostics.contentType,
          kie_upstream_body_format: result.diagnostics.bodyFormat,
          kie_upstream_body_length: result.diagnostics.bodyLength,
          kie_upstream_parse_source: result.diagnostics.parseSource,
          kie_upstream_json_parsed: result.diagnostics.jsonParsed,
          kie_upstream_top_level_keys: result.diagnostics.topLevelKeys,
          kie_upstream_data_keys: result.diagnostics.dataKeys,
          kie_upstream_has_message: result.diagnostics.hasMessage,
          kie_upstream_has_data: result.diagnostics.hasData,
          kie_upstream_has_download_url: result.diagnostics.hasDownloadUrl,
          kie_upstream_has_file_url: result.diagnostics.hasFileUrl,
          kie_upstream_has_file_name: result.diagnostics.hasFileName,
          kie_upstream_has_mime_type: result.diagnostics.hasMimeType,
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
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
