/**
 * Authenticated Fal CDN staging route for Fal-owned image/audio inputs.
 * Keeps auth, rate limits, request parsing, and response handling close to the
 * route while delegating provider-staging mechanics to `falCdnUpload`.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { requireMediaComplianceAccepted } from "../../../lib/server/api/mediaComplianceGuard";
import {
  FAL_CDN_UPLOAD_MAX_BYTES,
  FalUploadRequestError,
  isFalUploadJsonRequest,
  stageFalCdnBinaryUpload,
  stageFalCdnJsonUpload,
  type FalCdnUploadResponse,
} from "../../../lib/server/api/falCdnUpload";
import {
  readBinaryProviderRequestBody,
  ProviderUploadSafetyError,
} from "../../../lib/server/api/providerUploadSafety";
import { enforceApiRateLimit } from "../../../lib/server/api/rateLimit";
import { readProviderApiKey } from "../../../lib/server/providerIntegration/providerRuntimeConfig";

export const config = {
  api: {
    bodyParser: false,
  },
};

type ErrorResponse = {
  error: string;
  details?: string;
};

const FAL_UPLOAD_URL_RATE_LIMIT = {
  keyPrefix: "fal-upload-url",
  maxRequests: 12,
  windowMs: 10 * 60 * 1000,
} as const;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FalCdnUploadResponse | ErrorResponse>
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
  const hasAcceptedMediaAgreement = await requireMediaComplianceAccepted({
    req,
    res,
    user,
    routeLabel: "fal-upload-url",
    scope: "generation",
  });
  if (!hasAcceptedMediaAgreement) return;
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
    const bodyBuffer = await readBinaryProviderRequestBody(req, FAL_CDN_UPLOAD_MAX_BYTES);
    const result = isFalUploadJsonRequest(req)
      ? await stageFalCdnJsonUpload({ apiKey, bodyBuffer, userId })
      : await stageFalCdnBinaryUpload({ apiKey, bodyBuffer, headers: req.headers });

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof FalUploadRequestError || error instanceof ProviderUploadSafetyError) {
      return res.status(error.statusCode).json({
        error: "Fal upload failed",
        details: error.message,
      });
    }
    if (error instanceof SyntaxError && isFalUploadJsonRequest(req)) {
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
