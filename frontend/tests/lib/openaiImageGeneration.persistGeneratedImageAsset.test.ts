/**
 * Helper-level persistence coverage for GPT Image 2 autosave behavior.
 * Verifies the Media Library autosave contract independently from the route handlers.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const randomUUIDMock = vi.fn();
const persistGenerationOutputRecordsMock = vi.fn();
const attachMediaFileToGenerationOutputMock = vi.fn();
const upsertGenerationProjectionMock = vi.fn();
const upsertGenerationPublicationMock = vi.fn();
const readGenerationAbandonmentContextMock = vi.fn();
const associateGenerationWithProjectForUserMock = vi.fn();
const associateMediaFilesWithProjectForUserMock = vi.fn();
const writeAppErrorLogMock = vi.fn();

type MockQueryResult = {
  data?: unknown;
  error?: { message?: string } | null;
};

const mediaFilesInsertMock = vi.fn();
const aiGenerationsInsertMock = vi.fn();
const aiGenerationsUpdateMock = vi.fn();
const userPreferencesMaybeSingleMock = vi.fn();
const uploadMock = vi.fn();
const createSignedUrlMock = vi.fn();

const supabaseAdminMock = {
  storage: {
    from: vi.fn(() => ({
      upload: uploadMock,
      createSignedUrl: createSignedUrlMock,
    })),
  },
  from: vi.fn((table: string) => {
    if (table === "user_preferences") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: userPreferencesMaybeSingleMock,
          })),
        })),
      };
    }
    if (table === "ai_generations") {
      return {
        insert: aiGenerationsInsertMock,
        update: aiGenerationsUpdateMock,
      };
    }
    if (table === "media_files") {
      return {
        insert: mediaFilesInsertMock,
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  }),
};

vi.mock("crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("crypto")>();
  const mockedRandomUuid = () => randomUUIDMock();
  return {
    ...actual,
    default: {
      ...actual,
      randomUUID: mockedRandomUuid,
    },
    randomUUID: mockedRandomUuid,
  };
});

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: () => supabaseAdminMock,
}));

vi.mock("../../lib/server/api/generationOutputs", () => ({
  attachMediaFileToGenerationOutput: (...args: unknown[]) =>
    attachMediaFileToGenerationOutputMock(...args),
  persistGenerationOutputRecords: (...args: unknown[]) =>
    persistGenerationOutputRecordsMock(...args),
}));

vi.mock("../../lib/server/api/generationProjection", () => ({
  upsertGenerationProjection: (...args: unknown[]) => upsertGenerationProjectionMock(...args),
}));

vi.mock("../../lib/server/api/generationPublications", () => ({
  upsertGenerationPublication: (...args: unknown[]) => upsertGenerationPublicationMock(...args),
}));

vi.mock("../../lib/server/api/generationAbandonment", () => ({
  readGenerationAbandonmentContext: (...args: unknown[]) =>
    readGenerationAbandonmentContextMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  writeAppErrorLog: (...args: unknown[]) => writeAppErrorLogMock(...args),
}));

vi.mock("../../lib/server/projectGenerationAssociationsService", () => ({
  associateGenerationWithProjectForUser: (...args: unknown[]) =>
    associateGenerationWithProjectForUserMock(...args),
  associateMediaFilesWithProjectForUser: (...args: unknown[]) =>
    associateMediaFilesWithProjectForUserMock(...args),
  associateGenerationAndMediaWithProjectForUserBestEffort: async ({
    userId,
    projectId,
    generationId,
    mediaFileIds,
  }: {
    userId: string;
    projectId: string | null | undefined;
    generationId: string;
    mediaFileIds?: string[] | null;
  }) => {
    const normalizedProjectId = typeof projectId === "string" ? projectId.trim() : "";
    if (!normalizedProjectId) return false;
    const associatedGeneration = await associateGenerationWithProjectForUserMock({
      userId,
      projectId: normalizedProjectId,
      generationId,
    });
    const normalizedMediaFileIds =
      Array.isArray(mediaFileIds) && mediaFileIds.length > 0 ? mediaFileIds : [];
    if (normalizedMediaFileIds.length === 0) {
      return associatedGeneration;
    }
    const associatedMedia = await associateMediaFilesWithProjectForUserMock({
      userId,
      projectId: normalizedProjectId,
      mediaFileIds: normalizedMediaFileIds,
    });
    return Boolean(associatedGeneration || associatedMedia);
  },
}));

import { resolveMediaAutosavePreferenceLookupUserMessage } from "../../lib/server/api/mediaAutosavePreference";
import { persistGeneratedImageAsset } from "../../lib/server/openaiImageGeneration";

const resolveInsertSingle = (result: MockQueryResult) => ({
  select: vi.fn(() => ({
    single: vi.fn(async () => ({
      data: result.data ?? null,
      error: result.error ?? null,
    })),
  })),
});

const resolveUpdate = (result: MockQueryResult = { error: null }) => ({
  eq: vi.fn(() => ({
    eq: vi.fn(async () => ({
      data: result.data ?? null,
      error: result.error ?? null,
    })),
  })),
});

describe("persistGeneratedImageAsset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    randomUUIDMock.mockReset();
    randomUUIDMock.mockReturnValueOnce("generation-1").mockReturnValueOnce("request-1");
    uploadMock.mockResolvedValue({ error: null });
    createSignedUrlMock.mockResolvedValue({
      data: { signedUrl: "https://signed.example/generated-image.png" },
      error: null,
    });
    userPreferencesMaybeSingleMock.mockResolvedValue({
      data: { media_autosave_enabled: false },
      error: null,
    });
    aiGenerationsInsertMock.mockImplementation((payload: { id: string }) =>
      resolveInsertSingle({ data: { id: payload.id } })
    );
    aiGenerationsUpdateMock.mockImplementation(() => resolveUpdate());
    mediaFilesInsertMock.mockImplementation(() => resolveInsertSingle({ data: { id: "media-1" } }));
    persistGenerationOutputRecordsMock.mockResolvedValue([
      {
        id: "output-1",
        outputIndex: 0,
        resultUrl: "https://signed.example/generated-image.png",
        mediaFileId: null,
      },
    ]);
    attachMediaFileToGenerationOutputMock.mockResolvedValue(undefined);
    upsertGenerationProjectionMock.mockResolvedValue(undefined);
    upsertGenerationPublicationMock.mockResolvedValue(undefined);
    readGenerationAbandonmentContextMock.mockResolvedValue({
      abandoned: false,
      noRefund: false,
    });
    associateGenerationWithProjectForUserMock.mockResolvedValue(true);
    associateMediaFilesWithProjectForUserMock.mockResolvedValue(true);
    writeAppErrorLogMock.mockResolvedValue({ ok: true, skipped: false, id: "evt-1" });
  });

  it("skips Media Library persistence when autosave is disabled", async () => {
    const result = await persistGeneratedImageAsset({
      userId: "user-1",
      promptText: "Cinematic portrait",
      modelId: "gpt-image-2",
      projectId: "project-1",
      requestedSize: "1024x1024",
      requestedQuality: "medium",
      outputBuffer: Buffer.from("image"),
      outputContentType: "image/png",
    });

    expect(mediaFilesInsertMock).not.toHaveBeenCalled();
    expect(attachMediaFileToGenerationOutputMock).not.toHaveBeenCalled();
    expect(persistGenerationOutputRecordsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "generation-1",
        userId: "user-1",
        providerRequestId: null,
        resultUrls: ["https://signed.example/generated-image.png"],
        metadata: expect.objectContaining({
          autosave_enabled: false,
          autosave_decision: "autosave_skipped",
          autosave_decision_reason: "autosave_disabled",
          requested_size: "1024x1024",
          requested_quality: "medium",
        }),
      })
    );
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "generation-1",
        userId: "user-1",
        saveState: "idle",
        savedMediaIds: [],
        publicationState: "published",
      })
    );
    expect(associateGenerationWithProjectForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      projectId: "project-1",
      generationId: "generation-1",
    });
    expect(associateMediaFilesWithProjectForUserMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      generationId: "generation-1",
      mediaFileId: null,
      requestId: "request-1",
      storagePath: "user-1/generations/images/generation-1/Cinematic-portrait.png",
      signedUrl: "https://signed.example/generated-image.png",
      outputRowId: "output-1",
    });
  });

  it("runs the settlement gate before publication, projection, and project visibility", async () => {
    const beforeVisibleSettlement = vi.fn().mockResolvedValue(undefined);

    await persistGeneratedImageAsset({
      userId: "user-1",
      promptText: "Cinematic portrait",
      modelId: "gpt-image-2",
      projectId: "project-1",
      providerRequestId: "provider-image-1",
      requestId: "request-image-1",
      requestedSize: "1024x1024",
      requestedQuality: "medium",
      outputBuffer: Buffer.from("image"),
      outputContentType: "image/png",
      beforeVisibleSettlement,
    });

    expect(beforeVisibleSettlement).toHaveBeenCalledWith({
      generationId: "generation-1",
      requestId: "request-image-1",
      providerRequestId: "provider-image-1",
      outputRowId: "output-1",
      mediaFileId: null,
    });
    expect(aiGenerationsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "generation-1",
        status: "running",
      })
    );
    expect(persistGenerationOutputRecordsMock.mock.invocationCallOrder[0]).toBeLessThan(
      beforeVisibleSettlement.mock.invocationCallOrder[0]
    );
    expect(beforeVisibleSettlement.mock.invocationCallOrder[0]).toBeLessThan(
      aiGenerationsUpdateMock.mock.invocationCallOrder[0]
    );
    expect(aiGenerationsUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        failure_reason_code: null,
        error_message: null,
      })
    );
    expect(aiGenerationsUpdateMock.mock.invocationCallOrder[0]).toBeLessThan(
      upsertGenerationPublicationMock.mock.invocationCallOrder[0]
    );
    expect(beforeVisibleSettlement.mock.invocationCallOrder[0]).toBeLessThan(
      upsertGenerationPublicationMock.mock.invocationCallOrder[0]
    );
    expect(beforeVisibleSettlement.mock.invocationCallOrder[0]).toBeLessThan(
      upsertGenerationProjectionMock.mock.invocationCallOrder[0]
    );
    expect(beforeVisibleSettlement.mock.invocationCallOrder[0]).toBeLessThan(
      associateGenerationWithProjectForUserMock.mock.invocationCallOrder[0]
    );
  });

  it("does not publish or project visible success when the settlement gate fails", async () => {
    const beforeVisibleSettlement = vi.fn().mockRejectedValue(new Error("billing capture failed"));

    await expect(
      persistGeneratedImageAsset({
        userId: "user-1",
        promptText: "Cinematic portrait",
        modelId: "gpt-image-2",
        projectId: "project-1",
        providerRequestId: "provider-image-1",
        requestId: "request-image-1",
        requestedSize: "1024x1024",
        requestedQuality: "medium",
        outputBuffer: Buffer.from("image"),
        outputContentType: "image/png",
        beforeVisibleSettlement,
      })
    ).rejects.toThrow("billing capture failed");

    expect(upsertGenerationPublicationMock).not.toHaveBeenCalled();
    expect(upsertGenerationProjectionMock).not.toHaveBeenCalled();
    expect(persistGenerationOutputRecordsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "generation-1",
        providerRequestId: "provider-image-1",
        resultUrls: ["https://signed.example/generated-image.png"],
      })
    );
    expect(mediaFilesInsertMock).not.toHaveBeenCalled();
    expect(attachMediaFileToGenerationOutputMock).not.toHaveBeenCalled();
    expect(aiGenerationsUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "fail",
        failure_reason_code: "billing_settlement_failed",
        error_message: "billing capture failed",
      })
    );
    expect(associateGenerationWithProjectForUserMock).not.toHaveBeenCalled();
    expect(associateMediaFilesWithProjectForUserMock).not.toHaveBeenCalled();
  });

  it("fails closed when the autosave preference lookup errors", async () => {
    userPreferencesMaybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: "user preference read failed" },
    });

    const result = await persistGeneratedImageAsset({
      userId: "user-1",
      promptText: "Cinematic portrait",
      modelId: "gpt-image-2",
      projectId: "project-1",
      requestedSize: "1024x1024",
      requestedQuality: "medium",
      outputBuffer: Buffer.from("image"),
      outputContentType: "image/png",
    });

    expect(mediaFilesInsertMock).not.toHaveBeenCalled();
    expect(persistGenerationOutputRecordsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          autosave_enabled: false,
          autosave_preference_source: "lookup_error",
          autosave_decision: "autosave_skipped",
          autosave_decision_reason: "autosave_disabled",
        }),
      })
    );
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "generation-1",
        saveState: "failed",
        saveError: resolveMediaAutosavePreferenceLookupUserMessage({
          enabled: false,
          source: "lookup_error",
        }),
      })
    );
    expect(result).toMatchObject({
      generationId: "generation-1",
      saveState: "failed",
      saveError: resolveMediaAutosavePreferenceLookupUserMessage({
        enabled: false,
        source: "lookup_error",
      }),
    });
  });

  it("keeps output delivery when media autosave insert fails", async () => {
    userPreferencesMaybeSingleMock.mockResolvedValue({
      data: { media_autosave_enabled: true },
      error: null,
    });
    mediaFilesInsertMock.mockImplementation(() =>
      resolveInsertSingle({ error: { message: "Unable to record generated image media." } })
    );

    const result = await persistGeneratedImageAsset({
      userId: "user-1",
      promptText: "Cinematic portrait",
      modelId: "gpt-image-2",
      projectId: "project-1",
      requestedSize: "1024x1024",
      requestedQuality: "medium",
      outputBuffer: Buffer.from("image"),
      outputContentType: "image/png",
    });

    expect(mediaFilesInsertMock).toHaveBeenCalledTimes(1);
    expect(attachMediaFileToGenerationOutputMock).not.toHaveBeenCalled();
    expect(persistGenerationOutputRecordsMock).toHaveBeenCalledTimes(1);
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "generation-1",
        userId: "user-1",
        saveState: "idle",
        savedMediaIds: [],
        publicationState: "published",
      })
    );
    expect(upsertGenerationPublicationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "generation-1",
        ownedMediaFileId: null,
        metadata: expect.objectContaining({
          autosave_decision: "autosave_skipped",
          autosave_decision_reason: "Unable to record generated image media.",
        }),
      })
    );
    expect(associateMediaFilesWithProjectForUserMock).not.toHaveBeenCalled();
    expect(writeAppErrorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.openai_image.media_autosave_failed",
        message: "OpenAI image generation kept result URL after media autosave failed.",
        requestId: "request-1",
        userId: "user-1",
        statusCode: 200,
        metadata: expect.objectContaining({
          generation_id: "generation-1",
          model_id: "gpt-image-2",
          autosave_error: "Unable to record generated image media.",
        }),
      })
    );
    expect(result).toMatchObject({
      generationId: "generation-1",
      mediaFileId: null,
      signedUrl: "https://signed.example/generated-image.png",
      outputRowId: "output-1",
    });
  });

  it("keeps the saved image result when projection persistence fails", async () => {
    userPreferencesMaybeSingleMock.mockResolvedValue({
      data: { media_autosave_enabled: true },
      error: null,
    });
    upsertGenerationProjectionMock.mockRejectedValueOnce({
      code: "PGRST204",
      message: "save_error missing from schema cache",
    });

    const result = await persistGeneratedImageAsset({
      userId: "user-1",
      promptText: "Cinematic portrait",
      modelId: "gpt-image-2",
      projectId: "project-1",
      providerRequestId: "provider-image-1",
      requestId: "request-1",
      requestedSize: "1024x1024",
      requestedQuality: "medium",
      outputBuffer: Buffer.from("image"),
      outputContentType: "image/png",
    });

    expect(result).toMatchObject({
      generationId: "generation-1",
      mediaFileId: "media-1",
      requestId: "request-1",
      saveState: "saved",
      saveError: null,
    });
    expect(associateGenerationWithProjectForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      projectId: "project-1",
      generationId: "generation-1",
    });
    expect(writeAppErrorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.openai_image.projection_write_failed",
        requestId: "request-1",
        userId: "user-1",
        metadata: expect.objectContaining({
          generation_id: "generation-1",
          media_file_id: "media-1",
          project_id: "project-1",
          projection_error: "save_error missing from schema cache",
        }),
      })
    );
  });

  it("marks storage-blocked autosave results with blocked_storage", async () => {
    userPreferencesMaybeSingleMock.mockResolvedValue({
      data: { media_autosave_enabled: true },
      error: null,
    });
    mediaFilesInsertMock.mockImplementation(() =>
      resolveInsertSingle({
        error: {
          message:
            "Media storage limit exceeded (used_bytes=1073741824 incoming_bytes=16 limit_bytes=1073741824)",
        },
      })
    );

    const result = await persistGeneratedImageAsset({
      userId: "user-1",
      promptText: "Cinematic portrait",
      modelId: "gpt-image-2",
      projectId: "project-1",
      requestedSize: "1024x1024",
      requestedQuality: "medium",
      outputBuffer: Buffer.from("image"),
      outputContentType: "image/png",
    });

    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        saveState: "blocked_storage",
        savedMediaIds: [],
      })
    );
    expect(result).toMatchObject({
      saveState: "blocked_storage",
      saveError:
        "Your media storage is full. Delete media, upgrade your plan, or add recurring storage before saving more files.",
    });
  });

  it("persists saved media semantics and project association when autosave succeeds", async () => {
    userPreferencesMaybeSingleMock.mockResolvedValue({
      data: { media_autosave_enabled: true },
      error: null,
    });
    persistGenerationOutputRecordsMock
      .mockResolvedValueOnce([
        {
          id: "output-1",
          outputIndex: 0,
          resultUrl: "https://signed.example/generated-image.png",
          mediaFileId: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "output-1",
          outputIndex: 0,
          resultUrl: "https://signed.example/generated-image.png",
          mediaFileId: "media-1",
        },
      ]);

    const result = await persistGeneratedImageAsset({
      userId: "user-1",
      promptText: "Cinematic portrait",
      modelId: "gpt-image-2",
      projectId: "project-1",
      providerRequestId: "provider-image-1",
      requestId: "billing-source-image-1",
      requestedSize: "1024x1024",
      requestedQuality: "medium",
      outputBuffer: Buffer.from("image"),
      outputContentType: "image/png",
      generationReplay: { source: "reroll-1" },
      characterContext: { characterId: "char-1" },
      styleContext: { styleId: "style-1" },
    });

    expect(mediaFilesInsertMock).toHaveBeenCalledTimes(1);
    expect(attachMediaFileToGenerationOutputMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "generation-1",
        userId: "user-1",
        outputIndex: 0,
        mediaFileId: "media-1",
        resultUrl: "https://signed.example/generated-image.png",
        providerRequestId: "provider-image-1",
      })
    );
    expect(persistGenerationOutputRecordsMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        generationId: "generation-1",
        userId: "user-1",
        providerRequestId: "provider-image-1",
        resultUrls: ["https://signed.example/generated-image.png"],
        mediaFileIds: ["media-1"],
      })
    );
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "generation-1",
        userId: "user-1",
        requestId: "billing-source-image-1",
        saveState: "saved",
        savedMediaIds: ["media-1"],
        publicationState: "published",
        generationReplay: { source: "reroll-1" },
        characterContext: { characterId: "char-1" },
        styleContext: { styleId: "style-1" },
      })
    );
    expect(associateGenerationWithProjectForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      projectId: "project-1",
      generationId: "generation-1",
    });
    expect(associateMediaFilesWithProjectForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      projectId: "project-1",
      mediaFileIds: ["media-1"],
    });
    expect(result).toMatchObject({
      generationId: "generation-1",
      mediaFileId: "media-1",
      requestId: "billing-source-image-1",
      signedUrl: "https://signed.example/generated-image.png",
      outputRowId: "output-1",
    });
  });
});
