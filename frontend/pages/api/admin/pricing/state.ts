/**
 * Admin pricing state API.
 * Aggregates current runtime model pricing defaults and active public billing catalog rows.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import type {
  AdminCreditPricingBreakdown,
  AdminPricingCreditPackageRow,
  AdminPricingHealthSummary,
  AdminPricingModelRow,
  AdminPricingPlanRow,
  AdminPricingStateResponse,
  AdminPricingStorageAddonRow,
} from "../../../../features/admin/types";
import {
  buildDefaultPricingParams,
  computeCostForModel,
  listModelConfigs,
} from "../../../../lib/model-runtime/pricing";
import { getModelPricingPolicySnapshot } from "../../../../lib/model-runtime/pricingPolicy";
import { resolveModelCreditRoundingMode } from "../../../../lib/model-runtime/pricingCredits";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../lib/server/api/auth";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";

type BillingPlanMetadataRow = {
  id: string;
  display_name: string;
  is_active: boolean;
};

type BillingPlanOfferRow = {
  id: string;
  plan_id: string;
  recurring_price_cents: number;
  monthly_credits_cents: number;
  storage_limit_bytes: number;
  stripe_price_id: string | null;
  acquisition_enabled: boolean;
  is_active: boolean;
  effective_start_at: string | null;
  created_at: string;
};

type BillingCreditPackageRow = {
  id: string;
  display_name: string;
  credit_amount_cents: number;
  price_cents: number;
  stripe_price_id: string | null;
  sort_order: number;
  is_active: boolean;
};

type BillingStorageAddonMetadataRow = {
  id: string;
  display_name: string;
  sort_order: number;
  is_active: boolean;
};

type BillingStorageAddonOfferRow = {
  id: string;
  storage_addon_id: string;
  storage_limit_bytes: number;
  recurring_price_cents: number;
  stripe_price_id: string | null;
  acquisition_enabled: boolean;
  is_active: boolean;
  effective_start_at: string | null;
  created_at: string;
};

const compareOfferRecency = <T extends { effective_start_at: string | null; created_at: string }>(
  a: T,
  b: T
) => {
  const aDate = Date.parse(a.effective_start_at ?? a.created_at);
  const bDate = Date.parse(b.effective_start_at ?? b.created_at);
  return bDate - aDate;
};

const mapPricingPreview = (modelId: string): AdminCreditPricingBreakdown | null => {
  const breakdown = computeCostForModel(modelId, buildDefaultPricingParams(modelId));
  if (!breakdown) return null;
  return {
    usdRaw: breakdown.usdRaw,
    rawCredits: breakdown.rawCredits,
    billedCredits: breakdown.credits,
    billedUsd: breakdown.usd,
  };
};

const buildHealthSummary = ({
  plans,
  creditPackages,
  storageAddons,
}: {
  plans: AdminPricingPlanRow[];
  creditPackages: AdminPricingCreditPackageRow[];
  storageAddons: AdminPricingStorageAddonRow[];
}): AdminPricingHealthSummary => {
  const planOffersMissingStripePriceIds = plans.filter((row) => !row.stripePriceId).length;
  const creditPackagesMissingStripePriceIds = creditPackages.filter(
    (row) => !row.stripePriceId
  ).length;
  const storageOffersMissingStripePriceIds = storageAddons.filter(
    (row) => !row.stripePriceId
  ).length;

  const warnings: string[] = [];
  if (planOffersMissingStripePriceIds > 0) {
    warnings.push(
      `${planOffersMissingStripePriceIds} active public plan offer${planOffersMissingStripePriceIds === 1 ? "" : "s"} missing Stripe price ids.`
    );
  }
  if (creditPackagesMissingStripePriceIds > 0) {
    warnings.push(
      `${creditPackagesMissingStripePriceIds} active credit package${creditPackagesMissingStripePriceIds === 1 ? "" : "s"} missing Stripe price ids.`
    );
  }
  if (storageOffersMissingStripePriceIds > 0) {
    warnings.push(
      `${storageOffersMissingStripePriceIds} active storage add-on offer${storageOffersMissingStripePriceIds === 1 ? "" : "s"} missing Stripe price ids.`
    );
  }

  return {
    planOffersMissingStripePriceIds,
    creditPackagesMissingStripePriceIds,
    storageOffersMissingStripePriceIds,
    totalWarnings: warnings.length,
    warnings,
  };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AdminPricingStateResponse | { error: string }>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const [
      planMetadataResult,
      planOffersResult,
      creditPackagesResult,
      storageMetadataResult,
      storageOffersResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("billing_plans")
        .select("id, display_name, is_active")
        .eq("is_active", true),
      supabaseAdmin
        .from("billing_plan_offers")
        .select(
          "id, plan_id, recurring_price_cents, monthly_credits_cents, storage_limit_bytes, stripe_price_id, acquisition_enabled, is_active, effective_start_at, created_at"
        )
        .eq("acquisition_enabled", true)
        .eq("is_active", true)
        .is("effective_end_at", null)
        .order("effective_start_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("billing_credit_packages")
        .select(
          "id, display_name, credit_amount_cents, price_cents, stripe_price_id, sort_order, is_active"
        )
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabaseAdmin
        .from("billing_storage_addons")
        .select("id, display_name, sort_order, is_active")
        .eq("is_active", true),
      supabaseAdmin
        .from("billing_storage_addon_offers")
        .select(
          "id, storage_addon_id, storage_limit_bytes, recurring_price_cents, stripe_price_id, acquisition_enabled, is_active, effective_start_at, created_at"
        )
        .eq("acquisition_enabled", true)
        .eq("is_active", true)
        .is("effective_end_at", null)
        .order("effective_start_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false }),
    ]);

    if (
      planMetadataResult.error ||
      planOffersResult.error ||
      creditPackagesResult.error ||
      storageMetadataResult.error ||
      storageOffersResult.error
    ) {
      const detail = [
        planMetadataResult.error?.message,
        planOffersResult.error?.message,
        creditPackagesResult.error?.message,
        storageMetadataResult.error?.message,
        storageOffersResult.error?.message,
      ]
        .filter(Boolean)
        .join(" | ");
      return res.status(500).json({ error: detail || "Unable to load pricing state." });
    }

    const planMetadata = new Map<string, BillingPlanMetadataRow>(
      ((planMetadataResult.data ?? []) as BillingPlanMetadataRow[]).map((row) => [row.id, row])
    );
    const latestPlanOfferByPlanId = new Map<string, BillingPlanOfferRow>();
    for (const offer of ((planOffersResult.data ?? []) as BillingPlanOfferRow[]).sort(
      compareOfferRecency
    )) {
      if (!latestPlanOfferByPlanId.has(offer.plan_id)) {
        latestPlanOfferByPlanId.set(offer.plan_id, offer);
      }
    }

    const plans: AdminPricingPlanRow[] = [...latestPlanOfferByPlanId.values()]
      .map((offer) => {
        const metadata = planMetadata.get(offer.plan_id);
        if (!metadata) return null;
        return {
          planId: offer.plan_id,
          displayName: metadata.display_name,
          offerId: offer.id,
          recurringPriceCents: Number(offer.recurring_price_cents ?? 0),
          monthlyCreditsCents: Number(offer.monthly_credits_cents ?? 0),
          storageLimitBytes: Number(offer.storage_limit_bytes ?? 0),
          stripePriceId: offer.stripe_price_id,
          acquisitionEnabled: Boolean(offer.acquisition_enabled),
          isActive: Boolean(metadata.is_active && offer.is_active),
          effectiveStartAt: offer.effective_start_at,
        } satisfies AdminPricingPlanRow;
      })
      .filter((row): row is AdminPricingPlanRow => row !== null)
      .sort((a, b) => a.recurringPriceCents - b.recurringPriceCents);

    const creditPackages: AdminPricingCreditPackageRow[] = (
      (creditPackagesResult.data ?? []) as BillingCreditPackageRow[]
    ).map((row) => ({
      id: row.id,
      displayName: row.display_name,
      creditAmountCents: Number(row.credit_amount_cents ?? 0),
      priceCents: Number(row.price_cents ?? 0),
      stripePriceId: row.stripe_price_id,
      sortOrder: Number(row.sort_order ?? 0),
      isActive: Boolean(row.is_active),
    }));

    const storageMetadata = new Map<string, BillingStorageAddonMetadataRow>(
      ((storageMetadataResult.data ?? []) as BillingStorageAddonMetadataRow[]).map((row) => [
        row.id,
        row,
      ])
    );
    const latestStorageOfferByAddonId = new Map<string, BillingStorageAddonOfferRow>();
    for (const offer of ((storageOffersResult.data ?? []) as BillingStorageAddonOfferRow[]).sort(
      compareOfferRecency
    )) {
      if (!latestStorageOfferByAddonId.has(offer.storage_addon_id)) {
        latestStorageOfferByAddonId.set(offer.storage_addon_id, offer);
      }
    }

    const storageAddons: AdminPricingStorageAddonRow[] = [...latestStorageOfferByAddonId.values()]
      .map((offer) => {
        const metadata = storageMetadata.get(offer.storage_addon_id);
        if (!metadata) return null;
        return {
          storageAddonId: offer.storage_addon_id,
          displayName: metadata.display_name,
          offerId: offer.id,
          storageLimitBytes: Number(offer.storage_limit_bytes ?? 0),
          recurringPriceCents: Number(offer.recurring_price_cents ?? 0),
          stripePriceId: offer.stripe_price_id,
          acquisitionEnabled: Boolean(offer.acquisition_enabled),
          isActive: Boolean(metadata.is_active && offer.is_active),
          effectiveStartAt: offer.effective_start_at,
          sortOrder: Number(metadata.sort_order ?? 0),
        } satisfies AdminPricingStorageAddonRow;
      })
      .filter((row): row is AdminPricingStorageAddonRow => row !== null)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const models: AdminPricingModelRow[] = listModelConfigs()
      .slice()
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((model) => ({
        id: model.id,
        label: model.label,
        provider: model.provider,
        mediaType: model.mediaType,
        pricingStrategy: model.pricingStrategy,
        defaultAspect: model.defaultAspect,
        defaultResolution: model.defaultResolution ?? null,
        defaultDurationSeconds: model.defaultDurationSeconds ?? null,
        roundingMode: resolveModelCreditRoundingMode(model.id),
        pricingPreview: mapPricingPreview(model.id),
      }));

    const payload: AdminPricingStateResponse = {
      generatedAt: new Date().toISOString(),
      modelPolicy: getModelPricingPolicySnapshot(),
      models,
      plans,
      creditPackages,
      storageAddons,
      health: buildHealthSummary({ plans, creditPackages, storageAddons }),
    };

    return res.status(200).json(payload);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/pricing/state",
      user: adminUser,
      metadata: {
        source: "api.admin.pricing.state",
      },
    });
    return res.status(500).json({ error: "Unable to load pricing state." });
  }
}
