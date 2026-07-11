import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/generation-trace";

const requireAdminUserMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const resolveGenerationLineageByProviderRequestMock = vi.fn();
const resolveGenerationLineageBySourceRefMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/generationLineageResolver", () => ({
  resolveGenerationLineageByProviderRequest: (...args: unknown[]) =>
    resolveGenerationLineageByProviderRequestMock(...args),
  resolveGenerationLineageBySourceRef: (...args: unknown[]) =>
    resolveGenerationLineageBySourceRefMock(...args),
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

const createOutputColumnGuardBuilder = (rows: unknown[]) => {
  const builder = createQueryBuilder(rows);
  const select = vi.fn((fields: string) => {
    if (fields.includes("storage_path") || fields.includes("source_url")) {
      throw new Error(`Dead ai_generation_outputs column selected: ${fields}`);
    }
    return builder;
  });
  return {
    select,
  };
};

const createIdOnlyGenerationBuilder = (rowsById: Record<string, unknown>) => ({
  select: vi.fn(() => {
    let selectedId: string | null = null;
    let shouldReturnRows = false;
    const builder: Record<string, unknown> = {};
    builder.eq = vi.fn((column: string, value: string) => {
      selectedId = value;
      shouldReturnRows = column === "id";
      return builder;
    });
    builder.in = vi.fn(() => {
      shouldReturnRows = false;
      return builder;
    });
    builder.contains = vi.fn(() => {
      shouldReturnRows = false;
      return builder;
    });
    builder.order = vi.fn(() => builder);
    builder.limit = vi.fn(async () => ({
      data: shouldReturnRows && selectedId && rowsById[selectedId] ? [rowsById[selectedId]] : [],
      error: null,
    }));
    return builder;
  }),
});

describe("GET /api/admin/generation-trace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
    resolveGenerationLineageByProviderRequestMock.mockResolvedValue({
      generationId: null,
      generationAttemptId: null,
      userId: null,
      modelId: null,
      sourceRef: null,
      requestId: null,
      providerRequestId: "",
      evidence: [],
      attemptLookupError: null,
    });
    resolveGenerationLineageBySourceRefMock.mockResolvedValue({
      generationId: null,
      generationAttemptId: null,
      userId: null,
      modelId: null,
      sourceRef: null,
      requestId: null,
      providerRequestId: "",
      evidence: [],
      attemptLookupError: null,
    });
  });

  it("rejects non-GET methods", async () => {
    const req = { method: "POST", query: {} };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("logs unexpected admin auth failures before trace queries run", async () => {
    requireAdminUserMock.mockRejectedValue(new Error("auth verifier exploded"));
    const supabaseAdmin = { from: vi.fn() };
    getSupabaseAdminMock.mockReturnValue(supabaseAdmin);

    const req = { method: "GET", query: { generationId: "gen-1" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "admin.generation_trace.auth",
      })
    );
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to load generation trace timeline." });
  });

  it("requires at least one query identifier", async () => {
    const req = { method: "GET", query: {} };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Provide at least one of generationId, requestId, traceId, or userId.",
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
          pricingObservabilityMismatches: 0,
          pricingPolicyConflicts: 0,
        },
      })
    );
  });

  it("counts pricing observability mismatches from returned metadata", async () => {
    const generationRow = {
      id: "gen-mismatch-1",
      user_id: "user-1",
      request_id: "req-mismatch-1",
      status: "success",
      metadata: {
        pricing_metadata: {
          pricing_observability: {
            mismatch: true,
          },
        },
      },
      created_at: "2026-02-19T13:00:00.000Z",
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

    const req = { method: "GET", query: { requestId: "req-mismatch-1" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: expect.objectContaining({
          pricingObservabilityMismatches: 1,
        }),
        pricingObservabilityMismatchRows: [
          expect.objectContaining({
            sourceType: "generation",
            rowId: "gen-mismatch-1",
            generationId: "gen-mismatch-1",
            requestId: "req-mismatch-1",
            displayedBilledCredits: null,
            actualBilledCredits: null,
            deltaCredits: null,
            mismatch: true,
          }),
        ],
      })
    );
  });

  it("surfaces pricing policy conflict error events by source_ref trace lookup", async () => {
    const pricingConflictEvent = {
      id: "err-pricing-conflict-1",
      source: "api.generation_billing_pricing_policy_conflict",
      scope: "api",
      severity: "warn",
      message:
        "Pricing changed before generation started. Refresh pricing and review the new amount.",
      endpoint: "/api/fal/submit",
      request_id: null,
      metadata: {
        code: "PRICING_POLICY_STALE",
        model_id: "fal-ai/nano-banana-2",
        source_ref: "source-ref-1",
        displayed_pricing_policy_version: 22,
        active_pricing_policy_version: 23,
        displayed_billed_credits: 5,
        active_billed_credits: 7,
        displayed_pricing_variant_id: "default|res:1K|aspect:auto",
        active_pricing_variant_id: "edit|res:1K|aspect:auto",
      },
      created_at: "2026-07-10T17:00:00.000Z",
    };

    getSupabaseAdminMock.mockReturnValue({
      from: (table: string) => {
        switch (table) {
          case "app_error_events":
            return createQueryBuilder([pricingConflictEvent]);
          default:
            return createQueryBuilder([]);
        }
      },
    });

    const req = { method: "GET", query: { traceId: "source-ref-1" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: expect.objectContaining({
          errorEvents: 1,
          pricingPolicyConflicts: 1,
        }),
        pricingPolicyConflictRows: [
          expect.objectContaining({
            rowId: "err-pricing-conflict-1",
            sourceRef: "source-ref-1",
            code: "PRICING_POLICY_STALE",
            modelId: "fal-ai/nano-banana-2",
            displayedBilledCredits: 5,
            activeBilledCredits: 7,
            displayedPricingPolicyVersion: 22,
            activePricingPolicyVersion: 23,
            displayedPricingVariantId: "default|res:1K|aspect:auto",
            activePricingVariantId: "edit|res:1K|aspect:auto",
          }),
        ],
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

  it("expands trace lookup through generation_projection when attempt lineage is missing", async () => {
    const generationRow = {
      id: "gen-projection-trace-1",
      user_id: "user-1",
      request_id: null,
      status: "success",
      metadata: {},
      created_at: "2026-02-19T15:00:00.000Z",
    };
    const projectionRow = {
      generation_id: "gen-projection-trace-1",
      source_ref: null,
      request_id: null,
      provider_request_id: "req-projection-trace-1",
      updated_at: "2026-02-19T15:01:00.000Z",
    };
    const outputRow = {
      id: "output-projection-trace-1",
      generation_id: "gen-projection-trace-1",
      media_file_id: "file-projection-trace-1",
      created_at: "2026-02-19T15:02:00.000Z",
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
            return createQueryBuilder([]);
          case "generation_projection":
            return createQueryBuilder([projectionRow]);
          case "ai_generation_outputs":
            return createQueryBuilder([outputRow]);
          default:
            return createQueryBuilder([]);
        }
      },
    });

    const req = { method: "GET", query: { requestId: "req-projection-trace-1" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: expect.objectContaining({
          generations: 1,
          attempts: 0,
          outputs: 1,
        }),
        generations: expect.arrayContaining([
          expect.objectContaining({ id: "gen-projection-trace-1" }),
        ]),
        generationOutputs: expect.arrayContaining([
          expect.objectContaining({ media_file_id: "file-projection-trace-1" }),
        ]),
      })
    );
  });

  it("uses live ai_generation_outputs columns in the trace query", async () => {
    const generationRow = {
      id: "gen-output-columns-1",
      user_id: "user-1",
      request_id: "req-output-columns-1",
      status: "success",
      metadata: {},
      created_at: "2026-02-19T14:10:00.000Z",
    };
    const outputRow = {
      id: "output-columns-1",
      generation_id: "gen-output-columns-1",
      result_url: "https://cdn.test/output.png",
      media_file_id: null,
      created_at: "2026-02-19T14:11:00.000Z",
    };
    const outputBuilder = createOutputColumnGuardBuilder([outputRow]);

    getSupabaseAdminMock.mockReturnValue({
      from: (table: string) => {
        switch (table) {
          case "ai_generations":
            return createQueryBuilder([generationRow]);
          case "ai_generation_outputs":
            return outputBuilder;
          default:
            return createQueryBuilder([]);
        }
      },
    });

    const req = { method: "GET", query: { requestId: "req-output-columns-1" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(outputBuilder.select).toHaveBeenCalledWith(expect.stringContaining("result_url"));
    expect(outputBuilder.select).not.toHaveBeenCalledWith(expect.stringContaining("storage_path"));
    expect(outputBuilder.select).not.toHaveBeenCalledWith(expect.stringContaining("source_url"));
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

  it("uses shared provider-request lineage when user-scoped admin trace direct lookups miss", async () => {
    const generationRow = {
      id: "gen-shared-provider-1",
      user_id: "user-1",
      request_id: null,
      status: "success",
      metadata: {},
      created_at: "2026-02-19T16:00:00.000Z",
    };
    resolveGenerationLineageByProviderRequestMock.mockResolvedValue({
      generationId: "gen-shared-provider-1",
      generationAttemptId: null,
      userId: "user-1",
      modelId: null,
      sourceRef: "source-shared-provider-1",
      requestId: "req-projection-provider-1",
      providerRequestId: "req-admin-provider-1",
      evidence: ["projection_provider_request_id"],
      attemptLookupError: null,
    });

    const supabaseAdmin = {
      from: (table: string) => {
        switch (table) {
          case "ai_generations":
            return createIdOnlyGenerationBuilder({ "gen-shared-provider-1": generationRow });
          default:
            return createQueryBuilder([]);
        }
      },
    };
    getSupabaseAdminMock.mockReturnValue(supabaseAdmin);

    const req = {
      method: "GET",
      query: { requestId: "req-admin-provider-1", userId: "user-1" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(resolveGenerationLineageByProviderRequestMock).toHaveBeenCalledWith({
      userId: "user-1",
      providerRequestId: "req-admin-provider-1",
      supabaseAdmin,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: expect.objectContaining({
          generations: 1,
        }),
        generations: expect.arrayContaining([
          expect.objectContaining({ id: "gen-shared-provider-1" }),
        ]),
      })
    );
  });

  it("uses shared source-ref lineage when user-scoped traceId direct lookups miss", async () => {
    const generationRow = {
      id: "gen-shared-source-1",
      user_id: "user-1",
      request_id: "req-shared-source-1",
      status: "running",
      metadata: {},
      created_at: "2026-02-19T16:10:00.000Z",
    };
    resolveGenerationLineageBySourceRefMock.mockResolvedValue({
      generationId: "gen-shared-source-1",
      generationAttemptId: null,
      userId: "user-1",
      modelId: null,
      sourceRef: "source-shared-1",
      requestId: "req-shared-source-1",
      providerRequestId: "",
      evidence: ["projection_source_ref"],
      attemptLookupError: null,
    });

    const supabaseAdmin = {
      from: (table: string) => {
        switch (table) {
          case "ai_generations":
            return createIdOnlyGenerationBuilder({ "gen-shared-source-1": generationRow });
          default:
            return createQueryBuilder([]);
        }
      },
    };
    getSupabaseAdminMock.mockReturnValue(supabaseAdmin);

    const req = {
      method: "GET",
      query: { traceId: "source-shared-1", userId: "user-1" },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(resolveGenerationLineageBySourceRefMock).toHaveBeenCalledWith({
      userId: "user-1",
      sourceRef: "source-shared-1",
      supabaseAdmin,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: expect.objectContaining({
          generations: 1,
        }),
        generations: expect.arrayContaining([
          expect.objectContaining({ id: "gen-shared-source-1" }),
        ]),
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
