import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/credits/ledger";

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

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const buildLedgerQueryChain = (limitMock: ReturnType<typeof vi.fn>) => {
  const chain = {
    eq: vi.fn(),
    order: vi.fn(),
    limit: limitMock,
  };
  chain.eq.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  const selectMock = vi.fn(() => chain);
  return { chain, selectMock };
};

describe("GET /api/admin/credits/ledger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
  });

  it("rejects non-GET methods", async () => {
    const req = { method: "POST", query: {} };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("requires userId", async () => {
    const req = { method: "GET", query: {} };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "userId is required." });
  });

  it("returns recent transactions with parsed pricing breakdown", async () => {
    const limitMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: "ledger-1",
          user_id: "user-1",
          change_cents: -5,
          reason: "fal-ai/nano-banana generation",
          source: "generation_charge",
          source_ref: "req-123",
          metadata: {
            pricing_breakdown: {
              usd_raw: 0.039,
              raw_credits: 4,
              billed_credits: 5,
              billed_usd: 0.05,
            },
          },
          created_at: "2026-02-15T16:44:00.000Z",
        },
      ],
      error: null,
    });
    const { chain, selectMock } = buildLedgerQueryChain(limitMock);
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn(() => ({ select: selectMock })),
    });

    const req = { method: "GET", query: { userId: "user-1", limit: "10" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      userId: "user-1",
      limit: 10,
      source: null,
      transactions: [
        {
          id: "ledger-1",
          userId: "user-1",
          changeCents: -5,
          reason: "fal-ai/nano-banana generation",
          source: "generation_charge",
          sourceRef: "req-123",
          pricingBreakdown: {
            usdRaw: 0.039,
            rawCredits: 4,
            billedCredits: 5,
            billedUsd: 0.05,
          },
          createdAt: "2026-02-15T16:44:00.000Z",
        },
      ],
    });
    expect(selectMock).toHaveBeenCalledWith(
      "id, user_id, change_cents, reason, source, source_ref, metadata, created_at"
    );
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(chain.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(limitMock).toHaveBeenCalledWith(10);
  });

  it("applies source filter server-side when provided", async () => {
    const limitMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const { chain, selectMock } = buildLedgerQueryChain(limitMock);
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn(() => ({ select: selectMock })),
    });

    const req = {
      method: "GET",
      query: { userId: "user-1", source: "generation_charge", limit: "5" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(chain.eq).toHaveBeenCalledWith("source", "generation_charge");
    expect(limitMock).toHaveBeenCalledWith(5);
    expect(res.json).toHaveBeenCalledWith({
      userId: "user-1",
      limit: 5,
      source: "generation_charge",
      transactions: [],
    });
  });

  it("falls back to legacy ledger columns when rich columns are unavailable", async () => {
    const richLimitMock = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "42703",
        message: "column ai_credit_ledger.source_ref does not exist",
      },
    });
    const legacyLimitMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: "legacy-1",
          user_id: "user-legacy",
          change_cents: -15,
          reason: "legacy debit",
          ref_id: "legacy-ref-1",
          created_at: "2026-02-15T17:20:00.000Z",
        },
      ],
      error: null,
    });

    const richChain = buildLedgerQueryChain(richLimitMock);
    const legacyChain = buildLedgerQueryChain(legacyLimitMock);
    const fromMock = vi
      .fn()
      .mockReturnValueOnce({ select: richChain.selectMock })
      .mockReturnValueOnce({ select: legacyChain.selectMock });

    getSupabaseAdminMock.mockReturnValue({ from: fromMock });

    const req = { method: "GET", query: { userId: "user-legacy" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      userId: "user-legacy",
      limit: 20,
      source: null,
      transactions: [
        {
          id: "legacy-1",
          userId: "user-legacy",
          changeCents: -15,
          reason: "legacy debit",
          source: "legacy",
          sourceRef: "legacy-ref-1",
          pricingBreakdown: null,
          createdAt: "2026-02-15T17:20:00.000Z",
        },
      ],
    });
    expect(richLimitMock).toHaveBeenCalledWith(20);
    expect(legacyLimitMock).toHaveBeenCalledWith(20);
  });

  it("returns empty results for source filtering on legacy schemas", async () => {
    const richLimitMock = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "42703",
        message: "column ai_credit_ledger.source does not exist",
      },
    });
    const richChain = buildLedgerQueryChain(richLimitMock);
    const fromMock = vi.fn().mockReturnValueOnce({ select: richChain.selectMock });
    getSupabaseAdminMock.mockReturnValue({ from: fromMock });

    const req = {
      method: "GET",
      query: { userId: "user-legacy", source: "generation_charge" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      userId: "user-legacy",
      limit: 20,
      source: "generation_charge",
      transactions: [],
    });
    expect(fromMock).toHaveBeenCalledTimes(1);
  });
});
