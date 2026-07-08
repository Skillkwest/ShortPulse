import { EventEmitter } from "events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/billing/stripe/webhook";

const logApiRouteExceptionMock = vi.fn();
const writeAppErrorLogMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const verifyStripeWebhookSignatureMock = vi.fn();
const grantAccountCreditsMock = vi.fn();
const readVerifiedStripeCustomerForUserMock = vi.fn();

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
  grantAccountCredits: (...args: unknown[]) => grantAccountCreditsMock(...args),
}));

vi.mock("../../lib/server/api/stripeCustomer", () => ({
  readVerifiedStripeCustomerForUser: (...args: unknown[]) =>
    readVerifiedStripeCustomerForUserMock(...args),
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
  eventClaimDeleteError?: unknown;
  eventClaimDeleteThrows?: Error;
  billingProfile?: Record<string, unknown> | null;
  billingPlan?: Record<string, unknown> | null;
  billingPlans?: Record<string, unknown>[];
  billingOffer?: Record<string, unknown> | null;
  billingOffers?: Record<string, unknown>[];
  billingContract?: Record<string, unknown> | null;
  billingStorageAddon?: Record<string, unknown> | null;
  billingStorageAddonOffer?: Record<string, unknown> | null;
  billingStorageAddonContracts?: Record<string, unknown>[];
  billingSubscriptionChangeIntent?: Record<string, unknown> | null;
  onEventClaimDelete?: (eventId: string) => void;
  onBillingProfileUpdate?: (payload: unknown) => void;
  onContractInsert?: (payload: unknown) => void;
  onContractUpdate?: (payload: unknown) => void;
  onStorageAddonInsert?: (payload: unknown) => void;
  onStorageAddonUpdate?: (payload: unknown) => void;
  onSubscriptionChangeIntentUpdate?: (payload: unknown) => void;
  onScheduledChangeUpsert?: (payload: unknown) => void;
  onScheduledChangeUpdate?: (payload: unknown) => void;
}) => ({
  from: (table: string) => {
    if (table === "stripe_event_log") {
      return {
        insert: async () => ({ error: params?.eventClaimError ?? null }),
        delete: () => ({
          eq: async (_column: string, eventId: string) => {
            params?.onEventClaimDelete?.(eventId);
            if (params?.eventClaimDeleteThrows) {
              throw params.eventClaimDeleteThrows;
            }
            return { error: params?.eventClaimDeleteError ?? null };
          },
        }),
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
      const rows = params?.billingPlans ?? (params?.billingPlan ? [params.billingPlan] : []);
      return {
        select: () => ({
          eq: (column: string, value: unknown) => ({
            maybeSingle: async () => ({
              data: rows.find((row) => row[column] === value) ?? null,
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === "billing_subscription_scheduled_changes") {
      const updateChain: { eq: ReturnType<typeof vi.fn> } = {
        eq: vi.fn(),
      };
      updateChain.eq.mockReturnValue(updateChain);
      return {
        upsert: async (payload: unknown) => {
          params?.onScheduledChangeUpsert?.(payload);
          return { data: null, error: null };
        },
        update: (payload: unknown) => {
          params?.onScheduledChangeUpdate?.(payload);
          return updateChain;
        },
      };
    }

    if (table === "billing_plan_offers") {
      return {
        select: () => ({
          eq: (column: string, value: unknown) => ({
            maybeSingle: async () => {
              const offers =
                params?.billingOffers ?? (params?.billingOffer ? [params.billingOffer] : []);
              const data =
                offers.find((offer) => offer[column] === value) ?? params?.billingOffer ?? null;
              return {
                data,
                error: null,
              };
            },
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

    if (table === "billing_subscription_change_intents") {
      const selectChain = {} as {
        eq: ReturnType<typeof vi.fn>;
        in: ReturnType<typeof vi.fn>;
        gt: ReturnType<typeof vi.fn>;
        order: ReturnType<typeof vi.fn>;
        limit: ReturnType<typeof vi.fn>;
        maybeSingle: ReturnType<typeof vi.fn>;
      };
      selectChain.eq = vi.fn(() => selectChain);
      selectChain.in = vi.fn(() => selectChain);
      selectChain.gt = vi.fn(() => selectChain);
      selectChain.order = vi.fn(() => selectChain);
      selectChain.limit = vi.fn(() => selectChain);
      selectChain.maybeSingle = vi.fn(async () => ({
        data: params?.billingSubscriptionChangeIntent ?? null,
        error: null,
      }));
      return {
        select: () => selectChain,
        update: (payload: unknown) => ({
          eq: async () => {
            params?.onSubscriptionChangeIntentUpdate?.(payload);
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
    vi.useRealTimers();
    process.env.STRIPE_SECRET_KEY = "sk_test_key";
    process.env.STRIPE_WEBHOOK_SECRET = "stripe_webhook_test_secret";
    grantAccountCreditsMock.mockResolvedValue({ error: null });
    writeAppErrorLogMock.mockResolvedValue({ ok: true, skipped: false, id: null });
    readVerifiedStripeCustomerForUserMock.mockResolvedValue({
      id: "cus_verified",
      metadata: { user_id: "user_123" },
    });
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

  it("returns duplicate=true when event claim conflicts and skips side effects", async () => {
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
            customer: "cus_123",
            payment_status: "paid",
            metadata: {
              user_id: "user_123",
              credit_amount_cents: "1500",
              credit_package_id: "pkg_starter",
              credit_package_display_name: "100 credits",
              credit_package_price_cents: "500",
            },
          },
        },
      })
    );
    await promise;
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true, duplicate: true });
    expect(readVerifiedStripeCustomerForUserMock).not.toHaveBeenCalled();
    expect(grantAccountCreditsMock).not.toHaveBeenCalled();
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
    expect(grantAccountCreditsMock).not.toHaveBeenCalled();
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
              credit_package_display_name: "100 credits",
              credit_package_price_cents: "500",
            },
          },
        },
      })
    );
    await promise;

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true });
    expect(readVerifiedStripeCustomerForUserMock).toHaveBeenCalledWith({
      userId: "user_123",
      stripeCustomerId: "cus_123",
    });
    expect(grantAccountCreditsMock).toHaveBeenCalledTimes(1);
    expect(grantAccountCreditsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_123",
        amountCents: 1500,
        source: "stripe_checkout",
        sourceRef: "checkout_session:cs_test_1",
        creditKind: "paid_topup",
        expiresAt: null,
        metadata: expect.objectContaining({
          credit_package_display_name: "100 credits",
          credit_package_price_cents: 500,
        }),
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
              credit_package_id: "pkg_starter",
              credit_package_display_name: "100 credits",
              credit_package_price_cents: "500",
            },
          },
        },
      })
    );
    await promise;

    expect(res.status).toHaveBeenCalledWith(200);
    expect(grantAccountCreditsMock).not.toHaveBeenCalled();
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
            customer: "cus_123",
            payment_status: "paid",
            metadata: {
              user_id: "user_123",
              credit_amount_cents: "1500",
              credit_package_id: "pkg_starter",
              credit_package_display_name: "100 credits",
              credit_package_price_cents: "500",
            },
          },
        },
      })
    );
    await promise;

    expect(res.status).toHaveBeenCalledWith(200);
    expect(readVerifiedStripeCustomerForUserMock).toHaveBeenCalledWith({
      userId: "user_123",
      stripeCustomerId: "cus_123",
    });
    expect(grantAccountCreditsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_123",
        source: "stripe_checkout",
        sourceRef: "checkout_session:cs_async_1",
        creditKind: "paid_topup",
        expiresAt: null,
        metadata: expect.objectContaining({
          credit_package_display_name: "100 credits",
          credit_package_price_cents: 500,
        }),
      })
    );
  });

  it("logs async checkout payment failures without granting top-up credits", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminForWebhook({
        billingProfile: { user_id: "user_123", plan_id: "media" },
      })
    );

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_checkout_async_failed",
        type: "checkout.session.async_payment_failed",
        data: {
          object: {
            id: "cs_async_failed_1",
            customer: "cus_123",
            payment_status: "unpaid",
            metadata: {
              credit_package_id: "pkg_starter",
            },
          },
        },
      })
    );
    await promise;

    expect(res.status).toHaveBeenCalledWith(200);
    expect(grantAccountCreditsMock).not.toHaveBeenCalled();
    expect(writeAppErrorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.billing.checkout_async_payment_failed",
        userId: "user_123",
        metadata: expect.objectContaining({
          event_name: "checkout_async_payment_failed",
          checkout_session_id: "cs_async_failed_1",
          credit_package_id: "pkg_starter",
        }),
      })
    );
  });

  it("logs failed subscription invoice payments without granting monthly credits", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminForWebhook({
        billingProfile: { user_id: "user_123", plan_id: "media" },
      })
    );

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_invoice_failed",
        type: "invoice.payment_failed",
        data: {
          object: {
            id: "in_failed_1",
            customer: "cus_123",
            subscription: "sub_123",
            billing_reason: "subscription_cycle",
            status: "open",
            amount_due: 4900,
            attempt_count: 2,
          },
        },
      })
    );
    await promise;

    expect(res.status).toHaveBeenCalledWith(200);
    expect(grantAccountCreditsMock).not.toHaveBeenCalled();
    expect(writeAppErrorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.billing.invoice_payment_failed",
        userId: "user_123",
        metadata: expect.objectContaining({
          event_name: "invoice_payment_failed",
          invoice_id: "in_failed_1",
          stripe_subscription_id: "sub_123",
          amount_due_cents: 4900,
          attempt_count: 2,
        }),
      })
    );
  });

  it("logs subscription invoices that require payment action without granting monthly credits", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminForWebhook({
        billingProfile: { user_id: "user_123", plan_id: "media" },
      })
    );

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_invoice_action_required",
        type: "invoice.payment_action_required",
        data: {
          object: {
            id: "in_action_1",
            customer: "cus_123",
            subscription: "sub_123",
            billing_reason: "subscription_cycle",
            status: "open",
            hosted_invoice_url: "https://invoice.stripe.test/in_action_1",
          },
        },
      })
    );
    await promise;

    expect(res.status).toHaveBeenCalledWith(200);
    expect(grantAccountCreditsMock).not.toHaveBeenCalled();
    expect(writeAppErrorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.billing.invoice_payment_action_required",
        userId: "user_123",
        metadata: expect.objectContaining({
          event_name: "invoice_payment_action_required",
          invoice_id: "in_action_1",
          hosted_invoice_url: "https://invoice.stripe.test/in_action_1",
        }),
      })
    );
  });

  it("treats duplicate ledger source_ref writes as idempotent success", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(createSupabaseAdminForWebhook());
    grantAccountCreditsMock.mockResolvedValueOnce({
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
            customer: "cus_123",
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

  it("releases the event claim for Stripe retry when checkout credit processing fails", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    const releasedEventIds: string[] = [];
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminForWebhook({
        onEventClaimDelete: (eventId) => releasedEventIds.push(eventId),
      })
    );
    grantAccountCreditsMock.mockResolvedValueOnce({
      error: {
        code: "57014",
        message: "statement timeout",
      },
    });

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_checkout_credit_processing_failed",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_processing_failed",
            customer: "cus_123",
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

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Webhook processing failed." });
    expect(releasedEventIds).toEqual(["evt_checkout_credit_processing_failed"]);
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "billing/stripe/webhook",
        metadata: expect.objectContaining({
          stripe_event_id: "evt_checkout_credit_processing_failed",
          stripe_event_type: "checkout.session.completed",
          claim_released_for_retry: true,
          claim_release_error: null,
        }),
      })
    );
  });

  it("logs claim release exceptions when retry cleanup cannot delete the Stripe event claim", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminForWebhook({
        eventClaimDeleteThrows: new Error("network dropped during claim release"),
      })
    );
    grantAccountCreditsMock.mockResolvedValueOnce({
      error: {
        code: "57014",
        message: "statement timeout",
      },
    });

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_checkout_claim_release_throw",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_claim_release_throw",
            customer: "cus_123",
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

    expect(res.status).toHaveBeenCalledWith(500);
    expect(writeAppErrorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "api.exception",
        severity: "high",
        route: "billing/stripe/webhook",
        message: "network dropped during claim release",
        metadata: expect.objectContaining({
          route_label: "billing/stripe/webhook",
          stripe_event_id: "evt_checkout_claim_release_throw",
          stripe_event_type: "checkout.session.completed",
          claim_release_failed: true,
          exception_name: "Error",
        }),
      })
    );
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "billing/stripe/webhook",
        metadata: expect.objectContaining({
          claim_release_error: "network dropped during claim release",
        }),
      })
    );
  });

  it("fails closed on checkout credit grants when the Stripe customer does not belong to the session user", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(createSupabaseAdminForWebhook());
    readVerifiedStripeCustomerForUserMock.mockRejectedValueOnce(
      new Error("Stripe customer ownership mismatch detected.")
    );

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_checkout_foreign_customer",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_foreign_1",
            customer: "cus_foreign",
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

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Webhook processing failed." });
    expect(grantAccountCreditsMock).not.toHaveBeenCalled();
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
    expect(readVerifiedStripeCustomerForUserMock).toHaveBeenCalledWith({
      userId: "user_123",
      stripeCustomerId: "cus_123",
    });
    expect(grantAccountCreditsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_123",
        amountCents: 3000,
        source: "subscription_renewal",
        sourceRef: "invoice:in_cycle_1:monthly_allocation",
        creditKind: "subscription_allocation",
        expiresAt: expect.any(String),
        metadata: expect.objectContaining({
          billing_reason: "subscription_cycle",
          plan_id: "studio",
          offer_id: "studio__current",
          stripe_price_id: "price_studio",
        }),
      })
    );
  });

  it("logs subscription invoice credit context when recurring grant processing fails", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    const releasedEventIds: string[] = [];
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
        onEventClaimDelete: (eventId) => releasedEventIds.push(eventId),
      })
    );
    grantAccountCreditsMock.mockResolvedValueOnce({
      error: {
        code: "42702",
        message: "column reference ledger_id is ambiguous",
      },
    });

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_invoice_credit_grant_failed",
        type: "invoice.payment_succeeded",
        data: {
          object: {
            id: "in_credit_grant_failed",
            customer: "cus_123",
            billing_reason: "subscription_create",
          },
        },
      })
    );
    await promise;

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Webhook processing failed." });
    expect(releasedEventIds).toEqual(["evt_invoice_credit_grant_failed"]);
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "billing/stripe/webhook",
        metadata: expect.objectContaining({
          stripe_event_id: "evt_invoice_credit_grant_failed",
          stripe_event_type: "invoice.payment_succeeded",
          claim_released_for_retry: true,
          invoice_id: "in_credit_grant_failed",
          subscription_grant_source_ref: "invoice:in_credit_grant_failed:monthly_allocation",
          billing_reason: "subscription_create",
          stripe_customer_id: "cus_123",
          user_id: "user_123",
          contract_id: "contract_123",
          plan_id: "studio",
          offer_id: "studio__current",
          stripe_price_id: "price_studio",
          monthly_credits_cents: 3000,
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
    expect(grantAccountCreditsMock).not.toHaveBeenCalled();
  });

  it("grants target plan credits for paid immediate subscription update invoices with old-plan proration first", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminForWebhook({
        billingProfile: {
          user_id: "user_123",
          plan_id: "media",
        },
        billingOffers: [
          {
            id: "media__current",
            plan_id: "media",
            billing_interval: "month",
            stripe_price_id: "price_media",
            recurring_price_cents: 4900,
            monthly_credits_cents: 3000,
            storage_limit_bytes: 536870912,
            max_concurrent_generations: 4,
          },
          {
            id: "business__current",
            plan_id: "business",
            billing_interval: "month",
            stripe_price_id: "price_business",
            recurring_price_cents: 12900,
            monthly_credits_cents: 8000,
            storage_limit_bytes: 1073741824,
            max_concurrent_generations: 8,
          },
        ],
      })
    );

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_invoice_update_upgrade_paid",
        type: "invoice.payment_succeeded",
        data: {
          object: {
            id: "in_update_upgrade_paid",
            customer: "cus_123",
            billing_reason: "subscription_update",
            status: "paid",
            subscription_details: {
              metadata: {
                shortpulse_plan_change_kind: "immediate_paid_upgrade",
                billing_plan_id: "business",
                billing_offer_id: "business__current",
              },
            },
            lines: {
              data: [
                {
                  amount: -1200,
                  price: {
                    id: "price_media",
                    unit_amount: 4900,
                    metadata: {},
                  },
                  period: {
                    start: 1780881600,
                    end: 1783470000,
                  },
                },
                {
                  amount: 12900,
                  price: {
                    id: "price_business",
                    unit_amount: 12900,
                    metadata: {},
                  },
                  period: {
                    start: 1783470000,
                    end: 1786148400,
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
    expect(grantAccountCreditsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_123",
        amountCents: 8000,
        source: "subscription_renewal",
        sourceRef: "invoice:in_update_upgrade_paid:monthly_allocation",
        creditKind: "subscription_allocation",
        metadata: expect.objectContaining({
          invoice_id: "in_update_upgrade_paid",
          billing_reason: "subscription_update",
          plan_id: "business",
          offer_id: "business__current",
          stripe_customer_id: "cus_123",
          stripe_price_id: "price_business",
        }),
      })
    );
  });

  it("grants target plan credits for paid Portal-confirmed higher-plan update invoices without ShortPulse metadata", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminForWebhook({
        billingProfile: {
          user_id: "user_123",
          plan_id: "media",
        },
        billingPlans: [
          {
            id: "media",
            sort_order: 20,
          },
          {
            id: "business",
            sort_order: 40,
          },
        ],
        billingOffers: [
          {
            id: "media__current",
            plan_id: "media",
            billing_interval: "month",
            stripe_price_id: "price_media",
            recurring_price_cents: 4900,
            monthly_credits_cents: 1200,
            storage_limit_bytes: 26843545600,
            max_concurrent_generations: 2,
          },
          {
            id: "business__current",
            plan_id: "business",
            billing_interval: "month",
            stripe_price_id: "price_business",
            recurring_price_cents: 29900,
            monthly_credits_cents: 8000,
            storage_limit_bytes: 536870912000,
            max_concurrent_generations: 8,
          },
        ],
      })
    );

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_invoice_update_portal_upgrade_paid",
        type: "invoice.payment_succeeded",
        data: {
          object: {
            id: "in_update_portal_upgrade_paid",
            customer: "cus_123",
            billing_reason: "subscription_update",
            status: "paid",
            lines: {
              data: [
                {
                  amount: -1200,
                  price: {
                    id: "price_media",
                    unit_amount: 4900,
                    metadata: {},
                  },
                  period: {
                    start: 1780881600,
                    end: 1783470000,
                  },
                },
                {
                  amount: 29900,
                  price: {
                    id: "price_business",
                    unit_amount: 29900,
                    metadata: {},
                  },
                  period: {
                    start: 1783470000,
                    end: 1786148400,
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
    expect(grantAccountCreditsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_123",
        amountCents: 8000,
        source: "subscription_renewal",
        sourceRef: "invoice:in_update_portal_upgrade_paid:monthly_allocation",
        creditKind: "subscription_allocation",
        metadata: expect.objectContaining({
          invoice_id: "in_update_portal_upgrade_paid",
          billing_reason: "subscription_update",
          plan_id: "business",
          offer_id: "business__current",
          stripe_customer_id: "cus_123",
          stripe_price_id: "price_business",
        }),
      })
    );
  });

  it("grants target plan credits for full-price no-proration upgrade invoices with a matching intent", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    const intentUpdateSpy = vi.fn();
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminForWebhook({
        billingProfile: {
          user_id: "user_123",
          plan_id: "media",
        },
        billingPlans: [
          {
            id: "media",
            sort_order: 20,
          },
          {
            id: "business",
            sort_order: 40,
          },
        ],
        billingOffers: [
          {
            id: "business__current",
            plan_id: "business",
            billing_interval: "month",
            stripe_price_id: "price_business",
            recurring_price_cents: 29900,
            monthly_credits_cents: 8000,
            storage_limit_bytes: 536870912000,
            max_concurrent_generations: 8,
          },
        ],
        billingSubscriptionChangeIntent: {
          id: "intent_123",
          user_id: "user_123",
          active_plan_id: "media",
          active_offer_id: "media__current",
          target_plan_id: "business",
          target_offer_id: "business__current",
          target_stripe_price_id: "price_business",
          target_billing_interval: "month",
          status: "portal_created",
          expires_at: "2030-01-01T00:00:00.000Z",
        },
        onSubscriptionChangeIntentUpdate: intentUpdateSpy,
      })
    );

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_invoice_update_full_price_upgrade_paid",
        type: "invoice.payment_succeeded",
        data: {
          object: {
            id: "in_update_full_price_upgrade_paid",
            customer: "cus_123",
            subscription: "sub_123",
            billing_reason: "subscription_update",
            status: "paid",
            lines: {
              data: [
                {
                  amount: 29900,
                  price: {
                    id: "price_business",
                    unit_amount: 29900,
                    metadata: {},
                  },
                  period: {
                    start: 1783470000,
                    end: 1786148400,
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
    expect(grantAccountCreditsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_123",
        amountCents: 8000,
        source: "subscription_renewal",
        sourceRef: "invoice:in_update_full_price_upgrade_paid:monthly_allocation",
        creditKind: "subscription_allocation",
        metadata: expect.objectContaining({
          invoice_id: "in_update_full_price_upgrade_paid",
          billing_reason: "subscription_update",
          plan_id: "business",
          offer_id: "business__current",
          stripe_customer_id: "cus_123",
          stripe_price_id: "price_business",
          subscription_change_intent_id: "intent_123",
        }),
      })
    );
    expect(intentUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        stripe_invoice_id: "in_update_full_price_upgrade_paid",
        completed_at: expect.any(String),
      })
    );
  });

  it("does not grant credits for full-price subscription-update invoices without a matching intent", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminForWebhook({
        billingProfile: {
          user_id: "user_123",
          plan_id: "media",
        },
        billingPlans: [
          {
            id: "media",
            sort_order: 20,
          },
          {
            id: "business",
            sort_order: 40,
          },
        ],
        billingOffers: [
          {
            id: "business__current",
            plan_id: "business",
            billing_interval: "month",
            stripe_price_id: "price_business",
            recurring_price_cents: 29900,
            monthly_credits_cents: 8000,
            storage_limit_bytes: 536870912000,
            max_concurrent_generations: 8,
          },
        ],
        billingSubscriptionChangeIntent: null,
      })
    );

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_invoice_update_full_price_upgrade_no_intent",
        type: "invoice.payment_succeeded",
        data: {
          object: {
            id: "in_update_full_price_upgrade_no_intent",
            customer: "cus_123",
            subscription: "sub_123",
            billing_reason: "subscription_update",
            status: "paid",
            lines: {
              data: [
                {
                  amount: 29900,
                  price: {
                    id: "price_business",
                    unit_amount: 29900,
                    metadata: {},
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
    expect(grantAccountCreditsMock).not.toHaveBeenCalled();
  });

  it("does not grant subscription-update credits for paid lower-plan Portal changes", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminForWebhook({
        billingProfile: {
          user_id: "user_123",
          plan_id: "business",
        },
        billingPlans: [
          {
            id: "media",
            sort_order: 20,
          },
          {
            id: "business",
            sort_order: 40,
          },
        ],
        billingOffers: [
          {
            id: "media__current",
            plan_id: "media",
            billing_interval: "month",
            stripe_price_id: "price_media",
            recurring_price_cents: 4900,
            monthly_credits_cents: 1200,
            storage_limit_bytes: 26843545600,
            max_concurrent_generations: 2,
          },
          {
            id: "business__current",
            plan_id: "business",
            billing_interval: "month",
            stripe_price_id: "price_business",
            recurring_price_cents: 29900,
            monthly_credits_cents: 8000,
            storage_limit_bytes: 536870912000,
            max_concurrent_generations: 8,
          },
        ],
      })
    );

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_invoice_update_portal_downgrade_paid",
        type: "invoice.payment_succeeded",
        data: {
          object: {
            id: "in_update_portal_downgrade_paid",
            customer: "cus_123",
            billing_reason: "subscription_update",
            status: "paid",
            lines: {
              data: [
                {
                  amount: -29900,
                  price: {
                    id: "price_business",
                    unit_amount: 29900,
                    metadata: {},
                  },
                },
                {
                  amount: 4900,
                  price: {
                    id: "price_media",
                    unit_amount: 4900,
                    metadata: {},
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
    expect(grantAccountCreditsMock).not.toHaveBeenCalled();
  });

  it("grants target annual offer monthly credits for paid immediate subscription update invoices", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminForWebhook({
        billingProfile: {
          user_id: "user_123",
          plan_id: "media",
        },
        billingOffers: [
          {
            id: "media__current",
            plan_id: "media",
            billing_interval: "month",
            stripe_price_id: "price_media",
            recurring_price_cents: 4900,
            monthly_credits_cents: 1200,
            storage_limit_bytes: 26843545600,
            max_concurrent_generations: 2,
          },
          {
            id: "business__year_current",
            plan_id: "business",
            billing_interval: "year",
            stripe_price_id: "price_business_year",
            recurring_price_cents: 274800,
            monthly_credits_cents: 8000,
            storage_limit_bytes: 536870912000,
            max_concurrent_generations: 8,
          },
        ],
      })
    );

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_invoice_update_upgrade_annual_paid",
        type: "invoice.payment_succeeded",
        data: {
          object: {
            id: "in_update_upgrade_annual_paid",
            customer: "cus_123",
            billing_reason: "subscription_update",
            status: "paid",
            subscription_details: {
              metadata: {
                shortpulse_plan_change_kind: "immediate_paid_upgrade",
                billing_plan_id: "business",
                billing_offer_id: "business__year_current",
                billing_interval: "year",
              },
            },
            lines: {
              data: [
                {
                  amount: -1200,
                  price: {
                    id: "price_media",
                    unit_amount: 4900,
                    metadata: {},
                  },
                  period: {
                    start: 1780881600,
                    end: 1783470000,
                  },
                },
                {
                  amount: 274800,
                  price: {
                    id: "price_business_year",
                    unit_amount: 274800,
                    metadata: {},
                  },
                  period: {
                    start: 1783470000,
                    end: 1815006000,
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
    expect(grantAccountCreditsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_123",
        amountCents: 8000,
        source: "subscription_renewal",
        sourceRef: "invoice:in_update_upgrade_annual_paid:monthly_allocation",
        creditKind: "subscription_allocation",
        metadata: expect.objectContaining({
          invoice_id: "in_update_upgrade_annual_paid",
          billing_reason: "subscription_update",
          plan_id: "business",
          offer_id: "business__year_current",
          stripe_customer_id: "cus_123",
          stripe_price_id: "price_business_year",
        }),
      })
    );
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
    expect(grantAccountCreditsMock).not.toHaveBeenCalled();
  });

  it("fails closed on subscription-cycle credits when the Stripe customer does not belong to the resolved local user", async () => {
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
    readVerifiedStripeCustomerForUserMock.mockRejectedValueOnce(
      new Error("Stripe customer ownership mismatch detected.")
    );

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_invoice_cycle_foreign_customer",
        type: "invoice.payment_succeeded",
        data: {
          object: {
            id: "in_cycle_foreign_customer",
            customer: "cus_123",
            billing_reason: "subscription_cycle",
          },
        },
      })
    );
    await promise;

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Webhook processing failed." });
    expect(grantAccountCreditsMock).not.toHaveBeenCalled();
  });

  it("grants first-cycle subscription credits from invoice lines before the contract exists", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminForWebhook({
        billingProfile: {
          user_id: "user_123",
          plan_id: "free",
        },
        billingOffer: {
          id: "starter__current",
          plan_id: "starter",
          billing_interval: "month",
          stripe_price_id: "price_starter",
          recurring_price_cents: 1500,
          monthly_credits_cents: 350,
          storage_limit_bytes: 1073741824,
        },
        billingContract: null,
      })
    );

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_invoice_create_first_cycle",
        type: "invoice.payment_succeeded",
        data: {
          object: {
            id: "in_create_1",
            customer: "cus_123",
            billing_reason: "subscription_create",
            lines: {
              data: [
                {
                  amount: 1500,
                  period: {
                    start: 1704067200,
                    end: 1706745600,
                  },
                  price: {
                    id: "price_starter",
                    unit_amount: 1500,
                    metadata: {
                      monthly_credits_cents: "350",
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
    expect(grantAccountCreditsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_123",
        amountCents: 350,
        source: "subscription_renewal",
        sourceRef: "invoice:in_create_1:monthly_allocation",
        creditKind: "subscription_allocation",
        expiresAt: expect.any(String),
        metadata: expect.objectContaining({
          billing_reason: "subscription_create",
          plan_id: "starter",
          offer_id: "starter__current",
          stripe_price_id: "price_starter",
        }),
      })
    );
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

  it("projects active Stripe subscription schedules as pending downgrades", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    const scheduledChangeUpsertSpy = vi.fn();
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminForWebhook({
        billingProfile: {
          user_id: "user_123",
          plan_id: "media",
        },
        billingPlans: [
          { id: "starter", sort_order: 1 },
          { id: "media", sort_order: 2 },
        ],
        billingOffers: [
          {
            id: "media__monthly",
            plan_id: "media",
            billing_interval: "month",
            stripe_price_id: "price_media",
            recurring_price_cents: 4900,
            monthly_credits_cents: 1200,
            storage_limit_bytes: 26843545600,
            max_concurrent_generations: 2,
          },
          {
            id: "starter__monthly",
            plan_id: "starter",
            billing_interval: "month",
            stripe_price_id: "price_starter",
            recurring_price_cents: 1500,
            monthly_credits_cents: 350,
            storage_limit_bytes: 5368709120,
            max_concurrent_generations: 1,
          },
        ],
        billingContract: {
          id: "contract_media_1",
          plan_id: "media",
          offer_id: "media__monthly",
          billing_interval: "month",
          stripe_subscription_id: "sub_123",
          stripe_price_id: "price_media",
          recurring_price_cents: 4900,
          monthly_credits_cents: 1200,
          storage_limit_bytes: 26843545600,
          max_concurrent_generations: 2,
        },
        onScheduledChangeUpsert: scheduledChangeUpsertSpy,
      })
    );

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_schedule_updated_1",
        type: "subscription_schedule.updated",
        data: {
          object: {
            id: "sub_sched_123",
            customer: "cus_123",
            subscription: "sub_123",
            status: "active",
            current_phase: {
              start_date: 1783519163,
              end_date: 1786201163,
            },
            phases: [
              {
                start_date: 1783519163,
                end_date: 1786201163,
                items: [{ price: "price_media", quantity: 1 }],
              },
              {
                start_date: 1786201163,
                end_date: 1786201164,
                items: [{ price: "price_starter", quantity: 1 }],
              },
            ],
          },
        },
      })
    );
    await promise;

    expect(res.status).toHaveBeenCalledWith(200);
    expect(scheduledChangeUpsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user_123",
        status: "active",
        change_kind: "scheduled_downgrade",
        stripe_customer_id: "cus_123",
        stripe_subscription_id: "sub_123",
        stripe_schedule_id: "sub_sched_123",
        current_plan_id: "media",
        current_stripe_price_id: "price_media",
        target_plan_id: "starter",
        target_offer_id: "starter__monthly",
        target_stripe_price_id: "price_starter",
        target_monthly_credits_cents: 350,
        effective_at: "2026-08-08T14:59:23.000Z",
        current_benefits_end_at: "2026-08-08T14:59:23.000Z",
      })
    );
  });

  it("clears pending schedule projections when Stripe releases a subscription schedule", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    const scheduledChangeUpdateSpy = vi.fn();
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminForWebhook({
        onScheduledChangeUpdate: scheduledChangeUpdateSpy,
      })
    );

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_schedule_released_1",
        type: "subscription_schedule.released",
        data: {
          object: {
            id: "sub_sched_123",
            status: "released",
          },
        },
      })
    );
    await promise;

    expect(res.status).toHaveBeenCalledWith(200);
    expect(scheduledChangeUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "released",
        released_at: expect.any(String),
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
          monthly_credits_cents: 8000,
          storage_limit_bytes: 536870912000,
        },
        billingContract: {
          id: "contract_business_1",
          plan_id: "business",
          offer_id: "business__current",
          stripe_subscription_id: "sub_123",
          stripe_price_id: "price_business",
          recurring_price_cents: 12900,
          monthly_credits_cents: 8000,
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
                      monthly_credits_cents: "8000",
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

  it("keeps scheduled period-end cancellations open until Stripe sends final cancellation", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    const billingProfileUpdateSpy = vi.fn();
    const contractUpdateSpy = vi.fn();
    const storageAddonUpdateSpy = vi.fn();
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
          max_concurrent_generations: 4,
        },
        billingStorageAddonOffer: {
          id: "storage_100gb__current",
          storage_addon_id: "storage_100gb",
          stripe_price_id: "price_storage_100gb",
          storage_limit_bytes: 107374182400,
          recurring_price_cents: 1500,
        },
        billingContract: {
          id: "contract_studio_1",
          plan_id: "studio",
          offer_id: "studio__current",
          billing_interval: "month",
          stripe_subscription_id: "sub_123",
          stripe_price_id: "price_studio",
          recurring_price_cents: 3900,
          monthly_credits_cents: 3000,
          storage_limit_bytes: 107374182400,
          max_concurrent_generations: 4,
        },
        billingStorageAddonContracts: [
          {
            id: "addon_contract_1",
            storage_addon_id: "storage_100gb",
            offer_id: "storage_100gb__current",
            stripe_subscription_item_id: "si_storage_1",
            stripe_price_id: "price_storage_100gb",
            storage_limit_bytes: 107374182400,
            quantity: 1,
            recurring_price_cents: 1500,
            status: "active",
          },
        ],
        onBillingProfileUpdate: billingProfileUpdateSpy,
        onContractUpdate: contractUpdateSpy,
        onStorageAddonUpdate: storageAddonUpdateSpy,
      })
    );

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_sub_scheduled_cancel_1",
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_123",
            customer: "cus_123",
            status: "active",
            current_period_start: 1704067200,
            current_period_end: 1706745600,
            cancel_at_period_end: true,
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
                  quantity: 1,
                  price: {
                    id: "price_storage_100gb",
                    unit_amount: 1500,
                    metadata: {},
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
        plan_id: "studio",
        subscription_status: "active",
        stripe_subscription_id: "sub_123",
        current_period_end: "2024-02-01T00:00:00.000Z",
      })
    );
    expect(contractUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "active",
        cancel_at_period_end: true,
        ended_at: null,
      })
    );
    expect(storageAddonUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "active",
        cancel_at_period_end: true,
        ended_at: null,
      })
    );
  });

  it("closes period-end canceled subscriptions and storage add-ons even when Stripe keeps cancel_at_period_end true", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    const billingProfileUpdateSpy = vi.fn();
    const contractUpdateSpy = vi.fn();
    const storageAddonUpdateSpy = vi.fn();
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
          max_concurrent_generations: 4,
        },
        billingContract: {
          id: "contract_studio_1",
          plan_id: "studio",
          offer_id: "studio__current",
          billing_interval: "month",
          stripe_subscription_id: "sub_123",
          stripe_price_id: "price_studio",
          recurring_price_cents: 3900,
          monthly_credits_cents: 3000,
          storage_limit_bytes: 107374182400,
          max_concurrent_generations: 4,
        },
        billingStorageAddonContracts: [
          {
            id: "addon_contract_1",
            storage_addon_id: "storage_100gb",
            offer_id: "storage_100gb__current",
            stripe_subscription_item_id: "si_storage_1",
            stripe_price_id: "price_storage_100gb",
            storage_limit_bytes: 107374182400,
            quantity: 1,
            recurring_price_cents: 1500,
            status: "active",
          },
        ],
        onBillingProfileUpdate: billingProfileUpdateSpy,
        onContractUpdate: contractUpdateSpy,
        onStorageAddonUpdate: storageAddonUpdateSpy,
      })
    );

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_sub_period_end_deleted_1",
        type: "customer.subscription.deleted",
        data: {
          object: {
            id: "sub_123",
            customer: "cus_123",
            status: "canceled",
            current_period_start: 1704067200,
            current_period_end: 1706745600,
            cancel_at_period_end: true,
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
                  quantity: 1,
                  price: {
                    id: "price_storage_100gb",
                    unit_amount: 1500,
                    metadata: {},
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
        status: "canceled",
        cancel_at_period_end: false,
        ended_at: "2024-02-01T00:00:00.000Z",
      })
    );
    expect(storageAddonUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "canceled",
        cancel_at_period_end: false,
        ended_at: "2024-02-01T00:00:00.000Z",
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

  it("derives subscription period boundaries from subscription items when top-level period fields are absent", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    const billingProfileUpdateSpy = vi.fn();
    const contractInsertSpy = vi.fn();
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminForWebhook({
        billingProfile: {
          user_id: "user_123",
          plan_id: "starter",
        },
        billingOffer: {
          id: "starter__year__current",
          plan_id: "starter",
          billing_interval: "year",
          stripe_price_id: "price_starter_year",
          recurring_price_cents: 18000,
          monthly_credits_cents: 350,
          storage_limit_bytes: 1073741824,
        },
        billingContract: null,
        onBillingProfileUpdate: billingProfileUpdateSpy,
        onContractInsert: contractInsertSpy,
      })
    );

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_sub_created_item_periods_1",
        type: "customer.subscription.created",
        data: {
          object: {
            id: "sub_starter_year",
            customer: "cus_123",
            status: "active",
            cancel_at_period_end: false,
            items: {
              data: [
                {
                  id: "si_plan_annual",
                  quantity: 1,
                  current_period_start: 1704067200,
                  current_period_end: 1735689600,
                  price: {
                    id: "price_starter_year",
                    unit_amount: 18000,
                    metadata: {
                      monthly_credits_cents: "350",
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
        current_period_end: "2025-01-01T00:00:00.000Z",
      })
    );
    expect(contractInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        current_period_start: "2024-01-01T00:00:00.000Z",
        current_period_end: "2025-01-01T00:00:00.000Z",
        next_credit_grant_at: "2024-02-01T00:00:00.000Z",
      })
    );
  });

  it("syncs annual contract cursors when Stripe applies a pending subscription update", async () => {
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    const contractInsertSpy = vi.fn();
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminForWebhook({
        billingProfile: {
          user_id: "user_123",
          plan_id: "media",
        },
        billingOffer: {
          id: "business__year_current",
          plan_id: "business",
          billing_interval: "year",
          stripe_price_id: "price_business_year",
          recurring_price_cents: 274800,
          monthly_credits_cents: 8000,
          storage_limit_bytes: 536870912000,
          max_concurrent_generations: 8,
        },
        billingContract: null,
        onContractInsert: contractInsertSpy,
      })
    );

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_sub_pending_update_applied_annual_1",
        type: "customer.subscription.pending_update_applied",
        data: {
          object: {
            id: "sub_business_year",
            customer: "cus_123",
            status: "active",
            cancel_at_period_end: false,
            items: {
              data: [
                {
                  id: "si_plan_annual",
                  quantity: 1,
                  current_period_start: 1783472400,
                  current_period_end: 1815008400,
                  price: {
                    id: "price_business_year",
                    unit_amount: 274800,
                    metadata: {
                      monthly_credits_cents: "8000",
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
        plan_id: "business",
        offer_id: "business__year_current",
        billing_interval: "year",
        monthly_credits_cents: 8000,
        current_period_start: "2026-07-08T01:00:00.000Z",
        current_period_end: "2027-07-08T01:00:00.000Z",
        next_credit_grant_at: "2026-08-08T01:00:00.000Z",
      })
    );
  });

  it("ends removed recurring storage add-ons at mutation time instead of subscription period start", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-02-15T10:30:00.000Z"));
    verifyStripeWebhookSignatureMock.mockReturnValue(true);
    const storageAddonUpdateSpy = vi.fn();
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
        billingContract: {
          id: "contract_studio_1",
          plan_id: "studio",
          offer_id: "studio__current",
          stripe_subscription_id: "sub_123",
          stripe_price_id: "price_studio",
          recurring_price_cents: 3900,
          monthly_credits_cents: 3000,
          storage_limit_bytes: 107374182400,
        },
        billingStorageAddonContracts: [
          {
            id: "addon_contract_1",
            storage_addon_id: "storage_25gb",
            offer_id: "storage_25gb__current",
            stripe_subscription_item_id: "si_storage_1",
            stripe_price_id: "price_storage_25gb",
            quantity: 1,
            recurring_price_cents: 500,
            status: "active",
          },
        ],
        onStorageAddonUpdate: storageAddonUpdateSpy,
      })
    );

    const { res, promise } = createWebhookRequest(
      JSON.stringify({
        id: "evt_sub_storage_removed_1",
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
              ],
            },
          },
        },
      })
    );
    await promise;

    expect(res.status).toHaveBeenCalledWith(200);
    expect(storageAddonUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "canceled",
        ended_at: "2024-02-15T10:30:00.000Z",
      })
    );
  });
});
