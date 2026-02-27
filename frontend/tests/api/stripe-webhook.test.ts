import { EventEmitter } from "events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/billing/stripe/webhook";

const logApiRouteExceptionMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const verifyStripeWebhookSignatureMock = vi.fn();
const insertCreditLedgerEntryMock = vi.fn();

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/stripe", () => ({
  verifyStripeWebhookSignature: (...args: unknown[]) => verifyStripeWebhookSignatureMock(...args),
}));

vi.mock("../../lib/server/api/creditLedger", () => ({
  insertCreditLedgerEntry: (...args: unknown[]) => insertCreditLedgerEntryMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const createWebhookRequest = (rawBody: string) => {
  const req = new EventEmitter() as unknown as {
    method: string;
    headers: Record<string, string>;
    on: (event: string, listener: (...args: unknown[]) => void) => EventEmitter;
    emit: (event: string, ...args: unknown[]) => boolean;
  };
  (req as { method: string }).method = "POST";
  (req as { headers: Record<string, string> }).headers = { "stripe-signature": "t=1,v1=abc" };
  const res = createMockResponse();
  const promise = handler(req as never, res as never);
  req.emit("data", rawBody);
  req.emit("end");
  return { res, promise };
};

const createSupabaseAdminForEventClaim = (insertResult: { error: unknown }) => ({
  from: (table: string) => {
    if (table !== "stripe_event_log") {
      throw new Error(`Unexpected table access: ${table}`);
    }
    return {
      insert: async () => insertResult,
    };
  },
});

describe("POST /api/billing/stripe/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_key";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    insertCreditLedgerEntryMock.mockResolvedValue({ error: null });
  });

  it("rejects invalid signatures", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(false);
    const { res, promise } = createWebhookRequest(
      JSON.stringify({ id: "evt_1", type: "checkout.session.completed" })
    );
    await promise;
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid Stripe signature." });
  });

  it("returns duplicate=true when event claim conflicts and safely reprocesses", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminForEventClaim({
        error: { code: "23505", message: "duplicate key value violates unique constraint" },
      })
    );

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_1",
        type: "checkout.session.completed",
        data: {
          object: {
            metadata: {
              user_id: "user_123",
              credit_amount_cents: "1500",
            },
          },
        },
      })
    );
    await promise;
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true, duplicate: true });
    expect(insertCreditLedgerEntryMock).toHaveBeenCalledTimes(1);
  });

  it("returns 500 and skips side effects when event claim fails", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminForEventClaim({
        error: { code: "42501", message: "permission denied for table stripe_event_log" },
      })
    );

    const { res, promise } = createWebhookRequest(
      JSON.stringify({ id: "evt_claim_fail", type: "checkout.session.completed" })
    );
    await promise;

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "permission denied for table stripe_event_log",
    });
    expect(insertCreditLedgerEntryMock).not.toHaveBeenCalled();
  });

  it("applies checkout side effects once after successful event claim", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(createSupabaseAdminForEventClaim({ error: null }));

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_checkout_1",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_1",
            customer: "cus_123",
            metadata: {
              user_id: "user_123",
              credit_amount_cents: "1500",
              credit_package_id: "pkg_starter",
            },
          },
        },
      })
    );
    await promise;

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true });
    expect(insertCreditLedgerEntryMock).toHaveBeenCalledTimes(1);
    expect(insertCreditLedgerEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_123",
        changeCents: 1500,
        source: "stripe_checkout",
        sourceRef: "evt_checkout_1",
      })
    );
  });

  it("treats duplicate ledger source_ref writes as idempotent success", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(createSupabaseAdminForEventClaim({ error: null }));
    insertCreditLedgerEntryMock.mockResolvedValueOnce({
      error: {
        code: "23505",
        message: "duplicate key value violates unique constraint ux_ai_credit_ledger_source_ref",
      },
    });

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_checkout_duplicate_ledger",
        type: "checkout.session.completed",
        data: {
          object: {
            metadata: {
              user_id: "user_123",
              credit_amount_cents: "1500",
            },
          },
        },
      })
    );
    await promise;

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });
});
