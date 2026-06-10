import { useEffect, useState } from "react";
import { buildPlanView, normalizePlanId, type BillingPlanRecord } from "./catalog";
import { ensureSupabaseQueryClient } from "../../lib/supabaseClient";
import { useResolvedProtectedSessionState } from "../../lib/protectedRouteSessionContext";

type CurrentSubscriptionContractRow = {
  plan_id: string | null;
  monthly_credits_cents: number | null;
};

type BillingProfilePlanRow = {
  plan_id: string | null;
};

type ResolvedPlanMeta = {
  id: string;
  label: string;
  className: string;
  monthlyCreditsCents: number;
};

type UseResolvedAccountPlanParams = {
  defaultPlanTier?: string;
  enabled?: boolean;
};

const isSchemaCompatibilityError = (message: string) => {
  const text = message.toLowerCase();
  return (
    text.includes("does not exist") ||
    text.includes("could not find the table") ||
    text.includes("schema cache") ||
    text.includes("failed to parse select parameter") ||
    text.includes("column")
  );
};

const normalizeCreditCents = (value: number | null | undefined): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.floor(value);
};

export const useResolvedAccountPlan = ({
  defaultPlanTier = "free",
  enabled = true,
}: UseResolvedAccountPlanParams = {}) => {
  const { user } = useResolvedProtectedSessionState({
    enabled,
  });
  const [resolvedPlan, setResolvedPlan] = useState<ResolvedPlanMeta | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    const loadPlan = async () => {
      if (!user) {
        if (!active) return;
        setResolvedPlan(null);
        return;
      }

      try {
        const supabase = ensureSupabaseQueryClient();
        const [billingContractResponse, billingProfileResponse, billingPlansResponse] =
          await Promise.all([
            supabase
              .from("billing_subscription_contracts")
              .select("plan_id, monthly_credits_cents")
              .eq("user_id", user.id)
              .is("ended_at", null)
              .maybeSingle(),
            supabase
              .from("billing_profiles")
              .select("plan_id")
              .eq("user_id", user.id)
              .maybeSingle(),
            supabase
              .from("billing_plans")
              .select(
                "id, display_name, monthly_price_cents, monthly_credits_cents, storage_limit_bytes, is_active"
              )
              .eq("is_active", true),
          ]);

        if (
          billingContractResponse.error &&
          !isSchemaCompatibilityError(billingContractResponse.error.message)
        ) {
          throw billingContractResponse.error;
        }

        const contractPlanId =
          !billingContractResponse.error && billingContractResponse.data
            ? ((billingContractResponse.data as CurrentSubscriptionContractRow).plan_id ?? null)
            : null;
        const contractMonthlyCreditsCents =
          !billingContractResponse.error && billingContractResponse.data
            ? normalizeCreditCents(
                (billingContractResponse.data as CurrentSubscriptionContractRow)
                  .monthly_credits_cents
              )
            : null;
        const billingPlanId =
          !billingProfileResponse.error && billingProfileResponse.data
            ? ((billingProfileResponse.data as BillingProfilePlanRow).plan_id ?? null)
            : null;
        const effectivePlanId = contractPlanId ?? billingPlanId ?? defaultPlanTier;
        const normalizedPlanId = normalizePlanId(effectivePlanId);
        const plans =
          !billingPlansResponse.error && Array.isArray(billingPlansResponse.data)
            ? (billingPlansResponse.data as BillingPlanRecord[])
            : [];
        const planView = buildPlanView({
          planId: normalizedPlanId,
          plans,
        });
        const nextPlanLabel = plans.length > 0 ? planView.displayName : normalizedPlanId;

        if (!active) return;
        setResolvedPlan({
          id: normalizedPlanId,
          label: nextPlanLabel,
          className: planView.className,
          monthlyCreditsCents: contractMonthlyCreditsCents ?? planView.monthlyCreditsCents,
        });
      } catch {
        if (!active) return;
        const fallbackPlanId = normalizePlanId(defaultPlanTier);
        const fallbackPlanView = buildPlanView({
          planId: fallbackPlanId,
          plans: [],
        });
        setResolvedPlan({
          id: fallbackPlanId,
          label: fallbackPlanView.displayName,
          className: fallbackPlanView.className,
          monthlyCreditsCents: fallbackPlanView.monthlyCreditsCents,
        });
      }
    };

    void loadPlan();
    return () => {
      active = false;
    };
  }, [defaultPlanTier, enabled, user]);

  return {
    user,
    resolvedPlan,
  };
};
