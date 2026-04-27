/**
 * Guest-mode dashboard content.
 * Presents the public dashboard hero, guest CTA cards, and landing-style plan highlights.
 */
import Link from "next/link";
import { FolderSimple, Plus, Sparkle } from "phosphor-react";
import type { BillingCatalogSnapshot } from "../../billing/catalog";
import { buildPlanView } from "../../billing/catalog";
import { formatCurrencyFromCents } from "../../profile/profilePageModel";
import { DashboardQuickActionCard } from "./DashboardQuickActionCard";

type GuestDashboardViewProps = {
  billingCatalog: BillingCatalogSnapshot;
  createProjectHref: string;
  openProjectsHref: string;
};

const selectFeaturedPlans = (billingCatalog: BillingCatalogSnapshot) => {
  const sortedPlans = [...billingCatalog.plans].sort((left, right) => {
    if ((left.sort_order ?? 0) === (right.sort_order ?? 0)) {
      return left.monthly_price_cents - right.monthly_price_cents;
    }
    return (left.sort_order ?? 0) - (right.sort_order ?? 0);
  });

  return sortedPlans.slice(0, 3).map((plan) => {
    const view = buildPlanView({ planId: plan.id, plans: billingCatalog.plans });
    return {
      id: plan.id,
      label: view.displayName,
      priceLabel:
        plan.monthly_price_cents === 0
          ? "Start free"
          : `${formatCurrencyFromCents(plan.monthly_price_cents)} / month`,
      helperText: `${plan.monthly_credits_cents.toLocaleString()} credits · ${view.description}`,
    };
  });
};

/**
 * Renders the public guest dashboard mode.
 */
export function GuestDashboardView({
  billingCatalog,
  createProjectHref,
  openProjectsHref,
}: GuestDashboardViewProps) {
  const featuredPlans = selectFeaturedPlans(billingCatalog);

  return (
    <>
      <section className="dashboard-hero minimal-hero">
        <div className="hero-primary">
          <div className="hero-copy">
            <h1>
              Build faster with <span>ShortPulse</span>
            </h1>
            <p className="hero-subtext">
              Start from the dashboard, compare live plans, and unlock the AI Studio when you are
              ready to create your first saved project.
            </p>

            <div className="dashboard-guest-strip">
              <div className="dashboard-guest-strip-copy">
                <p className="eyebrow">Public dashboard</p>
                <p className="dashboard-guest-strip-title">
                  Your home, landing page, and workspace entry are now one surface.
                </p>
              </div>
              <Link href="/pricing" className="ghost-btn small">
                Explore pricing
              </Link>
            </div>
          </div>

          <div className="hero-quick-row">
            <DashboardQuickActionCard
              ariaLabel="Create New Project: Choose a plan to start building in AI Studio"
              className="hero-onboarding hero-new-project-card"
              title="Create New Project"
              helperText="Choose a plan and sign up to enter AI Studio"
              href={createProjectHref}
              icon={<Plus size={30} weight="bold" className="hero-new-project-icon" />}
            />

            <DashboardQuickActionCard
              ariaLabel="Open Projects: Sign in or choose a plan to continue"
              className="hero-sessions-group hero-sessions-group-button hero-open-projects-card"
              title="Open Projects"
              helperText="Sign in to your account or start with a new plan"
              href={openProjectsHref}
              icon={<FolderSimple size={30} weight="duotone" className="hero-open-projects-icon" />}
            />
          </div>
        </div>
      </section>

      <section className="lp-section dashboard-guest-plans" aria-labelledby="guest-plans-heading">
        <div className="lp-section-head">
          <div>
            <p className="eyebrow">Plans</p>
            <h2 id="guest-plans-heading">Choose where to start</h2>
          </div>
        </div>

        <div className="lp-feature-grid feature-tiles">
          {featuredPlans.map((plan) => (
            <Link
              key={plan.id}
              href={`/pricing?plan=${encodeURIComponent(plan.id)}`}
              className="lp-card tile dashboard-plan-highlight"
            >
              <div className="tile-icon">
                <Sparkle size={22} weight="bold" />
              </div>
              <div className="tile-body">
                <h3>{plan.label}</h3>
                <p>{plan.priceLabel}</p>
                <div className="tile-highlight">{plan.helperText}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
