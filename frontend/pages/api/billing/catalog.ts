/**
 * Returns the active billing catalog for authenticated users.
 * Centralizes subscription plans and one-time credit packages behind one backend contract.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";

type BillingPlanResponse = {
  id: string;
  display_name: string;
  monthly_price_cents: number;
  monthly_credits_cents: number;
  storage_limit_bytes: number;
  is_active: boolean;
};

type CreditPackageResponse = {
  id: string;
  display_name: string;
  credit_amount_cents: number;
  price_cents: number;
  sort_order: number;
};

type StorageAddonResponse = {
  id: string;
  display_name: string;
  storage_limit_bytes: number;
  monthly_price_cents: number;
  sort_order: number;
};

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

const compareOfferRecency = <T extends { effective_start_at: string | null; created_at: string }>(
  a: T,
  b: T
) => {
  const aDate = Date.parse(a.effective_start_at ?? a.created_at);
  const bDate = Date.parse(b.effective_start_at ?? b.created_at);
  return bDate - aDate;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) {
    return;
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const [
      planMetadataResult,
      planOffersResult,
      packagesResult,
      storageAddonMetadataResult,
      storageAddonOffersResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("billing_plans")
        .select("id, display_name, is_active")
        .eq("is_active", true),
      supabaseAdmin
        .from("billing_plan_offers")
        .select(
          "id, plan_id, recurring_price_cents, monthly_credits_cents, storage_limit_bytes, acquisition_enabled, is_active, effective_start_at, created_at"
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
      planMetadataResult.error ||
      planOffersResult.error ||
      packagesResult.error ||
      storageAddonMetadataResult.error ||
      storageAddonOffersResult.error
    ) {
      const detail = [
        planMetadataResult.error?.message,
        planOffersResult.error?.message,
        packagesResult.error?.message,
        storageAddonMetadataResult.error?.message,
        storageAddonOffersResult.error?.message,
      ]
        .filter(Boolean)
        .join(" | ");
      return res.status(500).json({ error: detail || "Unable to load billing catalog." });
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
    const plans: BillingPlanResponse[] = [...latestPlanOfferByPlanId.values()]
      .map((offer) => {
        const metadata = planMetadata.get(offer.plan_id);
        if (!metadata) return null;
        return {
          id: offer.plan_id,
          display_name: metadata.display_name,
          monthly_price_cents: offer.recurring_price_cents,
          monthly_credits_cents: offer.monthly_credits_cents,
          storage_limit_bytes: offer.storage_limit_bytes,
          is_active: Boolean(metadata.is_active && offer.is_active),
        } satisfies BillingPlanResponse;
      })
      .filter((row): row is BillingPlanResponse => row !== null)
      .sort((a, b) => a.monthly_price_cents - b.monthly_price_cents);

    const storageAddonMetadata = new Map<string, BillingStorageAddonMetadataRow>(
      ((storageAddonMetadataResult.data ?? []) as BillingStorageAddonMetadataRow[]).map((row) => [
        row.id,
        row,
      ])
    );
    const latestStorageAddonOfferByAddonId = new Map<string, BillingStorageAddonOfferRow>();
    for (const offer of (
      (storageAddonOffersResult.data ?? []) as BillingStorageAddonOfferRow[]
    ).sort(compareOfferRecency)) {
      if (!latestStorageAddonOfferByAddonId.has(offer.storage_addon_id)) {
        latestStorageAddonOfferByAddonId.set(offer.storage_addon_id, offer);
      }
    }
    const storageAddons: StorageAddonResponse[] = [...latestStorageAddonOfferByAddonId.values()]
      .map((offer) => {
        const metadata = storageAddonMetadata.get(offer.storage_addon_id);
        if (!metadata) return null;
        return {
          id: offer.storage_addon_id,
          display_name: metadata.display_name,
          storage_limit_bytes: offer.storage_limit_bytes,
          monthly_price_cents: offer.recurring_price_cents,
          sort_order: metadata.sort_order,
        } satisfies StorageAddonResponse;
      })
      .filter((row): row is StorageAddonResponse => row !== null)
      .sort((a, b) => a.sort_order - b.sort_order);

    return res.status(200).json({
      plans,
      packages: (packagesResult.data ?? []) as CreditPackageResponse[],
      storageAddons,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "billing/catalog",
      user,
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to load billing catalog.",
    });
  }
}
