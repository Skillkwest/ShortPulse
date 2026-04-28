import { beforeEach, describe, expect, it, vi } from "vitest";

const readRecoveryGenerationRowMock = vi.fn();
const settleGenerationOutcomeMock = vi.fn();
const lookupGenerationAttemptByProviderRequestMock = vi.fn();
const persistGenerationOutputRecordsMock = vi.fn();
const persistRecoveryMediaFilesForGenerationMock = vi.fn();
const applyGenerationLifecycleTransitionMock = vi.fn();
const upsertGenerationProjectionMock = vi.fn();
const upsertGenerationPublicationMock = vi.fn();
const readGenerationAbandonmentContextMock = vi.fn();
const updateGenerationEqMock = vi.fn();
const updateGenerationUpdateMock = vi.fn();
const mediaFilesInMock = vi.fn();
const mediaFilesEqMock = vi.fn();
const mediaFilesLimitMock = vi.fn();
const userPreferencesMaybeSingleMock = vi.fn();

vi.mock("../../falIntegration/recoveryGenerationLookup", () => ({
  readRecoveryGenerationRow: (...args: unknown[]) => readRecoveryGenerationRowMock(...args),
}));

vi.mock("../../falIntegration/recoveryMediaPersistence", () => ({
  persistRecoveryMediaFilesForGeneration: (...args: unknown[]) =>
    persistRecoveryMediaFilesForGenerationMock(...args),
}));

vi.mock("../generationBilling", () => ({
  settleGenerationOutcome: (...args: unknown[]) => settleGenerationOutcomeMock(...args),
}));

vi.mock("../generationAttempts", () => ({
  lookupGenerationAttemptByProviderRequest: (...args: unknown[]) =>
    lookupGenerationAttemptByProviderRequestMock(...args),
}));

vi.mock("../generationOutputs", () => ({
  persistGenerationOutputRecords: (...args: unknown[]) =>
    persistGenerationOutputRecordsMock(...args),
}));

vi.mock("../generationLifecycleTransitionService", () => ({
  applyGenerationLifecycleTransition: (...args: unknown[]) =>
    applyGenerationLifecycleTransitionMock(...args),
}));

vi.mock("../generationProjection", () => ({
  upsertGenerationProjection: (...args: unknown[]) => upsertGenerationProjectionMock(...args),
}));

vi.mock("../generationPublications", () => ({
  upsertGenerationPublication: (...args: unknown[]) => upsertGenerationPublicationMock(...args),
}));

vi.mock("../generationAbandonment", () => ({
  readGenerationAbandonmentContext: (...args: unknown[]) =>
    readGenerationAbandonmentContextMock(...args),
  isGenerationAbandonedMetadata: (metadata: unknown) =>
    Boolean((metadata as Record<string, unknown> | null)?.user_abandoned),
}));

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: () => ({
    from: vi.fn((table: string) => {
      if (table === "ai_generations") {
        return {
          update: updateGenerationUpdateMock,
        };
      }
      if (table === "user_preferences") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: userPreferencesMaybeSingleMock,
            })),
          })),
        };
      }
      if (table === "media_files") {
        return {
          select: vi.fn(() => ({
            in: mediaFilesInMock,
          })),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  }),
}));

import {
  settleDirectGenerationFailure,
  settleDirectGenerationSuccess,
} from "../directGenerationSettlement";

describe("directGenerationSettlement", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    updateGenerationEqMock.mockReturnThis();
    updateGenerationUpdateMock.mockReturnValue({
      eq: updateGenerationEqMock,
    });
    updateGenerationEqMock.mockResolvedValue({ error: null });
    mediaFilesLimitMock.mockResolvedValue({
      data: [
        {
          id: "media-1",
          preview_storage_path: "user-1/generations/images/media-1.png",
          storage_path: "user-1/generations/images/media-1.png",
        },
        {
          id: "media-2",
          preview_storage_path: "user-1/generations/images/media-2.png",
          storage_path: "user-1/generations/images/media-2.png",
        },
      ],
      error: null,
    });
    mediaFilesEqMock.mockReturnValue({
      limit: mediaFilesLimitMock,
    });
    mediaFilesInMock.mockReturnValue({
      eq: mediaFilesEqMock,
    });
    userPreferencesMaybeSingleMock.mockResolvedValue({
      data: { media_autosave_enabled: true },
      error: null,
    });

    readRecoveryGenerationRowMock.mockResolvedValue({
      id: "gen-1",
      user_id: "user-1",
      request_id: "req-1",
      provider: "fal",
      model_id: "fal-ai/nano-banana",
      prompt_text: "portrait",
      created_at: "2026-04-26T00:00:00.000Z",
      metadata: {
        source_ref: "source-ref-1",
        hidden_in_reference_grid: true,
        generation_replay: { input: "value" },
        character_context: { characterId: "char-1" },
        style_context: { styleId: "style-1" },
      },
    });
    lookupGenerationAttemptByProviderRequestMock.mockResolvedValue({
      data: {
        id: "attempt-1",
      },
      error: null,
    });
    applyGenerationLifecycleTransitionMock.mockResolvedValue({ ok: true });
    persistRecoveryMediaFilesForGenerationMock.mockResolvedValue(["media-1", "media-2"]);
    persistGenerationOutputRecordsMock.mockResolvedValue([
      {
        id: "output-1",
        resultUrl: "https://provider.example/out-1.png",
        mediaFileId: "media-1",
      },
      {
        id: "output-2",
        resultUrl: "https://provider.example/out-2.png",
        mediaFileId: "media-2",
      },
    ]);
    upsertGenerationPublicationMock.mockResolvedValue(undefined);
    upsertGenerationProjectionMock.mockResolvedValue(undefined);
    settleGenerationOutcomeMock.mockResolvedValue(undefined);
    readGenerationAbandonmentContextMock.mockResolvedValue({
      abandoned: false,
      noRefund: false,
      source: null,
    });
  });

  it("persists direct terminal success with storage-backed media authority when autosave allows it", async () => {
    const result = await settleDirectGenerationSuccess({
      generationId: "gen-1",
      requestId: "req-1",
      userId: "user-1",
      routeLabel: "test/direct-success",
      providerState: "COMPLETED",
      resultUrls: [
        "https://provider.example/out-1.png",
        "   ",
        "https://provider.example/out-2.png",
      ],
    });

    expect(result).toEqual({
      ok: true,
      generationId: "gen-1",
      requestId: "req-1",
    });
    expect(persistRecoveryMediaFilesForGenerationMock).toHaveBeenCalledWith({
      generation: expect.objectContaining({
        id: "gen-1",
        user_id: "user-1",
        request_id: "req-1",
      }),
      mediaUrls: ["https://provider.example/out-1.png", "https://provider.example/out-2.png"],
    });
    expect(persistGenerationOutputRecordsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        userId: "user-1",
        generationAttemptId: "attempt-1",
        providerRequestId: "req-1",
        resultUrls: ["https://provider.example/out-1.png", "https://provider.example/out-2.png"],
        mediaFileIds: ["media-1", "media-2"],
      })
    );
    expect(upsertGenerationPublicationMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        generationId: "gen-1",
        generationOutputId: "output-1",
        userId: "user-1",
        generationAttemptId: "attempt-1",
        publicationState: "published",
        ownedMediaFileId: "media-1",
        previewUrl: "https://provider.example/out-1.png",
        fullUrl: "https://provider.example/out-1.png",
        previewStoragePath: "user-1/generations/images/media-1.png",
        fullStoragePath: "user-1/generations/images/media-1.png",
        visibleInReferenceGrid: false,
      })
    );
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        userId: "user-1",
        requestId: "req-1",
        taskState: "success",
        queueState: "dispatched",
        publicationState: "published",
        previewUrl: "https://provider.example/out-1.png",
        previewStoragePath: "user-1/generations/images/media-1.png",
        fullStoragePath: "user-1/generations/images/media-1.png",
        resultUrls: ["https://provider.example/out-1.png", "https://provider.example/out-2.png"],
        savedMediaIds: ["media-1", "media-2"],
        hiddenInReferenceGrid: true,
        referenceGridVisible: false,
      })
    );
    expect(settleGenerationOutcomeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        providerRequestId: "req-1",
        outcome: "success",
      })
    );
  });

  it("keeps direct terminal success transient when autosave is disabled", async () => {
    userPreferencesMaybeSingleMock.mockResolvedValue({
      data: { media_autosave_enabled: false },
      error: null,
    });
    persistRecoveryMediaFilesForGenerationMock.mockReset();
    persistGenerationOutputRecordsMock.mockResolvedValue([
      {
        id: "output-1",
        resultUrl: "https://provider.example/out-1.png",
        mediaFileId: null,
      },
    ]);

    const result = await settleDirectGenerationSuccess({
      generationId: "gen-1",
      requestId: "req-1",
      userId: "user-1",
      routeLabel: "test/direct-success-no-autosave",
      providerState: "COMPLETED",
      resultUrls: ["https://provider.example/out-1.png"],
    });

    expect(result).toEqual({
      ok: true,
      generationId: "gen-1",
      requestId: "req-1",
    });
    expect(persistRecoveryMediaFilesForGenerationMock).not.toHaveBeenCalled();
    expect(persistGenerationOutputRecordsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaFileIds: [],
      })
    );
    expect(upsertGenerationPublicationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        publicationState: "suppressed",
        ownedMediaFileId: null,
      })
    );
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        publicationState: "suppressed",
        savedMediaIds: [],
        previewStoragePath: null,
        fullStoragePath: null,
      })
    );
  });

  it("settles abandoned direct terminal success without republishing to the reference grid", async () => {
    readGenerationAbandonmentContextMock.mockResolvedValue({
      abandoned: true,
      noRefund: true,
      source: "abandonment_row",
    });

    const result = await settleDirectGenerationSuccess({
      generationId: "gen-1",
      requestId: "req-1",
      userId: "user-1",
      routeLabel: "test/direct-success-abandoned",
      providerState: "COMPLETED",
      resultUrls: ["https://provider.example/out-1.png"],
    });

    expect(result).toEqual({
      ok: true,
      generationId: "gen-1",
      requestId: "req-1",
    });
    expect(upsertGenerationPublicationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        publicationState: "suppressed",
        visibleInReferenceGrid: false,
      })
    );
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        publicationState: "suppressed",
        hiddenInReferenceGrid: true,
        referenceGridVisible: false,
      })
    );
    expect(settleGenerationOutcomeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "success",
      })
    );
  });

  it("suppresses publications and projection output on direct terminal failure", async () => {
    const result = await settleDirectGenerationFailure({
      generationId: "gen-1",
      requestId: "req-1",
      userId: "user-1",
      routeLabel: "test/direct-failure",
      providerState: "FAILED",
      errorMessage: "Provider rejected request",
      errorDetail: { reason: "bad_input" },
      failureReasonCode: "provider_error",
    });

    expect(result).toEqual({
      ok: true,
      generationId: "gen-1",
      requestId: "req-1",
    });
    expect(persistGenerationOutputRecordsMock).not.toHaveBeenCalled();
    expect(upsertGenerationPublicationMock).not.toHaveBeenCalled();
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        userId: "user-1",
        requestId: "req-1",
        taskState: "fail",
        queueState: "failed",
        publicationState: "suppressed",
        resultUrls: [],
        savedMediaIds: [],
        errorMessage: "Provider rejected request",
        errorMessageShort: "Provider rejected request",
        errorDetail: JSON.stringify({ reason: "bad_input" }),
      })
    );
    expect(settleGenerationOutcomeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        providerRequestId: "req-1",
        outcome: "fail",
        reason: "Provider rejected request",
      })
    );
  });

  it("does not refund abandoned direct terminal failures", async () => {
    readGenerationAbandonmentContextMock.mockResolvedValue({
      abandoned: true,
      noRefund: true,
      source: "abandonment_row",
    });

    const result = await settleDirectGenerationFailure({
      generationId: "gen-1",
      requestId: "req-1",
      userId: "user-1",
      routeLabel: "test/direct-failure-abandoned",
      providerState: "FAILED",
      errorMessage: "Provider failed after clear",
    });

    expect(result).toEqual({
      ok: true,
      generationId: "gen-1",
      requestId: "req-1",
    });
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        publicationState: "suppressed",
        hiddenInReferenceGrid: true,
        referenceGridVisible: false,
      })
    );
    expect(settleGenerationOutcomeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "fail",
        abandonedNoRefund: true,
      })
    );
  });
});
