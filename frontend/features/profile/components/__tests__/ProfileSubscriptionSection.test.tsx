import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  buildPlanView,
  type BillingInterval,
  type BillingPlanRecord,
} from "../../../billing/catalog";
import type { PendingSubscriptionChange } from "../../../billing/accountSummary";
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
  activePlanId = "starter",
  activeAddonStorageBytes = 0,
  currentSubscriptionBillingInterval,
  currentSubscriptionCreditsCents = activePlanId === "free" ? 0 : 350,
  currentSubscriptionMaxConcurrentGenerations = 1,
  currentSubscriptionPriceCents,
  currentSubscriptionStorageLimitBytes = activePlanId === "free" ? 0 : GIB,
  isSubscriptionCancellationScheduled = false,
  onRequestPlanChange = vi.fn<(planId: string, billingInterval: BillingInterval) => void>(),
  pendingSubscriptionChange = null,
  planChangeLoadingPlanId = null,
  showLegacyPlanChangeNotice = false,
}: {
  activePlanId?: string;
  activeAddonStorageBytes?: number;
  currentSubscriptionBillingInterval: BillingInterval;
  currentSubscriptionCreditsCents?: number;
  currentSubscriptionMaxConcurrentGenerations?: number;
  currentSubscriptionPriceCents: number;
  currentSubscriptionStorageLimitBytes?: number;
  isSubscriptionCancellationScheduled?: boolean;
  onRequestPlanChange?: (planId: string, billingInterval: BillingInterval) => void;
  pendingSubscriptionChange?: PendingSubscriptionChange | null;
  planChangeLoadingPlanId?: string | null;
  showLegacyPlanChangeNotice?: boolean;
}) => {
  render(
    <ProfileSubscriptionSection
      activePlan={buildPlanView({ planId: activePlanId, plans: billingPlans })}
      activePlanRank={billingPlans.find((plan) => plan.id === activePlanId)?.sort_order ?? 0}
      activeAddonStorageBytes={activeAddonStorageBytes}
      currentSubscriptionCreditsCents={currentSubscriptionCreditsCents}
      currentSubscriptionBillingInterval={currentSubscriptionBillingInterval}
      currentSubscriptionPriceCents={currentSubscriptionPriceCents}
      currentSubscriptionStorageLimitBytes={currentSubscriptionStorageLimitBytes}
      currentSubscriptionMaxConcurrentGenerations={currentSubscriptionMaxConcurrentGenerations}
      recurringPaymentLabel={
        currentSubscriptionPriceCents === 0
          ? "No recurring payment"
          : currentSubscriptionBillingInterval === "year"
            ? "$180.00 / year"
            : "$15.00 / month"
      }
      subscriptionPeriodLabel="Current period"
      subscriptionRenewalText="July 15, 2026"
      isSubscriptionCancellationScheduled={isSubscriptionCancellationScheduled}
      billingPlans={billingPlans}
      billingPlansLoading={false}
      isInternalCompContract={false}
      showLegacyPlanChangeNotice={showLegacyPlanChangeNotice}
      planChangeLoadingPlanId={planChangeLoadingPlanId}
      subscriptionTransactions={[]}
      subscriptionTransactionsLoading={false}
      subscriptionTransactionsError={null}
      pendingSubscriptionChange={pendingSubscriptionChange}
      onRequestPlanChange={onRequestPlanChange}
      onRequestCancel={vi.fn()}
    />
  );
};

describe("ProfileSubscriptionSection", () => {
  it("replaces baseline plan metrics and available plans with the shared View plans CTA", () => {
    renderSubscriptionSection({
      activePlanId: "free",
      currentSubscriptionBillingInterval: "month",
      currentSubscriptionPriceCents: 0,
      currentSubscriptionMaxConcurrentGenerations: 0,
    });
    const hero = screen.getByText("Current plan").closest("article");

    expect(within(hero as HTMLElement).getByText("Baseline access")).toBeInTheDocument();
    expect(
      within(hero as HTMLElement).getByRole("link", { name: "View subscription plans" })
    ).toHaveAttribute("href", "/pricing");
    expect(within(hero as HTMLElement).getByText("View plans")).toBeInTheDocument();
    expect(within(hero as HTMLElement).queryByText("Monthly credits")).not.toBeInTheDocument();
    expect(screen.queryByText("Available plans")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Monthly" })).not.toBeInTheDocument();
  });

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

  it("confirms higher-plan upgrades before carrying over an active storage add-on", () => {
    const onRequestPlanChange = vi.fn<(planId: string, billingInterval: BillingInterval) => void>();
    renderSubscriptionSection({
      currentSubscriptionBillingInterval: "month",
      currentSubscriptionPriceCents: 1500,
      activeAddonStorageBytes: 50 * GIB,
      onRequestPlanChange,
    });

    fireEvent.click(screen.getByRole("button", { name: "Upgrade to Media" }));

    expect(onRequestPlanChange).not.toHaveBeenCalled();
    expect(screen.getByText(/Confirm upgrade to Media/)).toBeInTheDocument();
    expect(screen.getByText(/\+50 GB recurring storage add-on stays active/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm upgrade" }));

    expect(onRequestPlanChange).toHaveBeenCalledWith("media", "month");
  });

  it("shows pending downgrade messaging without changing the current plan card", () => {
    renderSubscriptionSection({
      activePlanId: "media",
      currentSubscriptionBillingInterval: "month",
      currentSubscriptionCreditsCents: 1200,
      currentSubscriptionPriceCents: 4900,
      currentSubscriptionStorageLimitBytes: 25 * GIB,
      currentSubscriptionMaxConcurrentGenerations: 2,
      pendingSubscriptionChange: {
        kind: "scheduled_downgrade",
        status: "active",
        currentPlanId: "media",
        currentOfferId: "media__month",
        currentBillingInterval: "month",
        currentStripePriceId: "price_media_month",
        targetPlanId: "starter",
        targetOfferId: "starter__month",
        targetPlanLabel: "Starter",
        targetBillingInterval: "month",
        targetStripePriceId: "price_starter_month",
        targetRecurringPriceCents: 1500,
        targetMonthlyCreditsCents: 350,
        targetStorageLimitBytes: GIB,
        targetMaxConcurrentGenerations: 1,
        effectiveAt: "2026-08-08T14:59:23.000Z",
        currentBenefitsEndAt: "2026-08-08T14:59:23.000Z",
      },
    });

    expect(screen.getByText(/Starter is scheduled for August 8, 2026/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Current Plan" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Scheduled for August 8, 2026/ })).toBeDisabled();
  });

  it("shows scheduled cancellation messaging with the access end date", () => {
    renderSubscriptionSection({
      activePlanId: "media",
      currentSubscriptionBillingInterval: "month",
      currentSubscriptionCreditsCents: 1200,
      currentSubscriptionPriceCents: 4900,
      currentSubscriptionStorageLimitBytes: 25 * GIB,
      currentSubscriptionMaxConcurrentGenerations: 2,
      isSubscriptionCancellationScheduled: true,
    });

    expect(
      screen.getByText(/Account cancellation is scheduled for July 15, 2026/)
    ).toBeInTheDocument();
    expect(screen.getByText(/recurring storage add-ons until then/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel subscription" })).not.toBeInTheDocument();
  });

  it("labels storage-carryover upgrade loading as an in-app plan update", () => {
    renderSubscriptionSection({
      currentSubscriptionBillingInterval: "month",
      currentSubscriptionPriceCents: 1500,
      activeAddonStorageBytes: 50 * GIB,
      planChangeLoadingPlanId: "media",
    });

    expect(screen.getByRole("button", { name: "Updating plan..." })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Opening billing…" })).not.toBeInTheDocument();
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
    const hero = screen.getByText("Current plan").closest("article");

    expect(within(hero as HTMLElement).getByText("Subscription")).toBeInTheDocument();
    expect(within(hero as HTMLElement).queryByText("Total payment")).not.toBeInTheDocument();
    expect(screen.getByText("Concurrent generations")).toBeInTheDocument();
    expect(within(hero as HTMLElement).getByText("1 (Image only)")).toBeInTheDocument();
    expect(screen.getAllByText("1 active image generation at a time").length).toBeGreaterThan(0);
  });

  it("shows non-starter concurrent generation entitlements as a number only", () => {
    renderSubscriptionSection({
      activePlanId: "studio",
      currentSubscriptionBillingInterval: "month",
      currentSubscriptionMaxConcurrentGenerations: 4,
      currentSubscriptionPriceCents: 12900,
    });
    const hero = screen.getByText("Current plan").closest("article");

    expect(within(hero as HTMLElement).getByText("4")).toBeInTheDocument();
    expect(
      within(hero as HTMLElement).queryByText("4 active generations at a time")
    ).not.toBeInTheDocument();
  });
});
