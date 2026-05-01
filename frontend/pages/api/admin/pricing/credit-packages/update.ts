import type { NextApiRequest, NextApiResponse } from "next";
import { isUniqueViolationError } from "../../../../../lib/server/api/billingContracts";
import { logApiRouteException } from "../../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../../lib/server/api/auth";
import {
  CatalogStripePriceValidationError,
  normalizeNullableText,
  normalizeRequiredText,
  parseNonNegativeInteger,
  parsePositiveInteger,
  requireStripePriceForPaidCatalogRow,
  validateStripePriceForCatalogRow,
} from "../../../../../lib/server/api/adminPricingCatalog";
import { getSupabaseAdmin } from "../../../../../lib/server/api/supabaseAdmin";

type UpdateCreditPackageRequest = {
  id?: string;
  displayName?: string;
  creditAmountCents?: number | string;
  priceCents?: number | string;
  stripePriceId?: string | null;
  isActive?: boolean;
  sortOrder?: number | string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  const body = (req.body ?? {}) as UpdateCreditPackageRequest;
  const id = normalizeRequiredText(body.id);
  const displayName = normalizeRequiredText(body.displayName);
  const creditAmountCents = parsePositiveInteger(body.creditAmountCents);
  const priceCents = parsePositiveInteger(body.priceCents);
  const sortOrder = parseNonNegativeInteger(body.sortOrder);
  const stripePriceId = normalizeNullableText(body.stripePriceId);
  const isActive = Boolean(body.isActive);

  if (!id) {
    return res.status(400).json({ error: "id is required." });
  }
  if (!displayName) {
    return res.status(400).json({ error: "displayName is required." });
  }
  if (creditAmountCents == null) {
    return res.status(400).json({ error: "creditAmountCents must be a positive integer." });
  }
  if (priceCents == null) {
    return res.status(400).json({ error: "priceCents must be a positive integer." });
  }
  if (sortOrder == null) {
    return res.status(400).json({ error: "sortOrder must be a non-negative integer." });
  }
  if (!requireStripePriceForPaidCatalogRow({ priceCents, stripePriceId, isActive })) {
    return res.status(400).json({
      error: "Active paid credit packages require a Stripe price id.",
    });
  }

  try {
    if (isActive) {
      await validateStripePriceForCatalogRow({
        stripePriceId,
        expectedAmountCents: priceCents,
        expectedInterval: null,
        catalogType: "credit_package",
        expectedMetadataIdKey: "shortpulse_credit_package_id",
        expectedMetadataIdValue: id,
      });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const existingResult = await supabaseAdmin
      .from("billing_credit_packages")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (existingResult.error) {
      throw new Error(existingResult.error.message || "Failed to load the credit package.");
    }
    if (!existingResult.data) {
      return res.status(404).json({ error: "Credit package not found." });
    }

    const { error: updateError } = await supabaseAdmin
      .from("billing_credit_packages")
      .update({
        display_name: displayName,
        credit_amount_cents: creditAmountCents,
        price_cents: priceCents,
        stripe_price_id: stripePriceId,
        is_active: isActive,
        sort_order: sortOrder,
      })
      .eq("id", id);

    if (updateError) {
      if (isUniqueViolationError(updateError)) {
        return res.status(409).json({
          error: "Display name or Stripe price id is already in use by another package.",
        });
      }
      throw new Error(updateError.message || "Failed to update the credit package.");
    }

    return res.status(200).json({
      ok: true,
      id,
      message: "Credit package updated.",
    });
  } catch (error) {
    if (error instanceof CatalogStripePriceValidationError) {
      return res.status(400).json({ error: error.message });
    }
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/pricing/credit-packages/update",
      user: adminUser,
      metadata: {
        source: "api.admin.pricing.credit-packages.update",
      },
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to update the credit package.",
    });
  }
}
