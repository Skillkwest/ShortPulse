import { beforeEach, describe, expect, it, vi } from "vitest";

const randomUUIDMock = vi.fn();
const persistGenerationOutputRecordsMock = vi.fn();
const upsertGenerationProjectionMock = vi.fn();
const upsertGenerationPublicationMock = vi.fn();

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
  });

  it("keeps published signed-url authority when autosave is disabled", async () => {
    const result = await persistGeneratedVideoAsset({
      userId: "user-1",
      promptText: "Cinematic skyline reveal",
      provider: "elevenlabs",
      modelId: "video_v1",
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
    expect(result).toMatchObject({
      generationId: "generation-1",
      mediaFileId: null,
      requestId: "request-1",
      storagePath: "user-1/generations/video/generation-1/Cinematic_skyline_reveal.mp4",
      signedUrl: "https://signed.example/video.mp4",
      outputRowId: "output-1",
    });
  });
});
