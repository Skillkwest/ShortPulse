import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { resolvePlanPricingForInterval, type BillingPlanRecord } from "../../catalog";
import { SubscriptionPlanCard } from "../SubscriptionPlanCard";

const GIB = 1024 * 1024 * 1024;

describe("SubscriptionPlanCard", () => {
  it("shows Business credits as base plus bonus copy while preserving the 8,000-credit entitlement", () => {
    const businessPlan: BillingPlanRecord = {
      id: "business",
      display_name: "Business",
      sort_order: 40,
      monthly_price_cents: 29900,
      monthly_credits_cents: 8000,
      storage_limit_bytes: 150 * GIB,
      max_concurrent_generations: 8,
      is_active: true,
      offers: {
        month: {
          id: "business__month",
          billing_interval: "month",
          recurring_price_cents: 29900,
          monthly_credits_cents: 8000,
          storage_limit_bytes: 150 * GIB,
          max_concurrent_generations: 8,
          stripe_price_id: "price_business_month",
          acquisition_enabled: true,
          is_active: true,
          effective_start_at: null,
        },
      },
    };

    render(
      <SubscriptionPlanCard
        plan={businessPlan}
        plans={[businessPlan]}
        billingInterval="month"
        actionSlot={<button type="button">Choose Business</button>}
      />
    );

    expect(resolvePlanPricingForInterval(businessPlan, "month").monthlyCreditsCents).toBe(8000);
    expect(screen.getByText("7,500 credits every month")).toBeInTheDocument();
    expect(screen.getByText("+ 500 BONUS credits every month for FREE")).toBeInTheDocument();
    expect(screen.getByText("Free BONUS credits").closest("li")).toHaveClass("is-included");
    expect(screen.queryByText("8,000 credits every month")).not.toBeInTheDocument();
  });
});
