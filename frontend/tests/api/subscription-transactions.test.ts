import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/billing/stripe/subscription-transactions";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const stripeGetMock = vi.fn();
const maybeSingleQueue = vi.hoisted(() => [] as Array<{ data: unknown; error: unknown }>);

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
        if (table === "billing_storage_addon_offers" || table === "billing_storage_addons") {
          return Promise.resolve(maybeSingleQueue.shift() ?? { data: [], error: null });
        }
        return {
          eq: () => ({
            maybeSingle: async () => maybeSingleQueue.shift() ?? { data: null, error: null },
            is: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => maybeSingleQueue.shift() ?? { data: null, error: null },
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

describe("GET /api/billing/stripe/subscription-transactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingleQueue.length = 0;
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

  it("returns recent paid Stripe invoices for the mapped customer", async () => {
    maybeSingleQueue.push(
      { data: { stripe_customer_id: "cus_123" }, error: null },
      {
        data: { contract_source: "stripe", stripe_customer_id: "cus_123" },
        error: null,
      }
    );
    stripeGetMock.mockResolvedValue({
      data: [
        {
          id: "in_123",
          number: "9A12E1",
          status: "paid",
          currency: "usd",
          amount_paid: 3900,
          created: 1772323200,
          paid: true,
          billing_reason: "subscription_cycle",
          hosted_invoice_url: "https://stripe.test/invoices/in_123",
          status_transitions: { paid_at: 1772323200 },
        },
      ],
    });

    const req = { method: "GET", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(stripeGetMock).toHaveBeenCalledWith("/invoices", {
      customer: "cus_123",
      limit: 12,
      "expand[0]": "data.lines",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      transactions: [
        {
          id: "in_123",
          invoiceNumber: "9A12E1",
          amountPaidCents: 3900,
          currency: "usd",
          status: "paid",
          title: "Monthly subscription renewal",
          createdAt: "2026-03-01T00:00:00.000Z",
          paidAt: "2026-03-01T00:00:00.000Z",
          receiptUrl: "https://stripe.test/invoices/in_123",
          kind: "subscription",
          kindLabel: "Subscription",
          reference: "9A12E1",
        },
      ],
    });
  });

  it("returns an empty list for internal-comp accounts without hitting Stripe", async () => {
    maybeSingleQueue.push(
      { data: { stripe_customer_id: null }, error: null },
      {
        data: { contract_source: "internal_comp", stripe_customer_id: null },
        error: null,
      }
    );

    const req = { method: "GET", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(stripeGetMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ transactions: [] });
  });

  it("filters recent invoices down to storage add-on charges", async () => {
    maybeSingleQueue.push(
      { data: { stripe_customer_id: "cus_123" }, error: null },
      {
        data: { contract_source: "stripe", stripe_customer_id: "cus_123" },
        error: null,
      },
      {
        data: [{ storage_addon_id: "storage_100gb", stripe_price_id: "price_storage_100" }],
        error: null,
      },
      {
        data: [{ id: "storage_100gb", display_name: "Extra 100 GB" }],
        error: null,
      }
    );
    stripeGetMock.mockResolvedValue({
      data: [
        {
          id: "in_storage_1",
          number: "S100GB1",
          status: "paid",
          currency: "usd",
          amount_paid: 5400,
          created: 1772323200,
          paid: true,
          hosted_invoice_url: "https://stripe.test/invoices/in_storage_1",
          status_transitions: { paid_at: 1772323200 },
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
    });

    const req = { method: "GET", body: {}, query: { kind: "storage" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      transactions: [
        {
          id: "in_storage_1",
          invoiceNumber: "S100GB1",
          amountPaidCents: 1500,
          currency: "usd",
          status: "paid",
          title: "Extra 100 GB",
          createdAt: "2026-03-01T00:00:00.000Z",
          paidAt: "2026-03-01T00:00:00.000Z",
          receiptUrl: "https://stripe.test/invoices/in_storage_1",
          kind: "storage",
          kindLabel: "Storage",
          reference: "S100GB1",
        },
      ],
    });
  });
});
