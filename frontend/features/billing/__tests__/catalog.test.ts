import { describe, expect, it } from "vitest";
import { buildPlanView, resolvePlanPricingForInterval } from "../catalog";

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

  it("exposes pricing-copy concurrency limits for each plan tier", () => {
    expect(buildPlanView({ planId: "media", plans }).concurrentGenerationsLabel).toBe(
      "2 audio, 2 image, and 1 video generations at a time"
    );
    expect(buildPlanView({ planId: "studio", plans }).concurrentGenerationsLabel).toBe(
      "4 audio, 3 image, and 2 video generations at a time"
    );
    expect(buildPlanView({ planId: "media", plans }).concurrentGenerationsCompactLabel).toBe(
      "2 audio · 2 image · 1 video"
    );
    expect(buildPlanView({ planId: "studio", plans }).concurrentGenerationsCompactLabel).toBe(
      "4 audio · 3 image · 2 video"
    );
  });

  it("adds business pricing highlights for credit efficiency", () => {
    expect(buildPlanView({ planId: "business", plans }).pricingHighlights).toEqual([
      "Lowest cost per credit",
      "Discounted credit top-ups",
    ]);
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
});
