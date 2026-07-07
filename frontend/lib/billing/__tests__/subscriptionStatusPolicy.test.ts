import { describe, expect, it } from "vitest";
import {
  isCreditTopUpEligibleSubscriptionStatus,
  isFullAccessSubscriptionStatus,
  isPaidAccessSubscriptionStatus,
  isRecoverableSubscriptionStatus,
  isRevokedSubscriptionStatus,
  normalizeSubscriptionStatus,
} from "../subscriptionStatusPolicy";

describe("subscription status policy", () => {
  it("normalizes Stripe status strings before classification", () => {
    expect(normalizeSubscriptionStatus(" Past_Due ")).toBe("past_due");
    expect(isPaidAccessSubscriptionStatus(" Past_Due ")).toBe(true);
  });

  it("keeps active and trialing as full access and credit top-up eligible", () => {
    for (const status of ["active", "trialing"]) {
      expect(isFullAccessSubscriptionStatus(status)).toBe(true);
      expect(isCreditTopUpEligibleSubscriptionStatus(status)).toBe(true);
      expect(isPaidAccessSubscriptionStatus(status)).toBe(true);
    }
  });

  it("treats past_due as paid-access grace but not credit top-up eligible", () => {
    expect(isRecoverableSubscriptionStatus("past_due")).toBe(true);
    expect(isPaidAccessSubscriptionStatus("past_due")).toBe(true);
    expect(isCreditTopUpEligibleSubscriptionStatus("past_due")).toBe(false);
  });

  it("treats unpaid as revoked instead of current paid access", () => {
    expect(isRevokedSubscriptionStatus("unpaid")).toBe(true);
    expect(isPaidAccessSubscriptionStatus("unpaid")).toBe(false);
    expect(isCreditTopUpEligibleSubscriptionStatus("unpaid")).toBe(false);
  });
});
