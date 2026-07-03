import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeGenerationRecovery } from "../recoveryExecution";

const getSupabaseAdminMock = vi.fn();
const readFalRuntimeFlagsMock = vi.fn();
const settleGenerationOutcomeMock = vi.fn();
const updateGenerationAttemptStateMock = vi.fn();
const writeAppErrorLogMock = vi.fn();
const readExistingRecoveryMediaRowsMock = vi.fn();
const persistRecoveryMediaFilesForGenerationMock = vi.fn();
const persistGenerationOutputRecordsMock = vi.fn();
const readPersistedGenerationOutputsMock = vi.fn();
const markGenerationOutputRowsVisibilitySettledMock = vi.fn();
const upsertGenerationProjectionMock = vi.fn();
const upsertGenerationPublicationMock = vi.fn();
const probeGenerationProviderResultMock = vi.fn();
const associateGenerationWithProjectForUserMock = vi.fn();
const associateGenerationWithProjectForUserBestEffortMock = vi.fn();

vi.mock("../../api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../api/falRuntimeFlags", () => ({
  readFalRuntimeFlags: (...args: unknown[]) => readFalRuntimeFlagsMock(...args),
}));

vi.mock("../../api/generationBilling", () => ({
  settleGenerationOutcome: (...args: unknown[]) => settleGenerationOutcomeMock(...args),
}));

vi.mock("../../api/generationAttempts", () => ({
  updateGenerationAttemptState: (...args: unknown[]) => updateGenerationAttemptStateMock(...args),
}));

vi.mock("../../api/generationOutputs", () => ({
  persistGenerationOutputRecords: (...args: unknown[]) =>
    persistGenerationOutputRecordsMock(...args),
  readPersistedGenerationOutputs: (...args: unknown[]) =>
    readPersistedGenerationOutputsMock(...args),
  markGenerationOutputRowsVisibilitySettled: (...args: unknown[]) =>
    markGenerationOutputRowsVisibilitySettledMock(...args),
}));

vi.mock("../../api/generationProjection", () => ({
  upsertGenerationProjection: (...args: unknown[]) => upsertGenerationProjectionMock(...args),
}));

vi.mock("../../api/generationPublications", () => ({
  upsertGenerationPublication: (...args: unknown[]) => upsertGenerationPublicationMock(...args),
}));

vi.mock("../../api/appErrorLogs", () => ({
  writeAppErrorLog: (...args: unknown[]) => writeAppErrorLogMock(...args),
}));

vi.mock("../recoveryMediaPersistence", () => ({
  readExistingRecoveryMediaRows: (...args: unknown[]) => readExistingRecoveryMediaRowsMock(...args),
  persistRecoveryMediaFilesForGeneration: (...args: unknown[]) =>
    persistRecoveryMediaFilesForGenerationMock(...args),
}));

vi.mock("../../providerIntegration/recoveryProviderDispatcher", () => ({
  probeGenerationProviderResult: (...args: unknown[]) => probeGenerationProviderResultMock(...args),
}));

vi.mock("../../projectGenerationAssociationsService", () => ({
  associateGenerationWithProjectForUser: (...args: unknown[]) =>
    associateGenerationWithProjectForUserMock(...args),
  associateGenerationWithProjectForUserBestEffort: (...args: unknown[]) =>
    associateGenerationWithProjectForUserBestEffortMock(...args),
}));

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const createAiGenerationsAdmin = (
  rows: Array<Record<string, unknown>>,
  options?: {
    mediaAutosaveEnabled?: boolean;
    userPreferenceError?: { code?: string; message?: string } | null;
    mediaRows?: Array<Record<string, unknown>>;
    abandonmentRow?: Record<string, unknown> | null;
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

  const generationAbandonmentsTable = {
    select: vi.fn(() => {
      const builder: Record<string, unknown> = {};
      builder.eq = vi.fn(() => builder);
      builder.limit = vi.fn(() => builder);
      builder.maybeSingle = vi.fn(async () => ({
        data: options?.abandonmentRow ?? null,
        error: null,
      }));
      return builder;
    }),
  };

  const mediaRows = options?.mediaRows ?? [
    {
      id: "media-1",
      user_id: "user-1",
      storage_path: "user-1/generations/images/media-1/full.png",
      preview_storage_path: "user-1/generations/images/media-1/preview.png",
      file_type: "image/png",
    },
    {
      id: "media-2",
      user_id: "user-1",
      storage_path: "user-1/generations/images/media-2/full.png",
      preview_storage_path: "user-1/generations/images/media-2/preview.png",
      file_type: "image/png",
    },
  ];

  const mediaFilesTable = {
    select: vi.fn(() => {
      const builder: Record<string, unknown> = {};
      builder.in = vi.fn(() => builder);
      builder.eq = vi.fn(() => builder);
      builder.limit = vi.fn(async () => ({ data: mediaRows, error: null }));
      return builder;
    }),
  };

  const from = vi.fn((tableName: string) => {
    if (tableName === "ai_generations") return table;
    if (tableName === "user_preferences") return userPreferencesTable;
    if (tableName === "media_events") return mediaEventsTable;
    if (tableName === "generation_abandonments") return generationAbandonmentsTable;
    if (tableName === "media_files") return mediaFilesTable;
    throw new Error(`unexpected table ${tableName}`);
  });

  return {
    admin: { from },
    aiGenerationsUpdateMock: table.update,
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
      noMediaExhaustMinAgeSeconds: 7200,
      runningExhaustMinAgeSeconds: 7200,
      runningHardTimeoutSeconds: 0,
    });
    settleGenerationOutcomeMock.mockResolvedValue({ settled: true, note: "captured" });
    updateGenerationAttemptStateMock.mockResolvedValue({ ok: true });
    writeAppErrorLogMock.mockResolvedValue({ ok: true, skipped: false, id: "evt-1" });
    readExistingRecoveryMediaRowsMock.mockResolvedValue([]);
    persistRecoveryMediaFilesForGenerationMock.mockResolvedValue(["media-1"]);
    persistGenerationOutputRecordsMock.mockResolvedValue([
      {
        id: "output-1",
        outputIndex: 0,
        resultUrl: "https://cdn.shortpulse.test/recovered.png",
        mediaFileId: null,
      },
    ]);
    readPersistedGenerationOutputsMock.mockResolvedValue([
      {
        id: "output-1",
        outputIndex: 0,
        resultUrl: "https://cdn.shortpulse.test/recovered.png",
        mediaFileId: null,
        metadata: {},
      },
    ]);
    markGenerationOutputRowsVisibilitySettledMock.mockImplementation(
      async ({ outputRows }: { outputRows: unknown[] }) => outputRows
    );
    upsertGenerationProjectionMock.mockResolvedValue(undefined);
    upsertGenerationPublicationMock.mockResolvedValue(undefined);
    associateGenerationWithProjectForUserMock.mockResolvedValue(true);
    associateGenerationWithProjectForUserBestEffortMock.mockImplementation(
      async ({
        userId,
        projectId,
        generationId,
        onError,
      }: {
        userId: string;
        projectId: string | null | undefined;
        generationId: string;
        onError?: (payload: { projectId: string; error: unknown }) => Promise<void> | void;
      }) => {
        try {
          return await associateGenerationWithProjectForUserMock({
            userId,
            projectId,
            generationId,
          });
        } catch (error) {
          await onError?.({
            projectId: typeof projectId === "string" ? projectId : "",
            error,
          });
          return false;
        }
      }
    );
    probeGenerationProviderResultMock.mockResolvedValue({
      state: "running",
      payload: null,
      mediaUrls: [],
    });
  });

  it("returns already persisted and backfills projection convergence when generation is already success with media", async () => {
    const scenario = createAiGenerationsAdmin([
      {
        ...baseGenerationRow,
        status: "success",
      },
    ]);
    getSupabaseAdminMock.mockReturnValue(scenario.admin);
    readExistingRecoveryMediaRowsMock.mockResolvedValue([{ id: "media-1", index: 0 }]);
    readPersistedGenerationOutputsMock.mockResolvedValue([
      {
        id: "output-1",
        outputIndex: 0,
        resultUrl: "https://cdn.shortpulse.test/already-persisted.png",
        mediaFileId: "media-1",
        metadata: {
          direct_terminal_visibility_state: "settlement_pending",
          recovery_visibility_state: "settlement_pending",
          keep_me: true,
        },
      },
    ]);
    markGenerationOutputRowsVisibilitySettledMock.mockResolvedValueOnce([
      {
        id: "output-1",
        outputIndex: 0,
        resultUrl: "https://cdn.shortpulse.test/already-persisted.png",
        mediaFileId: "media-1",
        metadata: {
          direct_terminal_visibility_state: "settlement_pending",
          recovery_visibility_state: "settled",
          keep_me: true,
        },
      },
    ]);
    markGenerationOutputRowsVisibilitySettledMock.mockResolvedValueOnce([
      {
        id: "output-1",
        outputIndex: 0,
        resultUrl: "https://cdn.shortpulse.test/already-persisted.png",
        mediaFileId: "media-1",
        metadata: {
          direct_terminal_visibility_state: "settled",
          recovery_visibility_state: "settled",
          keep_me: true,
        },
      },
    ]);

    const result = await executeGenerationRecovery({
      actor: "reconciler",
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
    expect(settleGenerationOutcomeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        providerRequestId: "req-1",
        outcome: "success",
        reason: "Recovered generation media already persisted.",
        detail: expect.objectContaining({
          actor: "reconciler",
          generation_id: "gen-1",
          existing_media_count: 1,
        }),
      })
    );
    expect(probeGenerationProviderResultMock).not.toHaveBeenCalled();
    expect(markGenerationOutputRowsVisibilitySettledMock).toHaveBeenNthCalledWith(1, {
      generationId: "gen-1",
      userId: "user-1",
      outputRows: [
        expect.objectContaining({
          metadata: expect.objectContaining({
            direct_terminal_visibility_state: "settlement_pending",
            recovery_visibility_state: "settlement_pending",
            keep_me: true,
          }),
        }),
      ],
      visibilityMetadataKey: "recovery_visibility_state",
    });
    expect(markGenerationOutputRowsVisibilitySettledMock).toHaveBeenNthCalledWith(2, {
      generationId: "gen-1",
      userId: "user-1",
      outputRows: [
        expect.objectContaining({
          metadata: expect.objectContaining({
            direct_terminal_visibility_state: "settlement_pending",
            recovery_visibility_state: "settled",
            keep_me: true,
          }),
        }),
      ],
      visibilityMetadataKey: "direct_terminal_visibility_state",
    });
    expect(settleGenerationOutcomeMock.mock.invocationCallOrder[0]).toBeLessThan(
      markGenerationOutputRowsVisibilitySettledMock.mock.invocationCallOrder[0]
    );
    expect(markGenerationOutputRowsVisibilitySettledMock.mock.invocationCallOrder[1]).toBeLessThan(
      upsertGenerationPublicationMock.mock.invocationCallOrder[0]
    );
    expect(upsertGenerationPublicationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        generationOutputId: "output-1",
        publicationState: "published",
      })
    );
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        taskState: "success",
        publicationState: "published",
        resultUrls: ["https://cdn.shortpulse.test/already-persisted.png"],
      })
    );
    expect(settleGenerationOutcomeMock.mock.invocationCallOrder[0]).toBeLessThan(
      upsertGenerationPublicationMock.mock.invocationCallOrder[0]
    );
    expect(settleGenerationOutcomeMock.mock.invocationCallOrder[0]).toBeLessThan(
      upsertGenerationProjectionMock.mock.invocationCallOrder[0]
    );
    expect(updateGenerationAttemptStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerRequestId: "req-1",
        userId: "user-1",
        status: "succeeded",
      })
    );
  });

  it("emits media-visible telemetry after successful recovery persistence", async () => {
    const scenario = createAiGenerationsAdmin([
      {
        ...baseGenerationRow,
        recovery_attempts: 2,
      },
    ]);
    getSupabaseAdminMock.mockReturnValue(scenario.admin);
    persistRecoveryMediaFilesForGenerationMock.mockResolvedValue(["media-1", "media-2"]);
    readPersistedGenerationOutputsMock.mockResolvedValue([
      {
        id: "output-1",
        outputIndex: 0,
        resultUrl: "https://cdn.shortpulse.test/recovered.png",
        mediaFileId: "media-1",
      },
    ]);

    const result = await executeGenerationRecovery({
      actor: "reconciler",
      generationId: "gen-1",
      routeLabel: "test/recovery",
      observation: {
        state: "completed",
        payload: {
          data: {
            images: [{ url: "https://cdn.shortpulse.test/generated-a.png" }],
          },
        },
        mediaUrls: ["https://cdn.shortpulse.test/generated-a.png"],
      },
    });

    expect(result.state).toBe("recovered");
    expect(writeAppErrorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.generation.recovery.media_visible",
        message: "media_visible",
        requestId: "req-1",
        userId: "user-1",
        metadata: expect.objectContaining({
          generation_id: "gen-1",
          provider_request_id: "req-1",
          model_id: "fal-ai/nano-banana-pro",
          provider: "fal",
          recovery_actor: "reconciler",
          recovery_attempts: 2,
          result_url_count: 1,
          media_file_count: 2,
          autosave_enabled: true,
          used_existing_media_rows: false,
          used_observation_payload: true,
          used_observation_media_urls: true,
        }),
      })
    );
  });

  it("associates recovered project-scoped generations with their project", async () => {
    const scenario = createAiGenerationsAdmin([
      {
        ...baseGenerationRow,
        metadata: {
          source_ref: "source-ref-1",
          shortpulse_context: {
            project_id: "project-1",
            project_id_present: true,
          },
        },
      },
    ]);
    getSupabaseAdminMock.mockReturnValue(scenario.admin);
    readPersistedGenerationOutputsMock.mockResolvedValue([
      {
        id: "output-1",
        outputIndex: 0,
        resultUrl: "https://cdn.shortpulse.test/recovered.png",
        mediaFileId: "media-1",
      },
    ]);

    const result = await executeGenerationRecovery({
      actor: "reconciler",
      generationId: "gen-1",
      routeLabel: "test/recovery",
      observation: {
        state: "completed",
        payload: {
          data: {
            images: [{ url: "https://cdn.shortpulse.test/generated-a.png" }],
          },
        },
        mediaUrls: ["https://cdn.shortpulse.test/generated-a.png"],
      },
    });

    expect(result.state).toBe("recovered");
    expect(associateGenerationWithProjectForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      projectId: "project-1",
      generationId: "gen-1",
    });
  });

  it("keeps recovered generations successful when project association telemetry fails", async () => {
    const scenario = createAiGenerationsAdmin([
      {
        ...baseGenerationRow,
        metadata: {
          source_ref: "source-ref-1",
          shortpulse_context: {
            project_id: "project-1",
          },
        },
      },
    ]);
    getSupabaseAdminMock.mockReturnValue(scenario.admin);
    readPersistedGenerationOutputsMock.mockResolvedValue([
      {
        id: "output-1",
        outputIndex: 0,
        resultUrl: "https://cdn.shortpulse.test/recovered.png",
        mediaFileId: "media-1",
      },
    ]);
    associateGenerationWithProjectForUserMock.mockRejectedValueOnce(
      new Error("project write failed")
    );

    const result = await executeGenerationRecovery({
      actor: "reconciler",
      generationId: "gen-1",
      routeLabel: "test/recovery",
      observation: {
        state: "completed",
        payload: {
          data: {
            images: [{ url: "https://cdn.shortpulse.test/generated-a.png" }],
          },
        },
        mediaUrls: ["https://cdn.shortpulse.test/generated-a.png"],
      },
    });

    expect(result.state).toBe("recovered");
    expect(writeAppErrorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.generation.recovery.project_association_failed",
        requestId: "req-1",
        userId: "user-1",
      })
    );
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

  it("recovers media-bearing running observations instead of requeueing provider_running", async () => {
    const scenario = createAiGenerationsAdmin([
      {
        ...baseGenerationRow,
        status: "running",
      },
    ]);
    getSupabaseAdminMock.mockReturnValue(scenario.admin);
    persistRecoveryMediaFilesForGenerationMock.mockResolvedValue(["media-1"]);

    const result = await executeGenerationRecovery({
      actor: "reconciler",
      generationId: "gen-1",
      routeLabel: "test/recovery",
      observation: {
        state: "running",
        payload: {
          data: {
            images: [{ url: "https://cdn.shortpulse.test/recovered-from-running.png" }],
          },
        },
        mediaUrls: [],
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        state: "recovered",
        processed: true,
        mediaFileIds: ["media-1"],
      })
    );
    expect(persistRecoveryMediaFilesForGenerationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaUrls: ["https://cdn.shortpulse.test/recovered-from-running.png"],
      })
    );
    expect(settleGenerationOutcomeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "success",
      })
    );
  });

  it("settles deterministic media persistence owner failures instead of requeueing", async () => {
    const scenario = createAiGenerationsAdmin([
      {
        ...baseGenerationRow,
        status: "running",
        recovery_attempts: 5,
      },
    ]);
    getSupabaseAdminMock.mockReturnValue(scenario.admin);
    persistRecoveryMediaFilesForGenerationMock.mockRejectedValue(
      new Error(
        'media_files insert failed: insert or update on table "media_files" violates foreign key constraint "media_files_user_id_fkey"'
      )
    );
    upsertGenerationProjectionMock.mockRejectedValueOnce({
      code: "23503",
      message:
        'insert or update on table "generation_projection" violates foreign key constraint "generation_projection_user_id_fkey"',
    });

    const result = await executeGenerationRecovery({
      actor: "reconciler",
      generationId: "gen-1",
      routeLabel: "test/recovery",
      maxAttempts: 5,
      observation: {
        state: "completed",
        payload: null,
        mediaUrls: ["https://cdn.shortpulse.test/recovered.png"],
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        state: "exhausted",
        processed: true,
        note: "media_persistence_failed",
        mediaFileIds: [],
        mediaUrls: ["https://cdn.shortpulse.test/recovered.png"],
      })
    );
    expect(settleGenerationOutcomeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "fail",
        reason:
          "Generated media could not be saved because the generation owner is no longer active.",
      })
    );
    expect(updateGenerationAttemptStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerRequestId: "req-1",
        userId: "user-1",
        status: "failed",
        failureReasonCode: "media_persistence_failed",
      })
    );
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        taskState: "fail",
        publicationState: "suppressed",
        resultUrls: [],
      })
    );
    expect(scenario.updatePayloads.at(-1)).toEqual(
      expect.objectContaining({
        status: "fail",
        recovery_state: "exhausted",
        failure_reason_code: "media_persistence_failed",
        next_recovery_at: null,
      })
    );
  });

  it("marks provider-running generations as exhausted when running hard-timeout is reached", async () => {
    readFalRuntimeFlagsMock.mockReturnValue({
      reconcilerMaxAttempts: 3,
      noMediaExhaustMinAgeSeconds: 7200,
      runningExhaustMinAgeSeconds: 7200,
      runningHardTimeoutSeconds: 900,
    });
    const scenario = createAiGenerationsAdmin([
      {
        ...baseGenerationRow,
        created_at: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
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
        state: "running",
        payload: null,
        mediaUrls: [],
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        state: "exhausted",
        processed: true,
        note: "running_hard_timeout",
      })
    );
    expect(scenario.updatePayloads).toHaveLength(1);
    expect(scenario.updatePayloads[0]).toEqual(
      expect.objectContaining({
        status: "fail",
        recovery_state: "exhausted",
        failure_reason_code: "provider_running_timeout",
        next_recovery_at: null,
      })
    );
    expect(settleGenerationOutcomeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "fail",
        reason: "Provider exceeded running hard-timeout during recovery execution.",
      })
    );
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        requestId: "req-1",
        status: "ready",
        taskState: "fail",
        errorMessageShort: "Generation timed out",
        errorDetail: "Provider exceeded running hard-timeout during recovery execution.",
        publicationState: "suppressed",
        resultUrls: [],
        savedMediaIds: [],
      })
    );
    expect(writeAppErrorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.generation.recovery.running_hard_timeout",
        message: "provider_running_timeout",
        scope: "generation",
        severity: "high",
      })
    );
    expect(updateGenerationAttemptStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerRequestId: "req-1",
        status: "timed_out",
        failureReasonCode: "provider_running_timeout",
      })
    );
  });

  it("caps next recovery check at running hard-timeout deadline", async () => {
    readFalRuntimeFlagsMock.mockReturnValue({
      reconcilerMaxAttempts: 5,
      noMediaExhaustMinAgeSeconds: 7200,
      runningExhaustMinAgeSeconds: 7200,
      runningHardTimeoutSeconds: 900,
    });
    const createdAt = new Date(Date.now() - 14 * 60 * 1000).toISOString();
    const scenario = createAiGenerationsAdmin([
      {
        ...baseGenerationRow,
        created_at: createdAt,
        recovery_attempts: 4,
      },
    ]);
    getSupabaseAdminMock.mockReturnValue(scenario.admin);

    const result = await executeGenerationRecovery({
      actor: "reconciler",
      generationId: "gen-1",
      routeLabel: "test/recovery",
      maxAttempts: 5,
      observation: {
        state: "running",
        payload: null,
        mediaUrls: [],
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        state: "provider_running",
        processed: true,
      })
    );
    expect(scenario.updatePayloads).toHaveLength(1);
    const nextRecoveryAt = scenario.updatePayloads[0]?.next_recovery_at;
    expect(typeof nextRecoveryAt).toBe("string");
    const hardDeadlineMs = Date.parse(createdAt) + 900 * 1000;
    const scheduledMs = Date.parse(String(nextRecoveryAt));
    expect(Number.isFinite(scheduledMs)).toBe(true);
    expect(scheduledMs).toBeLessThanOrEqual(hardDeadlineMs);
    expect(settleGenerationOutcomeMock).not.toHaveBeenCalled();
    expect(updateGenerationAttemptStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerRequestId: "req-1",
        status: "running",
      })
    );
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
    persistGenerationOutputRecordsMock.mockResolvedValue([
      {
        id: "output-1",
        outputIndex: 0,
        resultUrl: "https://cdn.shortpulse.test/recovered.png",
        mediaFileId: "media-1",
      },
    ]);

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
    expect(persistGenerationOutputRecordsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        userId: "user-1",
        providerRequestId: "req-1",
        resultUrls: ["https://cdn.shortpulse.test/recovered.png"],
        mediaFileIds: ["media-1", "media-2"],
      })
    );
    expect(upsertGenerationPublicationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        generationOutputId: "output-1",
        publicationState: "published",
        visibleInAiStudio: true,
        visibleInReferenceGrid: true,
      })
    );
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        requestId: "req-1",
        providerRequestId: "req-1",
        status: "ready",
        taskState: "success",
        saveState: "saved",
        publicationState: "published",
        resultUrls: ["https://cdn.shortpulse.test/recovered.png"],
        savedMediaIds: ["media-1", "media-2"],
      })
    );
    expect(settleGenerationOutcomeMock.mock.invocationCallOrder[0]).toBeLessThan(
      upsertGenerationPublicationMock.mock.invocationCallOrder[0]
    );
    expect(settleGenerationOutcomeMock.mock.invocationCallOrder[0]).toBeLessThan(
      upsertGenerationProjectionMock.mock.invocationCallOrder[0]
    );
    expect(scenario.aiGenerationsUpdateMock.mock.invocationCallOrder[0]).toBeLessThan(
      upsertGenerationPublicationMock.mock.invocationCallOrder[0]
    );
    expect(scenario.aiGenerationsUpdateMock.mock.invocationCallOrder[0]).toBeLessThan(
      upsertGenerationProjectionMock.mock.invocationCallOrder[0]
    );
    expect(scenario.updatePayloads).toHaveLength(1);
    expect(scenario.updatePayloads[0]).toEqual(
      expect.objectContaining({
        status: "success",
        recovery_state: "recovered",
      })
    );
    expect(asObject(scenario.updatePayloads[0]?.metadata)).not.toHaveProperty("result_urls");
    expect(asObject(scenario.updatePayloads[0]?.metadata)).not.toHaveProperty("media_file_ids");
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
    expect(updateGenerationAttemptStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerRequestId: "req-1",
        status: "succeeded",
        metadata: expect.objectContaining({
          recovery_outcome: "recovered_success",
          autosave_decision: "auto_persisted",
        }),
      })
    );
  });

  it("keeps abandoned recovered success suppressed in publication and projection surfaces", async () => {
    const scenario = createAiGenerationsAdmin(
      [
        {
          ...baseGenerationRow,
          status: "fail",
          failure_reason_code: "terminal_success_no_media",
          recovery_state: "queued",
        },
      ],
      {
        abandonmentRow: {
          no_refund: true,
        },
      }
    );
    getSupabaseAdminMock.mockReturnValue(scenario.admin);
    persistRecoveryMediaFilesForGenerationMock.mockResolvedValue(["media-1"]);
    persistGenerationOutputRecordsMock.mockResolvedValue([
      {
        id: "output-1",
        outputIndex: 0,
        resultUrl: "https://cdn.shortpulse.test/recovered.png",
        mediaFileId: "media-1",
      },
    ]);

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
        mediaFileIds: ["media-1"],
      })
    );
    expect(upsertGenerationPublicationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        generationOutputId: "output-1",
        publicationState: "suppressed",
        visibleInReferenceGrid: false,
      })
    );
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        taskState: "success",
        publicationState: "suppressed",
        hiddenInReferenceGrid: true,
        referenceGridVisible: false,
      })
    );
    expect(settleGenerationOutcomeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "success",
        detail: expect.objectContaining({
          user_abandoned: true,
        }),
      })
    );
    expect(scenario.updatePayloads).toHaveLength(1);
    expect(scenario.updatePayloads[0]).toEqual(
      expect.objectContaining({
        status: "success",
        recovery_state: "recovered",
        metadata: expect.objectContaining({
          user_abandoned: true,
          abandoned_no_refund: true,
          hidden_in_reference_grid: true,
        }),
      })
    );
  });

  it("recovers legacy user-abandoned provider success into visible project media", async () => {
    const scenario = createAiGenerationsAdmin(
      [
        {
          ...baseGenerationRow,
          status: "fail",
          failure_reason_code: "user_abandoned",
          recovery_state: "exhausted",
          metadata: {
            existing: true,
            user_abandoned: true,
            abandoned_no_refund: true,
            hidden_in_reference_grid: true,
            source_ref: "source-ref-1",
            shortpulse_context: { project_id: "project-1" },
          },
        },
      ],
      {
        abandonmentRow: {
          no_refund: true,
        },
      }
    );
    getSupabaseAdminMock.mockReturnValue(scenario.admin);
    persistRecoveryMediaFilesForGenerationMock.mockResolvedValue(["media-1"]);
    persistGenerationOutputRecordsMock.mockResolvedValue([
      {
        id: "output-1",
        outputIndex: 0,
        resultUrl: "https://cdn.shortpulse.test/recovered.png",
        mediaFileId: "media-1",
      },
    ]);

    const result = await executeGenerationRecovery({
      actor: "user_reconcile",
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
        mediaFileIds: ["media-1"],
      })
    );
    expect(upsertGenerationPublicationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        generationOutputId: "output-1",
        publicationState: "published",
        visibleInReferenceGrid: true,
      })
    );
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        projectId: "project-1",
        taskState: "success",
        publicationState: "published",
        hiddenInReferenceGrid: false,
        referenceGridVisible: true,
      })
    );
    expect(settleGenerationOutcomeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "success",
        detail: expect.objectContaining({
          user_abandoned: false,
          legacy_user_abandonment_ignored: true,
        }),
      })
    );
    expect(scenario.updatePayloads[0]).toEqual(
      expect.objectContaining({
        status: "success",
        recovery_state: "recovered",
        metadata: expect.objectContaining({
          existing: true,
          legacy_abandonment_recovery_actor: "user_reconcile",
        }),
      })
    );
    expect(asObject(scenario.updatePayloads[0]?.metadata)).not.toHaveProperty("user_abandoned");
    expect(asObject(scenario.updatePayloads[0]?.metadata)).not.toHaveProperty(
      "hidden_in_reference_grid"
    );
  });

  it("keeps recovered success settled when publication persistence fails", async () => {
    const scenario = createAiGenerationsAdmin([
      {
        ...baseGenerationRow,
        status: "fail",
        failure_reason_code: "terminal_success_no_media",
        recovery_state: "queued",
      },
    ]);
    getSupabaseAdminMock.mockReturnValue(scenario.admin);
    persistRecoveryMediaFilesForGenerationMock.mockResolvedValue(["media-1"]);
    persistGenerationOutputRecordsMock.mockResolvedValue([
      {
        id: "output-1",
        outputIndex: 0,
        resultUrl: "https://cdn.shortpulse.test/recovered.png",
        mediaFileId: "media-1",
      },
    ]);
    upsertGenerationPublicationMock.mockRejectedValueOnce(new Error("publication failed"));

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
      })
    );
    expect(settleGenerationOutcomeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "success",
      })
    );
    expect(writeAppErrorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.generation.recovery.publication_write_failed",
        requestId: "req-1",
        userId: "user-1",
        metadata: expect.objectContaining({
          generation_id: "gen-1",
          route_label: "test/recovery",
          publication_error: "publication failed",
          recovery_actor: "webhook",
        }),
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

  it("allows pending generations to recover directly to success when media is visible", async () => {
    const scenario = createAiGenerationsAdmin([
      {
        ...baseGenerationRow,
        status: "pending",
        recovery_state: "queued",
      },
    ]);
    getSupabaseAdminMock.mockReturnValue(scenario.admin);
    persistRecoveryMediaFilesForGenerationMock.mockResolvedValue(["media-1"]);

    const result = await executeGenerationRecovery({
      actor: "webhook",
      generationId: "gen-1",
      routeLabel: "test/recovery",
      observation: {
        state: "completed",
        payload: null,
        mediaUrls: ["https://cdn.shortpulse.test/recovered-from-pending.png"],
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        state: "recovered",
        processed: true,
        mediaFileIds: ["media-1"],
      })
    );
    expect(persistRecoveryMediaFilesForGenerationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaUrls: ["https://cdn.shortpulse.test/recovered-from-pending.png"],
      })
    );
    expect(settleGenerationOutcomeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "success",
      })
    );
  });

  it("does not terminalize recovered success when billing capture does not settle", async () => {
    const scenario = createAiGenerationsAdmin([
      {
        ...baseGenerationRow,
        status: "running",
      },
    ]);
    getSupabaseAdminMock.mockReturnValue(scenario.admin);
    settleGenerationOutcomeMock.mockResolvedValueOnce({
      settled: false,
      note: "reservation_capture_failed",
    });

    await expect(
      executeGenerationRecovery({
        actor: "webhook",
        generationId: "gen-1",
        routeLabel: "test/recovery",
        observation: {
          state: "completed",
          payload: null,
          mediaUrls: ["https://cdn.shortpulse.test/recovered.png"],
        },
      })
    ).rejects.toThrow("Generation billing settlement did not complete: reservation_capture_failed");

    expect(persistRecoveryMediaFilesForGenerationMock).toHaveBeenCalled();
    expect(persistGenerationOutputRecordsMock).toHaveBeenCalled();
    expect(persistGenerationOutputRecordsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          recovery_visibility_state: "settlement_pending",
        }),
      })
    );
    expect(updateGenerationAttemptStateMock).not.toHaveBeenCalled();
    expect(scenario.updatePayloads).toHaveLength(0);
    expect(upsertGenerationPublicationMock).not.toHaveBeenCalled();
    expect(upsertGenerationProjectionMock).not.toHaveBeenCalled();
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
    expect(persistGenerationOutputRecordsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        userId: "user-1",
        providerRequestId: "req-1",
        resultUrls: ["https://cdn.shortpulse.test/recovered.png"],
        mediaFileIds: [],
        metadata: expect.objectContaining({
          recovery_visibility_state: "settlement_pending",
        }),
      })
    );
    expect(persistGenerationOutputRecordsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        userId: "user-1",
        providerRequestId: "req-1",
        resultUrls: ["https://cdn.shortpulse.test/recovered.png"],
        mediaFileIds: [],
        metadata: expect.objectContaining({
          recovery_visibility_state: "settled",
        }),
      })
    );
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        requestId: "req-1",
        status: "ready",
        taskState: "success",
        saveState: "idle",
        publicationState: "suppressed",
        resultUrls: ["https://cdn.shortpulse.test/recovered.png"],
        savedMediaIds: [],
      })
    );
    expect(upsertGenerationPublicationMock).not.toHaveBeenCalled();
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
    expect(asObject(scenario.updatePayloads[0]?.metadata)).not.toHaveProperty("result_urls");
    expect(asObject(scenario.updatePayloads[0]?.metadata)).not.toHaveProperty("media_file_ids");
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
    expect(updateGenerationAttemptStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerRequestId: "req-1",
        status: "succeeded",
        metadata: expect.objectContaining({
          autosave_decision: "autosave_skipped",
        }),
      })
    );
  });

  it("fails closed when the autosave preference lookup errors", async () => {
    const scenario = createAiGenerationsAdmin(
      [
        {
          ...baseGenerationRow,
          status: "running",
          failure_reason_code: "terminal_success_no_media",
          recovery_state: "queued",
        },
      ],
      { userPreferenceError: { message: "user preference read failed" } }
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
        note: "autosave_skipped",
      })
    );
    expect(persistRecoveryMediaFilesForGenerationMock).not.toHaveBeenCalled();
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        requestId: "req-1",
        saveState: "failed",
        saveError:
          "Media Library autosave was skipped because your autosave preference could not be verified. You can still save manually.",
      })
    );
    expect(scenario.mediaEventInserts[0]).toEqual(
      expect.objectContaining({
        metadata: expect.objectContaining({
          autosave_enabled: false,
          autosave_preference_source: "lookup_error",
          autosave_decision: "autosave_skipped",
          decision_reason: "autosave_disabled",
        }),
      })
    );
  });

  it("projects blocked_storage when recovery autosave hits storage quota", async () => {
    const scenario = createAiGenerationsAdmin([
      {
        ...baseGenerationRow,
        status: "running",
        failure_reason_code: "terminal_success_no_media",
        recovery_state: "queued",
      },
    ]);
    getSupabaseAdminMock.mockReturnValue(scenario.admin);
    persistRecoveryMediaFilesForGenerationMock.mockRejectedValue(
      new Error(
        "Media storage limit exceeded (used_bytes=1073741824 incoming_bytes=16 limit_bytes=1073741824)"
      )
    );
    persistGenerationOutputRecordsMock.mockResolvedValue([
      {
        id: "output-1",
        outputIndex: 0,
        resultUrl: "https://cdn.shortpulse.test/recovered.png",
        mediaFileId: null,
      },
    ]);

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
        note: "autosave_skipped",
      })
    );
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        saveState: "blocked_storage",
        saveError:
          "Your media storage is full. Delete media, upgrade your plan, or add recurring storage before saving more files.",
        savedMediaIds: [],
      })
    );
    expect(writeAppErrorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.generation.recovery.media_autosave_failed",
        metadata: expect.objectContaining({
          autosave_error:
            "Media storage limit exceeded (used_bytes=1073741824 incoming_bytes=16 limit_bytes=1073741824)",
        }),
      })
    );
  });

  it("uses write-returned output ids when immediate output rereads are stale", async () => {
    const scenario = createAiGenerationsAdmin([
      {
        ...baseGenerationRow,
        status: "running",
        failure_reason_code: "terminal_success_no_media",
        recovery_state: "queued",
      },
    ]);
    getSupabaseAdminMock.mockReturnValue(scenario.admin);
    persistRecoveryMediaFilesForGenerationMock.mockResolvedValue(["media-1"]);
    persistGenerationOutputRecordsMock.mockResolvedValue([
      {
        id: "output-from-write",
        outputIndex: 0,
        resultUrl: "https://cdn.shortpulse.test/recovered.png",
        mediaFileId: "media-1",
      },
    ]);
    readPersistedGenerationOutputsMock.mockResolvedValue([]);

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
      })
    );
    expect(upsertGenerationPublicationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        generationOutputId: "output-from-write",
        publicationState: "published",
        ownedMediaFileId: "media-1",
      })
    );
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        taskState: "success",
        publicationState: "published",
        resultUrls: ["https://cdn.shortpulse.test/recovered.png"],
        savedMediaIds: ["media-1"],
      })
    );
    expect(readPersistedGenerationOutputsMock).not.toHaveBeenCalled();
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
    expect(settleGenerationOutcomeMock).not.toHaveBeenCalled();
    expect(scenario.updatePayloads).toHaveLength(1);
    expect(scenario.updatePayloads[0]).toEqual(
      expect.objectContaining({
        failure_reason_code: "terminal_success_no_media",
        recovery_state: "queued",
      })
    );
    expect(scenario.updatePayloads[0]).not.toHaveProperty("status");
    expect(scenario.updatePayloads[0]).not.toHaveProperty("completed_at");
    expect(typeof scenario.updatePayloads[0]?.next_recovery_at).toBe("string");
    expect(updateGenerationAttemptStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerRequestId: "req-1",
        status: "succeeded",
        failureReasonCode: "terminal_success_no_media",
      })
    );
    expect(upsertGenerationProjectionMock).not.toHaveBeenCalled();
  });

  it("defers no-media exhaustion when attempts reached max but generation age is below no-media minimum threshold", async () => {
    const scenario = createAiGenerationsAdmin([
      {
        ...baseGenerationRow,
        created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
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
        state: "no_media",
        processed: true,
      })
    );
    expect(scenario.updatePayloads).toHaveLength(1);
    expect(scenario.updatePayloads[0]).toEqual(
      expect.objectContaining({
        failure_reason_code: "terminal_success_no_media",
        recovery_state: "queued",
      })
    );
    expect(scenario.updatePayloads[0]).toEqual(
      expect.objectContaining({
        recovery_attempts: 4,
      })
    );
    expect(scenario.updatePayloads[0]).not.toHaveProperty("status");
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
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        requestId: null,
        status: "ready",
        taskState: "fail",
        errorMessageShort: "Generation failed",
        errorDetail: "Generation recovery exhausted because the provider request id is missing.",
        publicationState: "suppressed",
      })
    );
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
    readPersistedGenerationOutputsMock.mockResolvedValue([
      {
        id: "output-1",
        outputIndex: 0,
        resultUrl: "https://cdn.shortpulse.test/existing-media.png",
        mediaFileId: "media-1",
        metadata: {
          direct_terminal_visibility_state: "settlement_pending",
          recovery_visibility_state: "settlement_pending",
        },
      },
    ]);
    markGenerationOutputRowsVisibilitySettledMock.mockResolvedValueOnce([
      {
        id: "output-1",
        outputIndex: 0,
        resultUrl: "https://cdn.shortpulse.test/existing-media.png",
        mediaFileId: "media-1",
        metadata: {
          direct_terminal_visibility_state: "settlement_pending",
          recovery_visibility_state: "settled",
        },
      },
    ]);
    markGenerationOutputRowsVisibilitySettledMock.mockResolvedValueOnce([
      {
        id: "output-1",
        outputIndex: 0,
        resultUrl: "https://cdn.shortpulse.test/existing-media.png",
        mediaFileId: "media-1",
        metadata: {
          direct_terminal_visibility_state: "settled",
          recovery_visibility_state: "settled",
        },
      },
    ]);

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
    expect(markGenerationOutputRowsVisibilitySettledMock).toHaveBeenNthCalledWith(1, {
      generationId: "gen-1",
      userId: "user-1",
      outputRows: [
        expect.objectContaining({
          metadata: expect.objectContaining({
            direct_terminal_visibility_state: "settlement_pending",
            recovery_visibility_state: "settlement_pending",
          }),
        }),
      ],
      visibilityMetadataKey: "recovery_visibility_state",
    });
    expect(markGenerationOutputRowsVisibilitySettledMock).toHaveBeenNthCalledWith(2, {
      generationId: "gen-1",
      userId: "user-1",
      outputRows: [
        expect.objectContaining({
          metadata: expect.objectContaining({
            direct_terminal_visibility_state: "settlement_pending",
            recovery_visibility_state: "settled",
          }),
        }),
      ],
      visibilityMetadataKey: "direct_terminal_visibility_state",
    });
    expect(settleGenerationOutcomeMock.mock.invocationCallOrder[0]).toBeLessThan(
      markGenerationOutputRowsVisibilitySettledMock.mock.invocationCallOrder[0]
    );
    expect(markGenerationOutputRowsVisibilitySettledMock.mock.invocationCallOrder[1]).toBeLessThan(
      upsertGenerationPublicationMock.mock.invocationCallOrder[0]
    );
    expect(upsertGenerationPublicationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        generationOutputId: "output-1",
        publicationState: "published",
      })
    );
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        taskState: "success",
        publicationState: "published",
        resultUrls: ["https://cdn.shortpulse.test/existing-media.png"],
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
        payload: { error: "User defined request timeout exceeded: Pre-start" },
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
        reason: "User defined request timeout exceeded: Pre-start",
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
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        requestId: "req-1",
        status: "ready",
        taskState: "fail",
        errorMessageShort: "User defined request timeout exceeded: Pre-start",
        errorDetail: "User defined request timeout exceeded: Pre-start",
        publicationState: "suppressed",
        hiddenInReferenceGrid: false,
        referenceGridVisible: true,
        resultUrls: [],
        savedMediaIds: [],
      })
    );
    expect(updateGenerationAttemptStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerRequestId: "req-1",
        status: "failed",
        failureReasonCode: "provider_error",
      })
    );
  });

  it("does not terminalize provider failure when billing release does not settle", async () => {
    const scenario = createAiGenerationsAdmin([
      {
        ...baseGenerationRow,
        status: "running",
      },
    ]);
    getSupabaseAdminMock.mockReturnValue(scenario.admin);
    settleGenerationOutcomeMock.mockResolvedValueOnce({
      settled: false,
      note: "reservation_release_failed",
    });

    await expect(
      executeGenerationRecovery({
        actor: "webhook",
        generationId: "gen-1",
        routeLabel: "test/recovery",
        observation: {
          state: "failed",
          payload: { error: "Provider rejected request" },
          mediaUrls: [],
        },
      })
    ).rejects.toThrow("Generation billing settlement did not complete: reservation_release_failed");

    expect(updateGenerationAttemptStateMock).not.toHaveBeenCalled();
    expect(scenario.updatePayloads).toHaveLength(0);
    expect(upsertGenerationProjectionMock).not.toHaveBeenCalled();
  });

  it("does not refund abandoned provider failures during shared recovery", async () => {
    const scenario = createAiGenerationsAdmin(
      [
        {
          ...baseGenerationRow,
          status: "running",
        },
      ],
      {
        abandonmentRow: {
          no_refund: true,
        },
      }
    );
    getSupabaseAdminMock.mockReturnValue(scenario.admin);

    const result = await executeGenerationRecovery({
      actor: "webhook",
      generationId: "gen-1",
      routeLabel: "test/recovery",
      observation: {
        state: "failed",
        payload: { error: "Provider failed after user clear" },
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
        abandonedNoRefund: true,
        detail: expect.objectContaining({
          user_abandoned: true,
        }),
      })
    );
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        taskState: "fail",
        publicationState: "suppressed",
        hiddenInReferenceGrid: true,
        referenceGridVisible: false,
      })
    );
    expect(upsertGenerationPublicationMock).not.toHaveBeenCalled();
  });

  it("shows legacy user-abandoned provider failures as project error references", async () => {
    const scenario = createAiGenerationsAdmin(
      [
        {
          ...baseGenerationRow,
          status: "fail",
          failure_reason_code: "user_abandoned",
          recovery_state: "exhausted",
          metadata: {
            existing: true,
            user_abandoned: true,
            abandoned_no_refund: true,
            hidden_in_reference_grid: true,
            source_ref: "source-ref-1",
            shortpulse_context: { project_id: "project-1" },
          },
        },
      ],
      {
        abandonmentRow: {
          no_refund: true,
        },
      }
    );
    getSupabaseAdminMock.mockReturnValue(scenario.admin);

    const result = await executeGenerationRecovery({
      actor: "user_reconcile",
      generationId: "gen-1",
      routeLabel: "test/recovery",
      observation: {
        state: "failed",
        payload: { error: "Provider failed while user was away" },
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
        abandonedNoRefund: false,
        detail: expect.objectContaining({
          user_abandoned: false,
          legacy_user_abandonment_ignored: true,
        }),
      })
    );
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        projectId: "project-1",
        taskState: "fail",
        publicationState: "suppressed",
        hiddenInReferenceGrid: false,
        referenceGridVisible: true,
        errorDetail: "the generation service failed while user was away",
      })
    );
    expect(upsertGenerationPublicationMock).not.toHaveBeenCalled();
  });

  it("keeps provider failures settled when projection persistence fails", async () => {
    const scenario = createAiGenerationsAdmin([
      {
        ...baseGenerationRow,
        status: "running",
      },
    ]);
    getSupabaseAdminMock.mockReturnValue(scenario.admin);
    upsertGenerationProjectionMock.mockRejectedValueOnce({
      code: "PGRST204",
      message: "save_error missing from schema cache",
    });

    const result = await executeGenerationRecovery({
      actor: "webhook",
      generationId: "gen-1",
      routeLabel: "test/recovery",
      observation: {
        state: "failed",
        payload: { error: "Provider rejected request" },
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
    expect(writeAppErrorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.generation.recovery.projection_write_failed",
        requestId: "req-1",
        userId: "user-1",
        metadata: expect.objectContaining({
          generation_id: "gen-1",
          route_label: "test/recovery",
          projection_stage: "fail",
          projection_error: "save_error missing from schema cache",
          recovery_actor: "webhook",
        }),
      })
    );
    expect(scenario.updatePayloads).toHaveLength(1);
    expect(scenario.updatePayloads[0]).toEqual(
      expect.objectContaining({
        status: "fail",
        recovery_state: "exhausted",
      })
    );
  });

  it("persists explicit-content provider failures with shared copy", async () => {
    const scenario = createAiGenerationsAdmin([
      {
        ...baseGenerationRow,
        status: "running",
      },
    ]);
    getSupabaseAdminMock.mockReturnValue(scenario.admin);

    const result = await executeGenerationRecovery({
      actor: "poll",
      generationId: "gen-1",
      routeLabel: "test/recovery",
      observation: {
        state: "failed",
        payload: {
          detail: [
            {
              type: "content_policy_violation",
              msg: "Blocked by policy.",
            },
          ],
        },
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
    expect(scenario.updatePayloads).toHaveLength(1);
    expect(scenario.updatePayloads[0]).toEqual(
      expect.objectContaining({
        status: "fail",
        failure_reason_code: "content_policy_block",
      })
    );
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        errorMessageShort: "Content not allowed",
        errorDetail:
          "This request was blocked for explicit or unsafe content. Try revising the prompt or references.",
      })
    );
    expect(updateGenerationAttemptStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        failureReasonCode: "content_policy_block",
        errorMessage:
          "This request was blocked for explicit or unsafe content. Try revising the prompt or references.",
      })
    );
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
