import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureStripeCustomerForUser } from "../../lib/server/api/stripeCustomer";

const getSupabaseAdminMock = vi.fn();
const stripePostFormMock = vi.fn();

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/stripe", () => ({
  stripePostForm: (...args: unknown[]) => stripePostFormMock(...args),
}));

describe("ensureStripeCustomerForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns existing stripe customer id without creating a new customer", async () => {
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

    const customerId = await ensureStripeCustomerForUser({
      userId: "user_1",
      email: "user@example.com",
    });

    expect(customerId).toBe("cus_existing");
    expect(stripePostFormMock).not.toHaveBeenCalled();
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

    const customerId = await ensureStripeCustomerForUser({
      userId: "user_1",
      email: "user@example.com",
    });

    expect(customerId).toBe("cus_new");
    expect(stripePostFormMock).toHaveBeenCalledWith("/customers", {
      email: "user@example.com",
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
      ensureStripeCustomerForUser({
        userId: "user_1",
        email: "user@example.com",
      })
    ).rejects.toThrow("upsert failed");
  });
});
