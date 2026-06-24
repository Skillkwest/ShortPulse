import { useEffect, useState } from "react";
import { buildPlanView, normalizePlanId } from "./catalog";
import { primeSupabaseSession } from "../../lib/supabaseClient";
import { useResolvedProtectedSessionState } from "../../lib/protectedRouteSessionContext";
import { fetchBillingAccountSummary } from "./accountSummary";

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

export const useResolvedAccountPlan = ({
  defaultPlanTier = "free",
  enabled = true,
}: UseResolvedAccountPlanParams = {}) => {
  const { session, user } = useResolvedProtectedSessionState({
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
        if (session) {
          primeSupabaseSession(session);
        }
        const summary = await fetchBillingAccountSummary();
        if (!summary?.resolvedPlan || summary.userId !== user.id) {
          throw new Error("Unable to load billing account summary.");
        }
        if (!active) return;
        setResolvedPlan(summary.resolvedPlan);
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
  }, [defaultPlanTier, enabled, session, user]);

  return {
    user,
    resolvedPlan,
  };
};
