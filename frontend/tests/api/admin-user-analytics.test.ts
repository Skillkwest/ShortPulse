/**
 * API route tests for selected-account admin customer analytics.
 * Guards auth, request validation, and route-owned error mapping.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/users/[userId]/analytics";

const requireAdminUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const resolveAdminUserAnalyticsMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/adminUserAnalytics", () => ({
  resolveAdminUserAnalytics: (...args: unknown[]) => resolveAdminUserAnalyticsMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const USER_ID = "22222222-2222-4222-8222-222222222222";

describe("GET /api/admin/users/[userId]/analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
    resolveAdminUserAnalyticsMock.mockResolvedValue({
      generatedAt: "2026-04-30T12:00:00.000Z",
      target: {
        userId: USER_ID,
        email: "alpha@example.com",
        createdAt: "2026-03-01T00:00:00.000Z",
        lastSignInAt: null,
      },
      credits: {
        spendableCredits: 100,
        availableCredits: 100,
        reservedCredits: 0,
        totalCreditsSpent: 20,
        currentCycleSpentCredits: null,
        generationCreditsSpent: 20,
        expiringCredits: 100,
        nonExpiringCredits: 0,
        nextExpiringCredits: 100,
        nextExpiresAt: "2026-05-01T00:00:00.000Z",
        source: "exact",
      },
      billing: {
        status: "active",
        contractSource: "stripe",
        recurringPriceCents: 4900,
        billingInterval: "month",
        monthlyRecurringRevenueCents: 4900,
        renewalAt: "2026-05-01T00:00:00.000Z",
        paymentExempt: false,
        source: "exact",
      },
      revenue: {
        totalRevenueCents: 4900,
        subscriptionRevenueCents: 4900,
        topUpRevenueCents: 0,
        invoiceCount: 1,
        topUpPurchaseCount: 0,
        source: "stripe",
        note: "Revenue loaded.",
      },
      topUps: {
        purchaseCount: 0,
        creditsPurchased: 0,
        revenueCents: 0,
        source: "local_ledger",
      },
      generations: {
        total: 1,
        succeeded: 1,
        failed: 0,
        last30dTotal: 1,
        last30dSucceeded: 1,
        last30dFailed: 0,
        byStatus: { success: 1 },
        source: "generation_rows",
      },
      mediaBreakdown: {
        images: 1,
        videos: 0,
        audio: 0,
        voices: 0,
        music: 0,
        soundEffects: 0,
        unknownAudio: 0,
        unknown: 0,
        source: "generation_rows",
      },
      storage: {
        usedBytes: null,
        totalLimitBytes: null,
        addonLimitBytes: null,
        remainingBytes: null,
        isOverLimit: null,
        source: "unavailable",
      },
      agentUsage: {
        standard: { turns: null, source: "unavailable", note: "Not durable." },
        pulse: { turns: null, source: "unavailable", note: "Not durable." },
      },
      sourceHealth: [],
    });
  });

  it("rejects non-GET methods", async () => {
    const req = { method: "POST", query: { userId: USER_ID } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("returns a safe failure when admin auth verification throws", async () => {
    const authError = new Error("auth verifier exploded");
    requireAdminUserMock.mockRejectedValue(authError);
    const req = { method: "GET", query: { userId: USER_ID } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: authError,
        routeLabel: "admin/users/analytics.auth",
      })
    );
    expect(resolveAdminUserAnalyticsMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to load user analytics." });
  });

  it("requires a valid user id", async () => {
    const req = { method: "GET", query: { userId: "not-a-user-id" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(resolveAdminUserAnalyticsMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "A valid user id is required." });
  });

  it("returns selected-user analytics from the canonical helper", async () => {
    const req = { method: "GET", query: { userId: USER_ID } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(resolveAdminUserAnalyticsMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ userId: USER_ID }),
      })
    );
  });

  it("maps user-not-found helper failures to 404", async () => {
    resolveAdminUserAnalyticsMock.mockRejectedValue(new Error("User not found."));
    const req = { method: "GET", query: { userId: USER_ID } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "User not found." });
  });
});
