import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  buildPlanView,
  type BillingInterval,
  type BillingPlanRecord,
} from "../../../billing/catalog";
import { ProfileSubscriptionSection } from "../ProfileSubscriptionSection";

const GIB = 1024 * 1024 * 1024;

const billingPlans: BillingPlanRecord[] = [
  {
    id: "starter",
    display_name: "Starter",
    sort_order: 1,
    monthly_price_cents: 1500,
    monthly_credits_cents: 350,
    storage_limit_bytes: GIB,
    is_active: true,
    offers: {
      month: {
        id: "starter__month",
        billing_interval: "month",
        recurring_price_cents: 1500,
        monthly_credits_cents: 350,
        storage_limit_bytes: GIB,
        stripe_price_id: "price_starter_month",
        acquisition_enabled: true,
        is_active: true,
        effective_start_at: null,
      },
      year: {
        id: "starter__year",
        billing_interval: "year",
        recurring_price_cents: 18000,
        monthly_credits_cents: 350,
        storage_limit_bytes: GIB,
        stripe_price_id: "price_starter_year",
        acquisition_enabled: true,
        is_active: true,
        effective_start_at: null,
      },
    },
  },
  {
    id: "media",
    display_name: "Media",
    sort_order: 2,
    monthly_price_cents: 4900,
    monthly_credits_cents: 1200,
    storage_limit_bytes: 25 * GIB,
    is_active: true,
    offers: {
      month: {
        id: "media__month",
        billing_interval: "month",
        recurring_price_cents: 4900,
        monthly_credits_cents: 1200,
        storage_limit_bytes: 25 * GIB,
        stripe_price_id: "price_media_month",
        acquisition_enabled: true,
        is_active: true,
        effective_start_at: null,
      },
      year: {
        id: "media__year",
        billing_interval: "year",
        recurring_price_cents: 58800,
        monthly_credits_cents: 1200,
        storage_limit_bytes: 25 * GIB,
        stripe_price_id: "price_media_year",
        acquisition_enabled: true,
        is_active: true,
        effective_start_at: null,
      },
    },
  },
];

const renderSubscriptionSection = ({
  currentSubscriptionBillingInterval,
  currentSubscriptionPriceCents,
  onRequestPlanChange = vi.fn<(planId: string, billingInterval: BillingInterval) => void>(),
}: {
  currentSubscriptionBillingInterval: BillingInterval;
  currentSubscriptionPriceCents: number;
  onRequestPlanChange?: (planId: string, billingInterval: BillingInterval) => void;
}) => {
  render(
    <ProfileSubscriptionSection
      activePlan={buildPlanView({ planId: "starter", plans: billingPlans })}
      activePlanRank={1}
      activeAddonStorageBytes={0}
      currentSubscriptionCreditsCents={350}
      currentSubscriptionBillingInterval={currentSubscriptionBillingInterval}
      currentSubscriptionPriceCents={currentSubscriptionPriceCents}
      currentSubscriptionStorageLimitBytes={GIB}
      currentSubscriptionMaxConcurrentGenerations={1}
      recurringPaymentLabel={
        currentSubscriptionBillingInterval === "year" ? "$180.00 / year" : "$15.00 / month"
      }
      recurringPaymentHelper={
        currentSubscriptionBillingInterval === "year"
          ? "$15.00 / month equivalent, billed annually"
          : "Plan $15.00 / month"
      }
      subscriptionRenewalText="July 15, 2026"
      billingPlans={billingPlans}
      billingPlansLoading={false}
      isInternalCompContract={false}
      planChangeLoadingPlanId={null}
      subscriptionTransactions={[]}
      subscriptionTransactionsLoading={false}
      subscriptionTransactionsError={null}
      onRequestPlanChange={onRequestPlanChange}
      onRequestCancel={vi.fn()}
    />
  );
};

describe("ProfileSubscriptionSection", () => {
  it("offers annual billing on the current monthly plan when annual is selected", () => {
    const onRequestPlanChange = vi.fn<(planId: string, billingInterval: BillingInterval) => void>();
    renderSubscriptionSection({
      currentSubscriptionBillingInterval: "month",
      currentSubscriptionPriceCents: 1500,
      onRequestPlanChange,
    });

    fireEvent.click(screen.getByRole("button", { name: "Annual" }));
    fireEvent.click(screen.getByRole("button", { name: "Upgrade to annual billing" }));

    expect(onRequestPlanChange).toHaveBeenCalledWith("starter", "year");
  });

  it("offers monthly billing on the current annual plan when monthly is selected", () => {
    const onRequestPlanChange = vi.fn<(planId: string, billingInterval: BillingInterval) => void>();
    renderSubscriptionSection({
      currentSubscriptionBillingInterval: "year",
      currentSubscriptionPriceCents: 18000,
      onRequestPlanChange,
    });

    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
    fireEvent.click(screen.getByRole("button", { name: "Downgrade to monthly billing" }));

    expect(onRequestPlanChange).toHaveBeenCalledWith("starter", "month");
  });

  it("shows the current plan concurrent generation entitlement", () => {
    renderSubscriptionSection({
      currentSubscriptionBillingInterval: "month",
      currentSubscriptionPriceCents: 1500,
    });

    expect(screen.getByText("Concurrent generations")).toBeInTheDocument();
    expect(screen.getAllByText("1 active image generation at a time").length).toBeGreaterThan(0);
  });
});
