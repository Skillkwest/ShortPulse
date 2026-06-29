import {
  BILLING_CONTRACT_SOURCE_INTERNAL_COMP,
  BILLING_CONTRACT_SOURCE_STRIPE,
} from "./billingContracts";
import { getSupabaseAdmin } from "./supabaseAdmin";

export const CREDIT_TOP_UP_REQUIRES_SUBSCRIPTION_MESSAGE =
  "Choose a paid subscription plan before buying credit top-ups.";

const CREDIT_TOP_UP_ELIGIBLE_STATUSES = new Set<string>(["active", "trialing"]);
const CREDIT_TOP_UP_ELIGIBLE_SOURCES = new Set<string>([
  BILLING_CONTRACT_SOURCE_STRIPE,
  BILLING_CONTRACT_SOURCE_INTERNAL_COMP,
]);

type BillingSubscriptionContractRow = {
  id?: string | null;
  status?: string | null;
  plan_id?: string | null;
  contract_source?: string | null;
};

export type CreditTopUpEligibility =
  | { eligible: true; contractId: string | null }
  | {
      eligible: false;
      reason:
        | "missing_subscription_contract"
        | "inactive_subscription_contract"
        | "free_subscription_contract";
    };

const normalizeContractValue = (value: string | null | undefined): string =>
  String(value ?? "")
    .trim()
    .toLowerCase();

export async function resolveCreditTopUpEligibilityForUser(
  userId: string
): Promise<CreditTopUpEligibility> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("billing_subscription_contracts")
    .select("id, status, plan_id, contract_source")
    .eq("user_id", userId)
    .is("ended_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to verify credit top-up eligibility.");
  }

  const contract = (data ?? null) as BillingSubscriptionContractRow | null;
  if (!contract) {
    return { eligible: false, reason: "missing_subscription_contract" };
  }

  const status = normalizeContractValue(contract.status);
  const planId = normalizeContractValue(contract.plan_id);
  const contractSource = normalizeContractValue(contract.contract_source);

  if (!CREDIT_TOP_UP_ELIGIBLE_STATUSES.has(status)) {
    return { eligible: false, reason: "inactive_subscription_contract" };
  }
  if (!planId || planId === "free") {
    return { eligible: false, reason: "free_subscription_contract" };
  }
  if (!CREDIT_TOP_UP_ELIGIBLE_SOURCES.has(contractSource)) {
    return { eligible: false, reason: "inactive_subscription_contract" };
  }

  return { eligible: true, contractId: contract.id ?? null };
}
