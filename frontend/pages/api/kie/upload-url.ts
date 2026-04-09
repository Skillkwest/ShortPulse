import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { readProviderApiKey } from "../../../lib/server/providerIntegration/providerRuntimeConfig";

const KIE_FILE_URL_UPLOAD_ENDPOINT =
  process.env.SHORTPULSE_KIE_FILE_URL_UPLOAD_URL?.trim() ||
  "https://kieai.redpandaai.co/api/file-url-upload";

type SuccessResponse = {
  url: string;
  fileName: string | null;
  mimeType: string | null;
};

type ErrorResponse = {
  error: string;
  details?: string;
};

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
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

    const responsePayload = (await upstream.json().catch(() => ({}))) as {
      msg?: unknown;
      data?: {
        downloadUrl?: unknown;
        fileUrl?: unknown;
        fileName?: unknown;
        mimeType?: unknown;
      };
    };

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: "Kie URL upload failed",
        details: asNonEmptyString(responsePayload.msg) ?? "Unknown upstream error",
      });
    }

    const uploadedUrl =
      asNonEmptyString(responsePayload.data?.downloadUrl) ??
      asNonEmptyString(responsePayload.data?.fileUrl);
    if (!uploadedUrl) {
      return res.status(502).json({
        error: "Kie URL upload failed",
        details: "Upload succeeded but returned no file URL.",
      });
    }

    return res.status(200).json({
      url: uploadedUrl,
      fileName: asNonEmptyString(responsePayload.data?.fileName),
      mimeType: asNonEmptyString(responsePayload.data?.mimeType),
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "kie-upload-url",
      user,
    });
    return res.status(500).json({
      error: "Kie URL upload failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
