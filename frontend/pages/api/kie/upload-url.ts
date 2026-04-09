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

type SuccessResponse = {
  url: string;
  fileName: string | null;
  mimeType: string | null;
};

type ErrorResponse = {
  error: string;
  details?: string;
};

class KieUploadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KieUploadRequestError";
  }
}

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const isPrivateIpv4Address = (hostname: string): boolean => {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const octets = match.slice(1).map((segment) => Number.parseInt(segment, 10));
  if (octets.some((octet) => !Number.isFinite(octet) || octet < 0 || octet > 255)) return false;
  const [first, second] = octets;
  if (first === 10) return true;
  if (first === 127) return true;
  if (first === 169 && second === 254) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  return false;
};

const isLocalOrPrivateHostname = (hostname: string): boolean => {
  const normalized = hostname.trim().toLowerCase();
  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd")
  ) {
    return true;
  }
  return isPrivateIpv4Address(normalized);
};

const parseSafeHttpUrl = (value: string): URL => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new KieUploadRequestError("fileUrl must be a valid http(s) URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new KieUploadRequestError("fileUrl must use http or https.");
  }
  if (isLocalOrPrivateHostname(parsed.hostname)) {
    throw new KieUploadRequestError("fileUrl cannot target a local or private-network host.");
  }
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

  const payload = await upstream.json().catch(() => ({}));
  const parsed = readUploadPayload(payload);
  return { upstream, parsed };
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
    const sourceResponse = await fetch(sourceUrl.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
    });
    if (!sourceResponse.ok) {
      throw new Error(`Source fetch failed (${sourceResponse.status}).`);
    }

    const arrayBuffer = await sourceResponse.arrayBuffer();
    const sourceMimeType = asNonEmptyString(sourceResponse.headers.get("content-type"));
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([arrayBuffer], {
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

    const payload = await upstream.json().catch(() => ({}));
    const parsed = readUploadPayload(payload);
    return { upstream, parsed };
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  const payload =
    typeof req.body === "object" && req.body ? (req.body as Record<string, unknown>) : {};
  const fileUrl = asNonEmptyString(payload.fileUrl);
  const uploadPath = asNonEmptyString(payload.uploadPath);
  const fileName = asNonEmptyString(payload.fileName);

  if (!fileUrl || !uploadPath) {
    return res.status(400).json({
      error: "Invalid upload request",
      details: "fileUrl and uploadPath are required.",
    });
  }

  try {
    const apiKey = readProviderApiKey("kie");
    const sourceUrl = parseSafeHttpUrl(fileUrl);

    const primaryResult = prefersStreamUpload(sourceUrl)
      ? await uploadFileStreamToKie({
          apiKey,
          sourceUrl,
          uploadPath,
          fileName,
        })
      : await uploadFileUrlToKie({
          apiKey,
          fileUrl,
          uploadPath,
          fileName,
        });

    const result =
      !prefersStreamUpload(sourceUrl) &&
      (primaryResult.upstream.status === 400 || primaryResult.upstream.status === 403)
        ? await uploadFileStreamToKie({
            apiKey,
            sourceUrl,
            uploadPath,
            fileName,
          })
        : primaryResult;

    if (!result.upstream.ok) {
      return res.status(result.upstream.status).json({
        error: "Kie upload failed",
        details: result.parsed.detail ?? "Unknown upstream error",
      });
    }

    const uploadedUrl = result.parsed.uploadedUrl;
    if (!uploadedUrl) {
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
      return res.status(400).json({
        error: "Invalid upload request",
        details: error.message,
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
