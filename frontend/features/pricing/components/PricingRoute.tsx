/**
 * Public pricing route content.
 * Uses the live billing catalog to sell plans while keeping credits and storage add-ons informational.
 */
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle, CreditCard, Database, SignIn, Sparkle } from "phosphor-react";
import {
  annotateCreditPackages,
  buildPlanView,
  type BillingCatalogSnapshot,
  type BillingPlanRecord,
} from "../../billing/catalog";
import { formatStorageBytes } from "../../billing/storage";
import { formatCurrencyFromCents } from "../../profile/profilePageModel";
import {
  buildPricingAuthPath,
  buildPricingPath,
  normalizePricingIntent,
  normalizePricingPlanId,
  type PricingIntent,
} from "../paths";
import { trackBillingPricingViewed } from "../../../lib/growthTelemetry";
import { useSupabaseSessionState } from "../../../lib/supabaseClient";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";

type PricingRouteProps = {
  billingCatalog: BillingCatalogSnapshot;
};

const resolveHeroCopy = (intent: PricingIntent) => {
  if (intent === "create-project") {
    return {
      title: "Choose a plan to start your first project",
      body: "Creating a saved project starts here. Compare live plans, sign up, and continue into AI Studio when you are ready.",
    };
  }
  if (intent === "open-projects") {
    return {
      title: "Sign in or choose a plan to continue",
      body: "Project libraries stay tied to your account. Log in to continue or start with a new plan if you are new to ShortPulse.",
    };
  }
  return {
    title: "Simple pricing built from the live ShortPulse catalog",
    body: "Compare subscriptions, one-time credit packs, and recurring storage add-ons from one public pricing surface.",
  };
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
  const packageCards = useMemo(
    () => annotateCreditPackages(billingCatalog.packages),
    [billingCatalog.packages]
  );
  const heroCopy = resolveHeroCopy(intent);

  const handlePlanAction = async (planId: string) => {
    setNotice(null);

    if (!isAuthenticated) {
      await router.push(buildPricingAuthPath({ intent, planId }));
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
              <span className="logo-dot" />
              <span className="lp-brand-text">ShortPulse</span>
            </Link>
            <span className="lp-badge teal">Pricing</span>
          </div>

          <nav className="lp-nav-links">
            <Link href="/">Dashboard</Link>
            {isAuthenticated ? (
              <Link href="/dashboard">Workspace</Link>
            ) : (
              <Link href={buildPricingAuthPath({ intent, planId: selectedPlanId })}>Log in</Link>
            )}
          </nav>

          <div className="lp-actions">
            <Link
              href={
                isAuthenticated
                  ? "/dashboard"
                  : buildPricingAuthPath({ intent, planId: selectedPlanId })
              }
              className="primary-btn"
            >
              {isAuthenticated ? "Back to dashboard" : "Log in"}
            </Link>
          </div>
        </header>

        <main className="lp-main">
          <section className="lp-hero pricing-route-hero">
            <div className="lp-hero-grid pricing-route-hero-grid">
              <div className="lp-hero-copy">
                <div className="lp-pill">
                  <Sparkle size={16} weight="bold" />
                  Live billing catalog
                </div>
                <h1>
                  {heroCopy.title}
                  <span className="lp-hero-accent">
                    ShortPulse pricing, credits, and media capacity.
                  </span>
                </h1>
                <p className="lp-hero-sub">{heroCopy.body}</p>
                <div className="lp-cta-row">
                  <Link href={buildPricingPath({ intent })} className="ghost-btn lg">
                    Reset filters
                  </Link>
                  {!isAuthenticated ? (
                    <Link
                      href={buildPricingAuthPath({ intent, planId: selectedPlanId })}
                      className="primary-btn lg"
                    >
                      Start with email
                      <SignIn size={18} weight="bold" />
                    </Link>
                  ) : (
                    <Link href="/dashboard" className="primary-btn lg">
                      Return to dashboard
                    </Link>
                  )}
                </div>
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
                    </div>
                  </div>
                ) : null}
                {notice ? <p className="pricing-route-notice">{notice}</p> : null}
              </div>
            </div>
          </section>

          <section className="lp-section" aria-labelledby="pricing-plans-heading">
            <div className="pricing-hero">
              <h2 id="pricing-plans-heading">Subscription plans</h2>
              <p>Use the live public offers from your current billing catalog.</p>
            </div>

            <div className="lp-plan-grid">
              {sortedPlans.map((plan) => {
                const planView = buildPlanView({ planId: plan.id, plans: billingCatalog.plans });
                const isSelected = selectedPlanId === plan.id;
                const actionLabel = resolvePlanActionLabel({
                  isAuthenticated,
                  monthlyPriceCents: plan.monthly_price_cents,
                  displayName: planView.displayName,
                });
                const isLoading = planActionLoadingId === plan.id;

                return (
                  <article
                    key={plan.id}
                    className={`lp-plan-card pricing-card ${isSelected ? "pricing-plan-selected" : ""}`}
                  >
                    <div className="lp-plan-top">
                      <div>
                        <span className="lp-plan-name">{planView.displayName}</span>
                        <p className="lp-plan-sub">{planView.description}</p>
                      </div>
                      {plan.id === "studio" ? (
                        <span className="lp-badge teal">Most popular</span>
                      ) : null}
                    </div>

                    <div className="lp-price-block">
                      <div className="lp-price-big">
                        {plan.monthly_price_cents === 0
                          ? "Free"
                          : formatCurrencyFromCents(plan.monthly_price_cents)}
                      </div>
                      <div className="lp-price-note">
                        {plan.monthly_price_cents === 0 ? "forever" : "per month"}
                      </div>
                    </div>

                    <ul className="lp-plan-list">
                      <li>
                        <CheckCircle size={16} weight="bold" />
                        {plan.monthly_credits_cents.toLocaleString()} credits every month
                      </li>
                      <li>
                        <CheckCircle size={16} weight="bold" />
                        {formatStorageBytes(plan.storage_limit_bytes)} of included media storage
                      </li>
                      <li>
                        <CheckCircle size={16} weight="bold" />
                        {planView.seatsLabel}
                      </li>
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

          <section className="lp-section" aria-labelledby="pricing-credits-heading">
            <div className="lp-section-head">
              <div>
                <p className="eyebrow">Top-ups</p>
                <h2 id="pricing-credits-heading">Credit packages</h2>
              </div>
            </div>

            <div className="lp-plan-grid">
              {packageCards.map((pkg) => (
                <article key={pkg.id} className="lp-plan-card pricing-card pricing-detail-card">
                  <div className="lp-plan-top">
                    <div>
                      <span className="lp-plan-name">{pkg.display_name}</span>
                      <p className="lp-plan-sub">One-time top-up</p>
                    </div>
                    {pkg.badge ? <span className="lp-badge">{pkg.badge}</span> : null}
                  </div>

                  <div className="lp-price-block">
                    <div className="lp-price-big">{formatCurrencyFromCents(pkg.price_cents)}</div>
                    <div className="lp-price-note">one-time</div>
                  </div>

                  <ul className="lp-plan-list">
                    <li>
                      <CreditCard size={16} weight="bold" />
                      {pkg.credit_amount_cents.toLocaleString()} credits added to your balance
                    </li>
                    <li>
                      <CreditCard size={16} weight="bold" />${pkg.unitUsdPerThousand.toFixed(2)} per
                      1,000 credits
                    </li>
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section className="lp-section" aria-labelledby="pricing-storage-heading">
            <div className="lp-section-head">
              <div>
                <p className="eyebrow">Media capacity</p>
                <h2 id="pricing-storage-heading">Recurring storage add-ons</h2>
              </div>
            </div>

            <div className="lp-plan-grid">
              {billingCatalog.storageAddons.map((addon) => (
                <article key={addon.id} className="lp-plan-card pricing-card pricing-detail-card">
                  <div className="lp-plan-top">
                    <div>
                      <span className="lp-plan-name">{addon.display_name}</span>
                      <p className="lp-plan-sub">Recurring add-on</p>
                    </div>
                    <Database size={18} weight="bold" />
                  </div>

                  <div className="lp-price-block">
                    <div className="lp-price-big">
                      {formatCurrencyFromCents(addon.monthly_price_cents)}
                    </div>
                    <div className="lp-price-note">per month</div>
                  </div>

                  <ul className="lp-plan-list">
                    <li>
                      <CheckCircle size={16} weight="bold" />
                      Adds {formatStorageBytes(addon.storage_limit_bytes)} to your workspace
                    </li>
                    <li>
                      <CheckCircle size={16} weight="bold" />
                      Renews with your paid subscription
                    </li>
                  </ul>
                </article>
              ))}
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
