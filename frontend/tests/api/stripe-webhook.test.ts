import { EventEmitter } from "events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/billing/stripe/webhook";

const logApiRouteExceptionMock = vi.fn();
const writeAppErrorLogMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const verifyStripeWebhookSignatureMock = vi.fn();
const insertCreditLedgerEntryMock = vi.fn();

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
  writeAppErrorLog: (...args: unknown[]) => writeAppErrorLogMock(...args),
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

const createSupabaseAdminForWebhook = (params?: {
  eventClaimError?: unknown;
  billingProfile?: Record<string, unknown> | null;
  billingPlan?: Record<string, unknown> | null;
  billingOffer?: Record<string, unknown> | null;
  billingContract?: Record<string, unknown> | null;
  billingStorageAddon?: Record<string, unknown> | null;
  billingStorageAddonOffer?: Record<string, unknown> | null;
  billingStorageAddonContracts?: Record<string, unknown>[];
  onBillingProfileUpdate?: (payload: unknown) => void;
  onContractInsert?: (payload: unknown) => void;
  onContractUpdate?: (payload: unknown) => void;
  onStorageAddonInsert?: (payload: unknown) => void;
  onStorageAddonUpdate?: (payload: unknown) => void;
}) => ({
  from: (table: string) => {
    if (table === "stripe_event_log") {
      return {
        insert: async () => ({ error: params?.eventClaimError ?? null }),
      };
    }

    if (table === "billing_profiles") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: params?.billingProfile ?? null,
              error: null,
            }),
          }),
        }),
        update: (payload: unknown) => ({
          eq: async () => {
            params?.onBillingProfileUpdate?.(payload);
            return { data: null, error: null };
          },
        }),
      };
    }

    if (table === "billing_plans") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: params?.billingPlan ?? null,
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === "billing_plan_offers") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: params?.billingOffer ?? null,
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === "billing_storage_addons") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: params?.billingStorageAddon ?? null,
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === "billing_storage_addon_offers") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: params?.billingStorageAddonOffer ?? null,
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === "billing_subscription_contracts") {
      return {
        select: () => ({
          eq: () => ({
            is: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({
                    data: params?.billingContract ?? null,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
        insert: async (payload: unknown) => {
          params?.onContractInsert?.(payload);
          return { data: null, error: null };
        },
        update: (payload: unknown) => ({
          eq: async () => {
            params?.onContractUpdate?.(payload);
            return { data: null, error: null };
          },
        }),
      };
    }

    if (table === "billing_subscription_storage_addons") {
      const storageAddonSelectChain = {} as {
        eq: ReturnType<typeof vi.fn>;
        is: ReturnType<typeof vi.fn>;
      };
      storageAddonSelectChain.eq = vi.fn(() => storageAddonSelectChain);
      storageAddonSelectChain.is = vi.fn(() => ({
        order: async () => ({
          data: params?.billingStorageAddonContracts ?? [],
          error: null,
        }),
      }));
      return {
        select: () => ({
          eq: vi.fn(() => storageAddonSelectChain),
        }),
        insert: async (payload: unknown) => {
          params?.onStorageAddonInsert?.(payload);
          return { data: null, error: null };
        },
        update: (payload: unknown) => ({
          eq: async () => {
            params?.onStorageAddonUpdate?.(payload);
            return { data: null, error: null };
          },
        }),
      };
    }

    throw new Error(`Unexpected table access: ${table}`);
  },
});

describe("POST /api/billing/stripe/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_key";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    insertCreditLedgerEntryMock.mockResolvedValue({ error: null });
    writeAppErrorLogMock.mockResolvedValue({ ok: true, skipped: false, id: null });
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

  it("returns 413 when webhook payload exceeds max size", async () => {
    const largePayload = "x".repeat(256 * 1024 + 1);
    const { res, promise } = createWebhookRequest(largePayload);
    await promise;
    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({ error: "Webhook payload too large." });
    expect(verifyStripeWebhookSignatureMock).not.toHaveBeenCalled();
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
            id: "cs_duplicate_evt_1",
            payment_status: "paid",
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
      error: "Webhook processing failed.",
    });
    expect(insertCreditLedgerEntryMock).not.toHaveBeenCalled();
  });

  it("applies checkout side effects once after successful event claim", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(createSupabaseAdminForWebhook());

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_checkout_1",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_1",
            customer: "cus_123",
            payment_status: "paid",
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
        sourceRef: "checkout_session:cs_test_1",
      })
    );
    expect(writeAppErrorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.billing.checkout_completed",
        userId: "user_123",
        metadata: expect.objectContaining({
          event_name: "checkout_completed",
          credit_package_id: "pkg_starter",
        }),
      })
    );
  });

  it("does not grant top-up credits on checkout completion when payment is still unpaid", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(createSupabaseAdminForWebhook());

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_checkout_unpaid",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_unpaid_1",
            payment_status: "unpaid",
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
    expect(insertCreditLedgerEntryMock).not.toHaveBeenCalled();
  });

  it("grants top-up credits when delayed checkout payment later succeeds", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(createSupabaseAdminForWebhook());

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_checkout_async_paid",
        type: "checkout.session.async_payment_succeeded",
        data: {
          object: {
            id: "cs_async_1",
            payment_status: "paid",
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
    expect(insertCreditLedgerEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_123",
        source: "stripe_checkout",
        sourceRef: "checkout_session:cs_async_1",
      })
    );
  });

  it("treats duplicate ledger source_ref writes as idempotent success", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(createSupabaseAdminForWebhook());
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
            id: "cs_test_duplicate",
            payment_status: "paid",
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

  it("grants monthly subscription credits only for subscription-cycle invoices", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminForWebhook({
        billingProfile: {
          user_id: "user_123",
          plan_id: "studio",
        },
        billingContract: {
          id: "contract_123",
          plan_id: "studio",
          offer_id: "studio__current",
          stripe_price_id: "price_studio",
          monthly_credits_cents: 3000,
        },
      })
    );

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_invoice_cycle_1",
        type: "invoice.payment_succeeded",
        data: {
          object: {
            id: "in_cycle_1",
            customer: "cus_123",
            billing_reason: "subscription_cycle",
          },
        },
      })
    );
    await promise;

    expect(res.status).toHaveBeenCalledWith(200);
    expect(insertCreditLedgerEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_123",
        changeCents: 3000,
        source: "subscription_renewal",
        sourceRef: "invoice:in_cycle_1:monthly_allocation",
        metadata: expect.objectContaining({
          billing_reason: "subscription_cycle",
          plan_id: "studio",
          offer_id: "studio__current",
          stripe_price_id: "price_studio",
        }),
      })
    );
  });

  it("does not grant monthly credits for non-allocation subscription invoices", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminForWebhook({
        billingProfile: {
          user_id: "user_123",
          plan_id: "studio",
        },
        billingPlan: {
          monthly_credits_cents: 3000,
        },
      })
    );

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_invoice_update_1",
        type: "invoice.payment_succeeded",
        data: {
          object: {
            id: "in_update_1",
            customer: "cus_123",
            billing_reason: "subscription_update",
          },
        },
      })
    );
    await promise;

    expect(res.status).toHaveBeenCalledWith(200);
    expect(insertCreditLedgerEntryMock).not.toHaveBeenCalled();
  });

  it("fails closed on monthly credit grants when a paid profile has no current contract", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminForWebhook({
        billingProfile: {
          user_id: "user_123",
          plan_id: "studio",
        },
        billingContract: null,
      })
    );

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_invoice_cycle_missing_contract",
        type: "invoice.payment_succeeded",
        data: {
          object: {
            id: "in_cycle_missing_contract",
            customer: "cus_123",
            billing_reason: "subscription_cycle",
          },
        },
      })
    );
    await promise;

    expect(res.status).toHaveBeenCalledWith(200);
    expect(insertCreditLedgerEntryMock).not.toHaveBeenCalled();
  });

  it("syncs a subscription contract snapshot when Stripe subscription state changes", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    const contractInsertSpy = vi.fn();
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminForWebhook({
        billingProfile: {
          user_id: "user_123",
          plan_id: "studio",
        },
        billingOffer: {
          id: "studio__current",
          plan_id: "studio",
          stripe_price_id: "price_studio",
          recurring_price_cents: 3900,
          monthly_credits_cents: 3000,
          storage_limit_bytes: 107374182400,
        },
        billingContract: null,
        onContractInsert: contractInsertSpy,
      })
    );

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_sub_updated_1",
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_123",
            customer: "cus_123",
            status: "active",
            current_period_start: 1704067200,
            current_period_end: 1706745600,
            cancel_at_period_end: false,
            items: {
              data: [
                {
                  price: {
                    id: "price_studio",
                    unit_amount: 3900,
                    metadata: {
                      monthly_credits_cents: "3000",
                    },
                  },
                },
              ],
            },
          },
        },
      })
    );
    await promise;

    expect(res.status).toHaveBeenCalledWith(200);
    expect(contractInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user_123",
        plan_id: "studio",
        offer_id: "studio__current",
        stripe_subscription_id: "sub_123",
        stripe_price_id: "price_studio",
        recurring_price_cents: 3900,
        monthly_credits_cents: 3000,
        storage_limit_bytes: 107374182400,
        status: "active",
      })
    );
  });

  it("syncs a newly created non-canonical plan from billing_plan_offers", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    const billingProfileUpdateSpy = vi.fn();
    const contractInsertSpy = vi.fn();
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminForWebhook({
        billingProfile: {
          user_id: "user_123",
          plan_id: "studio",
        },
        billingOffer: {
          id: "creator_plus__current",
          plan_id: "creator_plus",
          stripe_price_id: "price_creator_plus",
          recurring_price_cents: 5900,
          monthly_credits_cents: 4500,
          storage_limit_bytes: 214748364800,
        },
        billingContract: null,
        onBillingProfileUpdate: billingProfileUpdateSpy,
        onContractInsert: contractInsertSpy,
      })
    );

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_sub_updated_creator_plus",
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_creator_plus",
            customer: "cus_123",
            status: "active",
            current_period_start: 1704067200,
            current_period_end: 1706745600,
            cancel_at_period_end: false,
            items: {
              data: [
                {
                  price: {
                    id: "price_creator_plus",
                    unit_amount: 5900,
                    metadata: {
                      monthly_credits_cents: "4500",
                    },
                  },
                },
              ],
            },
          },
        },
      })
    );
    await promise;

    expect(res.status).toHaveBeenCalledWith(200);
    expect(billingProfileUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_id: "creator_plus",
        subscription_status: "active",
        stripe_subscription_id: "sub_creator_plus",
      })
    );
    expect(contractInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user_123",
        plan_id: "creator_plus",
        offer_id: "creator_plus__current",
        stripe_subscription_id: "sub_creator_plus",
        stripe_price_id: "price_creator_plus",
        recurring_price_cents: 5900,
        monthly_credits_cents: 4500,
        storage_limit_bytes: 214748364800,
        status: "active",
      })
    );
  });

  it("drops the billing profile back to free on immediate subscription cancellation", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    const billingProfileUpdateSpy = vi.fn();
    const contractUpdateSpy = vi.fn();
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminForWebhook({
        billingProfile: {
          user_id: "user_123",
          plan_id: "business",
        },
        billingOffer: {
          id: "business__current",
          plan_id: "business",
          stripe_price_id: "price_business",
          recurring_price_cents: 12900,
          monthly_credits_cents: 12000,
          storage_limit_bytes: 536870912000,
        },
        billingContract: {
          id: "contract_business_1",
          plan_id: "business",
          offer_id: "business__current",
          stripe_subscription_id: "sub_123",
          stripe_price_id: "price_business",
          recurring_price_cents: 12900,
          monthly_credits_cents: 12000,
          storage_limit_bytes: 536870912000,
        },
        onBillingProfileUpdate: billingProfileUpdateSpy,
        onContractUpdate: contractUpdateSpy,
      })
    );

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_sub_deleted_1",
        type: "customer.subscription.deleted",
        data: {
          object: {
            id: "sub_123",
            customer: "cus_123",
            status: "canceled",
            current_period_start: 1704067200,
            current_period_end: 1706745600,
            cancel_at_period_end: false,
            items: {
              data: [
                {
                  price: {
                    id: "price_business",
                    unit_amount: 12900,
                    metadata: {
                      monthly_credits_cents: "12000",
                    },
                  },
                },
              ],
            },
          },
        },
      })
    );
    await promise;

    expect(res.status).toHaveBeenCalledWith(200);
    expect(billingProfileUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_id: "free",
        subscription_status: "canceled",
        stripe_subscription_id: null,
        current_period_end: null,
      })
    );
    expect(contractUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        ended_at: "2024-01-01T00:00:00.000Z",
      })
    );
  });

  it("syncs recurring storage add-on contracts from subscription items", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    const storageAddonInsertSpy = vi.fn();
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminForWebhook({
        billingProfile: {
          user_id: "user_123",
          plan_id: "studio",
        },
        billingOffer: {
          id: "studio__current",
          plan_id: "studio",
          stripe_price_id: "price_studio",
          recurring_price_cents: 3900,
          monthly_credits_cents: 3000,
          storage_limit_bytes: 107374182400,
        },
        billingStorageAddonOffer: {
          id: "storage_100gb__current",
          storage_addon_id: "storage_100gb",
          stripe_price_id: "price_storage_100gb",
          storage_limit_bytes: 107374182400,
          recurring_price_cents: 1500,
        },
        billingContract: null,
        billingStorageAddonContracts: [],
        onContractInsert: vi.fn(),
        onStorageAddonInsert: storageAddonInsertSpy,
      })
    );

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_sub_addon_1",
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_123",
            customer: "cus_123",
            status: "active",
            current_period_start: 1704067200,
            current_period_end: 1706745600,
            cancel_at_period_end: false,
            items: {
              data: [
                {
                  id: "si_plan_1",
                  quantity: 1,
                  price: {
                    id: "price_studio",
                    unit_amount: 3900,
                    metadata: {
                      monthly_credits_cents: "3000",
                    },
                  },
                },
                {
                  id: "si_storage_1",
                  quantity: 2,
                  price: {
                    id: "price_storage_100gb",
                    unit_amount: 1500,
                  },
                },
              ],
            },
          },
        },
      })
    );
    await promise;

    expect(res.status).toHaveBeenCalledWith(200);
    expect(storageAddonInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user_123",
        storage_addon_id: "storage_100gb",
        offer_id: "storage_100gb__current",
        stripe_subscription_item_id: "si_storage_1",
        stripe_price_id: "price_storage_100gb",
        storage_limit_bytes: 107374182400,
        quantity: 2,
        recurring_price_cents: 3000,
        status: "active",
      })
    );
  });
});
