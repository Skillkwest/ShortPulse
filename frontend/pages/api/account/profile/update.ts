import type { NextApiRequest, NextApiResponse } from "next";
import {
  normalizeDisplayNameInput,
  updateSupabaseAuthUser,
} from "../../../../lib/server/api/accountIdentity";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { requireApiUser } from "../../../../lib/server/api/auth";
import { enforceApiRateLimit } from "../../../../lib/server/api/rateLimit";
import { syncStripeCustomerForUser } from "../../../../lib/server/api/stripeCustomer";

type ProfileUpdateResponse = {
  displayName: string;
};

type ProfileUpdateBody = {
  displayName?: unknown;
};

const ACCOUNT_PROFILE_UPDATE_RATE_LIMIT = {
  keyPrefix: "account-profile-update",
  maxRequests: 10,
  windowMs: 10 * 60 * 1000,
} as const;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ error: string } | ProfileUpdateResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;
  if (
    !enforceApiRateLimit(req, res, {
      ...ACCOUNT_PROFILE_UPDATE_RATE_LIMIT,
      keyPrefix: `${ACCOUNT_PROFILE_UPDATE_RATE_LIMIT.keyPrefix}:${user.id}`,
    })
  ) {
    return;
  }

  const displayName = normalizeDisplayNameInput(
    (req.body as ProfileUpdateBody | null)?.displayName
  );
  if (!displayName) {
    return res.status(400).json({ error: "Display name is required." });
  }

  try {
    const nextUserMetadata = {
      ...(user.user_metadata ?? {}),
      full_name: displayName,
      display_name: displayName,
    };

    await updateSupabaseAuthUser({
      req,
      payload: {
        data: nextUserMetadata,
      },
    });

    try {
      await syncStripeCustomerForUser({
        userId: user.id,
        email: user.email ?? null,
        displayName,
      });
    } catch (syncError) {
      await logApiRouteException({
        req,
        error: syncError,
        routeLabel: "account/profile/update.stripe-sync",
        user,
      });
    }

    return res.status(200).json({ displayName });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "account/profile/update",
      user,
    });
    return res.status(500).json({
      error: "Unable to update your profile.",
    });
  }
}
