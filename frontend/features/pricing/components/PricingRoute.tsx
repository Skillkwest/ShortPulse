/**
 * Public pricing route content.
 * Uses the live billing catalog to sell plans while keeping credits and storage add-ons informational.
 */
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle } from "phosphor-react";
import {
  buildPlanView,
  type BillingCatalogSnapshot,
  type BillingInterval,
  type BillingPlanRecord,
  resolvePlanPricingForInterval,
} from "../../billing/catalog";
import { formatStorageBytes } from "../../billing/storage";
import { formatCurrencyFromCents } from "../../profile/profilePageModel";
import {
  buildDashboardAuthPath,
  buildPricingAuthPath,
  buildPricingPath,
  normalizePricingBillingInterval,
  normalizePricingIntent,
  normalizePricingPlanId,
} from "../paths";
import { trackBillingPricingViewed } from "../../../lib/growthTelemetry";
import { useSupabaseSessionState } from "../../../lib/supabaseClient";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";

type PricingRouteProps = {
  billingCatalog: BillingCatalogSnapshot;
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
    return params.monthlyPriceCents === 0
      ? "Create free account"
      : `Sign up for ${params.displayName}`;
  }
  if (params.monthlyPriceCents === 0) {
    return "Continue to dashboard";
  }
  return `Choose ${params.displayName}`;
};

/**
 * Renders the public pricing route.
 */
export function PricingRoute({ billingCatalog }: PricingRouteProps) {
  const router = useRouter();
  const { user } = useSupabaseSessionState();
  const isAuthenticated = Boolean(user);
  const intent = normalizePricingIntent(router.query.intent);
  const selectedPlanId = normalizePricingPlanId(router.query.plan);
  const selectedBillingInterval = normalizePricingBillingInterval(router.query.interval);
  const [planActionLoadingId, setPlanActionLoadingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    trackBillingPricingViewed({
      page_surface: "pricing",
      pricing_intent: intent,
      selected_plan_id: selectedPlanId,
      is_authenticated: isAuthenticated,
    });
  }, [intent, isAuthenticated, selectedPlanId]);

  const sortedPlans = useMemo(() => sortBillingPlans(billingCatalog.plans), [billingCatalog.plans]);

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

    if (!isAuthenticated) {
      await router.push(
        buildPricingAuthPath({
          intent,
          planId,
          billingInterval: selectedBillingInterval,
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
      const response = await fetchWithAuth("/api/billing/subscription/change", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetPlanId: planId,
          billingInterval: selectedBillingInterval,
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
              <>
                <Link href={buildDashboardAuthPath()} className="ghost-btn">
                  Log in
                </Link>
                <Link
                  href={buildPricingAuthPath({
                    intent,
                    planId: selectedPlanId,
                    billingInterval: selectedBillingInterval,
                    mode: "signup",
                  })}
                  className="primary-btn"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </header>

        <main className="lp-main">
          <section className="lp-section" aria-labelledby="pricing-plans-heading">
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
              {notice ? <p className="pricing-route-notice">{notice}</p> : null}
              <div className="pricing-interval-toggle" role="group" aria-label="Billing interval">
                <button
                  type="button"
                  className={`pricing-interval-option ${selectedBillingInterval === "month" ? "is-active" : ""}`}
                  onClick={() => {
                    void handleIntervalToggle("month");
                  }}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  className={`pricing-interval-option ${selectedBillingInterval === "year" ? "is-active" : ""}`}
                  onClick={() => {
                    void handleIntervalToggle("year");
                  }}
                >
                  Annual
                  <span className="pricing-interval-badge">Save up to 17%</span>
                </button>
              </div>
            </div>

            <div className="lp-plan-grid">
              {sortedPlans.map((plan) => {
                const planView = buildPlanView({ planId: plan.id, plans: billingCatalog.plans });
                const planPricing = resolvePlanPricingForInterval(plan, selectedBillingInterval);
                const isSelected = selectedPlanId === plan.id;
                const actionLabel = resolvePlanActionLabel({
                  isAuthenticated,
                  monthlyPriceCents: planPricing.monthlyEquivalentCents,
                  displayName: planView.displayName,
                });
                const isLoading = planActionLoadingId === plan.id;

                return (
                  <article
                    key={plan.id}
                    className={`lp-plan-card pricing-card pricing-plan-card ${planView.className} ${isSelected ? "pricing-plan-selected" : ""}`}
                  >
                    <div className="pricing-plan-head">
                      <div className="pricing-plan-kicker">
                        {plan.monthly_price_cents === 0
                          ? "Start here"
                          : selectedBillingInterval === "year"
                            ? "Annual billing"
                            : "Subscription"}
                      </div>
                      <div className="lp-plan-top pricing-plan-top">
                        <span className="lp-plan-name">{planView.displayName}</span>
                        {plan.id === "studio" ? (
                          <span className="lp-badge teal pricing-plan-badge">Most popular</span>
                        ) : null}
                      </div>
                      <p className="lp-plan-sub pricing-plan-sub">{planView.description}</p>
                    </div>

                    <div className="lp-price-block pricing-plan-price">
                      <div className="pricing-plan-price-row">
                        <div className="lp-price-big">
                          {plan.monthly_price_cents === 0
                            ? "Free"
                            : formatCurrencyFromCents(planPricing.monthlyEquivalentCents)}
                        </div>
                        <div className="lp-price-note pricing-plan-price-note">
                          {plan.monthly_price_cents === 0 ? "forever" : "/mo"}
                        </div>
                      </div>
                      {plan.monthly_price_cents > 0 && selectedBillingInterval === "year" ? (
                        <div className="pricing-plan-billing-meta">
                          {planPricing.savingsAmountCents > 0 ? (
                            <span className="pricing-plan-billing-savings">
                              Save {formatCurrencyFromCents(planPricing.savingsAmountCents)}/yr
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <ul className="lp-plan-list pricing-plan-list">
                      <li>
                        <CheckCircle size={16} weight="bold" />
                        {planPricing.monthlyCreditsCents.toLocaleString()} credits every month
                      </li>
                      <li>
                        <CheckCircle size={16} weight="bold" />
                        {formatStorageBytes(planPricing.storageLimitBytes)} of included media
                        storage
                      </li>
                      <li>
                        <CheckCircle size={16} weight="bold" />
                        {planView.seatsLabel}
                      </li>
                      <li>
                        <CheckCircle size={16} weight="bold" />
                        Concurrent: {planView.concurrentGenerationsCompactLabel}
                      </li>
                      {planView.pricingHighlights.map((highlight) => (
                        <li key={`${plan.id}-${highlight}`}>
                          <CheckCircle size={16} weight="bold" />
                          {highlight}
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      className={`pricing-btn ${plan.monthly_price_cents === 0 ? "neutral" : "primary"}`}
                      onClick={() => {
                        void handlePlanAction(plan.id);
                      }}
                      disabled={isLoading}
                    >
                      {isLoading ? "Starting…" : actionLabel}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
