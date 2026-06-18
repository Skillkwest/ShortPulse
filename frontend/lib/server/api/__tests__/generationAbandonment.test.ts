import { beforeEach, describe, expect, it, vi } from "vitest";

const getSupabaseAdminMock = vi.fn();
const settleGenerationOutcomeMock = vi.fn();
const cleanupAudioCompanionArtMock = vi.fn();
const writeAppErrorLogMock = vi.fn();
const resolveGenerationLineageBySourceRefMock = vi.fn();
const resolveGenerationLineageByProviderRequestMock = vi.fn();

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../generationBilling", () => ({
  settleGenerationOutcome: (...args: unknown[]) => settleGenerationOutcomeMock(...args),
}));

vi.mock("../generationLineageResolver", () => ({
  resolveGenerationLineageBySourceRef: (...args: unknown[]) =>
    resolveGenerationLineageBySourceRefMock(...args),
  resolveGenerationLineageByProviderRequest: (...args: unknown[]) =>
    resolveGenerationLineageByProviderRequestMock(...args),
}));

vi.mock("../../audioCompanionArt/cleanup", () => ({
  cleanupAudioCompanionArt: (...args: unknown[]) => cleanupAudioCompanionArtMock(...args),
}));

vi.mock("../appErrorLogs", () => ({
  writeAppErrorLog: (...args: unknown[]) => writeAppErrorLogMock(...args),
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
    cleanupAudioCompanionArtMock.mockResolvedValue({
      clearedProjection: false,
      deletedStoragePath: "user-1/generations/audio/gen-1/companion-art/cover.webp",
      storageDeleted: true,
    });
    writeAppErrorLogMock.mockResolvedValue({ ok: true, skipped: false, id: "evt-1" });
    resolveGenerationLineageBySourceRefMock.mockResolvedValue(null);
    resolveGenerationLineageByProviderRequestMock.mockResolvedValue(null);
  });

  it("suppresses active generation visibility without rewriting provider lifecycle", async () => {
    const supabase = createSupabaseMock({ generationStatus: "running" });
    getSupabaseAdminMock.mockReturnValue(supabase.client);
    resolveGenerationLineageBySourceRefMock.mockResolvedValueOnce({
      generationId: "gen-1",
      requestId: "req-1",
      sourceRef: "source-1",
    });

    const result = await recordGenerationAbandonment({
      userId: "user-1",
      sourceRef: "source-1",
      requestId: "req-1",
      noRefund: true,
    });

    expect(result).toEqual({
      abandonmentId: null,
      matchedGenerationIds: ["gen-1"],
    });
    expect(resolveGenerationLineageBySourceRefMock).toHaveBeenCalledWith({
      userId: "user-1",
      sourceRef: "source-1",
      supabaseAdmin: supabase.client,
    });
    expect(supabase.updates.generations).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          source_ref: "source-1",
          reference_grid_suppressed: true,
          reference_grid_suppression_reason: "reference_grid_clear",
          hidden_in_reference_grid: true,
        }),
      })
    );
    expect(supabase.updates.generations).not.toHaveBeenCalledWith(
      expect.objectContaining({
        status: "fail",
        failure_reason_code: "user_abandoned",
        recovery_state: "exhausted",
      })
    );
    expect(supabase.updates.attempts).not.toHaveBeenCalled();
    expect(supabase.updates.projections).toHaveBeenCalledWith(
      expect.objectContaining({
        companion_art_status: null,
        companion_art_storage_path: null,
        hidden_in_reference_grid: true,
        reference_grid_visible: false,
        publication_state: "suppressed",
      })
    );
    expect(cleanupAudioCompanionArtMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        userId: "user-1",
        clearProjection: false,
      })
    );
    expect(settleGenerationOutcomeMock).not.toHaveBeenCalled();
    expect(writeAppErrorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.generation.visibility_suppressed",
        userId: "user-1",
        requestId: "req-1",
        metadata: expect.objectContaining({
          lifecycle_preserved: true,
        }),
      })
    );
  });

  it("suppresses by request id through shared lineage without rewriting provider lifecycle", async () => {
    const supabase = createSupabaseMock({ generationStatus: "running" });
    getSupabaseAdminMock.mockReturnValue(supabase.client);
    resolveGenerationLineageByProviderRequestMock.mockResolvedValueOnce({
      generationId: "gen-1",
      requestId: "req-1",
      sourceRef: null,
    });

    const result = await recordGenerationAbandonment({
      userId: "user-1",
      requestId: "req-1",
      noRefund: true,
    });

    expect(result.matchedGenerationIds).toEqual(["gen-1"]);
    expect(resolveGenerationLineageByProviderRequestMock).toHaveBeenCalledWith({
      userId: "user-1",
      providerRequestId: "req-1",
      supabaseAdmin: supabase.client,
    });
    expect(supabase.updates.generations).not.toHaveBeenCalledWith(
      expect.objectContaining({
        status: "fail",
        failure_reason_code: "user_abandoned",
        recovery_state: "exhausted",
      })
    );
    expect(supabase.updates.attempts).not.toHaveBeenCalled();
    expect(settleGenerationOutcomeMock).not.toHaveBeenCalled();
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
        companion_art_status: null,
        companion_art_storage_path: null,
        hidden_in_reference_grid: true,
        reference_grid_visible: false,
        publication_state: "suppressed",
      })
    );
    expect(cleanupAudioCompanionArtMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        userId: "user-1",
        clearProjection: false,
      })
    );
  });

  it("rejects non-explicit suppression reasons before touching lifecycle state", async () => {
    const supabase = createSupabaseMock({ generationStatus: "running" });
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    await expect(
      recordGenerationAbandonment({
        userId: "user-1",
        generationId: "gen-1",
        reason: "pagehide",
        noRefund: true,
      })
    ).rejects.toThrow("generation_visibility_suppression_reason_invalid");

    expect(supabase.updates.generations).not.toHaveBeenCalled();
    expect(supabase.updates.attempts).not.toHaveBeenCalled();
    expect(supabase.updates.projections).not.toHaveBeenCalled();
    expect(supabase.updates.publications).not.toHaveBeenCalled();
    expect(settleGenerationOutcomeMock).not.toHaveBeenCalled();
  });
});
