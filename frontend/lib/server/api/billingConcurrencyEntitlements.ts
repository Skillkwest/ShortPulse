/**
 * Server-side resolver for plan-based generation concurrency entitlements.
 * Billing subscription contracts are authoritative; current offers and plan defaults are fallbacks.
 */
import {
  resolveDefaultPlanConcurrencyLimit,
  resolvePlanConcurrencyDisplayName,
} from "../../billing/planConcurrency";
import { getSupabaseAdmin } from "./supabaseAdmin";

export type BillingConcurrencyEntitlementSource = "contract" | "current_offer" | "default";

export type BillingConcurrencyEntitlement = {
  userId: string;
  planId: string;
  planDisplayName: string;
  offerId: string | null;
  contractId: string | null;
  maxConcurrentGenerations: number;
  source: BillingConcurrencyEntitlementSource;
};

type BillingContractConcurrencyRow = {
  id: string;
  plan_id: string | null;
  offer_id: string | null;
  max_concurrent_generations: number | string | null;
};

type BillingProfileConcurrencyRow = {
  plan_id: string | null;
};

type BillingOfferConcurrencyRow = {
  id: string;
  plan_id: string | null;
  max_concurrent_generations: number | string | null;
};

const FALLBACK_PLAN_ID = "free";

const isIgnorableConcurrencySchemaError = (
  error: { code?: string | null; message?: string | null } | null
): boolean => {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "42703") return true;
  return /does not exist|schema cache/i.test(String(error.message ?? ""));
};

const normalizePlanId = (value: unknown): string => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return normalized || FALLBACK_PLAN_ID;
};

const normalizeConcurrencyLimit = (value: unknown, fallback: number): number => {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed === "number" && Number.isFinite(parsed)) {
    return Math.max(0, Math.trunc(parsed));
  }
  return fallback;
};

const buildEntitlement = ({
  userId,
  planId,
  offerId,
  contractId,
  maxConcurrentGenerations,
  source,
}: Omit<BillingConcurrencyEntitlement, "planDisplayName">): BillingConcurrencyEntitlement => ({
  userId,
  planId,
  planDisplayName: resolvePlanConcurrencyDisplayName(planId),
  offerId,
  contractId,
  maxConcurrentGenerations,
  source,
});

/**
 * Resolves the active generation slot entitlement for a user.
 */
export const resolveBillingConcurrencyEntitlement = async (
  userId: string
): Promise<BillingConcurrencyEntitlement> => {
  const supabaseAdmin = getSupabaseAdmin();

  const contractResult = await supabaseAdmin
    .from("billing_subscription_contracts")
    .select("id, plan_id, offer_id, max_concurrent_generations")
    .eq("user_id", userId)
    .is("ended_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (contractResult.error && !isIgnorableConcurrencySchemaError(contractResult.error)) {
    throw new Error(
      contractResult.error.message || "Failed to resolve generation concurrency contract."
    );
  }

  const contract = (contractResult.data as BillingContractConcurrencyRow | null) ?? null;
  if (contract?.id) {
    const planId = normalizePlanId(contract.plan_id);
    return buildEntitlement({
      userId,
      planId,
      offerId: typeof contract.offer_id === "string" ? contract.offer_id : null,
      contractId: contract.id,
      maxConcurrentGenerations: normalizeConcurrencyLimit(
        contract.max_concurrent_generations,
        resolveDefaultPlanConcurrencyLimit(planId)
      ),
      source: "contract",
    });
  }

  const profileResult = await supabaseAdmin
    .from("billing_profiles")
    .select("plan_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileResult.error && !isIgnorableConcurrencySchemaError(profileResult.error)) {
    throw new Error(
      profileResult.error.message || "Failed to resolve generation concurrency profile."
    );
  }

  const profile = (profileResult.data as BillingProfileConcurrencyRow | null) ?? null;
  const planId = normalizePlanId(profile?.plan_id);

  const offerResult = await supabaseAdmin
    .from("billing_plan_offers")
    .select("id, plan_id, max_concurrent_generations")
    .eq("plan_id", planId)
    .eq("billing_interval", "month")
    .eq("is_active", true)
    .is("effective_end_at", null)
    .order("effective_start_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (offerResult.error && !isIgnorableConcurrencySchemaError(offerResult.error)) {
    throw new Error(offerResult.error.message || "Failed to resolve generation concurrency offer.");
  }

  const offer = (offerResult.data as BillingOfferConcurrencyRow | null) ?? null;
  if (offer?.id) {
    const offerPlanId = normalizePlanId(offer.plan_id ?? planId);
    return buildEntitlement({
      userId,
      planId: offerPlanId,
      offerId: offer.id,
      contractId: null,
      maxConcurrentGenerations: normalizeConcurrencyLimit(
        offer.max_concurrent_generations,
        resolveDefaultPlanConcurrencyLimit(offerPlanId)
      ),
      source: "current_offer",
    });
  }

  return buildEntitlement({
    userId,
    planId,
    offerId: null,
    contractId: null,
    maxConcurrentGenerations: resolveDefaultPlanConcurrencyLimit(planId),
    source: "default",
  });
};
