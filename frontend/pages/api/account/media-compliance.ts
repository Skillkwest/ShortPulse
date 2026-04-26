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
  saveMediaComplianceAcceptanceForUser,
} from "../../../lib/server/api/mediaComplianceAcceptance";

type MediaComplianceErrorResponse = {
  error: string;
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

  const user = await requireApiUser(req, res);
  if (!user) {
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
    return res.status(500).json({
      error:
        error instanceof Error ? error.message : "Unable to process the media agreement request.",
    });
  }
}
