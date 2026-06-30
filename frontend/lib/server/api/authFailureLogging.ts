/**
 * Shared logging helpers for controlled API auth failures.
 * Keeps fail-closed route responses intact while making verifier outages visible.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { AUTH_VERIFICATION_UNAVAILABLE_CODE } from "./authTokenVerifier";
import { logApiRouteException } from "./appErrorLogs";

type LogAuthVerificationUnavailableArgs = {
  req: NextApiRequest;
  res: NextApiResponse;
  routeLabel: string;
  scope?: "app" | "generation";
  metadata?: Record<string, unknown>;
};

/**
 * Logs the controlled `requireApiUser` auth-verification outage response.
 * Returns true when it wrote an outage log for the caller's route.
 */
export const logAuthVerificationUnavailableResponse = async ({
  req,
  res,
  routeLabel,
  scope = "app",
  metadata = {},
}: LogAuthVerificationUnavailableArgs): Promise<boolean> => {
  if (res.statusCode !== 503) return false;

  await logApiRouteException({
    req,
    error: Object.assign(new Error("Authentication verification is temporarily unavailable."), {
      code: AUTH_VERIFICATION_UNAVAILABLE_CODE,
    }),
    routeLabel,
    scope,
    metadata: {
      reason_code: AUTH_VERIFICATION_UNAVAILABLE_CODE,
      ...metadata,
    },
  });
  return true;
};
