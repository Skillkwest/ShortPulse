import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanupOrphanedMedia,
  getCharacterSheetPresetState,
  listCharacterSheetPresetMediaReferences,
  normalizeCharacterSheetPresetAssignments,
  serializeCharacterSheetPresetState,
} from "../characterManagerPersistenceCore";
import { ensureSupabaseClient } from "../../../../lib/supabaseClient";
import { invalidateSignedMediaUrl } from "../../../../lib/mediaSignedUrlCache";

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseClient: vi.fn(),
}));

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrl: vi.fn(),
  getSignedMediaUrlsBatch: vi.fn(),
  invalidateSignedMediaUrl: vi.fn(),
}));

const ensureSupabaseClientMock = vi.mocked(ensureSupabaseClient);
const invalidateSignedMediaUrlMock = vi.mocked(invalidateSignedMediaUrl);

describe("characterSheetPresets metadata helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes malformed preset assignments to a shape-stable record", () => {
    const normalized = normalizeCharacterSheetPresetAssignments({
      portrait: {
        media_file_id: "media-1",
        storage_path: "user/chars/presets/p1.png",
      } as unknown as { mediaFileId: string; storagePath: string; previewUrl: string | null },
      close_up: {
        mediaFileId: "media-2",
        storagePath: "user/chars/presets/p2.png",
        previewUrl: null,
      },
      front_shot: null,
      back_shot: {
        mediaFileId: "",
        storagePath: "  ",
        previewUrl: null,
      },
    });

    expect(normalized.portrait).toEqual({
      mediaFileId: "media-1",
      storagePath: "user/chars/presets/p1.png",
      previewUrl: null,
    });
    expect(normalized.close_up).toEqual({
      mediaFileId: "media-2",
      storagePath: "user/chars/presets/p2.png",
      previewUrl: null,
    });
    expect(normalized.front_shot).toBeNull();
    expect(normalized.back_shot).toBeNull();
  });

  it("parses preset state from metadata and round-trips through serializer", () => {
    const parsed = getCharacterSheetPresetState({
      character_sheet_presets_v1: {
        active_preset_id: "3",
        presets: {
          "1": {
            portrait: null,
            close_up: null,
            front_shot: null,
            back_shot: null,
          },
          "2": {
            portrait: {
              media_file_id: "media-portrait",
              storage_path: "user/chars/presets/portrait.png",
            },
          },
        },
      },
    });

    expect(parsed?.activePresetId).toBe("3");
    expect(parsed?.presets["2"].portrait).toEqual({
      mediaFileId: "media-portrait",
      storagePath: "user/chars/presets/portrait.png",
      previewUrl: null,
    });

    const serialized = serializeCharacterSheetPresetState(parsed!);
    expect(serialized).toEqual({
      active_preset_id: "3",
      presets: {
        "1": { portrait: null, close_up: null, front_shot: null, back_shot: null },
        "2": {
          portrait: {
            media_file_id: "media-portrait",
            storage_path: "user/chars/presets/portrait.png",
          },
          close_up: null,
          front_shot: null,
          back_shot: null,
        },
        "3": { portrait: null, close_up: null, front_shot: null, back_shot: null },
        "4": { portrait: null, close_up: null, front_shot: null, back_shot: null },
      },
    });
  });

  it("collects deduplicated preset media references for cleanup guards", () => {
    const references = listCharacterSheetPresetMediaReferences({
      character_sheet_presets_v1: {
        active_preset_id: "1",
        presets: {
          "1": {
            portrait: {
              media_file_id: "media-shared",
              storage_path: "user/chars/presets/shared.png",
            },
            close_up: {
              media_file_id: "media-shared",
              storage_path: "user/chars/presets/shared.png",
            },
            front_shot: {
              media_file_id: "media-front",
              storage_path: "user/chars/presets/front.png",
            },
            back_shot: null,
          },
        },
      },
    });

    expect(references).toEqual([
      {
        mediaFileId: "media-shared",
        storagePath: "user/chars/presets/shared.png",
      },
      {
        mediaFileId: "media-front",
        storagePath: "user/chars/presets/front.png",
      },
    ]);
  });

  it("does not delete media/storage when referenced by any preset metadata", async () => {
    const mediaDeleteSpy = vi.fn(async () => ({ error: null }));
    const storageRemoveSpy = vi.fn(async () => ({ error: null }));
    ensureSupabaseClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { user: { id: "user-1" } } },
          error: null,
        })),
      },
      from: vi.fn((table: string) => {
        if (table === "character_reference_images") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(async () => ({ count: 0, error: null })),
              })),
            })),
          };
        }
        if (table === "character_quick_swap_items") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(async () => ({ count: 0, error: null })),
              })),
            })),
          };
        }
        if (table === "characters") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                neq: vi.fn(async () => ({
                  data: [
                    {
                      metadata: {
                        character_sheet_presets_v1: {
                          active_preset_id: "1",
                          presets: {
                            "1": {
                              portrait: {
                                media_file_id: "media-shared",
                                storage_path: "user/chars/presets/shared.png",
                              },
                              close_up: null,
                              front_shot: null,
                              back_shot: null,
                            },
                          },
                        },
                      },
                    },
                  ],
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === "media_files") {
          return {
            delete: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: mediaDeleteSpy,
              })),
            })),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          remove: storageRemoveSpy,
        })),
      },
    } as unknown as ReturnType<typeof ensureSupabaseClient>);

    await cleanupOrphanedMedia({
      mediaFileId: "media-shared",
      storagePath: "user/chars/presets/shared.png",
    });

    expect(mediaDeleteSpy).not.toHaveBeenCalled();
    expect(storageRemoveSpy).not.toHaveBeenCalled();
    expect(invalidateSignedMediaUrlMock).not.toHaveBeenCalled();
  });
});
