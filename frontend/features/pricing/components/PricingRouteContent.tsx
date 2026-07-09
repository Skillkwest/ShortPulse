/**
 * Shared pricing route renderer.
 * Keeps the public pricing UI in one place while letting route owners decide how auth state is resolved.
 */
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { AppMessage } from "../../../components/AppMessage";
import {
  buildPlanView,
  filterPublicSubscriptionPlans,
  type BillingCatalogSnapshot,
  type BillingInterval,
  type BillingPlanRecord,
  resolvePlanPricingForInterval,
} from "../../billing/catalog";
import { BillingIntervalToggle } from "../../billing/components/BillingIntervalToggle";
import { SubscriptionPlanCard } from "../../billing/components/SubscriptionPlanCard";
import {
  buildPricingAuthPath,
  buildPricingCheckoutCancelPath,
  buildPricingPath,
  normalizePricingBillingInterval,
  normalizePricingCheckoutStatus,
  normalizePricingIntent,
  normalizePricingPlanId,
  type PricingBillingInterval,
  type PricingIntent,
} from "../paths";
import { loadGrowthTelemetry } from "../../../lib/growthTelemetryLoader";
import { isPublicSignupEnabled } from "../../../lib/authRedirects";

export type PricingRouteProps = {
  billingCatalog: BillingCatalogSnapshot;
};

type PricingRouteContentProps = PricingRouteProps & {
  isAuthenticated: boolean;
};

type PricingCheckoutPendingState = {
  planId: string;
  billingInterval: PricingBillingInterval;
  intent: PricingIntent;
  createdAt: number;
};

const PRICING_CHECKOUT_PENDING_STORAGE_KEY = "shortpulse.pricing.checkout.pending";
const PRICING_CHECKOUT_PENDING_TTL_MS = 60 * 60 * 1000;

const sortBillingPlans = (plans: readonly BillingPlanRecord[]) =>
  [...plans].sort((left, right) => {
    if ((left.sort_order ?? 0) === (right.sort_order ?? 0)) {
      return left.monthly_price_cents - right.monthly_price_cents;
    }
    return (left.sort_order ?? 0) - (right.sort_order ?? 0);
  });

const resolvePlanActionLabel = (params: {
  isAuthenticated: boolean;
  monthlyPriceCents: number;
  displayName: string;
  publicSignupEnabled: boolean;
}) => {
  if (!params.isAuthenticated) {
    if (!params.publicSignupEnabled) {
      return params.monthlyPriceCents === 0
        ? "Log in to continue"
        : `Log in to choose ${params.displayName}`;
    }
    return params.monthlyPriceCents === 0 ? "Create account" : `Sign up for ${params.displayName}`;
  }
  if (params.monthlyPriceCents === 0) {
    return "Continue to dashboard";
  }
  return `Choose ${params.displayName}`;
};

const resolveMaxAnnualSavingsPercent = (plans: readonly BillingPlanRecord[]): number =>
  Math.max(
    0,
    ...plans.map((plan) => {
      const pricing = resolvePlanPricingForInterval(plan, "year");
      return pricing.hasLiveOffer && pricing.savingsAmountCents > 0
        ? Math.round(pricing.savingsPercent)
        : 0;
    })
  );

const readPricingCheckoutPendingState = (): PricingCheckoutPendingState | null => {
  if (typeof window === "undefined") return null;
  try {
    const rawValue = window.sessionStorage.getItem(PRICING_CHECKOUT_PENDING_STORAGE_KEY);
    if (!rawValue) return null;
    const parsed = JSON.parse(rawValue) as Partial<PricingCheckoutPendingState>;
    if (
      typeof parsed.planId !== "string" ||
      typeof parsed.billingInterval !== "string" ||
      typeof parsed.intent !== "string" ||
      typeof parsed.createdAt !== "number"
    ) {
      return null;
    }
    return {
      planId: parsed.planId,
      billingInterval: parsed.billingInterval as PricingBillingInterval,
      intent: parsed.intent as PricingIntent,
      createdAt: parsed.createdAt,
    };
  } catch {
    return null;
  }
};

const writePricingCheckoutPendingState = (
  state: Omit<PricingCheckoutPendingState, "createdAt">
) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      PRICING_CHECKOUT_PENDING_STORAGE_KEY,
      JSON.stringify({ ...state, createdAt: Date.now() })
    );
  } catch {
    // Non-critical: Stripe cancel URLs still carry an explicit checkout marker.
  }
};

const clearPricingCheckoutPendingState = () => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PRICING_CHECKOUT_PENDING_STORAGE_KEY);
  } catch {
    // Ignore storage failures; they should never block pricing.
  }
};

const consumeMatchingPricingCheckoutPendingState = ({
  planId,
  billingInterval,
  intent,
}: {
  planId: string;
  billingInterval: PricingBillingInterval;
  intent: PricingIntent;
}): boolean => {
  const pendingState = readPricingCheckoutPendingState();
  if (!pendingState) return false;

  const isExpired = Date.now() - pendingState.createdAt > PRICING_CHECKOUT_PENDING_TTL_MS;
  const matchesPendingCheckout =
    pendingState.planId === planId &&
    pendingState.billingInterval === billingInterval &&
    pendingState.intent === intent;
  if (isExpired || matchesPendingCheckout) {
    clearPricingCheckoutPendingState();
  }
  return !isExpired && matchesPendingCheckout;
};

/**
 * Renders the public pricing UI for either anonymous or authenticated visitors.
 */
export function PricingRouteContent({ billingCatalog, isAuthenticated }: PricingRouteContentProps) {
  const router = useRouter();
  const intent = normalizePricingIntent(router.query.intent);
  const selectedPlanId = normalizePricingPlanId(router.query.plan);
  const selectedBillingInterval = normalizePricingBillingInterval(router.query.interval);
  const checkoutStatus = normalizePricingCheckoutStatus(router.query.checkout);
  const [planActionLoadingId, setPlanActionLoadingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [suppressSelectedPlanUi, setSuppressSelectedPlanUi] = useState(
    () => checkoutStatus === "cancel"
  );
  const publicSignupEnabled = isPublicSignupEnabled();

  useEffect(() => {
    void loadGrowthTelemetry().then(({ trackBillingPricingViewed }) => {
      trackBillingPricingViewed({
        page_surface: "pricing",
        pricing_intent: intent,
        selected_plan_id: selectedPlanId,
        is_authenticated: isAuthenticated,
      });
    });
  }, [intent, isAuthenticated, selectedPlanId]);

  const sortedPlans = useMemo(
    () => sortBillingPlans(filterPublicSubscriptionPlans(billingCatalog.plans)),
    [billingCatalog.plans]
  );
  const annualSavingsPercent = useMemo(
    () => resolveMaxAnnualSavingsPercent(sortedPlans),
    [sortedPlans]
  );
  const selectedPlanViewId = suppressSelectedPlanUi ? null : selectedPlanId;

  useEffect(() => {
    if (checkoutStatus === "cancel") {
      clearPricingCheckoutPendingState();
      setSuppressSelectedPlanUi(true);
      return;
    }

    if (!selectedPlanId) {
      setSuppressSelectedPlanUi(false);
      return;
    }

    setSuppressSelectedPlanUi(
      consumeMatchingPricingCheckoutPendingState({
        planId: selectedPlanId,
        billingInterval: selectedBillingInterval,
        intent,
      })
    );
  }, [checkoutStatus, intent, selectedBillingInterval, selectedPlanId]);

  useEffect(() => {
    if (typeof window === "undefined" || checkoutStatus === "cancel" || !selectedPlanId) {
      return undefined;
    }

    const handlePageShow = () => {
      if (
        consumeMatchingPricingCheckoutPendingState({
          planId: selectedPlanId,
          billingInterval: selectedBillingInterval,
          intent,
        })
      ) {
        setSuppressSelectedPlanUi(true);
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [checkoutStatus, intent, selectedBillingInterval, selectedPlanId]);

  const handleIntervalToggle = async (billingInterval: BillingInterval) => {
    if (billingInterval === selectedBillingInterval) return;
    await router.replace(
      buildPricingPath({
        intent,
        planId: selectedPlanId,
        billingInterval,
      }),
      undefined,
      { shallow: true }
    );
  };

  const handlePlanAction = async (planId: string) => {
    setNotice(null);

    void loadGrowthTelemetry().then(({ trackBillingUpgradeClicked }) => {
      trackBillingUpgradeClicked({
        upgrade_surface: "pricing_page",
        pricing_intent: intent,
        plan_id: planId,
        billing_interval: selectedBillingInterval,
        is_authenticated: isAuthenticated,
      });
    });

    if (!isAuthenticated) {
      await router.push(
        buildPricingAuthPath({
          intent,
          planId,
          billingInterval: selectedBillingInterval,
          publicSignupEnabled,
        })
      );
      return;
    }

    if (planId === "free") {
      await router.push("/dashboard");
      return;
    }

    setPlanActionLoadingId(planId);
    try {
      const { fetchWithAuth } = await import("../../../lib/authenticatedFetch");
      const response = await fetchWithAuth("/api/billing/subscription/change", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetPlanId: planId,
          billingInterval: selectedBillingInterval,
          checkoutCancelPath: buildPricingCheckoutCancelPath({
            intent,
            planId,
            billingInterval: selectedBillingInterval,
          }),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        redirectUrl?: string | null;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Unable to start the selected plan flow.");
      }
      if (payload.redirectUrl) {
        writePricingCheckoutPendingState({
          planId,
          billingInterval: selectedBillingInterval,
          intent,
        });
        window.location.assign(payload.redirectUrl);
        return;
      }
      await router.push("/dashboard");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to start the selected plan flow.");
    } finally {
      setPlanActionLoadingId(null);
    }
  };

  return (
    <>
      <Head>
        <title>ShortPulse · Pricing</title>
        <meta
          name="description"
          content="ShortPulse pricing for subscriptions, credit packs, and recurring storage add-ons."
        />
      </Head>

      <div className="lp-shell pricing-route-shell">
        <header className="pricing-route-brand-bar">
          <Link href="/dashboard" className="pricing-route-brand-link">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/small good d.png" alt="" className="pricing-route-brand-logo" />
            <span className="pricing-route-brand-text">ShortPulse</span>
          </Link>
        </header>

        <main className="lp-main">
          <section
            className="lp-section subscription-pricing-shell"
            aria-labelledby="pricing-plans-heading"
          >
            <div className="pricing-hero">
              <h2 id="pricing-plans-heading">Subscription plans</h2>
              <p>Start with the plan that matches your workflow. You can always upgrade later.</p>
              {checkoutStatus === "cancel" ? (
                <AppMessage
                  className="pricing-route-notice"
                  tone="info"
                  mode="banner"
                  message="Checkout was canceled. No plan changes were made."
                />
              ) : null}
              {selectedPlanViewId ? (
                <div className="dashboard-guest-strip pricing-route-selected-plan">
                  <div className="dashboard-guest-strip-copy">
                    <p className="eyebrow">Selected plan</p>
                    <p className="dashboard-guest-strip-title">
                      {
                        buildPlanView({ planId: selectedPlanViewId, plans: billingCatalog.plans })
                          .displayName
                      }
                    </p>
                    <p className="dashboard-guest-strip-description">
                      {selectedBillingInterval === "year"
                        ? "Annual billing selected"
                        : "Monthly billing selected"}
                    </p>
                  </div>
                </div>
              ) : null}
              {notice ? (
                <AppMessage
                  className="pricing-route-notice"
                  tone="error"
                  mode="banner"
                  message={notice}
                />
              ) : null}
              {!isAuthenticated && !publicSignupEnabled ? (
                <AppMessage
                  className="pricing-route-notice"
                  tone="info"
                  mode="banner"
                  message="Account creation is temporarily closed. Existing users can log in to continue with a selected plan."
                />
              ) : null}
              <BillingIntervalToggle
                selectedBillingInterval={selectedBillingInterval}
                annualSavingsPercent={annualSavingsPercent}
                onChange={(billingInterval) => {
                  void handleIntervalToggle(billingInterval);
                }}
              />
              {sortedPlans.length === 0 ? (
                <AppMessage
                  className="pricing-route-notice"
                  tone="error"
                  mode="banner"
                  message="Pricing is temporarily unavailable. Please refresh this page before choosing a plan."
                />
              ) : null}
            </div>

            {sortedPlans.length > 0 ? (
              <div className="lp-plan-grid pricing-plan-grid-screenshot">
                {sortedPlans.map((plan) => {
                  const planView = buildPlanView({ planId: plan.id, plans: billingCatalog.plans });
                  const planPricing = resolvePlanPricingForInterval(plan, selectedBillingInterval);
                  const intervalUnavailable =
                    selectedBillingInterval === "year" &&
                    plan.id !== "free" &&
                    !planPricing.hasLiveOffer;
                  const isSelected = selectedPlanViewId === plan.id;
                  const actionLabel = intervalUnavailable
                    ? "Annual unavailable"
                    : resolvePlanActionLabel({
                        isAuthenticated,
                        monthlyPriceCents: planPricing.monthlyEquivalentCents,
                        displayName: planView.displayName,
                        publicSignupEnabled,
                      });
                  const isLoading = planActionLoadingId === plan.id;

                  return (
                    <SubscriptionPlanCard
                      key={plan.id}
                      plan={plan}
                      plans={billingCatalog.plans}
                      billingInterval={selectedBillingInterval}
                      isSelected={isSelected}
                      className="pricing-surface-card"
                      actionSlot={
                        <button
                          type="button"
                          className={`pricing-btn ${plan.monthly_price_cents === 0 ? "neutral" : "primary"}`}
                          onClick={() => {
                            void handlePlanAction(plan.id);
                          }}
                          disabled={isLoading || intervalUnavailable}
                        >
                          {isLoading ? "Starting…" : actionLabel}
                        </button>
                      }
                    />
                  );
                })}
              </div>
            ) : null}
          </section>
        </main>
      </div>
    </>
  );
}
