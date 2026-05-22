import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanupAudioCompanionArt } from "../cleanup";

const getSupabaseAdminMock = vi.fn();
const upsertGenerationProjectionMock = vi.fn();
const writeAppErrorLogMock = vi.fn();

vi.mock("../../api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../api/generationProjection", () => ({
  upsertGenerationProjection: (...args: unknown[]) => upsertGenerationProjectionMock(...args),
}));

vi.mock("../../api/appErrorLogs", () => ({
  writeAppErrorLog: (...args: unknown[]) => writeAppErrorLogMock(...args),
}));

const createProjectionSelectBuilder = (result: { data: unknown; error: unknown }) => {
  const builder: Record<string, unknown> = {};
  builder.eq = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => result);
  return builder;
};

describe("cleanupAudioCompanionArt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upsertGenerationProjectionMock.mockResolvedValue(undefined);
    writeAppErrorLogMock.mockResolvedValue({ ok: true });
  });

  it("removes existing companion-art storage and clears projection metadata", async () => {
    const removeMock = vi.fn(async () => ({ error: null }));
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "generation_projection") {
          return {
            select: vi.fn(() =>
              createProjectionSelectBuilder({
                data: {
                  companion_art_storage_path:
                    "user-1/generations/audio/gen-1/companion-art/cover.webp",
                },
                error: null,
              })
            ),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          remove: removeMock,
        })),
      },
    });

    const result = await cleanupAudioCompanionArt({
      generationId: "gen-1",
      userId: "user-1",
    });

    expect(removeMock).toHaveBeenCalledWith([
      "user-1/generations/audio/gen-1/companion-art/cover.webp",
    ]);
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        userId: "user-1",
        companionArtStatus: null,
        companionArtStoragePath: null,
      })
    );
    expect(result).toEqual({
      clearedProjection: true,
      deletedStoragePath: "user-1/generations/audio/gen-1/companion-art/cover.webp",
      storageDeleted: true,
    });
  });

  it("logs storage cleanup failures without skipping projection clear", async () => {
    const removeMock = vi.fn(async () => ({
      error: { message: "storage remove failed" },
    }));
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "generation_projection") {
          return {
            select: vi.fn(() =>
              createProjectionSelectBuilder({
                data: {
                  companion_art_storage_path:
                    "user-1/generations/audio/gen-2/companion-art/cover.png",
                },
                error: null,
              })
            ),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          remove: removeMock,
        })),
      },
    });

    const result = await cleanupAudioCompanionArt({
      generationId: "gen-2",
      userId: "user-1",
    });

    expect(writeAppErrorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.audio_companion_art.cleanup_storage_failed",
      })
    );
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-2",
        userId: "user-1",
      })
    );
    expect(result).toEqual({
      clearedProjection: true,
      deletedStoragePath: "user-1/generations/audio/gen-2/companion-art/cover.png",
      storageDeleted: false,
    });
  });
});
