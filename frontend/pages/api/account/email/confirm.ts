import type { NextApiRequest, NextApiResponse } from "next";
import { resolveAuthDisplayName } from "../../../../lib/server/api/accountIdentity";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { requireApiUser } from "../../../../lib/server/api/auth";
import { syncStripeCustomerForUser } from "../../../../lib/server/api/stripeCustomer";

type ConfirmEmailResponse = {
  email: string | null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ error: string } | ConfirmEmailResponse>
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
      routeLabel: "account/email/confirm.auth",
    });
    return res.status(500).json({ error: "Unable to finish syncing your confirmed email." });
  }
  if (!user) return;

  try {
    await syncStripeCustomerForUser({
      userId: user.id,
      email: user.email ?? null,
      displayName: resolveAuthDisplayName(user),
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "account/email/confirm.stripe-sync",
      user,
    });
  }

  return res.status(200).json({ email: user.email ?? null });
}
