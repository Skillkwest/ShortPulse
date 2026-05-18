import { describe, expect, it } from "vitest";
import { resolveLedgerLabel, resolveLedgerReference } from "../profilePageModel";

describe("profilePageModel billing helpers", () => {
  it("labels annual recurring grants distinctly from monthly renewals", () => {
    expect(
      resolveLedgerLabel({
        id: "ledger-annual",
        change_cents: 350,
        reason: "Annual monthly allocation",
        source: "annual_contract_monthly_allocation",
        source_ref: "annual_contract:monthly_grant:contract-1:2026-06-18T00:00:00.000Z",
        metadata: null,
        created_at: "2026-06-18T00:00:00.000Z",
      })
    ).toBe("Annual monthly credit allocation");
  });

  it("prefers invoice metadata when resolving ledger references", () => {
    expect(
      resolveLedgerReference({
        id: "ledger-subscription",
        change_cents: 350,
        reason: "Monthly plan credit allocation",
        source: "subscription_renewal",
        source_ref: "invoice:in_123:monthly_allocation",
        metadata: {
          invoice_id: "in_123",
          stripe_price_id: "price_starter_monthly",
        },
        created_at: "2026-05-18T00:00:00.000Z",
      })
    ).toBe("in_123");
  });
});
