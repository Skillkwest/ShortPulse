import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/credits/adjust";

const requireAdminUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const grantAccountCreditsMock = vi.fn();
const debitAccountCreditsMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/creditLedger", () => ({
  grantAccountCredits: (...args: unknown[]) => grantAccountCreditsMock(...args),
  debitAccountCredits: (...args: unknown[]) => debitAccountCreditsMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/admin/credits/adjust", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
    grantAccountCreditsMock.mockResolvedValue({ error: null });
    debitAccountCreditsMock.mockResolvedValue({ error: null });
  });

  it("rejects zero adjustments", async () => {
    const req = {
      method: "POST",
      body: { userId: "user-1", changeCents: 0, idempotencyKey: "adjustment-1" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "changeCents must be a non-zero number." });
  });

  it("rejects adjustments without an idempotency key", async () => {
    const req = { method: "POST", body: { userId: "user-1", changeCents: 100 } };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "idempotencyKey is required." });
    expect(grantAccountCreditsMock).not.toHaveBeenCalled();
    expect(debitAccountCreditsMock).not.toHaveBeenCalled();
  });

  it("returns a safe failure when admin auth verification throws", async () => {
    const authError = new Error("auth verifier exploded");
    requireAdminUserMock.mockRejectedValue(authError);

    const req = {
      method: "POST",
      body: { userId: "user-1", changeCents: 100, idempotencyKey: "adjustment-1" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: authError,
        routeLabel: "admin/credits/adjust.auth",
      })
    );
    expect(grantAccountCreditsMock).not.toHaveBeenCalled();
    expect(debitAccountCreditsMock).not.toHaveBeenCalled();
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Credit adjustment failed." });
  });

  it("returns updated balance after successful adjustment", async () => {
    getSupabaseAdminMock.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { balance_cents: 1234 }, error: null }),
          }),
        }),
      }),
    });

    const req = {
      method: "POST",
      body: { userId: "user-1", changeCents: 100, idempotencyKey: "adjustment-1" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(grantAccountCreditsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        amountCents: 100,
        creditKind: "admin_adjustment",
        expiresAt: null,
        sourceRef: "admin_adjustment:admin-1:adjustment-1",
        metadata: expect.objectContaining({
          admin_adjustment_idempotency_key: "adjustment-1",
        }),
      })
    );
    expect(debitAccountCreditsMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      userId: "user-1",
      balanceCents: 1234,
      status: "granted",
      ledgerId: null,
      grantId: null,
    });
  });

  it("returns duplicate status as idempotent success", async () => {
    grantAccountCreditsMock.mockResolvedValue({
      error: null,
      status: "duplicate",
      ledgerId: "ledger-1",
      grantId: "grant-1",
    });
    getSupabaseAdminMock.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { balance_cents: 1234 }, error: null }),
          }),
        }),
      }),
    });

    const req = {
      method: "POST",
      body: { userId: "user-1", changeCents: 100, idempotencyKey: "adjustment-1" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      userId: "user-1",
      balanceCents: 1234,
      status: "duplicate",
      ledgerId: "ledger-1",
      grantId: "grant-1",
    });
  });

  it("fails closed when the updated balance read fails", async () => {
    getSupabaseAdminMock.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: null,
              error: { message: "balance read failed" },
            }),
          }),
        }),
      }),
    });

    const req = {
      method: "POST",
      body: { userId: "user-1", changeCents: 100, idempotencyKey: "adjustment-1" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "balance read failed" });
  });
});
