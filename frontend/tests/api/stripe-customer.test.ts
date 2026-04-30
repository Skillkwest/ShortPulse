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

describe("syncStripeCustomerForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns existing stripe customer id without updating when identity already matches", async () => {
    getSupabaseAdminMock.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                stripe_customer_id: "cus_existing",
                plan_id: "free",
                subscription_status: "inactive",
              },
              error: null,
            }),
          }),
        }),
      }),
    });
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
    getSupabaseAdminMock.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                stripe_customer_id: "cus_existing",
                plan_id: "free",
                subscription_status: "inactive",
              },
              error: null,
            }),
          }),
        }),
      }),
    });
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
    const stripeCustomerError = new Error("No such customer: 'cus_stale'");
    getSupabaseAdminMock.mockReturnValue({
      from: (table: string) => {
        if (table === "billing_profiles") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    stripe_customer_id: "cus_stale",
                    plan_id: "business",
                    subscription_status: "active",
                  },
                  error: null,
                }),
              }),
            }),
            upsert: upsertMock,
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    });
    stripeGetMock.mockRejectedValue(stripeCustomerError);
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
    expect(stripeGetMock).toHaveBeenCalledWith("/customers/cus_stale");
    expect(stripePostFormMock).toHaveBeenCalledTimes(1);
  });

  it("creates stripe customer and persists mapping when billing profile is missing", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    getSupabaseAdminMock.mockReturnValue({
      from: (table: string) => {
        if (table === "billing_profiles") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
            upsert: upsertMock,
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    });
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
        plan_id: "free",
        subscription_status: "inactive",
        stripe_customer_id: "cus_new",
      },
      { onConflict: "user_id" }
    );
  });

  it("throws when mapping persistence fails", async () => {
    getSupabaseAdminMock.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
        upsert: async () => ({ error: { message: "upsert failed" } }),
      }),
    });
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
