import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeGenerationRecovery } from "../recoveryExecution";

const getSupabaseAdminMock = vi.fn();
const readFalRuntimeFlagsMock = vi.fn();
const settleGenerationOutcomeMock = vi.fn();
const readExistingRecoveryMediaRowsMock = vi.fn();
const persistRecoveryMediaFilesForGenerationMock = vi.fn();
const probeGenerationProviderResultMock = vi.fn();

vi.mock("../../api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../api/falRuntimeFlags", () => ({
  readFalRuntimeFlags: (...args: unknown[]) => readFalRuntimeFlagsMock(...args),
}));

vi.mock("../../api/generationBilling", () => ({
  settleGenerationOutcome: (...args: unknown[]) => settleGenerationOutcomeMock(...args),
}));

vi.mock("../recoveryMediaPersistence", () => ({
  readExistingRecoveryMediaRows: (...args: unknown[]) => readExistingRecoveryMediaRowsMock(...args),
  persistRecoveryMediaFilesForGeneration: (...args: unknown[]) =>
    persistRecoveryMediaFilesForGenerationMock(...args),
}));

vi.mock("../../providerIntegration/recoveryProviderDispatcher", () => ({
  probeGenerationProviderResult: (...args: unknown[]) => probeGenerationProviderResultMock(...args),
}));

const createAiGenerationsAdmin = (
  rows: Array<Record<string, unknown>>,
  options?: {
    mediaAutosaveEnabled?: boolean;
    userPreferenceError?: { code?: string; message?: string } | null;
  }
) => {
  const selectResponses = rows.map((row) => ({ data: [row], error: null }));
  const updatePayloads: Array<Record<string, unknown>> = [];
  const mediaEventInserts: Array<Record<string, unknown>> = [];

  const table = {
    select: vi.fn(() => {
      const builder: Record<string, unknown> = {};
      builder.eq = vi.fn(() => builder);
      builder.order = vi.fn(() => builder);
      builder.limit = vi.fn(async () => selectResponses.shift() ?? { data: [], error: null });
      return builder;
    }),
    update: vi.fn((payload: Record<string, unknown>) => {
      updatePayloads.push(payload);
      const eqSecond = vi.fn(async () => ({ error: null }));
      return {
        eq: vi.fn(() => ({
          eq: eqSecond,
        })),
      };
    }),
  };

  const userPreferencesTable = {
    select: vi.fn(() => {
      const builder: Record<string, unknown> = {};
      builder.eq = vi.fn(() => builder);
      builder.maybeSingle = vi.fn(async () => ({
        data:
          options?.userPreferenceError == null
            ? { media_autosave_enabled: options?.mediaAutosaveEnabled ?? true }
            : null,
        error: options?.userPreferenceError ?? null,
      }));
      return builder;
    }),
  };

  const mediaEventsTable = {
    insert: vi.fn(async (payload: Record<string, unknown>) => {
      mediaEventInserts.push(payload);
      return { error: null };
    }),
  };

  const from = vi.fn((tableName: string) => {
    if (tableName === "ai_generations") return table;
    if (tableName === "user_preferences") return userPreferencesTable;
    if (tableName === "media_events") return mediaEventsTable;
    throw new Error(`unexpected table ${tableName}`);
  });

  return {
    admin: { from },
    updatePayloads,
    mediaEventInserts,
  };
};

const baseGenerationRow = {
  id: "gen-1",
  created_at: "2026-02-20T00:00:00.000Z",
  user_id: "user-1",
  request_id: "req-1",
  model_id: "fal-ai/nano-banana-pro",
  provider: "fal",
  mode: "image",
  prompt_text: "cinematic portrait",
  status: "running",
  metadata: { existing: true },
  recovery_attempts: 1,
  recovery_state: "recovering",
  failure_reason_code: null,
  completed_at: null,
};

describe("executeGenerationRecovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readFalRuntimeFlagsMock.mockReturnValue({
      reconcilerMaxAttempts: 3,
      runningExhaustMinAgeSeconds: 7200,
    });
    settleGenerationOutcomeMock.mockResolvedValue(undefined);
    readExistingRecoveryMediaRowsMock.mockResolvedValue([]);
    persistRecoveryMediaFilesForGenerationMock.mockResolvedValue(["media-1"]);
    probeGenerationProviderResultMock.mockResolvedValue({
      state: "running",
      payload: null,
      mediaUrls: [],
    });
  });

  it("returns already persisted without extra writes when generation is already success with media", async () => {
    const scenario = createAiGenerationsAdmin([
      {
        ...baseGenerationRow,
        status: "success",
      },
    ]);
    getSupabaseAdminMock.mockReturnValue(scenario.admin);
    readExistingRecoveryMediaRowsMock.mockResolvedValue([{ id: "media-1", index: 0 }]);

    const result = await executeGenerationRecovery({
      actor: "status_proxy",
      generationId: "gen-1",
      routeLabel: "test/recovery",
    });

    expect(result).toEqual({
      ok: true,
      state: "already_persisted",
      generationId: "gen-1",
      requestId: "req-1",
      mediaFileIds: ["media-1"],
      mediaUrls: [],
      processed: false,
    });
    expect(scenario.updatePayloads).toHaveLength(0);
    expect(settleGenerationOutcomeMock).not.toHaveBeenCalled();
    expect(probeGenerationProviderResultMock).not.toHaveBeenCalled();
  });

  it("marks running recovery as exhausted when attempts reached max", async () => {
    const scenario = createAiGenerationsAdmin([
      {
        ...baseGenerationRow,
        recovery_attempts: 3,
      },
    ]);
    getSupabaseAdminMock.mockReturnValue(scenario.admin);

    const result = await executeGenerationRecovery({
      actor: "reconciler",
      generationId: "gen-1",
      routeLabel: "test/recovery",
      maxAttempts: 3,
      observation: {
        state: "running",
        payload: null,
        mediaUrls: [],
      },
    });

    expect(result.state).toBe("exhausted");
    expect(result.processed).toBe(true);
    expect(scenario.updatePayloads).toHaveLength(1);
    expect(scenario.updatePayloads[0]).toEqual(
      expect.objectContaining({
        status: "fail",
        completed_at: expect.any(String),
        recovery_state: "exhausted",
        failure_reason_code: "recovery_exhausted",
        next_recovery_at: null,
      })
    );
    expect(settleGenerationOutcomeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "fail",
        reason: "Provider remained running after recovery attempts were exhausted.",
      })
    );
    expect(persistRecoveryMediaFilesForGenerationMock).not.toHaveBeenCalled();
  });

  it("defers running exhaustion when attempts reached max but generation age is below minimum threshold", async () => {
    const scenario = createAiGenerationsAdmin([
      {
        ...baseGenerationRow,
        created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        recovery_attempts: 3,
      },
    ]);
    getSupabaseAdminMock.mockReturnValue(scenario.admin);

    const result = await executeGenerationRecovery({
      actor: "reconciler",
      generationId: "gen-1",
      routeLabel: "test/recovery",
      maxAttempts: 3,
      observation: {
        state: "running",
        payload: null,
        mediaUrls: [],
      },
    });

    expect(result.state).toBe("provider_running");
    expect(result.processed).toBe(true);
    expect(scenario.updatePayloads).toHaveLength(1);
    expect(scenario.updatePayloads[0]).toEqual(
      expect.objectContaining({
        recovery_state: "queued",
        failure_reason_code: null,
        recovery_attempts: 2,
      })
    );
    expect(typeof scenario.updatePayloads[0]?.next_recovery_at).toBe("string");
    expect(settleGenerationOutcomeMock).not.toHaveBeenCalled();
  });

  it("keeps monotonic behavior by skipping fail->success when transition is not allowed", async () => {
    const scenario = createAiGenerationsAdmin([
      {
        ...baseGenerationRow,
        status: "fail",
        failure_reason_code: "provider_error",
        recovery_state: "queued",
      },
    ]);
    getSupabaseAdminMock.mockReturnValue(scenario.admin);

    const result = await executeGenerationRecovery({
      actor: "webhook",
      generationId: "gen-1",
      routeLabel: "test/recovery",
      observation: {
        state: "completed",
        payload: null,
        mediaUrls: ["https://cdn.shortpulse.test/recovered.png"],
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        state: "skipped",
        processed: false,
        note: "transition_blocked",
        mediaUrls: ["https://cdn.shortpulse.test/recovered.png"],
      })
    );
    expect(scenario.updatePayloads).toHaveLength(0);
    expect(settleGenerationOutcomeMock).not.toHaveBeenCalled();
    expect(persistRecoveryMediaFilesForGenerationMock).not.toHaveBeenCalled();
  });

  it("allows fail->success recovery when terminal_success_no_media was previously queued", async () => {
    const scenario = createAiGenerationsAdmin([
      {
        ...baseGenerationRow,
        status: "fail",
        failure_reason_code: "terminal_success_no_media",
        recovery_state: "queued",
      },
    ]);
    getSupabaseAdminMock.mockReturnValue(scenario.admin);
    persistRecoveryMediaFilesForGenerationMock.mockResolvedValue(["media-1", "media-2"]);

    const result = await executeGenerationRecovery({
      actor: "webhook",
      generationId: "gen-1",
      routeLabel: "test/recovery",
      observation: {
        state: "completed",
        payload: null,
        mediaUrls: ["https://cdn.shortpulse.test/recovered.png"],
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        state: "recovered",
        processed: true,
        mediaFileIds: ["media-1", "media-2"],
      })
    );
    expect(persistRecoveryMediaFilesForGenerationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generation: expect.objectContaining({ id: "gen-1" }),
        mediaUrls: ["https://cdn.shortpulse.test/recovered.png"],
      })
    );
    expect(settleGenerationOutcomeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "success",
      })
    );
    expect(scenario.updatePayloads).toHaveLength(1);
    expect(scenario.updatePayloads[0]).toEqual(
      expect.objectContaining({
        status: "success",
        recovery_state: "recovered",
      })
    );
    expect(scenario.mediaEventInserts).toHaveLength(1);
    expect(scenario.mediaEventInserts[0]).toEqual(
      expect.objectContaining({
        event_type: "generation_autosave_decision",
        entity_type: "ai_generation",
        entity_id: "gen-1",
        metadata: expect.objectContaining({
          autosave_enabled: true,
          autosave_decision: "auto_persisted",
          decision_reason: "auto_allowed",
          actor: "webhook",
        }),
      })
    );
  });

  it("skips persistence when media autosave preference is off and still settles success", async () => {
    const scenario = createAiGenerationsAdmin(
      [
        {
          ...baseGenerationRow,
          status: "running",
          failure_reason_code: "terminal_success_no_media",
          recovery_state: "queued",
        },
      ],
      { mediaAutosaveEnabled: false }
    );
    getSupabaseAdminMock.mockReturnValue(scenario.admin);

    const result = await executeGenerationRecovery({
      actor: "reconciler",
      generationId: "gen-1",
      routeLabel: "test/recovery",
      observation: {
        state: "completed",
        payload: null,
        mediaUrls: ["https://cdn.shortpulse.test/recovered.png"],
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        state: "recovered",
        processed: true,
        mediaFileIds: [],
        mediaUrls: ["https://cdn.shortpulse.test/recovered.png"],
        note: "autosave_skipped",
      })
    );
    expect(persistRecoveryMediaFilesForGenerationMock).not.toHaveBeenCalled();
    expect(settleGenerationOutcomeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "success",
        reason: "Generation recovered; autosave skipped by user preference.",
        detail: expect.objectContaining({
          autosave_enabled: false,
          autosave_decision: "autosave_skipped",
          decision_reason: "autosave_disabled",
        }),
      })
    );
    expect(scenario.updatePayloads).toHaveLength(1);
    expect(scenario.updatePayloads[0]).toEqual(
      expect.objectContaining({
        status: "success",
        recovery_state: "recovered",
        metadata: expect.objectContaining({
          autosave_enabled: false,
          autosave_decision: "autosave_skipped",
          autosave_decision_reason: "autosave_disabled",
          autosave_skipped: true,
        }),
      })
    );
    expect(scenario.mediaEventInserts).toHaveLength(1);
    expect(scenario.mediaEventInserts[0]).toEqual(
      expect.objectContaining({
        event_type: "generation_autosave_decision",
        metadata: expect.objectContaining({
          autosave_enabled: false,
          autosave_decision: "autosave_skipped",
          decision_reason: "autosave_disabled",
          actor: "reconciler",
        }),
      })
    );
  });

  it("records no-media terminal outcome and schedules another attempt when under max", async () => {
    const scenario = createAiGenerationsAdmin([
      {
        ...baseGenerationRow,
        status: "running",
        recovery_attempts: 1,
      },
    ]);
    getSupabaseAdminMock.mockReturnValue(scenario.admin);

    const result = await executeGenerationRecovery({
      actor: "reconciler",
      generationId: "gen-1",
      routeLabel: "test/recovery",
      maxAttempts: 5,
      observation: {
        state: "completed",
        payload: null,
        mediaUrls: [],
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        state: "no_media",
        processed: true,
      })
    );
    expect(settleGenerationOutcomeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "fail",
      })
    );
    expect(scenario.updatePayloads).toHaveLength(1);
    expect(scenario.updatePayloads[0]).toEqual(
      expect.objectContaining({
        status: "fail",
        failure_reason_code: "terminal_success_no_media",
        recovery_state: "queued",
      })
    );
    expect(typeof scenario.updatePayloads[0]?.next_recovery_at).toBe("string");
  });

  it("marks missing request id as exhausted with recovery_exhausted reason", async () => {
    const scenario = createAiGenerationsAdmin([
      {
        ...baseGenerationRow,
        request_id: null,
      },
    ]);
    getSupabaseAdminMock.mockReturnValue(scenario.admin);

    const result = await executeGenerationRecovery({
      actor: "reconciler",
      generationId: "gen-1",
      routeLabel: "test/recovery",
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        state: "exhausted",
        requestId: null,
        processed: true,
        note: "missing_request_id",
      })
    );
    expect(scenario.updatePayloads).toHaveLength(1);
    expect(scenario.updatePayloads[0]).toEqual({
      recovery_state: "exhausted",
      failure_reason_code: "recovery_exhausted",
      next_recovery_at: null,
      last_recovery_at: expect.any(String),
    });
    expect(settleGenerationOutcomeMock).not.toHaveBeenCalled();
  });

  it("settles success and marks recovered when media already exists on non-success generation", async () => {
    const scenario = createAiGenerationsAdmin([
      {
        ...baseGenerationRow,
        status: "running",
      },
    ]);
    getSupabaseAdminMock.mockReturnValue(scenario.admin);
    readExistingRecoveryMediaRowsMock.mockResolvedValue([{ id: "media-1", index: 0 }]);

    const result = await executeGenerationRecovery({
      actor: "webhook",
      generationId: "gen-1",
      routeLabel: "test/recovery",
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        state: "already_persisted",
        processed: true,
        mediaFileIds: ["media-1"],
      })
    );
    expect(settleGenerationOutcomeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "success",
      })
    );
    expect(scenario.updatePayloads).toHaveLength(1);
    expect(scenario.updatePayloads[0]).toEqual(
      expect.objectContaining({
        status: "success",
        recovery_state: "recovered",
        next_recovery_at: null,
        failure_reason_code: null,
        last_recovery_at: expect.any(String),
        last_media_detected_at: expect.any(String),
        completed_at: expect.any(String),
      })
    );
  });

  it("records provider failed terminal state and exhausts recovery", async () => {
    const scenario = createAiGenerationsAdmin([
      {
        ...baseGenerationRow,
        status: "running",
      },
    ]);
    getSupabaseAdminMock.mockReturnValue(scenario.admin);

    const result = await executeGenerationRecovery({
      actor: "webhook",
      generationId: "gen-1",
      routeLabel: "test/recovery",
      observation: {
        state: "failed",
        payload: null,
        mediaUrls: [],
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        state: "provider_failed",
        processed: true,
      })
    );
    expect(settleGenerationOutcomeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "fail",
      })
    );
    expect(scenario.updatePayloads).toHaveLength(1);
    expect(scenario.updatePayloads[0]).toEqual({
      status: "fail",
      completed_at: expect.any(String),
      failure_reason_code: "provider_error",
      recovery_state: "exhausted",
      last_recovery_at: expect.any(String),
      next_recovery_at: null,
    });
  });

  it("records no-media as exhausted when attempts hit max threshold", async () => {
    const scenario = createAiGenerationsAdmin([
      {
        ...baseGenerationRow,
        status: "running",
        recovery_attempts: 5,
      },
    ]);
    getSupabaseAdminMock.mockReturnValue(scenario.admin);

    const result = await executeGenerationRecovery({
      actor: "reconciler",
      generationId: "gen-1",
      routeLabel: "test/recovery",
      maxAttempts: 5,
      observation: {
        state: "completed",
        payload: null,
        mediaUrls: [],
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        state: "exhausted",
        processed: true,
      })
    );
    expect(scenario.updatePayloads).toHaveLength(1);
    expect(scenario.updatePayloads[0]).toEqual({
      status: "fail",
      completed_at: expect.any(String),
      failure_reason_code: "terminal_success_no_media",
      recovery_state: "exhausted",
      last_recovery_at: expect.any(String),
      next_recovery_at: null,
    });
  });

  it("hydrates kie observation via provider probe when observation is omitted", async () => {
    process.env.KIE_API_KEY = "kie-test-key";
    const scenario = createAiGenerationsAdmin([
      {
        ...baseGenerationRow,
        provider: "kie",
        model_id: "kie-ai/kling-3.0",
        recovery_attempts: 1,
      },
    ]);
    getSupabaseAdminMock.mockReturnValue(scenario.admin);
    probeGenerationProviderResultMock.mockResolvedValue({
      state: "running",
      payload: null,
      mediaUrls: [],
    });

    const result = await executeGenerationRecovery({
      actor: "reconciler",
      generationId: "gen-1",
      routeLabel: "test/recovery",
      maxAttempts: 5,
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        state: "provider_running",
        processed: true,
      })
    );
    expect(probeGenerationProviderResultMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "kie",
        modelId: "kie-ai/kling-3.0",
        requestId: "req-1",
        apiKey: "kie-test-key",
      })
    );
    expect(scenario.updatePayloads).toHaveLength(1);
    expect(scenario.updatePayloads[0]).toEqual(
      expect.objectContaining({
        recovery_state: "queued",
        failure_reason_code: null,
        next_recovery_at: expect.any(String),
      })
    );
    delete process.env.KIE_API_KEY;
  });

  it("recovers kie generation using model-aware payload media urls", async () => {
    const scenario = createAiGenerationsAdmin([
      {
        ...baseGenerationRow,
        provider: "kie",
        model_id: "kie-ai/veo-3.1-fast-i2v",
        status: "running",
      },
    ]);
    getSupabaseAdminMock.mockReturnValue(scenario.admin);
    persistRecoveryMediaFilesForGenerationMock.mockResolvedValue(["kie-media-1"]);

    const result = await executeGenerationRecovery({
      actor: "webhook",
      generationId: "gen-1",
      routeLabel: "test/recovery",
      observation: {
        state: "completed",
        payload: {
          videos: [{ url: "https://cdn.shortpulse.test/kie-output.mp4" }],
        },
        mediaUrls: [],
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        state: "recovered",
        processed: true,
        mediaFileIds: ["kie-media-1"],
        mediaUrls: ["https://cdn.shortpulse.test/kie-output.mp4"],
      })
    );
    expect(persistRecoveryMediaFilesForGenerationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generation: expect.objectContaining({
          provider: "kie",
          model_id: "kie-ai/veo-3.1-fast-i2v",
        }),
        mediaUrls: ["https://cdn.shortpulse.test/kie-output.mp4"],
      })
    );
    expect(settleGenerationOutcomeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "success",
      })
    );
    expect(scenario.updatePayloads).toHaveLength(1);
    expect(scenario.updatePayloads[0]).toEqual(
      expect.objectContaining({
        status: "success",
        recovery_state: "recovered",
      })
    );
  });
});
