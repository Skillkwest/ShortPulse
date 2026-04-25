/**
 * Admin pricing state API.
 * Aggregates the active shared model-pricing policy and active public billing catalog rows.
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
import { getAdminModelWorkflowType } from "../../../../lib/model-runtime/modelWorkflowType";
import { getAdminPricingStrategyLabel } from "../../../../lib/model-runtime/modelPricingStrategyLabel";
import {
  getModelPricingPolicySnapshot,
  resolveModelPricingForModel,
} from "../../../../lib/model-runtime/pricingPolicy";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../lib/server/api/auth";
import { resolveRuntimeModelPricingPolicy } from "../../../../lib/server/api/modelPricingControlPlane";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";

type BillingPlanMetadataRow = {
  id: string;
  display_name: string;
  is_active: boolean;
  monthly_price_cents: number;
  monthly_credits_cents: number;
  storage_limit_bytes: number;
  stripe_price_id: string | null;
  sort_order: number;
  stripe_product_id: string | null;
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

type BillingSubscriptionContractCountRow = {
  user_id: string;
  plan_id: string;
  recurring_price_cents: number;
};

type BillingProfileCountRow = {
  user_id: string;
  plan_id: string | null;
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

const isSchemaDriftError = (error: { message?: string; code?: string } | null | undefined) => {
  if (!error) return false;
  const code = String(error.code ?? "").toUpperCase();
  const message = String(error.message ?? "");
  return (
    code === "42703" ||
    code === "42P01" ||
    code === "PGRST204" ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
};

const loadBillingPlanMetadataRows = async (supabaseAdmin: ReturnType<typeof getSupabaseAdmin>) => {
  const withNewFields = await supabaseAdmin
    .from("billing_plans")
    .select(
      "id, display_name, is_active, monthly_price_cents, monthly_credits_cents, storage_limit_bytes, stripe_price_id, sort_order, stripe_product_id"
    );

  if (!withNewFields.error) {
    return withNewFields.data as BillingPlanMetadataRow[];
  }

  if (!isSchemaDriftError(withNewFields.error)) {
    throw new Error(withNewFields.error.message || "Unable to load billing plan metadata.");
  }

  const fallback = await supabaseAdmin
    .from("billing_plans")
    .select(
      "id, display_name, is_active, monthly_price_cents, monthly_credits_cents, storage_limit_bytes, stripe_price_id"
    );

  if (fallback.error) {
    throw new Error(fallback.error.message || "Unable to load billing plan metadata.");
  }

  return (
    (fallback.data ?? []) as Array<{
      id: string;
      display_name: string;
      is_active: boolean;
      monthly_price_cents: number;
      monthly_credits_cents: number;
      storage_limit_bytes: number;
      stripe_price_id: string | null;
    }>
  ).map((row, index) => ({
    ...row,
    sort_order: index * 10,
    stripe_product_id: null,
  }));
};

const compareOfferRecency = <T extends { effective_start_at: string | null; created_at: string }>(
  a: T,
  b: T
) => {
  const aDate = Date.parse(a.effective_start_at ?? a.created_at);
  const bDate = Date.parse(b.effective_start_at ?? b.created_at);
  return bDate - aDate;
};

const mapPricingPreview = (
  modelId: string,
  pricingPolicy: Parameters<typeof computeCostForModel>[2]
): AdminCreditPricingBreakdown | null => {
  const breakdown = computeCostForModel(modelId, buildDefaultPricingParams(modelId), pricingPolicy);
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
  const activePlanOffersMissingStripePriceIds = plans.filter(
    (row) => row.status === "active" && !row.stripePriceId
  ).length;
  const creditPackagesMissingStripePriceIds = creditPackages.filter(
    (row) => !row.stripePriceId
  ).length;
  const storageOffersMissingStripePriceIds = storageAddons.filter(
    (row) => !row.stripePriceId
  ).length;

  const warnings: string[] = [];
  if (activePlanOffersMissingStripePriceIds > 0) {
    warnings.push(
      `${activePlanOffersMissingStripePriceIds} active public plan offer${activePlanOffersMissingStripePriceIds === 1 ? "" : "s"} missing Stripe price ids.`
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
    planOffersMissingStripePriceIds: activePlanOffersMissingStripePriceIds,
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
    const runtimePricingPolicy = await resolveRuntimeModelPricingPolicy();
    const [
      planMetadataRows,
      planOffersResult,
      creditPackagesResult,
      storageMetadataResult,
      storageOffersResult,
      currentContractsResult,
      billingProfilesResult,
    ] = await Promise.all([
      loadBillingPlanMetadataRows(supabaseAdmin),
      supabaseAdmin
        .from("billing_plan_offers")
        .select(
          "id, plan_id, recurring_price_cents, monthly_credits_cents, storage_limit_bytes, stripe_price_id, acquisition_enabled, is_active, effective_start_at, created_at"
        )
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
      supabaseAdmin
        .from("billing_subscription_contracts")
        .select("user_id, plan_id, recurring_price_cents")
        .is("ended_at", null),
      supabaseAdmin.from("billing_profiles").select("user_id, plan_id"),
    ]);

    if (
      planOffersResult.error ||
      creditPackagesResult.error ||
      storageMetadataResult.error ||
      storageOffersResult.error ||
      currentContractsResult.error ||
      billingProfilesResult.error
    ) {
      const detail = [
        planOffersResult.error?.message,
        creditPackagesResult.error?.message,
        storageMetadataResult.error?.message,
        storageOffersResult.error?.message,
        currentContractsResult.error?.message,
        billingProfilesResult.error?.message,
      ]
        .filter(Boolean)
        .join(" | ");
      return res.status(500).json({ error: detail || "Unable to load pricing state." });
    }

    const planMetadata = new Map<string, BillingPlanMetadataRow>(
      (planMetadataRows ?? []).map((row) => [row.id, row])
    );
    const activeAcquisitionOfferByPlanId = new Map<string, BillingPlanOfferRow>();
    const currentOfferByPlanId = new Map<string, BillingPlanOfferRow>();
    const latestPlanOfferByPlanId = new Map<string, BillingPlanOfferRow>();
    for (const offer of ((planOffersResult.data ?? []) as BillingPlanOfferRow[]).sort(
      compareOfferRecency
    )) {
      if (
        offer.acquisition_enabled &&
        offer.is_active &&
        !activeAcquisitionOfferByPlanId.has(offer.plan_id)
      ) {
        activeAcquisitionOfferByPlanId.set(offer.plan_id, offer);
      }
      if (offer.is_active && !currentOfferByPlanId.has(offer.plan_id)) {
        currentOfferByPlanId.set(offer.plan_id, offer);
      }
      if (!latestPlanOfferByPlanId.has(offer.plan_id)) {
        latestPlanOfferByPlanId.set(offer.plan_id, offer);
      }
    }

    const accountCountByPlanId = new Map<string, number>();
    const usersWithCurrentContracts = new Set<string>();
    for (const contract of (currentContractsResult.data ??
      []) as BillingSubscriptionContractCountRow[]) {
      usersWithCurrentContracts.add(contract.user_id);
      accountCountByPlanId.set(
        contract.plan_id,
        (accountCountByPlanId.get(contract.plan_id) ?? 0) + 1
      );
    }

    for (const profile of (billingProfilesResult.data ?? []) as BillingProfileCountRow[]) {
      if (!profile.plan_id || usersWithCurrentContracts.has(profile.user_id)) continue;
      accountCountByPlanId.set(
        profile.plan_id,
        (accountCountByPlanId.get(profile.plan_id) ?? 0) + 1
      );
    }

    const plans: AdminPricingPlanRow[] = [...planMetadata.values()]
      .map((metadata) => {
        const activeAcquisitionOffer = activeAcquisitionOfferByPlanId.get(metadata.id) ?? null;
        const currentOffer = currentOfferByPlanId.get(metadata.id) ?? null;
        const latestOffer = latestPlanOfferByPlanId.get(metadata.id) ?? null;
        const offer = activeAcquisitionOffer ?? currentOffer ?? latestOffer;
        const accountCount = accountCountByPlanId.get(metadata.id) ?? 0;
        const isActive =
          Boolean(metadata.is_active) &&
          Boolean(activeAcquisitionOffer?.acquisition_enabled) &&
          Boolean(activeAcquisitionOffer?.is_active);
        const status: AdminPricingPlanRow["status"] = isActive
          ? "active"
          : accountCount > 0
            ? "legacy"
            : "inactive";
        return {
          planId: metadata.id,
          displayName: metadata.display_name,
          offerId: offer?.id ?? `${metadata.id}__none`,
          sortOrder: Number(metadata.sort_order ?? 0),
          accountCount,
          status,
          recurringPriceCents: Number(
            offer?.recurring_price_cents ?? metadata.monthly_price_cents ?? 0
          ),
          monthlyCreditsCents: Number(
            offer?.monthly_credits_cents ?? metadata.monthly_credits_cents ?? 0
          ),
          storageLimitBytes: Number(
            offer?.storage_limit_bytes ?? metadata.storage_limit_bytes ?? 0
          ),
          stripeProductId: metadata.stripe_product_id,
          stripePriceId: offer?.stripe_price_id ?? metadata.stripe_price_id,
          acquisitionEnabled: Boolean(activeAcquisitionOffer?.acquisition_enabled),
          isActive,
          effectiveStartAt: offer?.effective_start_at ?? null,
        } satisfies AdminPricingPlanRow;
      })
      .sort((a, b) => {
        if (a.sortOrder === b.sortOrder) {
          return a.recurringPriceCents - b.recurringPriceCents;
        }
        return a.sortOrder - b.sortOrder;
      });

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
        workflowType: getAdminModelWorkflowType(model),
        pricingStrategy: model.pricingStrategy,
        pricingStrategyLabel: getAdminPricingStrategyLabel(model.id, model.pricingStrategy),
        defaultAspect: model.defaultAspect,
        defaultResolution: model.defaultResolution ?? null,
        defaultDurationSeconds: model.defaultDurationSeconds ?? null,
        roundingIncrement: resolveModelPricingForModel(runtimePricingPolicy.policy, model.id)
          .roundingIncrement,
        pricingPreview: mapPricingPreview(model.id, runtimePricingPolicy.policy),
      }));

    const payload: AdminPricingStateResponse = {
      generatedAt: new Date().toISOString(),
      modelPolicy: getModelPricingPolicySnapshot(runtimePricingPolicy.policy, {
        activePolicyVersion: runtimePricingPolicy.activePolicyVersion,
        policySource: runtimePricingPolicy.source,
        updatedAt: runtimePricingPolicy.updatedAt,
        updatedByEmail: runtimePricingPolicy.updatedByEmail,
      }),
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
