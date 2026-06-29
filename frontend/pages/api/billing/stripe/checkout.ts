/**
 * Creates a Stripe Checkout session for one-time credit package purchases.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { resolveAuthDisplayName } from "../../../../lib/server/api/accountIdentity";
import { requireApiUser } from "../../../../lib/server/api/auth";
import { logApiRouteException, writeAppErrorLog } from "../../../../lib/server/api/appErrorLogs";
import {
  CREDIT_TOP_UP_REQUIRES_SUBSCRIPTION_MESSAGE,
  resolveCreditTopUpEligibilityForUser,
} from "../../../../lib/server/api/creditTopUpEligibility";
import { enforceApiRateLimit } from "../../../../lib/server/api/rateLimit";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";
import { getCanonicalAppBaseUrl, stripePostForm } from "../../../../lib/server/api/stripe";
import { ensureStripeCustomerForUser } from "../../../../lib/server/api/stripeCustomer";

type CheckoutRequest = {
  packageId?: string;
  returnPath?: string;
};

type StripeCheckoutResponse = { id: string; url?: string | null };

const BILLING_CHECKOUT_RATE_LIMIT = {
  keyPrefix: "billing-stripe-checkout",
  maxRequests: 5,
  windowMs: 10 * 60 * 1000,
} as const;
const CHECKOUT_UNAVAILABLE_MESSAGE = "Checkout is temporarily unavailable. Try again later.";
const CREDIT_PACKAGE_UNAVAILABLE_MESSAGE =
  "This credit package is temporarily unavailable. Try again later.";

const resolveCheckoutReturnUrls = (baseUrl: string, returnPath?: string) => {
  const defaultUrls = {
    successUrl: `${baseUrl}/profile?section=credits&checkout=success`,
    cancelUrl: `${baseUrl}/profile?section=credits&checkout=cancel`,
  };
  const candidate = returnPath?.trim();
  if (!candidate) return defaultUrls;
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return defaultUrls;
  }
  let parsed: URL;
  try {
    parsed = new URL(candidate, "https://shortpulse.local");
  } catch {
    return defaultUrls;
  }
  if (parsed.pathname !== "/ai-studio") return defaultUrls;
  parsed.searchParams.delete("checkout");
  parsed.searchParams.set("checkout", "credits_success");
  const successPath = `${parsed.pathname}${parsed.search}`;
  parsed.searchParams.set("checkout", "credits_cancel");
  const cancelPath = `${parsed.pathname}${parsed.search}`;
  return {
    successUrl: `${baseUrl}${successPath}`,
    cancelUrl: `${baseUrl}${cancelPath}`,
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(501).json({ error: CHECKOUT_UNAVAILABLE_MESSAGE });
  }

  let user;
  try {
    user = await requireApiUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "billing/stripe/checkout.auth",
    });
    return res.status(500).json({
      error: "Unable to create checkout session.",
    });
  }
  if (!user) {
    return;
  }
  if (
    !enforceApiRateLimit(req, res, {
      ...BILLING_CHECKOUT_RATE_LIMIT,
      keyPrefix: `${BILLING_CHECKOUT_RATE_LIMIT.keyPrefix}:${user.id}`,
    })
  ) {
    return;
  }

  const { packageId, returnPath } = (req.body ?? {}) as CheckoutRequest;
  if (!packageId) {
    return res.status(400).json({ error: "packageId is required." });
  }

  try {
    const eligibility = await resolveCreditTopUpEligibilityForUser(user.id);
    if (!eligibility.eligible) {
      return res.status(403).json({ error: CREDIT_TOP_UP_REQUIRES_SUBSCRIPTION_MESSAGE });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { data: pkg, error: pkgError } = await supabaseAdmin
      .from("billing_credit_packages")
      .select("id, display_name, credit_amount_cents, price_cents, stripe_price_id, is_active")
      .eq("id", packageId)
      .maybeSingle();

    if (pkgError || !pkg || !pkg.is_active) {
      return res.status(404).json({ error: "Credit package not found." });
    }
    if (!pkg.stripe_price_id) {
      return res.status(409).json({ error: CREDIT_PACKAGE_UNAVAILABLE_MESSAGE });
    }

    const stripeCustomerId = await ensureStripeCustomerForUser({
      userId: user.id,
      email: user.email ?? null,
      displayName: resolveAuthDisplayName(user),
    });

    const baseUrl = getCanonicalAppBaseUrl();
    const { successUrl, cancelUrl } = resolveCheckoutReturnUrls(baseUrl, returnPath);
    const session = await stripePostForm<StripeCheckoutResponse>("/checkout/sessions", {
      mode: "payment",
      customer: stripeCustomerId,
      "line_items[0][price]": pkg.stripe_price_id,
      "line_items[0][quantity]": 1,
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: user.id,
      "metadata[user_id]": user.id,
      "metadata[credit_package_id]": pkg.id,
      "metadata[credit_amount_cents]": pkg.credit_amount_cents,
      "metadata[credit_package_display_name]": pkg.display_name,
      "metadata[credit_package_price_cents]": pkg.price_cents,
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
        return_path: returnPath ?? null,
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
      error: "Unable to create checkout session.",
    });
  }
}
