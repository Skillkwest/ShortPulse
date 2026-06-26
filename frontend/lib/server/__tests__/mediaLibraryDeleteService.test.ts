import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteMediaFileForUser } from "../mediaLibraryDeleteService";

const getSupabaseAdminMock = vi.fn();
const cleanupAudioCompanionArtMock = vi.fn();

vi.mock("../api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../audioCompanionArt/cleanup", () => ({
  cleanupAudioCompanionArt: (...args: unknown[]) => cleanupAudioCompanionArtMock(...args),
}));

const createMaybeSingleBuilder = (result: { data: unknown; error: unknown }) => {
  const builder: Record<string, unknown> = {};
  builder.eq = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => result);
  return builder;
};

const createDeleteBuilder = (result: { data: unknown; error: unknown }) => {
  const builder: Record<string, unknown> = {};
  builder.eq = vi.fn(() => builder);
  builder.select = vi.fn(() => ({
    maybeSingle: vi.fn(async () => result),
  }));
  return builder;
};

describe("deleteMediaFileForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanupAudioCompanionArtMock.mockResolvedValue({
      clearedProjection: true,
      deletedStoragePath: "user-1/generations/audio/gen-audio-1/companion-art/cover.webp",
      storageDeleted: true,
    });
  });

  it("deletes generated audio media and invokes companion-art cleanup", async () => {
    const storageRemoveMock = vi.fn(async () => ({ error: null }));
    const mediaSelectBuilder = createMaybeSingleBuilder({
      data: {
        id: "media-1",
        storage_path: "user-1/generations/audio/gen-audio-1/audio.mp3",
        file_type: "audio/mpeg",
        source: "ai_studio",
        source_ref: "gen-audio-1",
      },
      error: null,
    });
    const mediaDeleteBuilder = createDeleteBuilder({
      data: { id: "media-1" },
      error: null,
    });
    const variantsBuilder = {
      eq: vi.fn(() => variantsBuilder),
      then: undefined,
    } as unknown as {
      eq: ReturnType<typeof vi.fn>;
      then?: undefined;
    };
    variantsBuilder.eq.mockReturnValueOnce(variantsBuilder).mockResolvedValueOnce({
      data: [{ storage_path: "user-1/generations/audio/gen-audio-1/waveform.webp" }],
      error: null,
    });
    const supabaseAdmin = {
      from: vi.fn((table: string) => {
        if (table === "media_files") {
          return {
            select: vi.fn(() => mediaSelectBuilder),
            delete: vi.fn(() => mediaDeleteBuilder),
          };
        }
        if (table === "media_asset_variants") {
          return {
            select: vi.fn(() => variantsBuilder),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          remove: storageRemoveMock,
        })),
      },
    };
    getSupabaseAdminMock.mockReturnValue(supabaseAdmin);

    const result = await deleteMediaFileForUser({
      userId: "user-1",
      mediaFileId: "media-1",
    });

    expect(storageRemoveMock).toHaveBeenCalledWith([
      "user-1/generations/audio/gen-audio-1/audio.mp3",
      "user-1/generations/audio/gen-audio-1/waveform.webp",
    ]);
    expect(cleanupAudioCompanionArtMock).toHaveBeenCalledWith({
      generationId: "gen-audio-1",
      userId: "user-1",
      clearProjection: true,
      supabaseAdmin,
    });
    expect(result).toEqual({
      deletedMediaId: "media-1",
      deletedStoragePaths: [
        "user-1/generations/audio/gen-audio-1/audio.mp3",
        "user-1/generations/audio/gen-audio-1/waveform.webp",
      ],
      cleanedGeneratedAudioCompanionArt: true,
    });
  });

  it("does not clean companion art for non-generated image media", async () => {
    const storageRemoveMock = vi.fn(async () => ({ error: null }));
    const mediaSelectBuilder = createMaybeSingleBuilder({
      data: {
        id: "media-2",
        storage_path: "user-1/images/uploaded.png",
        file_type: "image/png",
        source: "upload",
        source_ref: null,
      },
      error: null,
    });
    const mediaDeleteBuilder = createDeleteBuilder({
      data: { id: "media-2" },
      error: null,
    });
    const variantsBuilder = {
      eq: vi.fn(() => variantsBuilder),
      then: undefined,
    } as unknown as {
      eq: ReturnType<typeof vi.fn>;
      then?: undefined;
    };
    variantsBuilder.eq.mockReturnValueOnce(variantsBuilder).mockResolvedValueOnce({
      data: [],
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "media_files") {
          return {
            select: vi.fn(() => mediaSelectBuilder),
            delete: vi.fn(() => mediaDeleteBuilder),
          };
        }
        if (table === "media_asset_variants") {
          return {
            select: vi.fn(() => variantsBuilder),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          remove: storageRemoveMock,
        })),
      },
    });

    const result = await deleteMediaFileForUser({
      userId: "user-1",
      mediaFileId: "media-2",
    });

    expect(cleanupAudioCompanionArtMock).not.toHaveBeenCalled();
    expect(result.cleanedGeneratedAudioCompanionArt).toBe(false);
  });
});
