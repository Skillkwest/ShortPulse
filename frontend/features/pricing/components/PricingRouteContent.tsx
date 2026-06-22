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
  buildDashboardAuthPath,
  buildPricingAuthPath,
  buildPricingPath,
  normalizePricingBillingInterval,
  normalizePricingIntent,
  normalizePricingPlanId,
} from "../paths";
import { loadGrowthTelemetry } from "../../../lib/growthTelemetryLoader";

export type PricingRouteProps = {
  billingCatalog: BillingCatalogSnapshot;
};

type PricingRouteContentProps = PricingRouteProps & {
  isAuthenticated: boolean;
};

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
}) => {
  if (!params.isAuthenticated) {
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

/**
 * Renders the public pricing UI for either anonymous or authenticated visitors.
 */
export function PricingRouteContent({ billingCatalog, isAuthenticated }: PricingRouteContentProps) {
  const router = useRouter();
  const intent = normalizePricingIntent(router.query.intent);
  const selectedPlanId = normalizePricingPlanId(router.query.plan);
  const selectedBillingInterval = normalizePricingBillingInterval(router.query.interval);
  const [planActionLoadingId, setPlanActionLoadingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
          mode: "signup",
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
          checkoutCancelPath: buildPricingPath({
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
        <header className="lp-nav sticky">
          <div className="lp-brand">
            <Link href="/" className="lp-brand-link">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/small good d.png" alt="ShortPulse logo" className="lp-brand-logo" />
              <span className="lp-brand-text">ShortPulse</span>
            </Link>
          </div>

          <div className="lp-actions">
            {isAuthenticated ? (
              <Link href="/dashboard" className="primary-btn">
                Back to dashboard
              </Link>
            ) : (
              <Link href={buildDashboardAuthPath()} className="ghost-btn">
                Log in
              </Link>
            )}
          </div>
        </header>

        <main className="lp-main">
          <section
            className="lp-section subscription-pricing-shell"
            aria-labelledby="pricing-plans-heading"
          >
            <div className="pricing-hero">
              <h2 id="pricing-plans-heading">Subscription plans</h2>
              <p>Start with the plan that matches your workflow. You can always upgrade later.</p>
              {selectedPlanId ? (
                <div className="dashboard-guest-strip pricing-route-selected-plan">
                  <div className="dashboard-guest-strip-copy">
                    <p className="eyebrow">Selected plan</p>
                    <p className="dashboard-guest-strip-title">
                      {
                        buildPlanView({ planId: selectedPlanId, plans: billingCatalog.plans })
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
              <BillingIntervalToggle
                selectedBillingInterval={selectedBillingInterval}
                annualSavingsPercent={annualSavingsPercent}
                onChange={(billingInterval) => {
                  void handleIntervalToggle(billingInterval);
                }}
              />
              <p className="pricing-billing-helper">
                Upgrade anytime. Downgrades apply at the next billing cycle.
              </p>
            </div>

            <div className="lp-plan-grid pricing-plan-grid-screenshot">
              {sortedPlans.map((plan) => {
                const planView = buildPlanView({ planId: plan.id, plans: billingCatalog.plans });
                const planPricing = resolvePlanPricingForInterval(plan, selectedBillingInterval);
                const intervalUnavailable =
                  selectedBillingInterval === "year" &&
                  plan.id !== "free" &&
                  !planPricing.hasLiveOffer;
                const isSelected = selectedPlanId === plan.id;
                const actionLabel = intervalUnavailable
                  ? "Annual unavailable"
                  : resolvePlanActionLabel({
                      isAuthenticated,
                      monthlyPriceCents: planPricing.monthlyEquivalentCents,
                      displayName: planView.displayName,
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
          </section>
        </main>
      </div>
    </>
  );
}
