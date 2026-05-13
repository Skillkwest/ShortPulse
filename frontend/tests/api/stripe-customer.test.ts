import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncStripeCustomerForUser } from "../../lib/server/api/stripeCustomer";

const getSupabaseAdminMock = vi.fn();
const stripePostFormMock = vi.fn();
const stripeGetMock = vi.fn();

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/stripe", () => ({
  stripePostForm: (...args: unknown[]) => stripePostFormMock(...args),
  stripeGet: (...args: unknown[]) => stripeGetMock(...args),
}));

const createSupabaseAdminMock = (params?: {
  profile?: Record<string, unknown> | null;
  contract?: Record<string, unknown> | null;
  onUpsertProfile?: ReturnType<typeof vi.fn>;
  onUpdateContract?: ReturnType<typeof vi.fn>;
}) => ({
  from: (table: string) => {
    if (table === "billing_profiles") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: params?.profile ?? null,
              error: null,
            }),
          }),
        }),
        upsert: params?.onUpsertProfile ?? vi.fn().mockResolvedValue({ error: null }),
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
                    data: params?.contract ?? null,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
        update: (payload: unknown) => ({
          eq: async (column: string, value: string) => {
            params?.onUpdateContract?.(payload, column, value);
            return { error: null };
          },
        }),
      };
    }

    throw new Error(`Unexpected table ${table}`);
  },
});

describe("syncStripeCustomerForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns existing stripe customer id without updating when identity already matches", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        profile: {
          stripe_customer_id: "cus_existing",
          plan_id: "free",
          subscription_status: "inactive",
        },
      })
    );
    stripeGetMock.mockResolvedValue({
      id: "cus_existing",
      email: "user@example.com",
      name: "User Example",
      metadata: { user_id: "user_1" },
    });

    const result = await syncStripeCustomerForUser({
      userId: "user_1",
      email: "user@example.com",
      displayName: "User Example",
    });

    expect(result).toEqual({
      stripeCustomerId: "cus_existing",
      email: "user@example.com",
      name: "User Example",
      created: false,
      updated: false,
    });
    expect(stripeGetMock).toHaveBeenCalledWith("/customers/cus_existing");
    expect(stripePostFormMock).not.toHaveBeenCalled();
  });

  it("updates an existing Stripe customer when display name drifts", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        profile: {
          stripe_customer_id: "cus_existing",
          plan_id: "free",
          subscription_status: "inactive",
        },
      })
    );
    stripeGetMock.mockResolvedValue({
      id: "cus_existing",
      email: "user@example.com",
      name: null,
      metadata: { user_id: "user_1" },
    });
    stripePostFormMock.mockResolvedValue({
      id: "cus_existing",
      email: "user@example.com",
      name: "Updated Name",
    });

    const result = await syncStripeCustomerForUser({
      userId: "user_1",
      email: "user@example.com",
      displayName: "Updated Name",
    });

    expect(stripePostFormMock).toHaveBeenCalledWith("/customers/cus_existing", {
      name: "Updated Name",
    });
    expect(result.updated).toBe(true);
  });

  it("recreates a Stripe customer when existing mapping points to a missing customer", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const updateContractMock = vi.fn();
    stripeGetMock.mockRejectedValue(new Error("No such customer: 'cus_stale'"));
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        profile: {
          stripe_customer_id: "cus_stale",
          plan_id: "free",
          subscription_status: "inactive",
        },
        contract: {
          id: "contract_1",
          stripe_customer_id: "cus_stale",
          plan_id: "business",
          status: "active",
          contract_source: "stripe",
        },
        onUpsertProfile: upsertMock,
        onUpdateContract: updateContractMock,
      })
    );
    stripePostFormMock.mockResolvedValue({
      id: "cus_replaced",
      email: "user@example.com",
      name: "User Example",
    });

    const result = await syncStripeCustomerForUser({
      userId: "user_1",
      email: "user@example.com",
      displayName: "User Example",
    });

    expect(result.stripeCustomerId).toBe("cus_replaced");
    expect(result.created).toBe(true);
    expect(stripePostFormMock).toHaveBeenCalledWith("/customers", {
      email: "user@example.com",
      name: "User Example",
      "metadata[user_id]": "user_1",
    });
    expect(upsertMock).toHaveBeenCalledWith(
      {
        user_id: "user_1",
        plan_id: "business",
        subscription_status: "active",
        stripe_customer_id: "cus_replaced",
      },
      { onConflict: "user_id" }
    );
    expect(updateContractMock).toHaveBeenCalledWith(
      { stripe_customer_id: "cus_replaced" },
      "id",
      "contract_1"
    );
    expect(stripeGetMock).toHaveBeenCalledWith("/customers/cus_stale");
    expect(stripePostFormMock).toHaveBeenCalledTimes(1);
  });

  it("creates stripe customer and persists contract-backed mapping when billing profile is missing", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const updateContractMock = vi.fn();
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        profile: null,
        contract: {
          id: "contract_1",
          stripe_customer_id: null,
          plan_id: "business",
          status: "active",
          contract_source: "stripe",
        },
        onUpsertProfile: upsertMock,
        onUpdateContract: updateContractMock,
      })
    );
    stripePostFormMock.mockResolvedValue({ id: "cus_new" });

    const result = await syncStripeCustomerForUser({
      userId: "user_1",
      email: "user@example.com",
      displayName: "User Example",
    });

    expect(result.stripeCustomerId).toBe("cus_new");
    expect(stripePostFormMock).toHaveBeenCalledWith("/customers", {
      email: "user@example.com",
      name: "User Example",
      "metadata[user_id]": "user_1",
    });
    expect(upsertMock).toHaveBeenCalledWith(
      {
        user_id: "user_1",
        plan_id: "business",
        subscription_status: "active",
        stripe_customer_id: "cus_new",
      },
      { onConflict: "user_id" }
    );
    expect(updateContractMock).toHaveBeenCalledWith(
      { stripe_customer_id: "cus_new" },
      "id",
      "contract_1"
    );
  });

  it("syncs a missing contract customer id when the existing Stripe customer is still valid", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const updateContractMock = vi.fn();
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        profile: {
          stripe_customer_id: "cus_existing",
          plan_id: "business",
          subscription_status: "active",
        },
        contract: {
          id: "contract_1",
          stripe_customer_id: null,
          plan_id: "business",
          status: "active",
          contract_source: "stripe",
        },
        onUpsertProfile: upsertMock,
        onUpdateContract: updateContractMock,
      })
    );
    stripeGetMock.mockResolvedValue({
      id: "cus_existing",
      email: "user@example.com",
      name: "User Example",
      metadata: { user_id: "user_1" },
    });

    const result = await syncStripeCustomerForUser({
      userId: "user_1",
      email: "user@example.com",
      displayName: "User Example",
    });

    expect(result).toEqual({
      stripeCustomerId: "cus_existing",
      email: "user@example.com",
      name: "User Example",
      created: false,
      updated: false,
    });
    expect(upsertMock).toHaveBeenCalledWith(
      {
        user_id: "user_1",
        plan_id: "business",
        subscription_status: "active",
        stripe_customer_id: "cus_existing",
      },
      { onConflict: "user_id" }
    );
    expect(updateContractMock).toHaveBeenCalledWith(
      { stripe_customer_id: "cus_existing" },
      "id",
      "contract_1"
    );
  });

  it("throws on Stripe mode mismatch instead of auto-creating a duplicate customer", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        profile: {
          stripe_customer_id: "cus_mode_mismatch",
          plan_id: "business",
          subscription_status: "active",
        },
      })
    );
    stripeGetMock.mockRejectedValue(
      new Error(
        "No such customer: 'cus_mode_mismatch'; a similar object exists in test mode, but a live mode key was used to make this request."
      )
    );

    await expect(
      syncStripeCustomerForUser({
        userId: "user_1",
        email: "user@example.com",
        displayName: "User Example",
      })
    ).rejects.toThrow("Stripe customer mode mismatch detected.");

    expect(stripePostFormMock).not.toHaveBeenCalled();
  });

  it("throws when mapping persistence fails", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({
        profile: null,
        contract: null,
        onUpsertProfile: vi.fn().mockResolvedValue({ error: { message: "upsert failed" } }),
      })
    );
    stripePostFormMock.mockResolvedValue({ id: "cus_new" });

    await expect(
      syncStripeCustomerForUser({
        userId: "user_1",
        email: "user@example.com",
        displayName: "User Example",
      })
    ).rejects.toThrow("upsert failed");
  });
});
