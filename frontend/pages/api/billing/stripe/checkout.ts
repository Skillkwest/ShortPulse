/**
 * Creates a Stripe Checkout session for one-time credit package purchases.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../_utils/auth";
import { logApiRouteException } from "../../_utils/appErrorLogs";
import { getSupabaseAdmin } from "../../_utils/supabaseAdmin";
import { stripePostForm } from "../../_utils/stripe";

type CheckoutRequest = {
  packageId?: string;
};

type StripeCustomerResponse = { id: string };
type StripeCheckoutResponse = { id: string; url?: string | null };

const resolveOrigin = (req: NextApiRequest): string => {
  const explicitOrigin = req.headers.origin;
  if (explicitOrigin) return explicitOrigin;
  const host = req.headers.host;
  if (host) return `https://${host}`;
  return "http://localhost:3000";
};

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
      return res.status(409).json({ error: `Credit package '${pkg.id}' is missing a Stripe price id.` });
    }

    const { data: profile } = await supabaseAdmin
      .from("billing_profiles")
      .select("stripe_customer_id, plan_id, subscription_status")
      .eq("user_id", user.id)
      .maybeSingle();

    let stripeCustomerId = profile?.stripe_customer_id ?? null;
    if (!stripeCustomerId) {
      const customer = await stripePostForm<StripeCustomerResponse>("/customers", {
        email: user.email ?? undefined,
        "metadata[user_id]": user.id,
      });
      stripeCustomerId = customer.id;

      await supabaseAdmin.from("billing_profiles").upsert(
        {
          user_id: user.id,
          plan_id: profile?.plan_id ?? "free",
          subscription_status: profile?.subscription_status ?? "inactive",
          stripe_customer_id: stripeCustomerId,
        },
        { onConflict: "user_id" },
      );
    }

    const origin = resolveOrigin(req);
    const session = await stripePostForm<StripeCheckoutResponse>("/checkout/sessions", {
      mode: "payment",
      customer: stripeCustomerId,
      "line_items[0][price]": pkg.stripe_price_id,
      "line_items[0][quantity]": 1,
      success_url: `${origin}/profile?section=billing&checkout=success`,
      cancel_url: `${origin}/profile?section=billing&checkout=cancel`,
      client_reference_id: user.id,
      "metadata[user_id]": user.id,
      "metadata[credit_package_id]": pkg.id,
      "metadata[credit_amount_cents]": pkg.credit_amount_cents,
    });

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
