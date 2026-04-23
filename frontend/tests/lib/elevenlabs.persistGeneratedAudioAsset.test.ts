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
  });

  it("skips media_files persistence when autosave is disabled", async () => {
    const result = await persistGeneratedAudioAsset({
      userId: "user-1",
      promptText: "Rainy city ambience",
      provider: "elevenlabs",
      modelId: "music_v1",
      sourceMode: "music",
      outputBuffer: Buffer.from("audio"),
      outputContentType: "audio/mpeg",
      outputFormat: "mp3_44100_128",
    });

    expect(mediaFilesInsertMock).not.toHaveBeenCalled();
    expect(persistGenerationOutputRecordsMock).toHaveBeenCalledWith({
      generationId: "generation-1",
      userId: "user-1",
      resultUrls: ["https://signed.example/audio.mp3"],
      mediaFileIds: [],
      metadata: expect.objectContaining({
        media_kind: "audio",
        autosave_enabled: false,
        autosave_decision: "autosave_skipped",
        autosave_decision_reason: "autosave_disabled",
      }),
    });
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
});
