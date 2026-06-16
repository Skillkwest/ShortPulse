import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/users/[userId]";

const requireAdminUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const getSupabaseAdminMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const FOOTPRINT_TABLES = [
  "billing_subscription_contracts",
  "ai_credit_ledger",
  "ai_credit_reservations",
  "ai_generations",
  "media_files",
  "projects",
  "user_owned_custom_voices",
];

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const createSupabaseMock = ({
  billingProfile = { stripe_customer_id: null, stripe_subscription_id: null },
  creditBalance = { balance_cents: 0 },
  footprintCounts = {},
  storageObjects = [],
}: {
  billingProfile?: { stripe_customer_id: string | null; stripe_subscription_id: string | null };
  creditBalance?: { balance_cents: number };
  footprintCounts?: Partial<Record<string, number>>;
  storageObjects?: unknown[];
} = {}) => {
  const getUserById = vi.fn().mockResolvedValue({
    data: { user: { id: USER_ID, email: "target@example.com" } },
    error: null,
  });
  const deleteUser = vi.fn().mockResolvedValue({ data: { user: null }, error: null });

  const from = vi.fn((table: string) => {
    if (table === "billing_profiles") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: billingProfile, error: null }),
          }),
        }),
      };
    }

    if (table === "ai_credit_balance") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: creditBalance, error: null }),
          }),
        }),
      };
    }

    if (FOOTPRINT_TABLES.includes(table)) {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            count: footprintCounts[table] ?? 0,
            error: null,
          }),
        }),
      };
    }

    throw new Error(`Unexpected table ${table}`);
  });

  return {
    auth: {
      admin: {
        getUserById,
        deleteUser,
      },
    },
    from,
    storage: {
      from: vi.fn().mockReturnValue({
        list: vi.fn().mockResolvedValue({ data: storageObjects, error: null }),
      }),
    },
    getUserById,
    deleteUser,
  };
};

describe("DELETE /api/admin/users/[userId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: ADMIN_ID, email: "admin@example.com" });
  });

  it("rejects non-DELETE methods", async () => {
    const req = { method: "POST", query: { userId: USER_ID } };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("rejects attempts to delete the current admin", async () => {
    const req = {
      method: "DELETE",
      query: { userId: ADMIN_ID },
      body: { confirmationText: ADMIN_ID },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "You cannot delete the currently signed-in admin.",
    });
  });

  it("rejects mismatched confirmation text", async () => {
    getSupabaseAdminMock.mockReturnValue({
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { user: { id: USER_ID, email: "target@example.com" } },
            error: null,
          }),
        },
      },
    });

    const req = {
      method: "DELETE",
      query: { userId: USER_ID },
      body: { confirmationText: "wrong@example.com" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Type target@example.com exactly to confirm deletion.",
    });
  });

  it("deletes the user when the confirmation text matches", async () => {
    const supabaseMock = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue(supabaseMock);

    const req = {
      method: "DELETE",
      query: { userId: USER_ID },
      body: { confirmationText: "target@example.com" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(supabaseMock.getUserById).toHaveBeenCalledWith(USER_ID);
    expect(supabaseMock.deleteUser).toHaveBeenCalledWith(USER_ID, false);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      userId: USER_ID,
      email: "target@example.com",
    });
  });

  it("blocks deletion while account-owned billing or media footprint remains", async () => {
    const supabaseMock = createSupabaseMock({
      billingProfile: {
        stripe_customer_id: "cus_test_123",
        stripe_subscription_id: null,
      },
      footprintCounts: {
        media_files: 1,
      },
    });
    getSupabaseAdminMock.mockReturnValue(supabaseMock);

    const req = {
      method: "DELETE",
      query: { userId: USER_ID },
      body: { confirmationText: "target@example.com" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(supabaseMock.deleteUser).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error:
        "User deletion blocked until billing, credits, media, projects, voices, and storage are reviewed.",
      blockers: expect.arrayContaining([
        "Stripe-linked billing profile exists",
        "media rows exist",
      ]),
    });
  });
});
