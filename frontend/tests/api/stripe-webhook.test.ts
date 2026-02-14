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

describe("POST /api/billing/stripe/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_key";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
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

  it("returns duplicate=true when event already processed", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue({
      from: (table: string) => {
        if (table !== "stripe_event_log") throw new Error("Unexpected table");
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: "evt_1" }, error: null }),
            }),
          }),
          insert: vi.fn(),
        };
      },
    });

    const { res, promise } = createWebhookRequest(
      JSON.stringify({ id: "evt_1", type: "checkout.session.completed" })
    );
    await promise;
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true, duplicate: true });
  });
});
