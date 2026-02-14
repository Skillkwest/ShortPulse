/**
 * Creates a Stripe billing portal session for the authenticated user.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";
import { getCanonicalAppBaseUrl, stripePostForm } from "../../../../lib/server/api/stripe";

type StripePortalSession = { id: string; url: string };

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

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("billing_profiles")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      return res.status(500).json({ error: profileError.message });
    }
    if (!profile?.stripe_customer_id) {
      return res.status(404).json({ error: "No Stripe customer is linked to this user." });
    }

    const session = await stripePostForm<StripePortalSession>("/billing_portal/sessions", {
      customer: profile.stripe_customer_id,
      return_url: `${getCanonicalAppBaseUrl()}/profile?section=billing`,
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
      error: error instanceof Error ? error.message : "Unable to create billing portal session.",
    });
  }
}
