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
  AdminPricingPreviewVariant,
  AdminPricingPlanRow,
  AdminPricingStateResponse,
  AdminPricingStorageAddonRow,
} from "../../../../features/admin/types";
import {
  buildDefaultPricingParams,
  computeCostForModel,
} from "../../../../lib/model-runtime/pricing";
import {
  KIE_KLING_30_MOTION_CONTROL_LABEL,
  KIE_KLING_30_MOTION_CONTROL_VARIANT_ID,
} from "../../../../lib/model-runtime/klingMotionControlPricing";
import {
  listModelConfigs,
  listPricingModelConfigs,
  type ModelConfig,
} from "../../../../lib/model-runtime/modelRegistry";
import { KIE_KLING_30_MODEL_ID } from "../../../../lib/model-runtime/providerModelIds";
import { getAdminModelWorkflowType } from "../../../../lib/model-runtime/modelWorkflowType";
import { getAdminPricingStrategyLabel } from "../../../../lib/model-runtime/modelPricingStrategyLabel";
import { resolveDefaultPlanConcurrencyLimit } from "../../../../lib/billing/planConcurrency";
import { compactAdminPricingCustomRowsDocument } from "../../../../lib/model-runtime/adminPricingCustomRows";
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
  billing_interval: "month" | "year";
  recurring_price_cents: number;
  monthly_credits_cents: number;
  storage_limit_bytes: number;
  max_concurrent_generations?: number | null;
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
  params: ReturnType<typeof buildDefaultPricingParams>,
  pricingPolicy: Parameters<typeof computeCostForModel>[2]
): AdminCreditPricingBreakdown | null => {
  const breakdown = computeCostForModel(modelId, params, pricingPolicy);
  if (!breakdown) return null;
  return {
    usdRaw: breakdown.usdRaw,
    rawCredits: breakdown.rawCredits,
    billedCredits: breakdown.credits,
    billedUsd: breakdown.usd,
  };
};

const mapPricingPreviewVariants = (
  model: Pick<ModelConfig, "id" | "mediaType" | "supportsTextToImage" | "supportsImageToImage">,
  pricingPolicy: Parameters<typeof computeCostForModel>[2]
): AdminPricingPreviewVariant[] => {
  if (model.id === KIE_KLING_30_MODEL_ID) {
    const standardBreakdown = mapPricingPreview(
      model.id,
      buildDefaultPricingParams(model.id),
      pricingPolicy
    );
    const motionBreakdown = mapPricingPreview(
      model.id,
      buildDefaultPricingParams(model.id, {
        variantBaseId: KIE_KLING_30_MOTION_CONTROL_VARIANT_ID,
      }),
      pricingPolicy
    );

    return [
      standardBreakdown
        ? {
            id: "default",
            label: "Standard",
            breakdown: standardBreakdown,
          }
        : null,
      motionBreakdown
        ? {
            id: KIE_KLING_30_MOTION_CONTROL_VARIANT_ID,
            label: KIE_KLING_30_MOTION_CONTROL_LABEL,
            breakdown: motionBreakdown,
          }
        : null,
    ].filter((variant): variant is AdminPricingPreviewVariant => variant !== null);
  }

  if (model.mediaType !== "image") {
    const breakdown = mapPricingPreview(
      model.id,
      buildDefaultPricingParams(model.id),
      pricingPolicy
    );
    return breakdown ? [{ id: "default", label: "Default", breakdown }] : [];
  }

  if (model.supportsTextToImage && model.supportsImageToImage) {
    const createBreakdown = mapPricingPreview(
      model.id,
      buildDefaultPricingParams(model.id),
      pricingPolicy
    );
    const editBreakdown = mapPricingPreview(
      model.id,
      buildDefaultPricingParams(model.id, {
        inputImageCount: 1,
        inputFidelity: "high",
      }),
      pricingPolicy
    );

    return [
      createBreakdown
        ? {
            id: "create",
            label: "Create",
            breakdown: createBreakdown,
          }
        : null,
      editBreakdown
        ? {
            id: "edit",
            label: "Edit",
            breakdown: editBreakdown,
          }
        : null,
    ].filter((variant): variant is AdminPricingPreviewVariant => variant !== null);
  }

  const breakdown = mapPricingPreview(model.id, buildDefaultPricingParams(model.id), pricingPolicy);
  return breakdown ? [{ id: "default", label: "Default", breakdown }] : [];
};

const buildModelPolicyHealthWarnings = (
  perModelPolicy: Record<string, unknown>,
  models: ModelConfig[]
): string[] => {
  const warnings: string[] = [];
  const modelById = new Map(models.map((model) => [model.id, model]));
  const pricingModelIds = new Set(listPricingModelConfigs().map((model) => model.id));
  const unknownOverrideIds: string[] = [];
  const nonPricingOverrideIds: string[] = [];
  const inactiveOverrideIds: string[] = [];

  Object.keys(perModelPolicy).forEach((modelId) => {
    const model = modelById.get(modelId);
    if (!model) {
      unknownOverrideIds.push(modelId);
      return;
    }
    if (model.lifecycle !== "active") {
      inactiveOverrideIds.push(modelId);
    }
    if (!pricingModelIds.has(modelId)) {
      nonPricingOverrideIds.push(modelId);
    }
  });

  if (unknownOverrideIds.length) {
    warnings.push(
      `${unknownOverrideIds.length} model pricing override${unknownOverrideIds.length === 1 ? "" : "s"} target unknown catalog ids: ${unknownOverrideIds.join(", ")}.`
    );
  }
  if (inactiveOverrideIds.length) {
    warnings.push(
      `${inactiveOverrideIds.length} model pricing override${inactiveOverrideIds.length === 1 ? "" : "s"} target inactive catalog models: ${inactiveOverrideIds.join(", ")}.`
    );
  }
  if (nonPricingOverrideIds.length) {
    warnings.push(
      `${nonPricingOverrideIds.length} model pricing override${nonPricingOverrideIds.length === 1 ? "" : "s"} target models outside the pricing surface: ${nonPricingOverrideIds.join(", ")}.`
    );
  }

  return warnings;
};

const buildHealthSummary = ({
  plans,
  creditPackages,
  storageAddons,
  modelPolicyWarnings = [],
}: {
  plans: AdminPricingPlanRow[];
  creditPackages: AdminPricingCreditPackageRow[];
  storageAddons: AdminPricingStorageAddonRow[];
  modelPolicyWarnings?: string[];
}): AdminPricingHealthSummary => {
  const activePlanOffersMissingStripePriceIds = plans.reduce((count, row) => {
    const intervalOffers = [row.monthlyOffer, row.annualOffer];
    return (
      count +
      intervalOffers.filter(
        (offer) =>
          offer?.acquisitionEnabled &&
          offer.isActive &&
          offer.recurringPriceCents > 0 &&
          !offer.stripePriceId
      ).length
    );
  }, 0);
  const creditPackagesMissingStripePriceIds = creditPackages.filter(
    (row) => row.isActive && !row.stripePriceId
  ).length;
  const storageAddonsMissingCurrentOffer = storageAddons.filter((row) => !row.offerId).length;
  const storageOffersMissingStripePriceIds = storageAddons.filter(
    (row) => Boolean(row.offerId) && row.recurringPriceCents > 0 && !row.stripePriceId
  ).length;

  const warnings: string[] = [...modelPolicyWarnings];
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
  if (storageAddonsMissingCurrentOffer > 0) {
    warnings.push(
      `${storageAddonsMissingCurrentOffer} active storage add-on${storageAddonsMissingCurrentOffer === 1 ? "" : "s"} missing a current public offer.`
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

  let adminUser;
  try {
    adminUser = await requireAdminUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/pricing/state.auth",
      metadata: {
        source: "api.admin.pricing.state",
      },
    });
    return res.status(500).json({ error: "Unable to load pricing state." });
  }
  if (!adminUser) return;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const runtimePricingPolicy = await resolveRuntimeModelPricingPolicy({ bypassCache: true });
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
          "id, plan_id, billing_interval, recurring_price_cents, monthly_credits_cents, storage_limit_bytes, max_concurrent_generations, stripe_price_id, acquisition_enabled, is_active, effective_start_at, created_at"
        )
        .order("effective_start_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("billing_credit_packages")
        .select(
          "id, display_name, credit_amount_cents, price_cents, stripe_price_id, sort_order, is_active"
        )
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
    const activeAcquisitionOfferByPlanAndInterval = new Map<string, BillingPlanOfferRow>();
    const currentOfferByPlanAndInterval = new Map<string, BillingPlanOfferRow>();
    const latestPlanOfferByPlanAndInterval = new Map<string, BillingPlanOfferRow>();
    for (const offer of ((planOffersResult.data ?? []) as BillingPlanOfferRow[]).sort(
      compareOfferRecency
    )) {
      const intervalKey = `${offer.plan_id}:${offer.billing_interval}`;
      if (
        offer.acquisition_enabled &&
        offer.is_active &&
        !activeAcquisitionOfferByPlanAndInterval.has(intervalKey)
      ) {
        activeAcquisitionOfferByPlanAndInterval.set(intervalKey, offer);
      }
      if (offer.is_active && !currentOfferByPlanAndInterval.has(intervalKey)) {
        currentOfferByPlanAndInterval.set(intervalKey, offer);
      }
      if (!latestPlanOfferByPlanAndInterval.has(intervalKey)) {
        latestPlanOfferByPlanAndInterval.set(intervalKey, offer);
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
        const activeMonthlyOffer =
          activeAcquisitionOfferByPlanAndInterval.get(`${metadata.id}:month`) ?? null;
        const activeAnnualOffer =
          activeAcquisitionOfferByPlanAndInterval.get(`${metadata.id}:year`) ?? null;
        const currentMonthlyOffer =
          currentOfferByPlanAndInterval.get(`${metadata.id}:month`) ?? null;
        const currentAnnualOffer = currentOfferByPlanAndInterval.get(`${metadata.id}:year`) ?? null;
        const latestMonthlyOffer =
          latestPlanOfferByPlanAndInterval.get(`${metadata.id}:month`) ?? null;
        const latestAnnualOffer =
          latestPlanOfferByPlanAndInterval.get(`${metadata.id}:year`) ?? null;
        const monthlyOffer = activeMonthlyOffer ?? currentMonthlyOffer ?? latestMonthlyOffer;
        const annualOffer = activeAnnualOffer ?? currentAnnualOffer ?? latestAnnualOffer;
        const offer = monthlyOffer ?? annualOffer;
        const accountCount = accountCountByPlanId.get(metadata.id) ?? 0;
        const isActive =
          Boolean(metadata.is_active) &&
          Boolean(
            activeMonthlyOffer?.acquisition_enabled ?? activeAnnualOffer?.acquisition_enabled
          ) &&
          Boolean(activeMonthlyOffer?.is_active ?? activeAnnualOffer?.is_active);
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
          maxConcurrentGenerations: Number(
            offer?.max_concurrent_generations ?? resolveDefaultPlanConcurrencyLimit(metadata.id)
          ),
          stripeProductId: metadata.stripe_product_id,
          stripePriceId: offer?.stripe_price_id ?? metadata.stripe_price_id,
          acquisitionEnabled: Boolean(
            activeMonthlyOffer?.acquisition_enabled ?? activeAnnualOffer?.acquisition_enabled
          ),
          isActive,
          effectiveStartAt: offer?.effective_start_at ?? null,
          monthlyOffer: monthlyOffer
            ? {
                offerId: monthlyOffer.id,
                recurringPriceCents: Number(monthlyOffer.recurring_price_cents ?? 0),
                monthlyCreditsCents: Number(monthlyOffer.monthly_credits_cents ?? 0),
                storageLimitBytes: Number(monthlyOffer.storage_limit_bytes ?? 0),
                maxConcurrentGenerations: Number(
                  monthlyOffer.max_concurrent_generations ??
                    resolveDefaultPlanConcurrencyLimit(metadata.id)
                ),
                stripePriceId: monthlyOffer.stripe_price_id,
                acquisitionEnabled: Boolean(monthlyOffer.acquisition_enabled),
                isActive: Boolean(monthlyOffer.is_active),
                effectiveStartAt: monthlyOffer.effective_start_at ?? null,
              }
            : null,
          annualOffer: annualOffer
            ? {
                offerId: annualOffer.id,
                recurringPriceCents: Number(annualOffer.recurring_price_cents ?? 0),
                monthlyCreditsCents: Number(annualOffer.monthly_credits_cents ?? 0),
                storageLimitBytes: Number(annualOffer.storage_limit_bytes ?? 0),
                maxConcurrentGenerations: Number(
                  annualOffer.max_concurrent_generations ??
                    resolveDefaultPlanConcurrencyLimit(metadata.id)
                ),
                stripePriceId: annualOffer.stripe_price_id,
                acquisitionEnabled: Boolean(annualOffer.acquisition_enabled),
                isActive: Boolean(annualOffer.is_active),
                effectiveStartAt: annualOffer.effective_start_at ?? null,
              }
            : null,
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

    const storageAddons: AdminPricingStorageAddonRow[] = [...storageMetadata.values()]
      .map((metadata) => {
        const offer = latestStorageOfferByAddonId.get(metadata.id) ?? null;
        return {
          storageAddonId: metadata.id,
          displayName: metadata.display_name,
          offerId: offer?.id ?? null,
          storageLimitBytes: Number(offer?.storage_limit_bytes ?? 0),
          recurringPriceCents: Number(offer?.recurring_price_cents ?? 0),
          stripePriceId: offer?.stripe_price_id ?? null,
          acquisitionEnabled: Boolean(offer?.acquisition_enabled),
          isActive: Boolean(metadata.is_active && offer?.is_active),
          effectiveStartAt: offer?.effective_start_at ?? null,
          sortOrder: Number(metadata.sort_order ?? 0),
        } satisfies AdminPricingStorageAddonRow;
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const allModels = listModelConfigs();
    const models: AdminPricingModelRow[] = listPricingModelConfigs().map((model) => {
      const pricingPreviewVariants = mapPricingPreviewVariants(model, runtimePricingPolicy.policy);
      return {
        id: model.id,
        label: model.label,
        provider: model.provider,
        sourceUrl: model.sourceUrl ?? "",
        workflowType: getAdminModelWorkflowType(model),
        pricingStrategy: model.pricingStrategy,
        pricingStrategyLabel: getAdminPricingStrategyLabel(model.id, model.pricingStrategy),
        lifecycle: model.lifecycle ?? null,
        surfaces: model.surfaces,
        displayFamily: model.displayFamily ?? null,
        pricingFamily: model.pricingFamily ?? null,
        surfaceNote: model.surfaceNote ?? null,
        defaultAspect: model.defaultAspect,
        allowedAspects: model.allowedAspects ?? [],
        defaultResolution: model.defaultResolution ?? null,
        allowedResolutions: model.allowedResolutions ?? [],
        defaultDurationSeconds: model.defaultDurationSeconds ?? null,
        defaultSourceDurationSeconds: model.defaultSourceDurationSeconds ?? null,
        minDurationSeconds: model.minDurationSeconds ?? null,
        maxDurationSeconds: model.maxDurationSeconds ?? null,
        allowedDurations: model.allowedDurations ?? [],
        defaultAudio: model.defaultAudio ?? null,
        roundingIncrement: resolveModelPricingForModel(runtimePricingPolicy.policy, model.id)
          .roundingIncrement,
        pricingAuthority: model.pricingAuthority ?? "shared_policy",
        pricingPreview: pricingPreviewVariants[0]?.breakdown ?? null,
        pricingPreviewVariants,
      } satisfies AdminPricingModelRow;
    });

    const payload: AdminPricingStateResponse = {
      generatedAt: new Date().toISOString(),
      modelPolicy: getModelPricingPolicySnapshot(runtimePricingPolicy.policy, {
        activePolicyVersion: runtimePricingPolicy.activePolicyVersion,
        policySource: runtimePricingPolicy.source,
        updatedAt: runtimePricingPolicy.updatedAt,
        updatedByEmail: runtimePricingPolicy.updatedByEmail,
      }),
      customRows: compactAdminPricingCustomRowsDocument(runtimePricingPolicy.customRows),
      models,
      plans,
      creditPackages,
      storageAddons,
      health: buildHealthSummary({
        plans,
        creditPackages,
        storageAddons,
        modelPolicyWarnings: buildModelPolicyHealthWarnings(
          runtimePricingPolicy.policy.perModel,
          allModels
        ),
      }),
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
