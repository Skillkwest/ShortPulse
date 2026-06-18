import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDraftCharacter,
  fetchCharacterManagerList,
  getCharacterSheetAssignments,
  serializeCharacterSheetPresetState,
} from "../characterManagerPersistenceCore";
import { createDefaultCharacterSheetPresetState } from "../../constants";
import { ensureSupabaseQueryClient, readSupabaseUserId } from "../../../../lib/supabaseClient";
import { getSignedMediaUrlsBatch } from "../../../../lib/mediaSignedUrlCache";

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
const getSignedMediaUrlsBatchMock = vi.mocked(getSignedMediaUrlsBatch);

const createAwaitableQuery = <TData>(data: TData, error: unknown = null) => {
  const query = {
    data,
    error,
    eq: () => query,
    neq: () => query,
    in: () => query,
    order: () => query,
    limit: () => query,
    maybeSingle: async () => ({ data, error }),
    single: async () => ({ data, error }),
  };
  return query;
};

describe("characterManagerPersistenceCore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readSupabaseUserIdMock.mockResolvedValue("user-1");
    getSignedMediaUrlsBatchMock.mockResolvedValue(new Map());
  });

  it("repairs missing character sheets while listing characters", async () => {
    const createdSheetRows: Array<Record<string, unknown>> = [];
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([
        ["user-1/variants/images/media-profile-1/thumb_240", "https://signed.example/thumb.webp"],
      ])
    );
    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "characters") {
          return {
            select: () =>
              createAwaitableQuery([
                {
                  id: "char-1",
                  name: "Hero",
                  description: "",
                  status: "draft",
                  updated_at: "2026-04-25T00:00:00.000Z",
                  metadata: {
                    profile_image_storage_path: "user-1/characters/char-1/profile/original.png",
                    profile_image_character_media_id: "media-profile-1",
                  },
                },
                {
                  id: "char-2",
                  name: "Ayla",
                  description: "",
                  status: "draft",
                  updated_at: "2026-04-24T00:00:00.000Z",
                  metadata: {},
                },
              ]),
          };
        }
        if (table === "media_files") {
          return {
            select: () =>
              createAwaitableQuery([
                {
                  id: "media-profile-1",
                  filename: "original.png",
                  storage_path: "user-1/characters/char-1/profile/original.png",
                  file_type: "image/png",
                  file_size: 2048,
                  metadata: {},
                  thumb_variant_path: "user-1/variants/images/media-profile-1/thumb_240",
                  poster_variant_path: null,
                  preview_variant_path: null,
                  created_at: "2026-04-25T00:00:00.000Z",
                },
              ]),
          };
        }
        if (table === "character_reference_packs") {
          return {
            select: () =>
              createAwaitableQuery([
                {
                  id: "sheet-1",
                  character_id: "char-1",
                  status: "ready",
                  version: 2,
                },
              ]),
            insert: (payload: Record<string, unknown>) => {
              createdSheetRows.push(payload);
              return {
                select: () =>
                  createAwaitableQuery({
                    id: "sheet-2",
                    character_id: payload.character_id,
                    status: "draft",
                    version: 1,
                  }),
              };
            },
          };
        }
        if (table === "character_reference_images") {
          return {
            select: () => createAwaitableQuery([]),
          };
        }
        throw new Error(`Unexpected table lookup: ${table}`);
      }),
    } as unknown as ReturnType<typeof ensureSupabaseQueryClient>);

    const result = await fetchCharacterManagerList();

    expect(createdSheetRows).toEqual([
      {
        character_id: "char-2",
        user_id: "user-1",
        version: 1,
        status: "draft",
      },
    ]);
    expect(result).toEqual([
      expect.objectContaining({
        characterId: "char-1",
        characterSheetId: "sheet-1",
        profileImageUrl: "https://signed.example/thumb.webp",
        profileImageCharacterMediaId: "media-profile-1",
        profileImageStoragePath: "user-1/characters/char-1/profile/original.png",
        profileImagePreviewStoragePath: "user-1/variants/images/media-profile-1/thumb_240",
      }),
      expect.objectContaining({
        characterId: "char-2",
        characterSheetId: "sheet-2",
      }),
    ]);
    expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledWith({
      bucket: "media_library",
      storagePaths: [
        "user-1/variants/images/media-profile-1/thumb_240",
        "user-1/characters/char-1/profile/original.png",
      ],
      surface: "character-grid",
    });
  });

  it("falls back to the original profile asset when the durable preview path does not sign", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([
        ["user-1/variants/images/media-profile-1/thumb_240", null],
        [
          "user-1/characters/char-1/profile/original.png",
          "https://signed.example/original-profile.png",
        ],
      ])
    );
    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "characters") {
          return {
            select: () =>
              createAwaitableQuery([
                {
                  id: "char-1",
                  name: "Hero",
                  description: "",
                  status: "draft",
                  updated_at: "2026-04-25T00:00:00.000Z",
                  metadata: {
                    profile_image_storage_path: "user-1/characters/char-1/profile/original.png",
                    profile_image_character_media_id: "media-profile-1",
                  },
                },
              ]),
          };
        }
        if (table === "media_files") {
          return {
            select: () =>
              createAwaitableQuery([
                {
                  id: "media-profile-1",
                  filename: "original.png",
                  storage_path: "user-1/characters/char-1/profile/original.png",
                  file_type: "image/png",
                  file_size: 2048,
                  metadata: {},
                  thumb_variant_path: "user-1/variants/images/media-profile-1/thumb_240",
                  poster_variant_path: null,
                  preview_variant_path: null,
                  created_at: "2026-04-25T00:00:00.000Z",
                },
              ]),
          };
        }
        if (table === "character_reference_packs") {
          return {
            select: () =>
              createAwaitableQuery([
                {
                  id: "sheet-1",
                  character_id: "char-1",
                  status: "ready",
                  version: 2,
                },
              ]),
          };
        }
        if (table === "character_reference_images") {
          return {
            select: () => createAwaitableQuery([]),
          };
        }
        throw new Error(`Unexpected table lookup: ${table}`);
      }),
    } as unknown as ReturnType<typeof ensureSupabaseQueryClient>);

    const result = await fetchCharacterManagerList();

    expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledWith({
      bucket: "media_library",
      storagePaths: [
        "user-1/variants/images/media-profile-1/thumb_240",
        "user-1/characters/char-1/profile/original.png",
      ],
      surface: "character-grid",
    });
    expect(result).toEqual([
      expect.objectContaining({
        characterId: "char-1",
        profileImageUrl: "https://signed.example/original-profile.png",
        profileImagePreviewStoragePath: "user-1/characters/char-1/profile/original.png",
      }),
    ]);
  });

  it("prefers the active preset portrait slot for character chip avatars", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([
        [
          "user-1/variants/characters/char-1/presets/look-2-portrait-thumb.webp",
          "https://signed.example/look-2-portrait-thumb.webp",
        ],
      ])
    );
    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "characters") {
          return {
            select: () =>
              createAwaitableQuery([
                {
                  id: "char-1",
                  name: "Hero",
                  description: "",
                  status: "draft",
                  updated_at: "2026-04-25T00:00:00.000Z",
                  metadata: {
                    character_sheet_presets_v1: {
                      active_preset_id: "2",
                      tab_order: ["1", "2"],
                      tab_labels: {
                        "1": "1",
                        "2": "2",
                      },
                      tab_descriptions: {
                        "1": "",
                        "2": "",
                      },
                      presets: {
                        "1": {
                          portrait: {
                            character_media_id: "media-look-1-portrait",
                            storage_path: "user-1/characters/char-1/presets/look-1-portrait.png",
                            preview_storage_path:
                              "user-1/variants/characters/char-1/presets/look-1-portrait-thumb.webp",
                          },
                        },
                        "2": {
                          portrait: {
                            character_media_id: "media-look-2-portrait",
                            storage_path: "user-1/characters/char-1/presets/look-2-portrait.png",
                            preview_storage_path:
                              "user-1/variants/characters/char-1/presets/look-2-portrait-thumb.webp",
                          },
                        },
                      },
                    },
                  },
                },
              ]),
          };
        }
        if (table === "character_reference_packs") {
          return {
            select: () =>
              createAwaitableQuery([
                {
                  id: "sheet-1",
                  character_id: "char-1",
                  status: "ready",
                  version: 2,
                },
              ]),
          };
        }
        if (table === "character_reference_images") {
          return {
            select: () => createAwaitableQuery([]),
          };
        }
        throw new Error(`Unexpected table lookup: ${table}`);
      }),
    } as unknown as ReturnType<typeof ensureSupabaseQueryClient>);

    const result = await fetchCharacterManagerList();

    expect(result).toEqual([
      expect.objectContaining({
        characterId: "char-1",
        profileImageUrl: "https://signed.example/look-2-portrait-thumb.webp",
        profileImageCharacterMediaId: "media-look-2-portrait",
        profileImageStoragePath: "user-1/characters/char-1/presets/look-2-portrait.png",
        profileImagePreviewStoragePath:
          "user-1/variants/characters/char-1/presets/look-2-portrait-thumb.webp",
        profileImageTransform: null,
      }),
    ]);
    expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledWith({
      bucket: "media_library",
      storagePaths: [
        "user-1/variants/characters/char-1/presets/look-2-portrait-thumb.webp",
        "user-1/characters/char-1/presets/look-2-portrait.png",
      ],
      surface: "character-grid",
    });
  });

  it("serializes character sheet presets without persisting signed preview urls", () => {
    const presetState = createDefaultCharacterSheetPresetState();
    presetState.activePresetId = "2";
    presetState.tabOrder = ["1", "2"];
    presetState.presets["2"].portrait = {
      characterMediaId: "media-look-2-portrait",
      storagePath: "user-1/characters/char-1/presets/look-2-portrait.png",
      previewStoragePath: "user-1/variants/characters/char-1/presets/look-2-portrait-thumb.webp",
      previewUrl: "https://signed.example/look-2-portrait-thumb.webp",
    };

    const serialized = serializeCharacterSheetPresetState(presetState);
    const presets = serialized.presets as Record<string, Record<string, Record<string, unknown>>>;

    expect(presets["2"].portrait).toEqual({
      character_media_id: "media-look-2-portrait",
      storage_path: "user-1/characters/char-1/presets/look-2-portrait.png",
      preview_storage_path: "user-1/variants/characters/char-1/presets/look-2-portrait-thumb.webp",
    });
  });

  it("cleans up the created character row when initial sheet creation fails", async () => {
    const deletedCharacterIds: string[] = [];
    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "characters") {
          return {
            insert: () => ({
              select: () =>
                createAwaitableQuery({
                  id: "char-failed",
                  name: "Broken Hero",
                  description: "",
                  status: "draft",
                  metadata: {},
                }),
            }),
            delete: () => {
              const query = {
                data: null,
                error: null,
                eq: (column: string, value: string) => {
                  if (column === "id") {
                    deletedCharacterIds.push(value);
                  }
                  return query;
                },
              };
              return query;
            },
          };
        }
        if (table === "character_reference_packs") {
          return {
            insert: () => ({
              select: () =>
                createAwaitableQuery(
                  null,
                  new Error("Unable to create a character sheet right now.")
                ),
            }),
          };
        }
        throw new Error(`Unexpected table lookup: ${table}`);
      }),
    } as unknown as ReturnType<typeof ensureSupabaseQueryClient>);

    await expect(createDraftCharacter("Broken Hero")).rejects.toThrow(
      "Unable to create a character sheet right now."
    );
    expect(deletedCharacterIds).toEqual(["char-failed"]);
  });

  it("reads only canonical character sheet assignment metadata", () => {
    expect(
      getCharacterSheetAssignments({
        character_sheet_assignments: {
          portrait: "front_full",
        },
      })
    ).toEqual(
      expect.objectContaining({
        portrait: "front_full",
      })
    );
  });
});
