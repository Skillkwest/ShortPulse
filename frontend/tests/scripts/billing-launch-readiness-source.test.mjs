import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(process.cwd(), "..");
const readinessScriptPath = path.join(repoRoot, "scripts/check_billing_launch_readiness.mjs");
const readinessHelpersPath = path.join(
  repoRoot,
  "scripts/lib/billing_launch_readiness_helpers.mjs"
);

const requiredScheduleEvents = [
  "subscription_schedule.created",
  "subscription_schedule.updated",
  "subscription_schedule.released",
  "subscription_schedule.completed",
  "subscription_schedule.canceled",
  "subscription_schedule.aborted",
];

const requiredPaymentRecoveryEvents = [
  "checkout.session.async_payment_failed",
  "invoice.payment_failed",
  "invoice.payment_action_required",
];

describe("billing launch readiness source", () => {
  it("requires Stripe subscription schedule events for period-end downgrade projection", () => {
    const source = fs.readFileSync(readinessHelpersPath, "utf8");

    for (const eventName of requiredScheduleEvents) {
      expect(source).toContain(eventName);
    }
  });

  it("requires Stripe payment-recovery events handled by the billing webhook", () => {
    const source = fs.readFileSync(readinessHelpersPath, "utf8");

    for (const eventName of requiredPaymentRecoveryEvents) {
      expect(source).toContain(eventName);
    }
  });

  it("probes both internal credit workers as unauthenticated fail-closed routes", () => {
    const source = fs.readFileSync(readinessScriptPath, "utf8");

    expect(source).toContain("checkInternalWorkerFailClosed");
    expect(source).toContain("/api/internal/billing-contract-renewals/run");
    expect(source).toContain("billing_renewal_worker_fail_closed");
    expect(source).toContain("/api/internal/credit-expirations/run");
    expect(source).toContain("credit_expiration_worker_fail_closed");
    expect(source).toContain("response.status === 401");
    expect(source).toContain("allowDisabledNotFound && response.status === 404");
    expect(source).toContain("allowDisabledNotFound: true");
  });

  it("probes the full-price Stripe Portal upgrade configuration", () => {
    const source = fs.readFileSync(readinessScriptPath, "utf8");

    expect(source).toContain("checkStripeFullPriceUpgradePortalConfig");
    expect(source).toContain("scripts/check_stripe_billing_portal_upgrade_config.mjs");
    expect(source).toContain("stripe_full_price_upgrade_portal_config");
  });
});
