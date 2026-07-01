import { describe, expect, it } from "vitest";
import {
  CUSTOMER_CREDIT_ACTIVITY_SOURCES,
  formatAccountCreditsSummary,
  getProfileSectionContent,
  resolveAccountCreditsSummary,
  resolveLedgerLabel,
  resolveLedgerReference,
  resolveRecurringPaymentSummary,
} from "../profilePageModel";

describe("profilePageModel billing helpers", () => {
  it("keeps customer credit activity limited to direct credit purchases", () => {
    expect(CUSTOMER_CREDIT_ACTIVITY_SOURCES).toEqual(["stripe_checkout"]);
    expect(CUSTOMER_CREDIT_ACTIVITY_SOURCES).not.toContain("signup_seed");
    expect(CUSTOMER_CREDIT_ACTIVITY_SOURCES).not.toContain("subscription_renewal");
    expect(CUSTOMER_CREDIT_ACTIVITY_SOURCES).not.toContain("annual_contract_monthly_allocation");
  });

  it("formats account summary credits as current balance over plan allowance", () => {
    expect(
      formatAccountCreditsSummary({
        balanceCents: 850,
        balanceLoading: false,
        planCreditsCents: 350,
      })
    ).toBe("850 / 350");
    expect(
      formatAccountCreditsSummary({
        balanceCents: 12_500,
        balanceLoading: false,
        planCreditsCents: 7_500,
      })
    ).toBe("12,500 / 7,500");
  });

  it("marks account summary credits as surplus only above the plan allowance", () => {
    expect(
      resolveAccountCreditsSummary({
        balanceCents: 850,
        balanceLoading: false,
        planCreditsCents: 350,
      })
    ).toMatchObject({
      label: "850 / 350",
      state: "ready",
      currentLabel: "850",
      planLabel: "350",
      isSurplus: true,
    });
    expect(
      resolveAccountCreditsSummary({
        balanceCents: 350,
        balanceLoading: false,
        planCreditsCents: 350,
      }).isSurplus
    ).toBe(false);
    expect(
      resolveAccountCreditsSummary({
        balanceCents: 294,
        balanceLoading: false,
        planCreditsCents: 350,
      }).isSurplus
    ).toBe(false);
  });

  it("preserves account summary credit loading and unavailable states", () => {
    expect(
      formatAccountCreditsSummary({
        balanceCents: 850,
        balanceLoading: true,
        planCreditsCents: 350,
      })
    ).toBe("Syncing");
    expect(
      formatAccountCreditsSummary({
        balanceCents: null,
        balanceLoading: false,
        planCreditsCents: 350,
      })
    ).toBe("Unavailable");
  });

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

  it("does not preserve retired signup seed grants as a customer-facing credit label", () => {
    expect(
      resolveLedgerLabel({
        id: "ledger-signup-seed",
        change_cents: 100,
        reason: "Legacy signup seed grant",
        source: "signup_seed",
        source_ref: "user-1",
        metadata: null,
        created_at: "2026-05-15T20:48:26.000Z",
      })
    ).toBe("Billing activity");
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
    });
  });

  it("keeps section content titles compact without helper body copy", () => {
    expect(getProfileSectionContent("credits")).toEqual({
      title: "Credits",
    });
    expect(getProfileSectionContent("account")).toEqual({
      title: "Account settings",
    });
  });
});
