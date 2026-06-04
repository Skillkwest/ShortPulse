import { describe, expect, it } from "vitest";
import {
  buildPlanView,
  filterPublicSubscriptionPlans,
  resolvePlanPricingForInterval,
} from "../catalog";

describe("buildPlanView", () => {
  const plans = [
    {
      id: "media",
      display_name: "Media",
      monthly_price_cents: 1200,
      monthly_credits_cents: 600,
      storage_limit_bytes: 25 * 1024 * 1024 * 1024,
      is_active: true,
    },
    {
      id: "studio",
      display_name: "Studio",
      monthly_price_cents: 3900,
      monthly_credits_cents: 3000,
      storage_limit_bytes: 100 * 1024 * 1024 * 1024,
      is_active: true,
    },
  ];

  it("uses one workspace seat for Media and Studio plans", () => {
    expect(buildPlanView({ planId: "media", plans }).seatsLabel).toBe("1 workspace seat");
    expect(buildPlanView({ planId: "studio", plans }).seatsLabel).toBe("1 workspace seat");
  });

  it("presents the hidden baseline tier with Starter-facing customer copy", () => {
    expect(
      buildPlanView({
        planId: "free",
        plans: [
          {
            id: "free",
            display_name: "Starter",
            monthly_price_cents: 0,
            monthly_credits_cents: 0,
            storage_limit_bytes: 1024,
            is_active: true,
          },
        ],
      }).displayName
    ).toBe("Starter");
  });

  it("uses starter as the paid first-tier presentation model", () => {
    expect(
      buildPlanView({
        planId: "starter",
        plans: [
          {
            id: "starter",
            display_name: "Starter",
            monthly_price_cents: 1500,
            monthly_credits_cents: 350,
            storage_limit_bytes: 1024,
            is_active: true,
          },
        ],
      }).displayName
    ).toBe("Starter");
  });

  it("exposes plan-card concurrency copy that hints at capacity without hard-coding exact limits", () => {
    expect(buildPlanView({ planId: "free", plans }).concurrentGenerationsLabel).toBe(
      "Image-only workflow"
    );
    expect(buildPlanView({ planId: "starter", plans }).concurrentGenerationsLabel).toBe(
      "Image-only workflow"
    );
    expect(buildPlanView({ planId: "media", plans }).concurrentGenerationsLabel).toBe(
      "Parallel mixed-media workflow"
    );
    expect(buildPlanView({ planId: "studio", plans }).concurrentGenerationsLabel).toBe(
      "Higher-concurrency mixed-media workflow"
    );
    expect(buildPlanView({ planId: "business", plans }).concurrentGenerationsLabel).toBe(
      "Highest-concurrency mixed-media workflow"
    );
    expect(buildPlanView({ planId: "free", plans }).concurrentGenerationsCompactLabel).toBe(
      "Image-only workflow"
    );
    expect(buildPlanView({ planId: "starter", plans }).concurrentGenerationsCompactLabel).toBe(
      "Image-only workflow"
    );
    expect(buildPlanView({ planId: "media", plans }).concurrentGenerationsCompactLabel).toBe(
      "Parallel mixed-media workflow"
    );
    expect(buildPlanView({ planId: "studio", plans }).concurrentGenerationsCompactLabel).toBe(
      "Higher-concurrency mixed-media workflow"
    );
    expect(buildPlanView({ planId: "business", plans }).concurrentGenerationsCompactLabel).toBe(
      "Highest-concurrency mixed-media workflow"
    );
  });

  it("adds business pricing highlights for credit efficiency", () => {
    expect(buildPlanView({ planId: "business", plans }).pricingHighlights).toEqual([
      "Lowest cost per credit",
      "Discounted credit top-ups",
    ]);
  });

  it("exposes the screenshot-aligned card copy model", () => {
    const businessPlan = buildPlanView({ planId: "business", plans });
    const studioPlan = buildPlanView({ planId: "studio", plans });

    expect(businessPlan.cardFooterDescription).toBe(
      "Best for serious creators with heavy workflow & storage needs"
    );
    expect(businessPlan.bonusCreditsLabel).toBe("+ 500 bonus credits every month included");
    expect(studioPlan.displayPricing).toEqual(
      expect.objectContaining({
        monthlyDisplayPriceCents: 12900,
        annualDisplayPriceCents: 9900,
        annualDiscountLabel: "23% OFF",
        annualSaveLabel: "Save $360",
      })
    );
    expect(studioPlan.displayBenefits).toEqual({
      monthlyCreditsLabel: "3,200 credits every month",
      storageLabel: "100 GB of media storage",
    });
    expect(businessPlan.displayPricing).toEqual(
      expect.objectContaining({
        monthlyDisplayPriceCents: 29900,
        annualDisplayPriceCents: 22900,
        annualDiscountLabel: "23% OFF",
        annualSaveLabel: "Save $840",
      })
    );
    expect(businessPlan.displayBenefits).toEqual({
      monthlyCreditsLabel: "7,500 credits every month",
      storageLabel: "500 GB of media storage",
    });
    expect(businessPlan.cardFeatures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Create studio", included: true }),
        expect.objectContaining({ label: "Bonus credits", included: true }),
      ])
    );
  });

  it("uses the approved annual display math for paid plans", () => {
    const mediaAnnual = resolvePlanPricingForInterval(plans[0], "year");
    const studioAnnual = resolvePlanPricingForInterval(plans[1], "year");

    expect(mediaAnnual.monthlyEquivalentCents).toBe(1000);
    expect(mediaAnnual.billedPriceCents).toBe(12000);
    expect(mediaAnnual.savingsAmountCents).toBe(2400);

    expect(studioAnnual.monthlyEquivalentCents).toBe(3250);
    expect(studioAnnual.billedPriceCents).toBe(39000);
    expect(studioAnnual.savingsAmountCents).toBe(7800);
  });

  it("hides the hidden baseline tier from public plan selections when starter exists", () => {
    expect(
      filterPublicSubscriptionPlans([
        {
          id: "free",
          display_name: "Starter",
          monthly_price_cents: 0,
          monthly_credits_cents: 100,
          storage_limit_bytes: 1024,
          is_active: true,
        },
        {
          id: "starter",
          display_name: "Starter",
          monthly_price_cents: 1500,
          monthly_credits_cents: 350,
          storage_limit_bytes: 1024,
          is_active: true,
        },
        {
          id: "media",
          display_name: "Media",
          monthly_price_cents: 4900,
          monthly_credits_cents: 1200,
          storage_limit_bytes: 1024,
          is_active: true,
        },
      ]).map((plan) => plan.id)
    ).toEqual(["starter", "media"]);
  });
});
