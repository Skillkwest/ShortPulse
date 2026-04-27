import type { NextApiRequest, NextApiResponse } from "next";
import { isUniqueViolationError } from "../../../../../lib/server/api/billingContracts";
import { logApiRouteException } from "../../../../../lib/server/api/appErrorLogs";
import {
  buildCurrentCatalogOfferId,
  normalizeIdentifier,
  normalizeRequiredText,
  parseNonNegativeInteger,
} from "../../../../../lib/server/api/adminPricingCatalog";
import { requireAdminUser } from "../../../../../lib/server/api/auth";
import { getSupabaseAdmin } from "../../../../../lib/server/api/supabaseAdmin";
import { stripePostForm } from "../../../../../lib/server/api/stripe";

type CreatePlanRequest = {
  planId?: string;
  displayName?: string;
  recurringPriceCents?: number | string;
  monthlyCreditsCents?: number | string;
  storageLimitBytes?: number | string;
  sortOrder?: number | string;
};

type StripeProductResponse = {
  id: string;
};

type StripePriceResponse = {
  id: string;
};

const PLAN_ID_PATTERN = /^[a-z0-9_]+$/;

const archiveStripeArtifacts = async ({
  stripeProductId,
  stripePriceId,
}: {
  stripeProductId: string | null;
  stripePriceId: string | null;
}) => {
  if (stripePriceId) {
    await stripePostForm(`/prices/${stripePriceId}`, {
      active: false,
    }).catch(() => undefined);
  }
  if (stripeProductId) {
    await stripePostForm(`/products/${stripeProductId}`, {
      active: false,
    }).catch(() => undefined);
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  const body = (req.body ?? {}) as CreatePlanRequest;
  const planId = normalizeIdentifier(body.planId);
  const displayName = normalizeRequiredText(body.displayName);
  const recurringPriceCents = parseNonNegativeInteger(body.recurringPriceCents);
  const monthlyCreditsCents = parseNonNegativeInteger(body.monthlyCreditsCents);
  const storageLimitBytes = parseNonNegativeInteger(body.storageLimitBytes);
  const sortOrder = parseNonNegativeInteger(body.sortOrder);

  if (!planId || !PLAN_ID_PATTERN.test(planId)) {
    return res
      .status(400)
      .json({ error: "planId must contain only lowercase letters, numbers, and underscores." });
  }
  if (!displayName) {
    return res.status(400).json({ error: "displayName is required." });
  }
  if (recurringPriceCents == null) {
    return res.status(400).json({ error: "recurringPriceCents must be a non-negative integer." });
  }
  if (monthlyCreditsCents == null) {
    return res.status(400).json({ error: "monthlyCreditsCents must be a non-negative integer." });
  }
  if (storageLimitBytes == null) {
    return res.status(400).json({ error: "storageLimitBytes must be a non-negative integer." });
  }
  if (sortOrder == null) {
    return res.status(400).json({ error: "sortOrder must be a non-negative integer." });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const existingPlanResult = await supabaseAdmin
      .from("billing_plans")
      .select("id, display_name")
      .or(`id.eq.${planId},display_name.eq.${displayName}`)
      .limit(1)
      .maybeSingle();

    if (existingPlanResult.error) {
      throw new Error(
        existingPlanResult.error.message || "Failed to validate the plan identifier."
      );
    }
    if (existingPlanResult.data) {
      const conflictField = existingPlanResult.data.id === planId ? "Plan id" : "Display name";
      return res.status(409).json({ error: `${conflictField} is already in use.` });
    }

    const stripeProduct = await stripePostForm<StripeProductResponse>("/products", {
      name: `Plan - ${displayName}`,
      "metadata[shortpulse_catalog_type]": "plan",
      "metadata[shortpulse_plan_id]": planId,
      "metadata[shortpulse_display_name]": displayName,
    });

    let stripePriceId: string | null = null;
    if (recurringPriceCents > 0) {
      const stripePrice = await stripePostForm<StripePriceResponse>("/prices", {
        product: stripeProduct.id,
        currency: "usd",
        unit_amount: recurringPriceCents,
        "recurring[interval]": "month",
        "metadata[shortpulse_catalog_type]": "plan",
        "metadata[shortpulse_plan_id]": planId,
        "metadata[shortpulse_display_name]": displayName,
      });
      stripePriceId = stripePrice.id;
    }

    const nowIso = new Date().toISOString();
    const initialOfferId = buildCurrentCatalogOfferId(planId, "month");
    const insertPlanResult = await supabaseAdmin.from("billing_plans").insert({
      id: planId,
      display_name: displayName,
      monthly_price_cents: recurringPriceCents,
      monthly_credits_cents: monthlyCreditsCents,
      storage_limit_bytes: storageLimitBytes,
      stripe_price_id: stripePriceId,
      stripe_product_id: stripeProduct.id,
      sort_order: sortOrder,
      is_active: true,
    });

    if (insertPlanResult.error) {
      await archiveStripeArtifacts({
        stripeProductId: stripeProduct.id,
        stripePriceId,
      });
      if (isUniqueViolationError(insertPlanResult.error)) {
        return res
          .status(409)
          .json({ error: "Plan id, display name, or Stripe linkage is already in use." });
      }
      throw new Error(insertPlanResult.error.message || "Failed to create the new plan.");
    }

    const insertOfferResult = await supabaseAdmin.from("billing_plan_offers").insert({
      id: initialOfferId,
      plan_id: planId,
      offer_name: `${displayName} Current Offer`,
      billing_interval: "month",
      recurring_price_cents: recurringPriceCents,
      monthly_credits_cents: monthlyCreditsCents,
      storage_limit_bytes: storageLimitBytes,
      stripe_price_id: stripePriceId,
      acquisition_enabled: true,
      is_active: true,
      effective_start_at: nowIso,
    });

    if (insertOfferResult.error) {
      await supabaseAdmin.from("billing_plans").delete().eq("id", planId);
      await archiveStripeArtifacts({
        stripeProductId: stripeProduct.id,
        stripePriceId,
      });
      if (isUniqueViolationError(insertOfferResult.error)) {
        return res
          .status(409)
          .json({ error: "Plan id, display name, or Stripe linkage is already in use." });
      }
      throw new Error(
        insertOfferResult.error.message || "Failed to create the initial plan offer."
      );
    }

    return res.status(200).json({
      ok: true,
      planId,
      offerId: initialOfferId,
      stripeProductId: stripeProduct.id,
      stripePriceId,
      message: "Plan created and activated.",
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/pricing/plans/create",
      user: adminUser,
      metadata: {
        source: "api.admin.pricing.plans.create",
      },
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to create the plan.",
    });
  }
}
