import type { NextApiRequest, NextApiResponse } from "next";
import {
  isManualReviewStorageAddon,
  isSelfServeStorageAddon,
} from "../../../../../lib/billing/storageAddonEligibility";
import { isUniqueViolationError } from "../../../../../lib/server/api/billingContracts";
import { logApiRouteException } from "../../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../../lib/server/api/auth";
import {
  buildCatalogOfferId,
  CatalogStripePriceValidationError,
  normalizeNullableText,
  normalizeRequiredText,
  parsePositiveInteger,
  requireStripePriceForPaidCatalogRow,
  validateStripePriceForCatalogRow,
} from "../../../../../lib/server/api/adminPricingCatalog";
import { getSupabaseAdmin } from "../../../../../lib/server/api/supabaseAdmin";

type CreateStorageOfferRequest = {
  storageAddonId?: string;
  offerName?: string;
  storageLimitBytes?: number | string;
  recurringPriceCents?: number | string;
  stripePriceId?: string | null;
  expectedCurrentOfferId?: string | null;
  expectedCurrentOfferAbsent?: boolean;
};

type ActivateStorageOfferResult = {
  status: "activated" | "already_current" | "rejected" | "not_found" | "stale";
  offer_id: string | null;
  message: string | null;
};

const statusToHttpCode = (status: ActivateStorageOfferResult["status"]): number => {
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

  let adminUser;
  try {
    adminUser = await requireAdminUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/pricing/storage-offers/create.auth",
      metadata: {
        source: "api.admin.pricing.storage-offers.create",
      },
    });
    return res.status(500).json({
      error: "Failed to create the next storage add-on offer.",
    });
  }
  if (!adminUser) return;

  const body = (req.body ?? {}) as CreateStorageOfferRequest;
  const storageAddonId = normalizeRequiredText(body.storageAddonId).toLowerCase();
  const offerName = normalizeRequiredText(body.offerName);
  const storageLimitBytes = parsePositiveInteger(body.storageLimitBytes);
  const recurringPriceCents = parsePositiveInteger(body.recurringPriceCents);
  const stripePriceId = normalizeNullableText(body.stripePriceId);
  const expectedCurrentOfferId = normalizeNullableText(body.expectedCurrentOfferId);
  const expectedCurrentOfferAbsent =
    expectedCurrentOfferId == null && body.expectedCurrentOfferAbsent === true;

  if (!storageAddonId) {
    return res.status(400).json({ error: "storageAddonId is required." });
  }
  if (isManualReviewStorageAddon(storageAddonId)) {
    return res.status(400).json({
      error: "Manual-review storage add-ons cannot be activated as public self-serve offers.",
    });
  }
  if (!isSelfServeStorageAddon(storageAddonId)) {
    return res.status(400).json({
      error: "Only current self-serve storage add-ons can be activated as public offers.",
    });
  }
  if (!offerName) {
    return res.status(400).json({ error: "offerName is required." });
  }
  if (storageLimitBytes == null) {
    return res.status(400).json({ error: "storageLimitBytes must be a positive integer." });
  }
  if (recurringPriceCents == null) {
    return res.status(400).json({ error: "recurringPriceCents must be a positive integer." });
  }
  if (!requireStripePriceForPaidCatalogRow({ priceCents: recurringPriceCents, stripePriceId })) {
    return res.status(400).json({
      error: "Paid public storage add-on offers require a Stripe price id.",
    });
  }

  try {
    await validateStripePriceForCatalogRow({
      stripePriceId,
      expectedAmountCents: recurringPriceCents,
      expectedInterval: "month",
      catalogType: "storage_addon",
      expectedMetadataIdKey: "shortpulse_storage_addon_id",
      expectedMetadataIdValue: storageAddonId,
    });

    const supabaseAdmin = getSupabaseAdmin();
    const nextOfferId = buildCatalogOfferId(storageAddonId, offerName);
    const rpcResult = await supabaseAdmin.rpc("activate_billing_storage_addon_offer", {
      p_offer_id: nextOfferId,
      p_storage_addon_id: storageAddonId,
      p_offer_name: offerName,
      p_storage_limit_bytes: storageLimitBytes,
      p_recurring_price_cents: recurringPriceCents,
      p_stripe_price_id: stripePriceId,
      p_expected_current_offer_id: expectedCurrentOfferId,
      p_expected_current_offer_absent: expectedCurrentOfferAbsent,
    });

    if (rpcResult.error) {
      if (isUniqueViolationError(rpcResult.error)) {
        return res.status(409).json({ error: "Offer name or Stripe price id is already in use." });
      }
      throw new Error(rpcResult.error.message || "Failed to create the next storage add-on offer.");
    }

    const result = (
      Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data
    ) as ActivateStorageOfferResult | null;
    const statusCode = statusToHttpCode(result?.status ?? "rejected");
    return res.status(statusCode).json({
      ok: statusCode < 400,
      id: result?.offer_id ?? nextOfferId,
      status: result?.status ?? "rejected",
      message: result?.message ?? "Storage add-on offer created and activated.",
      ...(statusCode >= 400
        ? { error: result?.message ?? "Failed to create the next storage add-on offer." }
        : {}),
    });
  } catch (error) {
    if (error instanceof CatalogStripePriceValidationError) {
      return res.status(400).json({ error: error.message });
    }
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/pricing/storage-offers/create",
      user: adminUser,
      metadata: {
        source: "api.admin.pricing.storage-offers.create",
      },
    });
    return res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to create the next storage add-on offer.",
    });
  }
}
