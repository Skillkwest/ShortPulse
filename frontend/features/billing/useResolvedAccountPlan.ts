import { useEffect, useState } from "react";
import { buildPlanView, normalizePlanId } from "./catalog";
import { primeSupabaseSession } from "../../lib/supabaseClient";
import { useResolvedProtectedSessionState } from "../../lib/protectedRouteSessionContext";
import { fetchBillingAccountSummary } from "./accountSummary";
import type { PendingSubscriptionChange } from "./accountSummary";

type ResolvedPlanMeta = {
  id: string;
  label: string;
  className: string;
  monthlyCreditsCents: number;
};

export type ResolvedAccountPlanStatus = "idle" | "loading" | "ready" | "unavailable";

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
  const [pendingSubscriptionChange, setPendingSubscriptionChange] =
    useState<PendingSubscriptionChange | null>(null);
  const [status, setStatus] = useState<ResolvedAccountPlanStatus>("idle");

  useEffect(() => {
    if (!enabled) {
      setResolvedPlan(null);
      setPendingSubscriptionChange(null);
      setStatus("idle");
      return;
    }
    let active = true;

    const loadPlan = async () => {
      if (!user) {
        if (!active) return;
        setResolvedPlan(null);
        setPendingSubscriptionChange(null);
        setStatus("idle");
        return;
      }

      setStatus("loading");
      try {
        if (session) {
          primeSupabaseSession(session);
        }
        const summary = await fetchBillingAccountSummary({ expectedUserId: user.id });
        if (!summary?.resolvedPlan || summary.userId !== user.id) {
          throw new Error("Unable to load billing account summary.");
        }
        if (!active) return;
        setResolvedPlan(summary.resolvedPlan);
        setPendingSubscriptionChange(summary.pendingSubscriptionChange ?? null);
        setStatus("ready");
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
        setPendingSubscriptionChange(null);
        setStatus("unavailable");
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
    pendingSubscriptionChange,
    status,
  };
};
