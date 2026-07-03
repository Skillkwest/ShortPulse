/**
 * Server-side paid-plan guard for Media Library persistence.
 * Baseline AI Studio access can open the workspace, but cannot create library rows.
 */
import { normalizeBillingPlanId } from "../../billing/storageAddonEligibility";
import { getSupabaseAdmin } from "./supabaseAdmin";

export const MEDIA_LIBRARY_PAID_PLAN_REQUIRED_MESSAGE =
  "Choose a plan to add media to your Reference Grid and Media Library.";

type BillingContractAccessRow = {
  plan_id: string | null;
  status: string | null;
};

type BillingProfileAccessRow = {
  plan_id: string | null;
  subscription_status: string | null;
};

export class MediaLibraryPaidAccessError extends Error {
  status = 402;

  constructor(message = MEDIA_LIBRARY_PAID_PLAN_REQUIRED_MESSAGE) {
    super(message);
    this.name = "MediaLibraryPaidAccessError";
  }
}

const isPaidPlanId = (planId: string | null | undefined): boolean =>
  normalizeBillingPlanId(planId) !== "free";

const hasCurrentSubscriptionStatus = (status: string | null | undefined): boolean => {
  const normalizedStatus = (status ?? "active").trim().toLowerCase();
  return ["active", "trialing", "past_due", "unpaid"].includes(normalizedStatus);
};

/**
 * Resolves whether the user has a non-baseline plan for media-library writes.
 */
export const hasPaidMediaLibraryAccess = async (userId: string): Promise<boolean> => {
  const supabaseAdmin = getSupabaseAdmin();
  const [contractResult, profileResult] = await Promise.all([
    supabaseAdmin
      .from("billing_subscription_contracts")
      .select("plan_id,status")
      .eq("user_id", userId)
      .is("ended_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("billing_profiles")
      .select("plan_id,subscription_status")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (contractResult.error) {
    throw new Error(contractResult.error.message || "Unable to verify media-library access.");
  }
  if (profileResult.error) {
    throw new Error(profileResult.error.message || "Unable to verify media-library access.");
  }

  const contract = (contractResult.data as BillingContractAccessRow | null) ?? null;
  if (isPaidPlanId(contract?.plan_id) && hasCurrentSubscriptionStatus(contract?.status))
    return true;

  const profile = (profileResult.data as BillingProfileAccessRow | null) ?? null;
  return (
    isPaidPlanId(profile?.plan_id) && hasCurrentSubscriptionStatus(profile?.subscription_status)
  );
};

/**
 * Throws when a baseline account attempts to create persistent media-library content.
 */
export const assertPaidMediaLibraryAccess = async (userId: string): Promise<void> => {
  if (await hasPaidMediaLibraryAccess(userId)) return;
  throw new MediaLibraryPaidAccessError();
};
