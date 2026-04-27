import type { NextApiRequest, NextApiResponse } from "next";
import { isUniqueViolationError } from "../../../../../lib/server/api/billingContracts";
import { logApiRouteException } from "../../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../../lib/server/api/auth";
import {
  buildCatalogOfferId,
  normalizeNullableText,
  normalizeRequiredText,
  parseNonNegativeInteger,
  requireStripePriceForPaidCatalogRow,
} from "../../../../../lib/server/api/adminPricingCatalog";
import { getSupabaseAdmin } from "../../../../../lib/server/api/supabaseAdmin";

type CreatePlanOfferRequest = {
  planId?: string;
  offerName?: string;
  billingInterval?: "month" | "year";
  recurringPriceCents?: number | string;
  monthlyCreditsCents?: number | string;
  storageLimitBytes?: number | string;
  stripePriceId?: string | null;
};

type CurrentPlanOfferRow = {
  id: string;
  billing_interval: "month" | "year";
  recurring_price_cents: number;
  monthly_credits_cents: number;
  storage_limit_bytes: number;
  stripe_price_id: string | null;
};

const normalizeBillingInterval = (value: unknown): "month" | "year" =>
  value === "year" ? "year" : "month";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  const body = (req.body ?? {}) as CreatePlanOfferRequest;
  const planId = normalizeRequiredText(body.planId).toLowerCase();
  const offerName = normalizeRequiredText(body.offerName);
  const billingInterval = normalizeBillingInterval(body.billingInterval);
  const recurringPriceCents = parseNonNegativeInteger(body.recurringPriceCents);
  const monthlyCreditsCents = parseNonNegativeInteger(body.monthlyCreditsCents);
  const storageLimitBytes = parseNonNegativeInteger(body.storageLimitBytes);
  const stripePriceId = normalizeNullableText(body.stripePriceId);

  if (!planId) {
    return res.status(400).json({ error: "planId is required." });
  }
  if (!offerName) {
    return res.status(400).json({ error: "offerName is required." });
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
  if (!requireStripePriceForPaidCatalogRow({ priceCents: recurringPriceCents, stripePriceId })) {
    return res.status(400).json({ error: "Paid public plan offers require a Stripe price id." });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const [planResult, currentOfferResult] = await Promise.all([
      supabaseAdmin.from("billing_plans").select("id").eq("id", planId).maybeSingle(),
      supabaseAdmin
        .from("billing_plan_offers")
        .select(
          "id, billing_interval, recurring_price_cents, monthly_credits_cents, storage_limit_bytes, stripe_price_id"
        )
        .eq("plan_id", planId)
        .eq("billing_interval", billingInterval)
        .eq("acquisition_enabled", true)
        .eq("is_active", true)
        .is("effective_end_at", null)
        .limit(1)
        .maybeSingle(),
    ]);

    if (planResult.error || currentOfferResult.error) {
      throw new Error(
        [planResult.error?.message, currentOfferResult.error?.message]
          .filter(Boolean)
          .join(" | ") || "Failed to load the current plan pricing state."
      );
    }
    if (!planResult.data) {
      return res.status(404).json({ error: "Plan not found." });
    }

    const currentOffer = (currentOfferResult.data as CurrentPlanOfferRow | null) ?? null;
    if (
      currentOffer &&
      Number(currentOffer.recurring_price_cents) === recurringPriceCents &&
      Number(currentOffer.monthly_credits_cents) === monthlyCreditsCents &&
      Number(currentOffer.storage_limit_bytes) === storageLimitBytes &&
      (currentOffer.stripe_price_id ?? null) === stripePriceId
    ) {
      return res.status(200).json({
        ok: true,
        id: currentOffer.id,
        message: "Plan offer is already current.",
      });
    }

    const nowIso = new Date().toISOString();
    if (currentOffer) {
      const { error: disableCurrentError } = await supabaseAdmin
        .from("billing_plan_offers")
        .update({
          acquisition_enabled: false,
          effective_end_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", currentOffer.id);
      if (disableCurrentError) {
        throw new Error(disableCurrentError.message || "Failed to close the current plan offer.");
      }
    }

    const nextOfferId = buildCatalogOfferId(planId, offerName, billingInterval);
    const insertResult = await supabaseAdmin.from("billing_plan_offers").insert({
      id: nextOfferId,
      plan_id: planId,
      offer_name: offerName,
      billing_interval: billingInterval,
      recurring_price_cents: recurringPriceCents,
      monthly_credits_cents: monthlyCreditsCents,
      storage_limit_bytes: storageLimitBytes,
      stripe_price_id: stripePriceId,
      acquisition_enabled: true,
      is_active: true,
      effective_start_at: nowIso,
    });

    if (insertResult.error) {
      if (currentOffer) {
        await supabaseAdmin
          .from("billing_plan_offers")
          .update({
            acquisition_enabled: true,
            effective_end_at: null,
            updated_at: nowIso,
          })
          .eq("id", currentOffer.id);
      }
      if (isUniqueViolationError(insertResult.error)) {
        return res.status(409).json({ error: "Offer name or Stripe price id is already in use." });
      }
      throw new Error(insertResult.error.message || "Failed to create the next plan offer.");
    }

    return res.status(200).json({
      ok: true,
      id: nextOfferId,
      message: "Plan offer created and activated.",
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/pricing/plan-offers/create",
      user: adminUser,
      metadata: {
        source: "api.admin.pricing.plan-offers.create",
      },
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to create the next plan offer.",
    });
  }
}
