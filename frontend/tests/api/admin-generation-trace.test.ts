import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/generation-trace";

const requireAdminUserMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const createQueryBuilder = (rows: unknown[]) => {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.contains = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(async () => ({ data: rows, error: null }));
  return builder;
};

describe("GET /api/admin/generation-trace", () => {
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

  it("requires at least one query identifier", async () => {
    const req = { method: "GET", query: {} };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Provide at least one of generationId, requestId, or traceId.",
    });
  });

  it("returns aggregated timeline data for a request id", async () => {
    const generationRow = {
      id: "gen-1",
      user_id: "user-1",
      request_id: "req-1",
      status: "running",
      metadata: {
        generation_trace_id: "req-1",
      },
      created_at: "2026-02-19T13:00:00.000Z",
    };
    const mediaEventRow = {
      id: "evt-1",
      entity_type: "ai_generation",
      entity_id: "gen-1",
      created_at: "2026-02-19T13:01:00.000Z",
    };
    const mediaFileRow = {
      id: "file-1",
      source_ref: "gen-1",
      created_at: "2026-02-19T13:02:00.000Z",
    };
    const reservationRow = {
      id: "res-1",
      provider_request_id: "req-1",
      created_at: "2026-02-19T13:03:00.000Z",
    };
    const ledgerRow = {
      id: "ledger-1",
      source: "generation_charge",
      source_ref: "src-1",
      created_at: "2026-02-19T13:04:00.000Z",
    };
    const errorEventRow = {
      id: "err-1",
      request_id: "req-1",
      created_at: "2026-02-19T13:05:00.000Z",
    };

    getSupabaseAdminMock.mockReturnValue({
      from: (table: string) => {
        switch (table) {
          case "ai_generations":
            return createQueryBuilder([generationRow]);
          case "media_events":
            return createQueryBuilder([mediaEventRow]);
          case "media_files":
            return createQueryBuilder([mediaFileRow]);
          case "ai_credit_reservations":
            return createQueryBuilder([reservationRow]);
          case "ai_credit_ledger":
            return createQueryBuilder([ledgerRow]);
          case "app_error_events":
            return createQueryBuilder([errorEventRow]);
          default:
            return createQueryBuilder([]);
        }
      },
    });

    const req = { method: "GET", query: { requestId: "req-1" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ requestId: "req-1" }),
        summary: {
          generations: 1,
          mediaEvents: 1,
          mediaFiles: 1,
          reservations: 1,
          ledgerEntries: 1,
          errorEvents: 1,
        },
      })
    );
  });
});
