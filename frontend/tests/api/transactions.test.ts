import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/billing/stripe/transactions";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const stripeGetMock = vi.fn();

const billingStateQueue = vi.hoisted(() => [] as Array<{ data: unknown; error: unknown }>);
const storageOfferRows = vi.hoisted(() => [] as Array<Record<string, unknown>>);
const storageAddonRows = vi.hoisted(() => [] as Array<Record<string, unknown>>);
const creditLedgerRows = vi.hoisted(() => [] as Array<Record<string, unknown>>);
const creditPackageRows = vi.hoisted(() => [] as Array<Record<string, unknown>>);

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/stripe", () => ({
  stripeGet: (...args: unknown[]) => stripeGetMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => ({
      select: () => {
        if (table === "billing_storage_addon_offers") {
          return Promise.resolve({ data: storageOfferRows, error: null });
        }
        if (table === "billing_storage_addons") {
          return Promise.resolve({ data: storageAddonRows, error: null });
        }
        if (table === "ai_credit_ledger") {
          return {
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: async () => ({ data: creditLedgerRows, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "billing_credit_packages") {
          return {
            in: async () => ({
              data: creditPackageRows,
              error: null,
            }),
          };
        }
        return {
          eq: () => ({
            maybeSingle: async () => billingStateQueue.shift() ?? { data: null, error: null },
            is: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => billingStateQueue.shift() ?? { data: null, error: null },
                }),
              }),
            }),
          }),
        };
      },
    }),
  }),
}));

const createMockResponse = () => ({
  setHeader: vi.fn(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("GET /api/billing/stripe/transactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    billingStateQueue.length = 0;
    storageOfferRows.length = 0;
    storageAddonRows.length = 0;
    creditLedgerRows.length = 0;
    creditPackageRows.length = 0;
    process.env.STRIPE_SECRET_KEY = "sk_test_key";
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
  });

  it("rejects non-GET methods", async () => {
    const req = { method: "POST", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Allow", "GET");
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("returns a safe transaction-history failure when auth verification throws unexpectedly", async () => {
    requireApiUserMock.mockRejectedValueOnce(new Error("auth verifier exploded"));
    const req = { method: "GET", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(stripeGetMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: expect.any(Error),
      routeLabel: "billing/stripe/transactions.auth",
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to load recent transactions.",
    });
  });

  it("returns a combined billing feed across invoices and credit purchases", async () => {
    billingStateQueue.push(
      { data: { stripe_customer_id: "cus_123" }, error: null },
      { data: { contract_source: "stripe", stripe_customer_id: "cus_123" }, error: null }
    );
    storageOfferRows.push({ storage_addon_id: "addon_100", stripe_price_id: "price_storage_100" });
    storageAddonRows.push({ id: "addon_100", display_name: "Extra 100 GB" });
    creditLedgerRows.push({
      id: "ledger_1",
      source_ref: "checkout_grant:cs_test_123",
      metadata: {
        checkout_session_id: "cs_test_123",
        credit_package_id: "pkg_growth",
      },
      created_at: "2026-04-03T15:00:00.000Z",
    });
    creditPackageRows.push({
      id: "pkg_growth",
      display_name: "Growth 2,000",
      price_cents: 2600,
    });
    stripeGetMock.mockImplementation(async (path: string) => {
      if (path === "/customers/cus_123") {
        return {
          id: "cus_123",
          email: "user@example.com",
          metadata: { user_id: "user-1" },
        };
      }
      if (path === "/invoices") {
        return {
          data: [
            {
              id: "in_123",
              number: "INV-100",
              status: "paid",
              currency: "usd",
              amount_paid: 5400,
              created: 1772582400,
              paid: true,
              hosted_invoice_url: "https://stripe.test/invoices/in_123",
              status_transitions: { paid_at: 1772582400 },
              lines: {
                data: [
                  {
                    id: "il_plan",
                    amount: 3900,
                    pricing: { price_details: { price: "price_business" } },
                  },
                  {
                    id: "il_storage",
                    amount: 1500,
                    pricing: { price_details: { price: "price_storage_100" } },
                  },
                ],
              },
            },
          ],
        };
      }

      if (path === "/checkout/sessions/cs_test_123") {
        return {
          id: "cs_test_123",
          amount_total: 2600,
          currency: "usd",
          payment_status: "paid",
        };
      }

      throw new Error(`Unexpected Stripe path ${path}`);
    });

    const req = { method: "GET", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(stripeGetMock).toHaveBeenCalledWith("/invoices", {
      customer: "cus_123",
      limit: 12,
      "expand[0]": "data.lines",
    });
    expect(stripeGetMock).toHaveBeenCalledWith("/checkout/sessions/cs_test_123");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      transactions: [
        {
          id: "ledger_1",
          invoiceNumber: null,
          amountPaidCents: 2600,
          currency: "usd",
          status: "paid",
          title: "Credit top-up · Growth 2,000",
          createdAt: "2026-04-03T15:00:00.000Z",
          paidAt: "2026-04-03T15:00:00.000Z",
          receiptUrl: null,
          kind: "credit_purchase",
          kindLabel: "Credit top-up",
          reference: "cs_test_123",
        },
        {
          id: "in_123",
          invoiceNumber: "INV-100",
          amountPaidCents: 5400,
          currency: "usd",
          status: "paid",
          title: "Subscription + storage",
          createdAt: "2026-03-04T00:00:00.000Z",
          paidAt: "2026-03-04T00:00:00.000Z",
          receiptUrl: "https://stripe.test/invoices/in_123",
          kind: "mixed",
          kindLabel: "Combined invoice",
          reference: "INV-100",
        },
      ],
    });
  });

  it("returns credit purchases even when the current plan is managed internally", async () => {
    billingStateQueue.push(
      { data: { stripe_customer_id: null }, error: null },
      { data: { contract_source: "internal_comp", stripe_customer_id: null }, error: null }
    );
    creditLedgerRows.push({
      id: "ledger_2",
      source_ref: "checkout_grant:cs_test_456",
      metadata: {
        checkout_session_id: "cs_test_456",
        credit_package_id: "pkg_starter",
      },
      created_at: "2026-04-02T10:00:00.000Z",
    });
    creditPackageRows.push({
      id: "pkg_starter",
      display_name: "Starter 500",
      price_cents: 700,
    });

    const req = { method: "GET", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(stripeGetMock).toHaveBeenCalledWith("/checkout/sessions/cs_test_456");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      transactions: [
        {
          id: "ledger_2",
          invoiceNumber: null,
          amountPaidCents: 700,
          currency: "usd",
          status: "paid",
          title: "Credit top-up · Starter 500",
          createdAt: "2026-04-02T10:00:00.000Z",
          paidAt: "2026-04-02T10:00:00.000Z",
          receiptUrl: null,
          kind: "credit_purchase",
          kindLabel: "Credit top-up",
          reference: "cs_test_456",
        },
      ],
    });
  });

  it("uses historical ledger snapshots when Stripe session lookup and current catalog differ", async () => {
    billingStateQueue.push(
      { data: { stripe_customer_id: "cus_789" }, error: null },
      { data: { contract_source: "stripe", stripe_customer_id: "cus_789" }, error: null }
    );
    creditLedgerRows.push({
      id: "ledger_3",
      source_ref: "checkout_grant:cs_archived_1",
      metadata: {
        checkout_session_id: "cs_archived_1",
        credit_package_id: "pkg_growth",
        credit_package_display_name: "Growth 2,000",
        credit_package_price_cents: 2600,
      },
      created_at: "2026-04-01T10:00:00.000Z",
    });
    creditPackageRows.push({
      id: "pkg_growth",
      display_name: "Growth 2,500",
      price_cents: 3200,
    });
    stripeGetMock.mockImplementation(async (path: string) => {
      if (path === "/customers/cus_789") {
        return {
          id: "cus_789",
          email: "user@example.com",
          metadata: { user_id: "user-1" },
        };
      }
      if (path === "/invoices") {
        return { data: [] };
      }
      if (path === "/checkout/sessions/cs_archived_1") {
        throw new Error("not found");
      }
      throw new Error(`Unexpected Stripe path ${path}`);
    });

    const req = { method: "GET", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      transactions: [
        {
          id: "ledger_3",
          invoiceNumber: null,
          amountPaidCents: 2600,
          currency: "usd",
          status: "paid",
          title: "Credit top-up · Growth 2,000",
          createdAt: "2026-04-01T10:00:00.000Z",
          paidAt: "2026-04-01T10:00:00.000Z",
          receiptUrl: null,
          kind: "credit_purchase",
          kindLabel: "Credit top-up",
          reference: "cs_archived_1",
        },
      ],
    });
  });

  it("fails closed when the mapped Stripe customer belongs to a different user", async () => {
    billingStateQueue.push(
      { data: { stripe_customer_id: "cus_foreign" }, error: null },
      { data: { contract_source: "stripe", stripe_customer_id: "cus_foreign" }, error: null }
    );
    stripeGetMock.mockImplementation(async (path: string) => {
      if (path === "/customers/cus_foreign") {
        return {
          id: "cus_foreign",
          email: "other@example.com",
          metadata: { user_id: "user-other" },
        };
      }
      throw new Error(`Unexpected Stripe path ${path}`);
    });

    const req = { method: "GET", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to load recent transactions.",
    });
  });
});
