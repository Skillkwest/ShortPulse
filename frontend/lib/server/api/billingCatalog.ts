/**
 * Shared billing catalog loader for public and authenticated surfaces.
 * Resolves the current acquisition-safe plan, credit-pack, and storage-addon snapshot.
 */
import type {
  BillingCatalogSnapshot,
  BillingInterval,
  BillingPlanIntervalOfferRecord,
  BillingPlanRecord,
  BillingStorageAddonRecord,
  CreditPackageRecord,
} from "../../../features/billing/catalog";
import { resolveDefaultPlanConcurrencyLimit } from "../../billing/planConcurrency";
import { getSupabaseAdmin } from "./supabaseAdmin";

type BillingPlanMetadataRow = {
  id: string;
  display_name: string;
  is_active: boolean;
  sort_order: number;
};

type BillingPlanOfferRow = {
  id: string;
  plan_id: string;
  billing_interval: BillingInterval;
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

const compareOfferRecency = <T extends { effective_start_at: string | null; created_at: string }>(
  left: T,
  right: T
) => {
  const leftDate = Date.parse(left.effective_start_at ?? left.created_at);
  const rightDate = Date.parse(right.effective_start_at ?? right.created_at);
  return rightDate - leftDate;
};

const loadBillingPlanMetadataRows = async (supabaseAdmin: ReturnType<typeof getSupabaseAdmin>) => {
  const withSortOrder = await supabaseAdmin
    .from("billing_plans")
    .select("id, display_name, is_active, sort_order")
    .eq("is_active", true);

  if (!withSortOrder.error) {
    return withSortOrder.data as BillingPlanMetadataRow[];
  }

  if (!isSchemaDriftError(withSortOrder.error)) {
    throw new Error(withSortOrder.error.message || "Unable to load billing plan metadata.");
  }

  const fallback = await supabaseAdmin
    .from("billing_plans")
    .select("id, display_name, is_active")
    .eq("is_active", true);

  if (fallback.error) {
    throw new Error(fallback.error.message || "Unable to load billing plan metadata.");
  }

  return (
    (fallback.data ?? []) as Array<{
      id: string;
      display_name: string;
      is_active: boolean;
    }>
  ).map((row, index) => ({
    ...row,
    sort_order: index * 10,
  }));
};

/**
 * Loads the current public billing catalog snapshot from Supabase.
 */
export const loadBillingCatalogSnapshot = async (
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin> = getSupabaseAdmin()
): Promise<BillingCatalogSnapshot> => {
  const [
    planMetadataRows,
    planOffersResult,
    packagesResult,
    storageAddonMetadataResult,
    storageAddonOffersResult,
  ] = await Promise.all([
    loadBillingPlanMetadataRows(supabaseAdmin),
    supabaseAdmin
      .from("billing_plan_offers")
      .select(
        "id, plan_id, billing_interval, recurring_price_cents, monthly_credits_cents, storage_limit_bytes, max_concurrent_generations, stripe_price_id, acquisition_enabled, is_active, effective_start_at, created_at"
      )
      .eq("acquisition_enabled", true)
      .eq("is_active", true)
      .is("effective_end_at", null)
      .order("effective_start_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("billing_credit_packages")
      .select("id, display_name, credit_amount_cents, price_cents, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabaseAdmin
      .from("billing_storage_addons")
      .select("id, display_name, sort_order, is_active")
      .eq("is_active", true),
    supabaseAdmin
      .from("billing_storage_addon_offers")
      .select(
        "id, storage_addon_id, storage_limit_bytes, recurring_price_cents, acquisition_enabled, is_active, effective_start_at, created_at"
      )
      .eq("acquisition_enabled", true)
      .eq("is_active", true)
      .is("effective_end_at", null)
      .order("effective_start_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
  ]);

  if (
    planOffersResult.error ||
    packagesResult.error ||
    storageAddonMetadataResult.error ||
    storageAddonOffersResult.error
  ) {
    const detail = [
      planOffersResult.error?.message,
      packagesResult.error?.message,
      storageAddonMetadataResult.error?.message,
      storageAddonOffersResult.error?.message,
    ]
      .filter(Boolean)
      .join(" | ");
    throw new Error(detail || "Unable to load billing catalog.");
  }

  const planMetadata = new Map<string, BillingPlanMetadataRow>(
    (planMetadataRows ?? []).map((row) => [row.id, row])
  );
  const latestPlanOfferByPlanAndInterval = new Map<string, BillingPlanOfferRow>();
  for (const offer of ((planOffersResult.data ?? []) as BillingPlanOfferRow[]).sort(
    compareOfferRecency
  )) {
    const intervalKey = `${offer.plan_id}:${offer.billing_interval}`;
    if (!latestPlanOfferByPlanAndInterval.has(intervalKey)) {
      latestPlanOfferByPlanAndInterval.set(intervalKey, offer);
    }
  }

  const planIds = new Set<string>([
    ...planMetadata.keys(),
    ...((planOffersResult.data ?? []) as BillingPlanOfferRow[]).map((offer) => offer.plan_id),
  ]);

  const plans = [...planIds]
    .flatMap((planId): BillingPlanRecord[] => {
      const metadata = planMetadata.get(planId);
      if (!metadata) return [];

      const monthlyOffer = latestPlanOfferByPlanAndInterval.get(`${planId}:month`) ?? null;
      const annualOffer = latestPlanOfferByPlanAndInterval.get(`${planId}:year`) ?? null;
      const primaryOffer = monthlyOffer ?? annualOffer;
      if (!primaryOffer) return [];

      const offers: Partial<Record<BillingInterval, BillingPlanIntervalOfferRecord>> = {};
      if (monthlyOffer) {
        offers.month = {
          id: monthlyOffer.id,
          billing_interval: "month",
          recurring_price_cents: monthlyOffer.recurring_price_cents,
          monthly_credits_cents: monthlyOffer.monthly_credits_cents,
          storage_limit_bytes: monthlyOffer.storage_limit_bytes,
          max_concurrent_generations:
            monthlyOffer.max_concurrent_generations ?? resolveDefaultPlanConcurrencyLimit(planId),
          stripe_price_id: monthlyOffer.stripe_price_id,
          acquisition_enabled: monthlyOffer.acquisition_enabled,
          is_active: monthlyOffer.is_active,
          effective_start_at: monthlyOffer.effective_start_at,
        };
      }
      if (annualOffer) {
        offers.year = {
          id: annualOffer.id,
          billing_interval: "year",
          recurring_price_cents: annualOffer.recurring_price_cents,
          monthly_credits_cents: annualOffer.monthly_credits_cents,
          storage_limit_bytes: annualOffer.storage_limit_bytes,
          max_concurrent_generations:
            annualOffer.max_concurrent_generations ?? resolveDefaultPlanConcurrencyLimit(planId),
          stripe_price_id: annualOffer.stripe_price_id,
          acquisition_enabled: annualOffer.acquisition_enabled,
          is_active: annualOffer.is_active,
          effective_start_at: annualOffer.effective_start_at,
        };
      }

      return [
        {
          id: planId,
          display_name: metadata.display_name,
          sort_order: Number(metadata.sort_order ?? 0),
          monthly_price_cents:
            monthlyOffer?.recurring_price_cents ?? primaryOffer.recurring_price_cents,
          monthly_credits_cents:
            monthlyOffer?.monthly_credits_cents ?? primaryOffer.monthly_credits_cents,
          storage_limit_bytes:
            monthlyOffer?.storage_limit_bytes ?? primaryOffer.storage_limit_bytes,
          max_concurrent_generations:
            monthlyOffer?.max_concurrent_generations ??
            primaryOffer.max_concurrent_generations ??
            resolveDefaultPlanConcurrencyLimit(planId),
          is_active: Boolean(metadata.is_active && primaryOffer.is_active),
          offers,
        },
      ];
    })
    .sort((left, right) => {
      if ((left.sort_order ?? 0) === (right.sort_order ?? 0)) {
        return left.monthly_price_cents - right.monthly_price_cents;
      }
      return (left.sort_order ?? 0) - (right.sort_order ?? 0);
    });

  const storageAddonMetadata = new Map<string, BillingStorageAddonMetadataRow>(
    ((storageAddonMetadataResult.data ?? []) as BillingStorageAddonMetadataRow[]).map((row) => [
      row.id,
      row,
    ])
  );
  const latestStorageAddonOfferByAddonId = new Map<string, BillingStorageAddonOfferRow>();
  for (const offer of ((storageAddonOffersResult.data ?? []) as BillingStorageAddonOfferRow[]).sort(
    compareOfferRecency
  )) {
    if (!latestStorageAddonOfferByAddonId.has(offer.storage_addon_id)) {
      latestStorageAddonOfferByAddonId.set(offer.storage_addon_id, offer);
    }
  }

  const storageAddons: BillingStorageAddonRecord[] = [...latestStorageAddonOfferByAddonId.values()]
    .map((offer) => {
      const metadata = storageAddonMetadata.get(offer.storage_addon_id);
      if (!metadata) return null;
      return {
        id: offer.storage_addon_id,
        display_name: metadata.display_name,
        storage_limit_bytes: offer.storage_limit_bytes,
        monthly_price_cents: offer.recurring_price_cents,
        sort_order: metadata.sort_order,
      } satisfies BillingStorageAddonRecord;
    })
    .filter((row): row is BillingStorageAddonRecord => row !== null)
    .sort((left, right) => left.sort_order - right.sort_order);

  return {
    plans,
    packages: (packagesResult.data ?? []) as CreditPackageRecord[],
    storageAddons,
  };
};
