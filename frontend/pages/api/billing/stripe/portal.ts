/**
 * Creates a Stripe billing portal session for the authenticated user.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { resolveAuthDisplayName } from "../../../../lib/server/api/accountIdentity";
import { requireApiUser } from "../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { enforceApiRateLimit } from "../../../../lib/server/api/rateLimit";
import { getCanonicalAppBaseUrl, stripePostForm } from "../../../../lib/server/api/stripe";
import { ensureStripeCustomerForUser } from "../../../../lib/server/api/stripeCustomer";

type StripePortalSession = { id: string; url: string };

const BILLING_PORTAL_RATE_LIMIT = {
  keyPrefix: "billing-stripe-portal",
  maxRequests: 8,
  windowMs: 10 * 60 * 1000,
} as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(501).json({ error: "Stripe is not configured on the server yet." });
  }

  const user = await requireApiUser(req, res);
  if (!user) {
    return;
  }
  if (
    !enforceApiRateLimit(req, res, {
      ...BILLING_PORTAL_RATE_LIMIT,
      keyPrefix: `${BILLING_PORTAL_RATE_LIMIT.keyPrefix}:${user.id}`,
    })
  ) {
    return;
  }

  try {
    const stripeCustomerId = await ensureStripeCustomerForUser({
      userId: user.id,
      email: user.email ?? null,
      displayName: resolveAuthDisplayName(user),
    });

    const session = await stripePostForm<StripePortalSession>("/billing_portal/sessions", {
      customer: stripeCustomerId,
      return_url: `${getCanonicalAppBaseUrl()}/profile?section=credits`,
    });

    return res.status(200).json({ portalUrl: session.url });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "billing/stripe/portal",
      user,
    });
    return res.status(500).json({
      error: "Unable to create billing portal session.",
    });
  }
}
