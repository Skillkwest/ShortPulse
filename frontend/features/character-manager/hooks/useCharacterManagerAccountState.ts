import { useEffect, useState } from "react";
import { buildPlanView, normalizePlanId, type BillingPlanRecord } from "../../billing/catalog";
import { ensureSupabaseQueryClient, useSupabaseSessionState } from "../../../lib/supabaseClient";

type ResolvedPlanMeta = {
  label: string;
  className: string;
};

type UseCharacterManagerAccountStateParams = {
  isEmbeddedSurface: boolean;
  defaultPlanTier: string;
};

type UseCharacterManagerAccountStateResult = {
  user: ReturnType<typeof useSupabaseSessionState>["user"];
  resolvedPlan: ResolvedPlanMeta | null;
};

export const useCharacterManagerAccountState = ({
  isEmbeddedSurface,
  defaultPlanTier,
}: UseCharacterManagerAccountStateParams): UseCharacterManagerAccountStateResult => {
  const { user } = useSupabaseSessionState();
  const [resolvedPlan, setResolvedPlan] = useState<ResolvedPlanMeta | null>(null);

  useEffect(() => {
    if (isEmbeddedSurface) return;
    let active = true;

    const loadPlan = async () => {
      if (!user) {
        if (!active) return;
        setResolvedPlan(null);
        return;
      }

      try {
        const supabase = ensureSupabaseQueryClient();
        const [billingProfileResponse, billingPlansResponse] = await Promise.all([
          supabase.from("billing_profiles").select("plan_id").eq("user_id", user.id).maybeSingle(),
          supabase
            .from("billing_plans")
            .select("id, display_name, monthly_price_cents, monthly_credits_cents, is_active")
            .eq("is_active", true),
        ]);

        const billingPlanId =
          !billingProfileResponse.error && billingProfileResponse.data
            ? ((billingProfileResponse.data as { plan_id: string | null }).plan_id ?? null)
            : null;
        const effectivePlanId =
          billingPlanId ?? (user.user_metadata?.plan as string | undefined) ?? defaultPlanTier;
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
          label: nextPlanLabel,
          className: planView.className,
        });
      } catch {
        if (!active) return;
        setResolvedPlan(null);
      }
    };

    void loadPlan();
    return () => {
      active = false;
    };
  }, [defaultPlanTier, isEmbeddedSurface, user]);

  return {
    user,
    resolvedPlan,
  };
};
