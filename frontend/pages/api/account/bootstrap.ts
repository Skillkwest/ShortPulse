import type { NextApiRequest, NextApiResponse } from "next";
import { resolveAuthDisplayName } from "../../../lib/server/api/accountIdentity";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { requireApiUser } from "../../../lib/server/api/auth";
import { syncStripeCustomerForUser } from "../../../lib/server/api/stripeCustomer";

type AccountBootstrapResponse =
  | {
      ok: true;
      stripeCustomerId: string;
    }
  | {
      error: string;
    };

/**
 * Idempotently prepares account identity after signup.
 * This creates or syncs the Stripe customer mapping without granting paid entitlement.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AccountBootstrapResponse>
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
      routeLabel: "account/bootstrap.auth",
    });
    return res.status(500).json({ error: "Unable to finish setting up your account." });
  }
  if (!user) return;

  try {
    const result = await syncStripeCustomerForUser({
      userId: user.id,
      email: user.email ?? null,
      displayName: resolveAuthDisplayName(user),
    });
    return res.status(200).json({
      ok: true,
      stripeCustomerId: result.stripeCustomerId,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "account/bootstrap.stripe-sync",
      user,
    });
    return res.status(500).json({ error: "Unable to finish setting up your account." });
  }
}
