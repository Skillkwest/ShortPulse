import type { NextApiRequest, NextApiResponse } from "next";
import { isUniqueViolationError } from "../../../../../lib/server/api/billingContracts";
import { logApiRouteException } from "../../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../../lib/server/api/auth";
import {
  buildCatalogOfferId,
  CatalogStripePriceValidationError,
  normalizeNullableText,
  normalizeRequiredText,
  parseNonNegativeInteger,
  requireStripePriceForPaidCatalogRow,
  validateStripePriceForCatalogRow,
} from "../../../../../lib/server/api/adminPricingCatalog";
import { getSupabaseAdmin } from "../../../../../lib/server/api/supabaseAdmin";

type CreatePlanOfferRequest = {
  planId?: string;
  offerName?: string;
  billingInterval?: "month" | "year";
  recurringPriceCents?: number | string;
  monthlyCreditsCents?: number | string;
  storageLimitBytes?: number | string;
  maxConcurrentGenerations?: number | string;
  stripePriceId?: string | null;
  expectedCurrentOfferId?: string | null;
  expectedCurrentOfferAbsent?: boolean;
};

type ActivateOfferResult = {
  status: "activated" | "already_current" | "rejected" | "not_found" | "stale";
  offer_id: string | null;
  message: string | null;
};

const normalizeBillingInterval = (value: unknown): "month" | "year" =>
  value === "year" ? "year" : "month";

const statusToHttpCode = (status: ActivateOfferResult["status"]): number => {
  if (status === "rejected") return 400;
  if (status === "not_found") return 404;
  if (status === "stale") return 409;
  return 200;
};

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
  const maxConcurrentGenerations = parseNonNegativeInteger(body.maxConcurrentGenerations);
  const stripePriceId = normalizeNullableText(body.stripePriceId);
  const expectedCurrentOfferId = normalizeNullableText(body.expectedCurrentOfferId);
  const expectedCurrentOfferAbsent =
    expectedCurrentOfferId == null && body.expectedCurrentOfferAbsent === true;

  if (!planId) {
    return res.status(400).json({ error: "planId is required." });
  }
  if (planId === "free") {
    return res.status(400).json({
      error: "The hidden free tier cannot be activated as a billing offer.",
    });
  }
  if (!offerName) {
    return res.status(400).json({ error: "offerName is required." });
  }
  if (recurringPriceCents == null) {
    return res.status(400).json({ error: "recurringPriceCents must be a non-negative integer." });
  }
  if (recurringPriceCents <= 0) {
    return res.status(400).json({ error: "Paid public plan offers must be greater than $0." });
  }
  if (monthlyCreditsCents == null) {
    return res.status(400).json({ error: "monthlyCreditsCents must be a non-negative integer." });
  }
  if (storageLimitBytes == null) {
    return res.status(400).json({ error: "storageLimitBytes must be a non-negative integer." });
  }
  if (maxConcurrentGenerations == null) {
    return res
      .status(400)
      .json({ error: "maxConcurrentGenerations must be a non-negative integer." });
  }
  if (!requireStripePriceForPaidCatalogRow({ priceCents: recurringPriceCents, stripePriceId })) {
    return res.status(400).json({ error: "Paid public plan offers require a Stripe price id." });
  }

  try {
    await validateStripePriceForCatalogRow({
      stripePriceId,
      expectedAmountCents: recurringPriceCents,
      expectedInterval: billingInterval,
      catalogType: "plan",
      expectedMetadataIdKey: "shortpulse_plan_id",
      expectedMetadataIdValue: planId,
    });

    const supabaseAdmin = getSupabaseAdmin();
    const nextOfferId = buildCatalogOfferId(planId, offerName, billingInterval);
    const rpcResult = await supabaseAdmin.rpc("activate_billing_plan_offer", {
      p_offer_id: nextOfferId,
      p_plan_id: planId,
      p_offer_name: offerName,
      p_billing_interval: billingInterval,
      p_recurring_price_cents: recurringPriceCents,
      p_monthly_credits_cents: monthlyCreditsCents,
      p_storage_limit_bytes: storageLimitBytes,
      p_max_concurrent_generations: maxConcurrentGenerations,
      p_stripe_price_id: stripePriceId,
      p_expected_current_offer_id: expectedCurrentOfferId,
      p_expected_current_offer_absent: expectedCurrentOfferAbsent,
    });

    if (rpcResult.error) {
      if (isUniqueViolationError(rpcResult.error)) {
        return res.status(409).json({ error: "Offer name or Stripe price id is already in use." });
      }
      throw new Error(rpcResult.error.message || "Failed to create the next plan offer.");
    }

    const result = (
      Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data
    ) as ActivateOfferResult | null;
    const statusCode = statusToHttpCode(result?.status ?? "rejected");
    return res.status(statusCode).json({
      ok: statusCode < 400,
      id: result?.offer_id ?? nextOfferId,
      status: result?.status ?? "rejected",
      message: result?.message ?? "Plan offer created and activated.",
      ...(statusCode >= 400
        ? { error: result?.message ?? "Failed to create the next plan offer." }
        : {}),
    });
  } catch (error) {
    if (error instanceof CatalogStripePriceValidationError) {
      return res.status(400).json({ error: error.message });
    }
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
