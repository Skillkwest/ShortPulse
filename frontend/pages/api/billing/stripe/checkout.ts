/**
 * Creates a Stripe Checkout session for one-time credit package purchases.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../../lib/server/api/auth";
import { logApiRouteException, writeAppErrorLog } from "../../../../lib/server/api/appErrorLogs";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";
import { getCanonicalAppBaseUrl, stripePostForm } from "../../../../lib/server/api/stripe";
import { ensureStripeCustomerForUser } from "../../../../lib/server/api/stripeCustomer";

type CheckoutRequest = {
  packageId?: string;
};

type StripeCheckoutResponse = { id: string; url?: string | null };

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

  const { packageId } = (req.body ?? {}) as CheckoutRequest;
  if (!packageId) {
    return res.status(400).json({ error: "packageId is required." });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { data: pkg, error: pkgError } = await supabaseAdmin
      .from("billing_credit_packages")
      .select("id, display_name, credit_amount_cents, stripe_price_id, is_active")
      .eq("id", packageId)
      .maybeSingle();

    if (pkgError || !pkg || !pkg.is_active) {
      return res.status(404).json({ error: "Credit package not found." });
    }
    if (!pkg.stripe_price_id) {
      return res
        .status(409)
        .json({ error: `Credit package '${pkg.id}' is missing a Stripe price id.` });
    }

    const stripeCustomerId = await ensureStripeCustomerForUser({
      userId: user.id,
      email: user.email ?? null,
    });

    const baseUrl = getCanonicalAppBaseUrl();
    const session = await stripePostForm<StripeCheckoutResponse>("/checkout/sessions", {
      mode: "payment",
      customer: stripeCustomerId,
      "line_items[0][price]": pkg.stripe_price_id,
      "line_items[0][quantity]": 1,
      success_url: `${baseUrl}/profile?section=billing&checkout=success`,
      cancel_url: `${baseUrl}/profile?section=billing&checkout=cancel`,
      client_reference_id: user.id,
      "metadata[user_id]": user.id,
      "metadata[credit_package_id]": pkg.id,
      "metadata[credit_amount_cents]": pkg.credit_amount_cents,
    });

    void writeAppErrorLog({
      source: "telemetry.billing.checkout_started",
      scope: "app",
      severity: "low",
      message: "checkout_started",
      userId: user.id,
      userEmail: user.email ?? null,
      metadata: {
        telemetry_family: "billing_funnel",
        telemetry_version: 1,
        event_name: "checkout_started",
        package_id: pkg.id,
        stripe_price_id: pkg.stripe_price_id,
        credit_amount_cents: pkg.credit_amount_cents,
        stripe_customer_id: stripeCustomerId,
        checkout_session_id: session.id,
      },
    }).catch(() => {});

    return res.status(200).json({
      sessionId: session.id,
      checkoutUrl: session.url ?? null,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "billing/stripe/checkout",
      user,
      metadata: { package_id: packageId },
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to create checkout session.",
    });
  }
}
