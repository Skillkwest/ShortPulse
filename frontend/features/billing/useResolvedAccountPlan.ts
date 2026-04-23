import { useEffect, useState } from "react";
import { buildPlanView, normalizePlanId, type BillingPlanRecord } from "./catalog";
import { ensureSupabaseQueryClient, useSupabaseSessionState } from "../../lib/supabaseClient";

type CurrentSubscriptionContractRow = {
  plan_id: string | null;
};

type ResolvedPlanMeta = {
  id: string;
  label: string;
  className: string;
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

export const useResolvedAccountPlan = ({
  defaultPlanTier = "free",
  enabled = true,
}: UseResolvedAccountPlanParams = {}) => {
  const { user } = useSupabaseSessionState();
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
              .select("plan_id")
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
        const billingPlanId =
          !billingProfileResponse.error && billingProfileResponse.data
            ? ((billingProfileResponse.data as { plan_id: string | null }).plan_id ?? null)
            : null;
        const effectivePlanId =
          contractPlanId ??
          billingPlanId ??
          (user.user_metadata?.plan as string | undefined) ??
          defaultPlanTier;
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
        });
      } catch {
        if (!active) return;
        const fallbackPlanId = normalizePlanId(
          (user.user_metadata?.plan as string | undefined) ?? defaultPlanTier
        );
        const fallbackPlanView = buildPlanView({
          planId: fallbackPlanId,
          plans: [],
        });
        setResolvedPlan({
          id: fallbackPlanId,
          label: fallbackPlanView.displayName,
          className: fallbackPlanView.className,
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
