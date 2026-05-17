import { beforeEach, describe, expect, it, vi } from "vitest";

const randomUUIDMock = vi.fn();
const persistGenerationOutputRecordsMock = vi.fn();
const upsertGenerationProjectionMock = vi.fn();
const upsertGenerationPublicationMock = vi.fn();
const associateGenerationWithProjectForUserMock = vi.fn();
const associateMediaFilesWithProjectForUserMock = vi.fn();
const writeAppErrorLogMock = vi.fn();

type MockQueryResult = {
  data?: unknown;
  error?: { message?: string } | null;
};

const mediaFilesInsertMock = vi.fn();
const aiGenerationsInsertMock = vi.fn();
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
  persistGenerationOutputRecords: (...args: unknown[]) =>
    persistGenerationOutputRecordsMock(...args),
}));

vi.mock("../../lib/server/api/generationProjection", () => ({
  upsertGenerationProjection: (...args: unknown[]) => upsertGenerationProjectionMock(...args),
}));

vi.mock("../../lib/server/api/generationPublications", () => ({
  upsertGenerationPublication: (...args: unknown[]) => upsertGenerationPublicationMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  writeAppErrorLog: (...args: unknown[]) => writeAppErrorLogMock(...args),
}));

vi.mock("../../lib/server/projectGenerationAssociationsService", () => ({
  associateGenerationWithProjectForUser: (...args: unknown[]) =>
    associateGenerationWithProjectForUserMock(...args),
  associateMediaFilesWithProjectForUser: (...args: unknown[]) =>
    associateMediaFilesWithProjectForUserMock(...args),
}));

import { resolveMediaAutosavePreferenceLookupUserMessage } from "../../lib/server/api/mediaAutosavePreference";
import { persistGeneratedAudioAsset } from "../../lib/server/elevenlabs";

const resolveInsertSingle = (result: MockQueryResult) => ({
  select: vi.fn(() => ({
    single: vi.fn(async () => ({
      data: result.data ?? null,
      error: result.error ?? null,
    })),
  })),
});

describe("persistGeneratedAudioAsset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    randomUUIDMock.mockReset();
    randomUUIDMock.mockReturnValueOnce("generation-1").mockReturnValueOnce("request-1");
    uploadMock.mockResolvedValue({ error: null });
    createSignedUrlMock.mockResolvedValue({
      data: { signedUrl: "https://signed.example/audio.mp3" },
      error: null,
    });
    userPreferencesMaybeSingleMock.mockResolvedValue({
      data: { media_autosave_enabled: false },
      error: null,
    });
    aiGenerationsInsertMock.mockImplementation((payload: { id: string }) =>
      resolveInsertSingle({ data: { id: payload.id } })
    );
    mediaFilesInsertMock.mockImplementation(() => resolveInsertSingle({ data: { id: "media-1" } }));
    persistGenerationOutputRecordsMock.mockResolvedValue([
      {
        id: "output-1",
        outputIndex: 0,
        resultUrl: "https://signed.example/audio.mp3",
        mediaFileId: null,
      },
    ]);
    upsertGenerationPublicationMock.mockResolvedValue(undefined);
    upsertGenerationProjectionMock.mockResolvedValue(undefined);
    associateGenerationWithProjectForUserMock.mockResolvedValue(true);
    associateMediaFilesWithProjectForUserMock.mockResolvedValue(true);
    writeAppErrorLogMock.mockResolvedValue({ ok: true, skipped: false, id: "evt-1" });
  });

  it("skips media_files persistence when autosave is disabled", async () => {
    const result = await persistGeneratedAudioAsset({
      userId: "user-1",
      promptText: "Rainy city ambience",
      provider: "elevenlabs",
      modelId: "music_v1",
      projectId: "project-1",
      sourceMode: "music",
      outputBuffer: Buffer.from("audio"),
      outputContentType: "audio/mpeg",
      outputFormat: "mp3_44100_128",
    });

    expect(mediaFilesInsertMock).not.toHaveBeenCalled();
    expect(persistGenerationOutputRecordsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "generation-1",
        userId: "user-1",
        providerRequestId: null,
        resultUrls: ["https://signed.example/audio.mp3"],
        mediaFileIds: [],
        metadata: expect.objectContaining({
          media_kind: "audio",
          autosave_enabled: false,
          autosave_decision: "autosave_skipped",
          autosave_decision_reason: "autosave_disabled",
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
    expect(upsertGenerationPublicationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "generation-1",
        generationOutputId: "output-1",
        userId: "user-1",
        publicationState: "published",
        ownedMediaFileId: null,
      })
    );
    expect(result).toMatchObject({
      generationId: "generation-1",
      mediaFileId: null,
      requestId: "request-1",
      storagePath: "user-1/generations/audio/generation-1/Rainy_city_ambience.mp3",
      signedUrl: "https://signed.example/audio.mp3",
      outputRowId: "output-1",
    });
  });

  it("fails closed when the autosave preference lookup errors", async () => {
    userPreferencesMaybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: "user preference read failed" },
    });

    const result = await persistGeneratedAudioAsset({
      userId: "user-1",
      promptText: "Rainy city ambience",
      provider: "elevenlabs",
      modelId: "music_v1",
      projectId: "project-1",
      sourceMode: "music",
      outputBuffer: Buffer.from("audio"),
      outputContentType: "audio/mpeg",
      outputFormat: "mp3_44100_128",
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

  it("keeps audio output records when media autosave insert fails", async () => {
    userPreferencesMaybeSingleMock.mockResolvedValue({
      data: { media_autosave_enabled: true },
      error: null,
    });
    mediaFilesInsertMock.mockImplementation(() =>
      resolveInsertSingle({ error: { message: "media_files insert failed" } })
    );

    const result = await persistGeneratedAudioAsset({
      userId: "user-1",
      promptText: "Rainy city ambience",
      provider: "elevenlabs",
      modelId: "music_v1",
      projectId: "project-1",
      sourceMode: "music",
      outputBuffer: Buffer.from("audio"),
      outputContentType: "audio/mpeg",
      outputFormat: "mp3_44100_128",
    });

    expect(mediaFilesInsertMock).toHaveBeenCalledTimes(1);
    expect(persistGenerationOutputRecordsMock).toHaveBeenCalledTimes(1);
    expect(persistGenerationOutputRecordsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "generation-1",
        userId: "user-1",
        resultUrls: ["https://signed.example/audio.mp3"],
        mediaFileIds: [],
        metadata: expect.objectContaining({
          media_kind: "audio",
          autosave_enabled: true,
          autosave_decision: "provider_urls_persisted",
          autosave_decision_reason: "canonical_outputs_before_media_autosave",
        }),
      })
    );
    expect(associateMediaFilesWithProjectForUserMock).not.toHaveBeenCalled();
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "generation-1",
        saveState: "idle",
        resultUrls: ["https://signed.example/audio.mp3"],
        savedMediaIds: [],
      })
    );
    expect(upsertGenerationPublicationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "generation-1",
        ownedMediaFileId: null,
        metadata: expect.objectContaining({
          autosave_decision: "autosave_skipped",
          autosave_decision_reason: "media_files insert failed",
        }),
      })
    );
    expect(writeAppErrorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.elevenlabs.media_autosave_failed",
        message: "ElevenLabs audio generation kept result URL after media autosave failed.",
        requestId: "request-1",
        userId: "user-1",
        statusCode: 200,
        metadata: expect.objectContaining({
          generation_id: "generation-1",
          media_kind: "audio",
          autosave_error: "media_files insert failed",
        }),
      })
    );
    expect(result).toMatchObject({
      generationId: "generation-1",
      mediaFileId: null,
      outputRowId: "output-1",
      signedUrl: "https://signed.example/audio.mp3",
    });
  });

  it("keeps the saved audio result when projection persistence fails", async () => {
    userPreferencesMaybeSingleMock.mockResolvedValue({
      data: { media_autosave_enabled: true },
      error: null,
    });
    upsertGenerationProjectionMock.mockRejectedValueOnce({
      code: "PGRST204",
      message: "save_error missing from schema cache",
    });

    const result = await persistGeneratedAudioAsset({
      userId: "user-1",
      promptText: "Rainy city ambience",
      provider: "elevenlabs",
      modelId: "music_v1",
      projectId: "project-1",
      sourceMode: "music",
      providerRequestId: "provider-1",
      requestId: "request-1",
      outputBuffer: Buffer.from("audio"),
      outputContentType: "audio/mpeg",
      outputFormat: "mp3_44100_128",
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
        source: "telemetry.elevenlabs.projection_write_failed",
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

  it("marks storage-blocked audio autosave results with blocked_storage", async () => {
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

    const result = await persistGeneratedAudioAsset({
      userId: "user-1",
      promptText: "Rainy city ambience",
      provider: "elevenlabs",
      modelId: "music_v1",
      projectId: "project-1",
      sourceMode: "music",
      outputBuffer: Buffer.from("audio"),
      outputContentType: "audio/mpeg",
      outputFormat: "mp3_44100_128",
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

  it("associates autosaved audio media with the active project", async () => {
    userPreferencesMaybeSingleMock.mockResolvedValue({
      data: { media_autosave_enabled: true },
      error: null,
    });

    await persistGeneratedAudioAsset({
      userId: "user-1",
      promptText: "Rainy city ambience",
      provider: "elevenlabs",
      modelId: "music_v1",
      projectId: "project-1",
      sourceMode: "music",
      outputBuffer: Buffer.from("audio"),
      outputContentType: "audio/mpeg",
      outputFormat: "mp3_44100_128",
    });

    expect(associateMediaFilesWithProjectForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      projectId: "project-1",
      mediaFileIds: ["media-1"],
    });
  });
});
