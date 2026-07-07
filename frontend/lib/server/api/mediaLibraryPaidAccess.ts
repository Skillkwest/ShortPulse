/**
 * Server-side paid-plan guard for Media Library persistence.
 * Baseline AI Studio access can open the workspace, but cannot create library rows.
 */
import { normalizeBillingPlanId } from "../../billing/storageAddonEligibility";
import { isPaidAccessSubscriptionStatus } from "../../billing/subscriptionStatusPolicy";
import { getSupabaseAdmin } from "./supabaseAdmin";

export const MEDIA_LIBRARY_PAID_PLAN_REQUIRED_MESSAGE =
  "Choose a plan to add media to your Reference Grid and Media Library.";

type BillingContractAccessRow = {
  plan_id: string | null;
  status: string | null;
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

/**
 * Resolves whether the user has a non-baseline plan for media-library writes.
 */
export const hasPaidMediaLibraryAccess = async (userId: string): Promise<boolean> => {
  const supabaseAdmin = getSupabaseAdmin();
  const contractResult = await supabaseAdmin
    .from("billing_subscription_contracts")
    .select("plan_id,status")
    .eq("user_id", userId)
    .is("ended_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (contractResult.error) {
    throw new Error(contractResult.error.message || "Unable to verify media-library access.");
  }

  const contract = (contractResult.data as BillingContractAccessRow | null) ?? null;
  return isPaidPlanId(contract?.plan_id) && isPaidAccessSubscriptionStatus(contract?.status);
};

/**
 * Throws when a baseline account attempts to create persistent media-library content.
 */
export const assertPaidMediaLibraryAccess = async (userId: string): Promise<void> => {
  if (await hasPaidMediaLibraryAccess(userId)) return;
  throw new MediaLibraryPaidAccessError();
};
