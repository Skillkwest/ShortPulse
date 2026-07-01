import type { NextApiRequest, NextApiResponse } from "next";
import { buildAuthCallbackPath } from "../../../../lib/authRedirects";
import {
  isValidEmailAddress,
  normalizeEmailInput,
  updateSupabaseAuthUser,
} from "../../../../lib/server/api/accountIdentity";
import { resolveEmailChangeErrorMessage } from "../../../../lib/authErrorMessages";
import { resolvePublicAppOrigin } from "../../../../lib/server/api/appOrigin";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { requireApiUser } from "../../../../lib/server/api/auth";
import { enforceApiRateLimit } from "../../../../lib/server/api/rateLimit";

type EmailUpdateBody = {
  email?: unknown;
};

type EmailUpdateResponse = {
  email: string;
  confirmationRequired: true;
};

const ACCOUNT_EMAIL_UPDATE_RATE_LIMIT = {
  keyPrefix: "account-email-update",
  maxRequests: 5,
  windowMs: 15 * 60 * 1000,
} as const;

const resolveSafeEmailUpdateErrorMessage = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return "Unable to update your email.";
  }
  const rawMessage = error.message.trim();
  const normalized = resolveEmailChangeErrorMessage(error, "Unable to update your email.");
  if (!rawMessage || normalized === rawMessage) {
    return "Unable to update your email.";
  }
  return normalized;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ error: string } | EmailUpdateResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let user;
  try {
    user = await requireApiUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "account/email/update.auth",
    });
    return res.status(500).json({
      error: "Unable to update your email.",
    });
  }
  if (!user) return;
  if (
    !enforceApiRateLimit(req, res, {
      ...ACCOUNT_EMAIL_UPDATE_RATE_LIMIT,
      keyPrefix: `${ACCOUNT_EMAIL_UPDATE_RATE_LIMIT.keyPrefix}:${user.id}`,
    })
  ) {
    return;
  }

  const body = ((req.body as EmailUpdateBody | null) ?? {}) as EmailUpdateBody;
  const email = normalizeEmailInput(body.email);
  if (!email || !isValidEmailAddress(email)) {
    return res.status(400).json({ error: "Enter a valid email." });
  }
  try {
    const requestOrigin = resolvePublicAppOrigin(req);
    if (!requestOrigin) {
      throw new Error("Unable to resolve app origin.");
    }
    await updateSupabaseAuthUser({
      req,
      payload: { email },
      emailRedirectTo: `${requestOrigin}${buildAuthCallbackPath({
        flow: "email-change",
        nextPath: "/profile?section=account",
      })}`,
    });

    return res.status(200).json({ email, confirmationRequired: true });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "account/email/update",
      user,
    });
    return res.status(500).json({
      error: resolveSafeEmailUpdateErrorMessage(error),
    });
  }
}
