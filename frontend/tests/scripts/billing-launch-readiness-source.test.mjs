import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(process.cwd(), "..");
const readinessScriptPath = path.join(repoRoot, "scripts/check_billing_launch_readiness.mjs");

describe("billing launch readiness source", () => {
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
