import { beforeEach, describe, expect, it, vi } from "vitest";

const randomUUIDMock = vi.fn();
const persistGenerationOutputRecordsMock = vi.fn();
const upsertGenerationProjectionMock = vi.fn();
const upsertGenerationPublicationMock = vi.fn();
const associateGenerationWithProjectForUserMock = vi.fn();
const associateMediaFilesWithProjectForUserMock = vi.fn();
const writeAppErrorLogMock = vi.fn();
const upsertVideoPosterVariantFromBufferMock = vi.fn();
const signVideoPosterVariantMock = vi.fn();
const upsertVideoPreviewVariantFromBufferMock = vi.fn();

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

vi.mock("../../lib/server/videoPosterVariant", () => ({
  upsertVideoPosterVariantFromBuffer: (...args: unknown[]) =>
    upsertVideoPosterVariantFromBufferMock(...args),
  signVideoPosterVariant: (...args: unknown[]) => signVideoPosterVariantMock(...args),
  upsertVideoPreviewVariantFromBuffer: (...args: unknown[]) =>
    upsertVideoPreviewVariantFromBufferMock(...args),
}));

import { persistGeneratedVideoAsset } from "../../lib/server/elevenlabs";

const resolveInsertSingle = (result: MockQueryResult) => ({
  select: vi.fn(() => ({
    single: vi.fn(async () => ({
      data: result.data ?? null,
      error: result.error ?? null,
    })),
  })),
});

describe("persistGeneratedVideoAsset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    randomUUIDMock.mockReset();
    randomUUIDMock.mockReturnValueOnce("generation-1").mockReturnValueOnce("request-1");
    uploadMock.mockResolvedValue({ error: null });
    createSignedUrlMock.mockResolvedValue({
      data: { signedUrl: "https://signed.example/video.mp4" },
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
        resultUrl: "https://signed.example/video.mp4",
        mediaFileId: null,
      },
    ]);
    upsertGenerationPublicationMock.mockResolvedValue(undefined);
    upsertGenerationProjectionMock.mockResolvedValue(undefined);
    associateGenerationWithProjectForUserMock.mockResolvedValue(true);
    associateMediaFilesWithProjectForUserMock.mockResolvedValue(true);
    writeAppErrorLogMock.mockResolvedValue({ ok: true, skipped: false, id: "evt-1" });
    upsertVideoPosterVariantFromBufferMock.mockResolvedValue(null);
    signVideoPosterVariantMock.mockResolvedValue(null);
    upsertVideoPreviewVariantFromBufferMock.mockResolvedValue(null);
  });

  it("keeps published signed-url authority when autosave is disabled", async () => {
    const result = await persistGeneratedVideoAsset({
      userId: "user-1",
      promptText: "Cinematic skyline reveal",
      provider: "elevenlabs",
      modelId: "video_v1",
      projectId: "project-1",
      sourceMode: "voice-changer",
      outputBuffer: Buffer.from("video"),
      outputContentType: "video/mp4",
      generationReplay: { source: "reroll-1" },
      extraMetadata: { remuxed_from: "source-video-1" },
    });

    expect(mediaFilesInsertMock).not.toHaveBeenCalled();
    expect(persistGenerationOutputRecordsMock).toHaveBeenCalledWith({
      generationId: "generation-1",
      userId: "user-1",
      providerRequestId: null,
      resultUrls: ["https://signed.example/video.mp4"],
      mediaFileIds: [],
      metadata: expect.objectContaining({
        media_kind: "video",
        autosave_enabled: false,
        autosave_decision: "autosave_skipped",
        autosave_decision_reason: "autosave_disabled",
        provider_request_id: null,
        remuxed_from: "source-video-1",
      }),
    });
    expect(upsertGenerationPublicationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "generation-1",
        generationOutputId: "output-1",
        userId: "user-1",
        publicationState: "published",
        ownedMediaFileId: null,
        previewUrl: "https://signed.example/video.mp4",
        fullUrl: "https://signed.example/video.mp4",
        previewStoragePath: "user-1/generations/video/generation-1/Cinematic_skyline_reveal.mp4",
        fullStoragePath: "user-1/generations/video/generation-1/Cinematic_skyline_reveal.mp4",
        metadata: expect.objectContaining({
          remuxed_from: "source-video-1",
        }),
      })
    );
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "generation-1",
        userId: "user-1",
        requestId: "request-1",
        previewUrl: "https://signed.example/video.mp4",
        previewStoragePath: "user-1/generations/video/generation-1/Cinematic_skyline_reveal.mp4",
        fullStoragePath: "user-1/generations/video/generation-1/Cinematic_skyline_reveal.mp4",
        saveState: "idle",
        publicationState: "published",
        resultUrls: ["https://signed.example/video.mp4"],
        savedMediaIds: [],
        generationReplay: { source: "reroll-1" },
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
      storagePath: "user-1/generations/video/generation-1/Cinematic_skyline_reveal.mp4",
      signedUrl: "https://signed.example/video.mp4",
      outputRowId: "output-1",
    });
  });

  it("keeps video output records when media autosave insert fails", async () => {
    userPreferencesMaybeSingleMock.mockResolvedValue({
      data: { media_autosave_enabled: true },
      error: null,
    });
    mediaFilesInsertMock.mockImplementation(() =>
      resolveInsertSingle({ error: { message: "media_files insert failed" } })
    );

    const result = await persistGeneratedVideoAsset({
      userId: "user-1",
      promptText: "Cinematic skyline reveal",
      provider: "elevenlabs",
      modelId: "video_v1",
      projectId: "project-1",
      sourceMode: "voice-changer",
      outputBuffer: Buffer.from("video"),
      outputContentType: "video/mp4",
      generationReplay: { source: "reroll-1" },
      extraMetadata: { remuxed_from: "source-video-1" },
    });

    expect(mediaFilesInsertMock).toHaveBeenCalledTimes(1);
    expect(persistGenerationOutputRecordsMock).toHaveBeenCalledTimes(1);
    expect(persistGenerationOutputRecordsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "generation-1",
        userId: "user-1",
        resultUrls: ["https://signed.example/video.mp4"],
        mediaFileIds: [],
        metadata: expect.objectContaining({
          media_kind: "video",
          autosave_enabled: true,
          autosave_decision: "provider_urls_persisted",
          autosave_decision_reason: "canonical_outputs_before_media_autosave",
        }),
      })
    );
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "generation-1",
        saveState: "idle",
        resultUrls: ["https://signed.example/video.mp4"],
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
    expect(associateMediaFilesWithProjectForUserMock).not.toHaveBeenCalled();
    expect(writeAppErrorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.elevenlabs.media_autosave_failed",
        message: "ElevenLabs video generation kept result URL after media autosave failed.",
        requestId: "request-1",
        userId: "user-1",
        statusCode: 200,
        metadata: expect.objectContaining({
          generation_id: "generation-1",
          media_kind: "video",
          autosave_error: "media_files insert failed",
        }),
      })
    );
    expect(result).toMatchObject({
      generationId: "generation-1",
      mediaFileId: null,
      outputRowId: "output-1",
      signedUrl: "https://signed.example/video.mp4",
    });
  });

  it("associates autosaved video media with the active project", async () => {
    userPreferencesMaybeSingleMock.mockResolvedValue({
      data: { media_autosave_enabled: true },
      error: null,
    });

    await persistGeneratedVideoAsset({
      userId: "user-1",
      promptText: "Cinematic skyline reveal",
      provider: "elevenlabs",
      modelId: "video_v1",
      projectId: "project-1",
      sourceMode: "voice-changer",
      outputBuffer: Buffer.from("video"),
      outputContentType: "video/mp4",
      generationReplay: { source: "reroll-1" },
      extraMetadata: { remuxed_from: "source-video-1" },
    });

    expect(associateMediaFilesWithProjectForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      projectId: "project-1",
      mediaFileIds: ["media-1"],
    });
  });

  it("publishes the generated preview-loop path when autosaved video preview generation succeeds", async () => {
    userPreferencesMaybeSingleMock.mockResolvedValue({
      data: { media_autosave_enabled: true },
      error: null,
    });
    upsertVideoPreviewVariantFromBufferMock.mockResolvedValueOnce(
      "user-1/variants/videos/media-1/preview_loop_360p.mp4"
    );

    await persistGeneratedVideoAsset({
      userId: "user-1",
      promptText: "Cinematic skyline reveal",
      provider: "elevenlabs",
      modelId: "video_v1",
      projectId: "project-1",
      sourceMode: "voice-changer",
      outputBuffer: Buffer.from("video"),
      outputContentType: "video/mp4",
    });

    expect(upsertVideoPreviewVariantFromBufferMock).toHaveBeenCalledWith(
      expect.objectContaining({
        supabaseAdmin: supabaseAdminMock,
        userId: "user-1",
        mediaFileId: "media-1",
        videoBuffer: Buffer.from("video"),
        videoMimeType: "video/mp4",
        metadata: expect.objectContaining({
          generated_by: "elevenlabs_video_persistence",
          generation_id: "generation-1",
          source_mode: "voice-changer",
        }),
      })
    );
    expect(upsertGenerationPublicationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        previewStoragePath: "user-1/variants/videos/media-1/preview_loop_360p.mp4",
        fullStoragePath: "user-1/generations/video/generation-1/Cinematic_skyline_reveal.mp4",
      })
    );
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        previewStoragePath: "user-1/variants/videos/media-1/preview_loop_360p.mp4",
        fullStoragePath: "user-1/generations/video/generation-1/Cinematic_skyline_reveal.mp4",
      })
    );
  });
});
