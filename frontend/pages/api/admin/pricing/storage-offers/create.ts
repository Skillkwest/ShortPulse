import type { NextApiRequest, NextApiResponse } from "next";
import { isUniqueViolationError } from "../../../../../lib/server/api/billingContracts";
import { logApiRouteException } from "../../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../../lib/server/api/auth";
import {
  buildCatalogOfferId,
  normalizeNullableText,
  normalizeRequiredText,
  parsePositiveInteger,
  requireStripePriceForPaidCatalogRow,
} from "../../../../../lib/server/api/adminPricingCatalog";
import { getSupabaseAdmin } from "../../../../../lib/server/api/supabaseAdmin";

type CreateStorageOfferRequest = {
  storageAddonId?: string;
  offerName?: string;
  storageLimitBytes?: number | string;
  recurringPriceCents?: number | string;
  stripePriceId?: string | null;
};

type CurrentStorageOfferRow = {
  id: string;
  storage_limit_bytes: number;
  recurring_price_cents: number;
  stripe_price_id: string | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  const body = (req.body ?? {}) as CreateStorageOfferRequest;
  const storageAddonId = normalizeRequiredText(body.storageAddonId).toLowerCase();
  const offerName = normalizeRequiredText(body.offerName);
  const storageLimitBytes = parsePositiveInteger(body.storageLimitBytes);
  const recurringPriceCents = parsePositiveInteger(body.recurringPriceCents);
  const stripePriceId = normalizeNullableText(body.stripePriceId);

  if (!storageAddonId) {
    return res.status(400).json({ error: "storageAddonId is required." });
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
    const supabaseAdmin = getSupabaseAdmin();
    const [storageAddonResult, currentOfferResult] = await Promise.all([
      supabaseAdmin
        .from("billing_storage_addons")
        .select("id")
        .eq("id", storageAddonId)
        .maybeSingle(),
      supabaseAdmin
        .from("billing_storage_addon_offers")
        .select("id, storage_limit_bytes, recurring_price_cents, stripe_price_id")
        .eq("storage_addon_id", storageAddonId)
        .eq("acquisition_enabled", true)
        .eq("is_active", true)
        .is("effective_end_at", null)
        .limit(1)
        .maybeSingle(),
    ]);

    if (storageAddonResult.error || currentOfferResult.error) {
      throw new Error(
        [storageAddonResult.error?.message, currentOfferResult.error?.message]
          .filter(Boolean)
          .join(" | ") || "Failed to load the current storage pricing state."
      );
    }
    if (!storageAddonResult.data) {
      return res.status(404).json({ error: "Storage add-on not found." });
    }

    const currentOffer = (currentOfferResult.data as CurrentStorageOfferRow | null) ?? null;
    if (
      currentOffer &&
      Number(currentOffer.storage_limit_bytes) === storageLimitBytes &&
      Number(currentOffer.recurring_price_cents) === recurringPriceCents &&
      (currentOffer.stripe_price_id ?? null) === stripePriceId
    ) {
      return res.status(200).json({
        ok: true,
        id: currentOffer.id,
        message: "Storage add-on offer is already current.",
      });
    }

    const nowIso = new Date().toISOString();
    if (currentOffer) {
      const { error: disableCurrentError } = await supabaseAdmin
        .from("billing_storage_addon_offers")
        .update({
          acquisition_enabled: false,
          effective_end_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", currentOffer.id);
      if (disableCurrentError) {
        throw new Error(
          disableCurrentError.message || "Failed to close the current storage add-on offer."
        );
      }
    }

    const nextOfferId = buildCatalogOfferId(storageAddonId, offerName);
    const insertResult = await supabaseAdmin.from("billing_storage_addon_offers").insert({
      id: nextOfferId,
      storage_addon_id: storageAddonId,
      offer_name: offerName,
      storage_limit_bytes: storageLimitBytes,
      recurring_price_cents: recurringPriceCents,
      stripe_price_id: stripePriceId,
      acquisition_enabled: true,
      is_active: true,
      effective_start_at: nowIso,
    });

    if (insertResult.error) {
      if (currentOffer) {
        await supabaseAdmin
          .from("billing_storage_addon_offers")
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
      throw new Error(
        insertResult.error.message || "Failed to create the next storage add-on offer."
      );
    }

    return res.status(200).json({
      ok: true,
      id: nextOfferId,
      message: "Storage add-on offer created and activated.",
    });
  } catch (error) {
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
