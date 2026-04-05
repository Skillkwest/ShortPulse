import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CHARACTER_SHEET_PRIMARY_TAB_LABEL } from "../../constants";
import {
  cleanupOrphanedMedia,
  getCharacterSheetPresetState,
  listCharacterSheetPresetMediaReferences,
  normalizeCharacterSheetPresetAssignments,
  normalizeCharacterSheetPresetState,
  serializeCharacterSheetPresetState,
} from "../characterManagerPersistenceCore";
import { ensureSupabaseQueryClient, readSupabaseUserId } from "../../../../lib/supabaseClient";
import { invalidateSignedMediaUrl } from "../../../../lib/mediaSignedUrlCache";

vi.mock("../../../../lib/supabaseClient", async () => {
  const { createSupabaseClientModuleMock } =
    await import("../../../../tests/support/supabaseClientMock");
  return createSupabaseClientModuleMock();
});

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrl: vi.fn(),
  getSignedMediaUrlsBatch: vi.fn(),
  invalidateSignedMediaUrl: vi.fn(),
}));

const ensureSupabaseQueryClientMock = vi.mocked(ensureSupabaseQueryClient);
const readSupabaseUserIdMock = vi.mocked(readSupabaseUserId);
const invalidateSignedMediaUrlMock = vi.mocked(invalidateSignedMediaUrl);

describe("characterSheetPresets metadata helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readSupabaseUserIdMock.mockResolvedValue("user-1");
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
        tab_order: ["1", "2", "3"],
        tab_labels: {
          "1": "Primary",
          "2": "Alt",
          "3": "Look B",
        },
        tab_descriptions: {
          "1": "Legacy look",
          "2": "Alt look",
          "3": "Primary cinematic look",
        },
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
    expect(parsed?.tabOrder).toEqual(["1", "2", "3"]);
    expect(parsed?.tabLabels["1"]).toBe("Primary");
    expect(parsed?.tabLabels["4"]).toBe("4");
    expect(parsed?.tabDescriptions["2"]).toBe("Alt look");
    expect(parsed?.tabDescriptions["10"]).toBe("");

    const serialized = serializeCharacterSheetPresetState(parsed!);
    expect(serialized).toEqual(
      expect.objectContaining({
        active_preset_id: "3",
        tab_order: ["1", "2", "3"],
        tab_labels: expect.objectContaining({
          "1": "Primary",
          "2": "Alt",
          "3": "Look B",
          "10": "10",
        }),
        tab_descriptions: expect.objectContaining({
          "1": "Legacy look",
          "2": "Alt look",
          "3": "Primary cinematic look",
          "10": "",
        }),
      })
    );
    expect(Object.keys(serialized.presets as Record<string, unknown>).length).toBe(10);
  });

  it("seeds tab 1 description from legacy character description when tab_descriptions is missing", () => {
    const parsed = getCharacterSheetPresetState(
      {
        character_sheet_presets_v1: {
          active_preset_id: "1",
          tab_order: ["1", "2"],
          tab_labels: {
            "1": "1",
            "2": "2",
          },
          presets: {
            "1": { portrait: null, close_up: null, front_shot: null, back_shot: null },
            "2": { portrait: null, close_up: null, front_shot: null, back_shot: null },
          },
        },
      },
      {
        legacyCharacterDescription: "  Legacy description for tab one  ",
      }
    );

    expect(parsed?.tabDescriptions["1"]).toBe("  Legacy description for tab one  ");
    expect(parsed?.tabDescriptions["2"]).toBe("");
  });

  it("clamps malformed tab descriptions to 150 characters", () => {
    const overLimit = "a".repeat(200);
    const parsed = getCharacterSheetPresetState({
      character_sheet_presets_v1: {
        active_preset_id: "1",
        tab_order: ["1"],
        tab_labels: {
          "1": "1",
        },
        tab_descriptions: {
          "1": overLimit,
        },
        presets: {
          "1": { portrait: null, close_up: null, front_shot: null, back_shot: null },
        },
      },
    });

    expect(parsed?.tabDescriptions["1"].length).toBe(150);
  });

  it("derives legacy visible tabs from preset keys when tab_order is absent", () => {
    const parsed = getCharacterSheetPresetState({
      character_sheet_presets_v1: {
        active_preset_id: "3",
        presets: {
          "1": { portrait: null, close_up: null, front_shot: null, back_shot: null },
          "2": { portrait: null, close_up: null, front_shot: null, back_shot: null },
          "4": { portrait: null, close_up: null, front_shot: null, back_shot: null },
        },
      },
    });

    expect(parsed?.tabOrder).toEqual(["1", "2", "4", "3"]);
    expect(parsed?.tabLabels["1"]).toBe(DEFAULT_CHARACTER_SHEET_PRIMARY_TAB_LABEL);
  });

  it("normalizes malformed tab order and labels to safe defaults", () => {
    const normalized = normalizeCharacterSheetPresetState({
      activePresetId: "2",
      tabOrder: ["2", "2", "1", "9"],
      tabLabels: {
        "1": "  Hero  ",
        "2": "   ",
      },
      presets: {
        "1": null,
      },
    });

    expect(normalized.tabOrder).toEqual(["2", "1", "9"]);
    expect(normalized.tabLabels["1"]).toBe("Hero");
    expect(normalized.tabLabels["2"]).toBe("2");
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
    type CountQuery = {
      eq: (column: string, value: string) => CountQuery;
      or: (filters: string) => Promise<{ count: number; error: null }>;
    };
    const createCountQuery = (): CountQuery => {
      const query: CountQuery = {
        eq: () => query,
        or: async () => ({ count: 0, error: null }),
      };
      return query;
    };
    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "character_reference_images") {
          const query = createCountQuery();
          return {
            select: vi.fn(() => query),
          };
        }
        if (table === "character_quick_swap_items") {
          const query = createCountQuery();
          return {
            select: vi.fn(() => query),
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
    } as unknown as ReturnType<typeof ensureSupabaseQueryClient>);

    await cleanupOrphanedMedia({
      mediaFileId: "media-shared",
      storagePath: "user/chars/presets/shared.png",
    });

    expect(mediaDeleteSpy).not.toHaveBeenCalled();
    expect(storageRemoveSpy).not.toHaveBeenCalled();
    expect(invalidateSignedMediaUrlMock).not.toHaveBeenCalled();
  });
});
