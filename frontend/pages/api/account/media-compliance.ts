/**
 * Authenticated media-compliance status route.
 * Returns or records the caller's acceptance of the current versioned media agreement.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import {
  MEDIA_COMPLIANCE_AGREEMENT,
  type MediaComplianceStatusResponse,
} from "../../../lib/compliance/mediaAgreement";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { requireApiUser } from "../../../lib/server/api/auth";
import {
  getMediaComplianceAcceptanceStatusForUser,
  isMediaComplianceUnavailableError,
  saveMediaComplianceAcceptanceForUser,
} from "../../../lib/server/api/mediaComplianceAcceptance";

type MediaComplianceErrorResponse = {
  error: string;
  code?: string;
};

const buildStatusResponse = ({
  accepted,
  acceptedAt,
}: {
  accepted: boolean;
  acceptedAt: string | null;
}): MediaComplianceStatusResponse => ({
  agreement: MEDIA_COMPLIANCE_AGREEMENT,
  accepted,
  acceptedAt,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MediaComplianceStatusResponse | MediaComplianceErrorResponse>
) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let user: Awaited<ReturnType<typeof requireApiUser>>;
  try {
    user = await requireApiUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "account/media-compliance.auth",
      scope: "app",
    });
    return res.status(500).json({
      error: "Unable to process the media agreement request.",
      code: "MEDIA_COMPLIANCE_REQUEST_FAILED",
    });
  }
  if (!user) {
    if (res.statusCode === 503) {
      await logApiRouteException({
        req,
        error: Object.assign(new Error("Authentication verification is temporarily unavailable."), {
          code: "AUTH_VERIFICATION_UNAVAILABLE",
        }),
        routeLabel: "account/media-compliance.auth",
        scope: "app",
        metadata: {
          reason_code: "AUTH_VERIFICATION_UNAVAILABLE",
        },
      });
    }
    return;
  }

  try {
    if (req.method === "GET") {
      const status = await getMediaComplianceAcceptanceStatusForUser(user.id);
      return res.status(200).json(buildStatusResponse(status));
    }

    const status = await saveMediaComplianceAcceptanceForUser({
      req,
      userId: user.id,
    });
    return res.status(200).json(buildStatusResponse(status));
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "account/media-compliance",
      user,
    });
    if (isMediaComplianceUnavailableError(error)) {
      return res.status(503).json({
        error: "Media agreement service is temporarily unavailable.",
        code: "MEDIA_COMPLIANCE_UNAVAILABLE",
      });
    }
    return res.status(500).json({
      error: "Unable to process the media agreement request.",
      code: "MEDIA_COMPLIANCE_REQUEST_FAILED",
    });
  }
}
