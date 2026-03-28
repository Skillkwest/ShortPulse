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

const createFallbackGenerationQueryBuilder = (rows: unknown[]) => {
  const baseError = { message: "column ai_generations.recovery_state does not exist" };
  const legacyBuilder: Record<string, unknown> = {};
  legacyBuilder.eq = vi.fn(() => legacyBuilder);
  legacyBuilder.in = vi.fn(() => legacyBuilder);
  legacyBuilder.contains = vi.fn(() => legacyBuilder);
  legacyBuilder.order = vi.fn(() => legacyBuilder);
  legacyBuilder.limit = vi.fn(async () => ({ data: rows, error: null }));

  const primaryBuilder: Record<string, unknown> = {};
  primaryBuilder.eq = vi.fn(() => primaryBuilder);
  primaryBuilder.in = vi.fn(() => primaryBuilder);
  primaryBuilder.contains = vi.fn(() => primaryBuilder);
  primaryBuilder.order = vi.fn(() => primaryBuilder);
  primaryBuilder.limit = vi.fn(async () => ({ data: null, error: baseError }));

  return {
    select: vi.fn((fields: string) =>
      fields.includes("recovery_state") ? primaryBuilder : legacyBuilder
    ),
  };
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
    const attemptRow = {
      id: "attempt-1",
      generation_id: "gen-1",
      provider_request_id: "req-1",
      created_at: "2026-02-19T13:02:30.000Z",
    };
    const outputRow = {
      id: "output-1",
      generation_id: "gen-1",
      media_file_id: "file-1",
      created_at: "2026-02-19T13:02:45.000Z",
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
          case "generation_attempts":
            return createQueryBuilder([attemptRow]);
          case "ai_generation_outputs":
            return createQueryBuilder([outputRow]);
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
          attempts: 1,
          outputs: 1,
          mediaEvents: 1,
          mediaFiles: 1,
          reservations: 1,
          ledgerEntries: 1,
          errorEvents: 1,
        },
      })
    );
  });

  it("expands trace lookup through generation_attempts when ai_generations.request_id is missing", async () => {
    const generationRow = {
      id: "gen-attempt-1",
      user_id: "user-1",
      request_id: null,
      status: "success",
      metadata: {},
      created_at: "2026-02-19T14:00:00.000Z",
    };
    const attemptRow = {
      id: "attempt-trace-1",
      generation_id: "gen-attempt-1",
      provider_request_id: "req-attempt-1",
      created_at: "2026-02-19T14:01:00.000Z",
    };
    const outputRow = {
      id: "output-trace-1",
      generation_id: "gen-attempt-1",
      media_file_id: "file-trace-1",
      created_at: "2026-02-19T14:02:00.000Z",
    };
    const mediaFileRow = {
      id: "file-trace-1",
      source_ref: null,
      created_at: "2026-02-19T14:03:00.000Z",
    };

    let aiGenerationsSelectCount = 0;
    getSupabaseAdminMock.mockReturnValue({
      from: (table: string) => {
        switch (table) {
          case "ai_generations":
            return {
              select: vi.fn(() => {
                aiGenerationsSelectCount += 1;
                if (aiGenerationsSelectCount === 1) {
                  return {
                    eq: vi.fn(() => ({
                      limit: vi.fn(async () => ({ data: [], error: null })),
                    })),
                  };
                }
                return {
                  in: vi.fn(() => ({
                    limit: vi.fn(async () => ({ data: [generationRow], error: null })),
                  })),
                };
              }),
            };
          case "generation_attempts":
            return createQueryBuilder([attemptRow]);
          case "ai_generation_outputs":
            return createQueryBuilder([outputRow]);
          case "media_files":
            return createQueryBuilder([mediaFileRow]);
          default:
            return createQueryBuilder([]);
        }
      },
    });

    const req = { method: "GET", query: { requestId: "req-attempt-1" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: expect.objectContaining({
          generations: 1,
          attempts: 1,
          outputs: 1,
          mediaFiles: 1,
        }),
        generationAttempts: expect.arrayContaining([
          expect.objectContaining({ provider_request_id: "req-attempt-1" }),
        ]),
        generationOutputs: expect.arrayContaining([
          expect.objectContaining({ media_file_id: "file-trace-1" }),
        ]),
      })
    );
  });

  it("resolves generations by source_ref when traceId matches submit source reference", async () => {
    const generationRow = {
      id: "gen-trace-1",
      user_id: "user-1",
      request_id: "req-trace-1",
      status: "pending",
      metadata: {
        source_ref: "src-trace-1",
      },
      created_at: "2026-02-19T13:10:00.000Z",
    };

    getSupabaseAdminMock.mockReturnValue({
      from: (table: string) => {
        switch (table) {
          case "ai_generations":
            return createQueryBuilder([generationRow]);
          default:
            return createQueryBuilder([]);
        }
      },
    });

    const req = { method: "GET", query: { traceId: "src-trace-1" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ traceId: "src-trace-1" }),
        summary: expect.objectContaining({
          generations: 1,
        }),
      })
    );
  });

  it("falls back when ai_generations recovery columns are missing", async () => {
    const generationRow = {
      id: "gen-fallback-1",
      user_id: "user-1",
      request_id: "req-fallback-1",
      status: "success",
      metadata: {},
      created_at: "2026-02-19T13:20:00.000Z",
    };

    getSupabaseAdminMock.mockReturnValue({
      from: (table: string) => {
        switch (table) {
          case "ai_generations":
            return createFallbackGenerationQueryBuilder([generationRow]);
          default:
            return createQueryBuilder([]);
        }
      },
    });

    const req = { method: "GET", query: { requestId: "req-fallback-1" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: expect.objectContaining({ generations: 1 }),
        warnings: expect.arrayContaining([
          expect.stringContaining("fell back to legacy ai_generations fields"),
        ]),
      })
    );
  });
});
