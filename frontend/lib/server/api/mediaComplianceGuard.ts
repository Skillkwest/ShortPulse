/**
 * Server-side media-compliance guard for effectful authenticated API routes.
 * Use after identity is verified and before routes create projects, media, or generations.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "./appErrorLogs";
import type { AuthenticatedApiUser } from "./auth";
import {
  getMediaComplianceAcceptanceStatusForUser,
  isMediaComplianceUnavailableError,
} from "./mediaComplianceAcceptance";

type RequireMediaComplianceAcceptedOptions = {
  req: NextApiRequest;
  res: NextApiResponse;
  user: AuthenticatedApiUser;
  routeLabel: string;
  scope?: "app" | "generation";
};

/**
 * Returns true only when the authenticated user has accepted the current media agreement.
 * Writes the fail-closed HTTP response when acceptance is missing or cannot be verified.
 */
export const requireMediaComplianceAccepted = async ({
  req,
  res,
  user,
  routeLabel,
  scope = "app",
}: RequireMediaComplianceAcceptedOptions): Promise<boolean> => {
  try {
    const status = await getMediaComplianceAcceptanceStatusForUser(user.id);
    if (status.accepted) {
      return true;
    }

    res.status(403).json({
      error: "Media agreement acceptance is required.",
      code: "MEDIA_COMPLIANCE_REQUIRED",
    });
    return false;
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: `${routeLabel}.media_compliance`,
      user,
      scope,
    });

    if (isMediaComplianceUnavailableError(error)) {
      res.status(503).json({
        error: "Media agreement service is temporarily unavailable.",
        code: "MEDIA_COMPLIANCE_UNAVAILABLE",
      });
      return false;
    }

    res.status(500).json({
      error: "Media agreement check failed.",
      code: "MEDIA_COMPLIANCE_CHECK_FAILED",
    });
    return false;
  }
};
