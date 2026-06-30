import { describe, expect, it } from "vitest";
import {
  getProfileSectionContent,
  resolveLedgerLabel,
  resolveLedgerReference,
  resolveRecurringPaymentSummary,
} from "../profilePageModel";

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

  it("summarizes monthly plan payments with recurring storage add-ons", () => {
    expect(
      resolveRecurringPaymentSummary({
        baseRecurringPriceCents: 1500,
        billingInterval: "month",
        activeAddonRecurringPriceCents: 500,
        isInternalCompContract: false,
      })
    ).toEqual({
      primaryLabel: "$20.00 / month",
      shortHelperLabel: "Plan + active add-ons",
      breakdownLabel: "Plan $15.00 / month + add-ons $5.00 / month",
    });
  });

  it("keeps annual plan billing distinct from monthly storage add-ons", () => {
    expect(
      resolveRecurringPaymentSummary({
        baseRecurringPriceCents: 18000,
        billingInterval: "year",
        activeAddonRecurringPriceCents: 500,
        isInternalCompContract: false,
      })
    ).toEqual({
      primaryLabel: "$20.00 / month",
      shortHelperLabel: "Billed as $180.00 yearly + add-ons monthly",
      breakdownLabel: "Plan $180.00 / year + add-ons $5.00 / month",
    });
  });

  it("keeps credits copy separate from account billing controls", () => {
    expect(getProfileSectionContent("credits")).toEqual({
      title: "Credits",
      body: "Manage credit balance, one-time top-ups, and recent credit activity.",
    });
    expect(getProfileSectionContent("account").body).toContain("billing");
  });
});
