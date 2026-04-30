import { beforeEach, describe, expect, it, vi } from "vitest";

const getSupabaseAdminMock = vi.fn();
const settleGenerationOutcomeMock = vi.fn();

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../generationBilling", () => ({
  settleGenerationOutcome: (...args: unknown[]) => settleGenerationOutcomeMock(...args),
}));

import { recordGenerationAbandonment } from "../generationAbandonment";

type QueryResult = { data?: unknown; error?: { message?: string } | null };

const createEqBuilder = (result: QueryResult) => {
  const resolved = { data: result.data ?? null, error: result.error ?? null };
  const builder: Record<string, unknown> = {
    error: result.error ?? null,
  };
  builder.eq = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => resolved);
  builder.then = (...args: Parameters<Promise<QueryResult>["then"]>) =>
    Promise.resolve(resolved).then(...args);
  builder.catch = (...args: Parameters<Promise<QueryResult>["catch"]>) =>
    Promise.resolve(resolved).catch(...args);
  builder.finally = (...args: Parameters<Promise<QueryResult>["finally"]>) =>
    Promise.resolve(resolved).finally(...args);
  return builder;
};

const createSelectBuilder = (result: QueryResult) => ({
  select: vi.fn(() => createEqBuilder(result)),
});

const createInsertBuilder = (result: QueryResult) => ({
  insert: vi.fn(() => ({
    select: vi.fn(() => ({
      maybeSingle: vi.fn(async () => ({
        data: result.data ?? null,
        error: result.error ?? null,
      })),
    })),
  })),
});

const createUpdateBuilder = (updateMock: (payload: unknown) => unknown) => ({
  update: vi.fn((payload: unknown) => {
    updateMock(payload);
    return createEqBuilder({ data: null, error: null });
  }),
});

const createSupabaseMock = ({ generationStatus }: { generationStatus: "running" | "success" }) => {
  const updates = {
    generations: vi.fn(),
    attempts: vi.fn(),
    projections: vi.fn(),
    publications: vi.fn(),
  };
  const from = vi.fn((table: string) => {
    if (table === "generation_abandonments") {
      return {
        ...createSelectBuilder({ data: null, error: null }),
        ...createInsertBuilder({ data: { id: "abandon-1" }, error: null }),
      };
    }
    if (table === "generation_projection") {
      return {
        ...createSelectBuilder({ data: [{ generation_id: "gen-1" }], error: null }),
        ...createUpdateBuilder(updates.projections),
      };
    }
    if (table === "ai_generations") {
      return {
        ...createSelectBuilder({
          data: {
            metadata: { source_ref: "source-1" },
            request_id: "req-1",
            status: generationStatus,
          },
          error: null,
        }),
        ...createUpdateBuilder(updates.generations),
      };
    }
    if (table === "generation_attempts") {
      return createUpdateBuilder(updates.attempts);
    }
    if (table === "generation_publications") {
      return createUpdateBuilder(updates.publications);
    }
    throw new Error(`Unexpected table: ${table}`);
  });
  return {
    client: { from },
    updates,
  };
};

describe("recordGenerationAbandonment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settleGenerationOutcomeMock.mockResolvedValue({
      settled: true,
      note: "abandoned_no_refund_captured",
    });
  });

  it("closes active abandoned generations and captures the no-refund settlement", async () => {
    const supabase = createSupabaseMock({ generationStatus: "running" });
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    const result = await recordGenerationAbandonment({
      userId: "user-1",
      sourceRef: "source-1",
      requestId: "req-1",
      noRefund: true,
    });

    expect(result).toEqual({
      abandonmentId: "abandon-1",
      matchedGenerationIds: ["gen-1"],
    });
    expect(supabase.updates.generations).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "fail",
        failure_reason_code: "user_abandoned",
        error_message: "Generation abandoned by user.",
        recovery_state: "exhausted",
        next_recovery_at: null,
      })
    );
    expect(supabase.updates.attempts).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "abandoned",
        error_message: "Generation abandoned by user.",
      })
    );
    expect(supabase.updates.projections).toHaveBeenCalledWith(
      expect.objectContaining({
        task_state: "fail",
        queue_state: "failed",
        hidden_in_reference_grid: true,
        reference_grid_visible: false,
        publication_state: "suppressed",
      })
    );
    expect(settleGenerationOutcomeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        providerRequestId: "req-1",
        outcome: "fail",
        abandonedNoRefund: true,
      })
    );
  });

  it("does not reopen or rewrite terminal generation status during suppression", async () => {
    const supabase = createSupabaseMock({ generationStatus: "success" });
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    await recordGenerationAbandonment({
      userId: "user-1",
      generationId: "gen-1",
      noRefund: true,
    });

    expect(supabase.updates.generations).toHaveBeenCalledWith(
      expect.not.objectContaining({
        status: "fail",
        recovery_state: "exhausted",
      })
    );
    expect(supabase.updates.attempts).not.toHaveBeenCalled();
    expect(settleGenerationOutcomeMock).not.toHaveBeenCalled();
    expect(supabase.updates.projections).toHaveBeenCalledWith(
      expect.objectContaining({
        hidden_in_reference_grid: true,
        reference_grid_visible: false,
        publication_state: "suppressed",
      })
    );
  });
});
