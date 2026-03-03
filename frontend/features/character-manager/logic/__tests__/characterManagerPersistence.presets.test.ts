import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteCharacterManagerCharacterSheetPreset,
  saveCharacterManagerActiveCharacterSheetPreset,
  saveCharacterManagerCharacterSheetPresetTabDescription,
  saveCharacterManagerCharacterSheetPresetTabLabel,
  saveCharacterManagerCharacterSheetPresetTabOrder,
} from "../characterManagerPersistence";
import { ensureSupabaseClient } from "../../../../lib/supabaseClient";
import { getSignedMediaUrlsBatch } from "../../../../lib/mediaSignedUrlCache";

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseClient: vi.fn(),
}));

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrl: vi.fn(),
  getSignedMediaUrlsBatch: vi.fn(),
  invalidateSignedMediaUrl: vi.fn(),
}));

const ensureSupabaseClientMock = vi.mocked(ensureSupabaseClient);
const getSignedMediaUrlsBatchMock = vi.mocked(getSignedMediaUrlsBatch);

describe("characterManagerPersistence preset preview hydration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSignedMediaUrlsBatchMock.mockResolvedValue(new Map());
  });

  it("persists active preset selection without rehydrating preview urls", async () => {
    const metadata = {
      character_sheet_presets_v1: {
        active_preset_id: "1",
        tab_order: ["1", "2", "3", "4"],
        tab_labels: {
          "1": "One",
          "2": "Two",
          "3": "Three",
          "4": "Four",
        },
        presets: {
          "1": {
            portrait: {
              media_file_id: "media-portrait",
              storage_path: "user/chars/presets/portrait.png",
            },
            close_up: null,
            front_shot: null,
            back_shot: null,
          },
          "2": {
            portrait: {
              media_file_id: "media-alt-portrait",
              storage_path: "user/chars/presets/alt-portrait.png",
            },
            close_up: null,
            front_shot: null,
            back_shot: null,
          },
        },
      },
    };

    const selectQuery = {
      eq: vi.fn(),
      maybeSingle: vi.fn(async () => ({ data: { metadata }, error: null })),
    };
    selectQuery.eq.mockImplementation(() => selectQuery);

    const updateSecondEq = vi.fn(async () => ({ error: null }));
    const updateFirstEq = { eq: updateSecondEq };
    const updateQuery = {
      eq: vi.fn(() => updateFirstEq),
    };

    ensureSupabaseClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { user: { id: "user-1" } } },
          error: null,
        })),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => selectQuery),
        update: vi.fn(() => updateQuery),
      })),
    } as unknown as ReturnType<typeof ensureSupabaseClient>);

    const result = await saveCharacterManagerActiveCharacterSheetPreset({
      characterId: "char-1",
      presetId: "2",
    });

    expect(result.activePresetId).toBe("2");
    expect(result.tabOrder).toEqual(["1", "2", "3", "4"]);
    expect(result.tabLabels["1"]).toBe("One");
    expect(result.presets["1"].portrait?.previewUrl ?? null).toBeNull();
    expect(result.presets["2"].portrait?.previewUrl ?? null).toBeNull();
    expect(getSignedMediaUrlsBatchMock).not.toHaveBeenCalled();
  });

  it("persists visible preset tab order and active preset", async () => {
    const metadata = {
      character_sheet_presets_v1: {
        active_preset_id: "1",
        tab_order: ["1"],
        tab_labels: { "1": "1" },
        presets: {
          "1": { portrait: null, close_up: null, front_shot: null, back_shot: null },
        },
      },
    };

    const selectQuery = {
      eq: vi.fn(),
      maybeSingle: vi.fn(async () => ({ data: { metadata }, error: null })),
    };
    selectQuery.eq.mockImplementation(() => selectQuery);

    const updateSecondEq = vi.fn(async () => ({ error: null }));
    const updateFirstEq = { eq: updateSecondEq };
    const updateQuery = {
      eq: vi.fn(() => updateFirstEq),
    };

    ensureSupabaseClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { user: { id: "user-1" } } },
          error: null,
        })),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => selectQuery),
        update: vi.fn(() => updateQuery),
      })),
    } as unknown as ReturnType<typeof ensureSupabaseClient>);

    const result = await saveCharacterManagerCharacterSheetPresetTabOrder({
      characterId: "char-1",
      tabOrder: ["1", "2", "3"],
      activePresetId: "3",
    });

    expect(result.activePresetId).toBe("3");
    expect(result.tabOrder).toEqual(["1", "2", "3"]);
    expect(result.tabLabels["3"]).toBe("3");
  });

  it("hydrates preset previews when persisting visible tab order", async () => {
    const metadata = {
      character_sheet_presets_v1: {
        active_preset_id: "1",
        tab_order: ["1", "2"],
        tab_labels: { "1": "Main", "2": "Alt" },
        presets: {
          "1": {
            portrait: {
              media_file_id: "media-portrait",
              storage_path: "user/chars/presets/portrait.png",
            },
            close_up: null,
            front_shot: null,
            back_shot: null,
          },
          "2": { portrait: null, close_up: null, front_shot: null, back_shot: null },
        },
      },
    };

    const selectQuery = {
      eq: vi.fn(),
      maybeSingle: vi.fn(async () => ({ data: { metadata }, error: null })),
    };
    selectQuery.eq.mockImplementation(() => selectQuery);

    const updateSecondEq = vi.fn(async () => ({ error: null }));
    const updateFirstEq = { eq: updateSecondEq };
    const updateQuery = {
      eq: vi.fn(() => updateFirstEq),
    };

    ensureSupabaseClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { user: { id: "user-1" } } },
          error: null,
        })),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => selectQuery),
        update: vi.fn(() => updateQuery),
      })),
    } as unknown as ReturnType<typeof ensureSupabaseClient>);

    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([["user/chars/presets/portrait.png", "https://signed.example/portrait.png"]])
    );

    const result = await saveCharacterManagerCharacterSheetPresetTabOrder({
      characterId: "char-1",
      tabOrder: ["1", "2"],
      activePresetId: "1",
    });

    expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledWith({
      bucket: "media_library",
      storagePaths: ["user/chars/presets/portrait.png"],
    });
    expect(result.presets["1"].portrait?.previewUrl).toBe("https://signed.example/portrait.png");
  });

  it("persists sanitized preset tab labels", async () => {
    const metadata = {
      character_sheet_presets_v1: {
        active_preset_id: "1",
        tab_order: ["1", "2"],
        tab_labels: { "1": "1", "2": "2" },
        presets: {
          "1": { portrait: null, close_up: null, front_shot: null, back_shot: null },
          "2": { portrait: null, close_up: null, front_shot: null, back_shot: null },
        },
      },
    };

    const selectQuery = {
      eq: vi.fn(),
      maybeSingle: vi.fn(async () => ({ data: { metadata }, error: null })),
    };
    selectQuery.eq.mockImplementation(() => selectQuery);

    const updateSecondEq = vi.fn(async () => ({ error: null }));
    const updateFirstEq = { eq: updateSecondEq };
    const updateQuery = {
      eq: vi.fn(() => updateFirstEq),
    };

    ensureSupabaseClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { user: { id: "user-1" } } },
          error: null,
        })),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => selectQuery),
        update: vi.fn(() => updateQuery),
      })),
    } as unknown as ReturnType<typeof ensureSupabaseClient>);

    const result = await saveCharacterManagerCharacterSheetPresetTabLabel({
      characterId: "char-1",
      presetId: "2",
      label: "  Hero  Closeups  ",
    });

    expect(result.tabLabels["2"]).toBe("Hero Closeups");
  });

  it("hydrates preset previews when persisting tab labels", async () => {
    const metadata = {
      character_sheet_presets_v1: {
        active_preset_id: "1",
        tab_order: ["1", "2"],
        tab_labels: { "1": "1", "2": "2" },
        presets: {
          "1": {
            portrait: {
              media_file_id: "media-portrait",
              storage_path: "user/chars/presets/portrait.png",
            },
            close_up: null,
            front_shot: null,
            back_shot: null,
          },
          "2": { portrait: null, close_up: null, front_shot: null, back_shot: null },
        },
      },
    };

    const selectQuery = {
      eq: vi.fn(),
      maybeSingle: vi.fn(async () => ({ data: { metadata }, error: null })),
    };
    selectQuery.eq.mockImplementation(() => selectQuery);

    const updateSecondEq = vi.fn(async () => ({ error: null }));
    const updateFirstEq = { eq: updateSecondEq };
    const updateQuery = {
      eq: vi.fn(() => updateFirstEq),
    };

    ensureSupabaseClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { user: { id: "user-1" } } },
          error: null,
        })),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => selectQuery),
        update: vi.fn(() => updateQuery),
      })),
    } as unknown as ReturnType<typeof ensureSupabaseClient>);

    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([["user/chars/presets/portrait.png", "https://signed.example/portrait.png"]])
    );

    const result = await saveCharacterManagerCharacterSheetPresetTabLabel({
      characterId: "char-1",
      presetId: "2",
      label: "Main",
    });

    expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledWith({
      bucket: "media_library",
      storagePaths: ["user/chars/presets/portrait.png"],
    });
    expect(result.presets["1"].portrait?.previewUrl).toBe("https://signed.example/portrait.png");
  });

  it("deletes a non-primary preset tab and resets its assignments", async () => {
    const metadata = {
      character_sheet_presets_v1: {
        active_preset_id: "2",
        tab_order: ["1", "2"],
        tab_labels: { "1": "1", "2": "Look 2" },
        presets: {
          "1": { portrait: null, close_up: null, front_shot: null, back_shot: null },
          "2": { portrait: null, close_up: null, front_shot: null, back_shot: null },
        },
      },
    };

    const selectQuery = {
      eq: vi.fn(),
      maybeSingle: vi.fn(async () => ({ data: { metadata }, error: null })),
    };
    selectQuery.eq.mockImplementation(() => selectQuery);

    const updateSecondEq = vi.fn(async () => ({ error: null }));
    const updateFirstEq = { eq: updateSecondEq };
    const updateQuery = {
      eq: vi.fn(() => updateFirstEq),
    };

    ensureSupabaseClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { user: { id: "user-1" } } },
          error: null,
        })),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => selectQuery),
        update: vi.fn(() => updateQuery),
      })),
    } as unknown as ReturnType<typeof ensureSupabaseClient>);

    const result = await deleteCharacterManagerCharacterSheetPreset({
      characterId: "char-1",
      presetId: "2",
      nextTabOrder: ["1"],
      nextActivePresetId: "1",
    });

    expect(result.activePresetId).toBe("1");
    expect(result.tabOrder).toEqual(["1"]);
    expect(result.tabLabels["2"]).toBe("2");
    expect(result.presets["2"].portrait).toBeNull();
  });

  it("uses nearest-left fallback when deleting the active preset tab", async () => {
    const metadata = {
      character_sheet_presets_v1: {
        active_preset_id: "3",
        tab_order: ["1", "2", "3", "4"],
        tab_labels: { "1": "1", "2": "2", "3": "Look 3", "4": "4" },
        presets: {
          "1": { portrait: null, close_up: null, front_shot: null, back_shot: null },
          "2": { portrait: null, close_up: null, front_shot: null, back_shot: null },
          "3": { portrait: null, close_up: null, front_shot: null, back_shot: null },
          "4": { portrait: null, close_up: null, front_shot: null, back_shot: null },
        },
      },
    };

    const selectQuery = {
      eq: vi.fn(),
      maybeSingle: vi.fn(async () => ({ data: { metadata }, error: null })),
    };
    selectQuery.eq.mockImplementation(() => selectQuery);

    const updateSecondEq = vi.fn(async () => ({ error: null }));
    const updateFirstEq = { eq: updateSecondEq };
    const updateQuery = {
      eq: vi.fn(() => updateFirstEq),
    };

    ensureSupabaseClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { user: { id: "user-1" } } },
          error: null,
        })),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => selectQuery),
        update: vi.fn(() => updateQuery),
      })),
    } as unknown as ReturnType<typeof ensureSupabaseClient>);

    const result = await deleteCharacterManagerCharacterSheetPreset({
      characterId: "char-1",
      presetId: "3",
      nextTabOrder: ["1", "2", "4"],
      nextActivePresetId: "3",
    });

    expect(result.activePresetId).toBe("2");
    expect(result.tabOrder).toEqual(["1", "2", "4"]);
  });

  it("deletes preset references without invoking media cleanup side effects", async () => {
    const metadata = {
      character_sheet_presets_v1: {
        active_preset_id: "2",
        tab_order: ["1", "2"],
        tab_labels: { "1": "1", "2": "Look 2" },
        presets: {
          "1": { portrait: null, close_up: null, front_shot: null, back_shot: null },
          "2": {
            portrait: {
              media_file_id: "media-delete-me",
              storage_path: "user/chars/presets/delete-me.png",
            },
            close_up: null,
            front_shot: null,
            back_shot: null,
          },
        },
      },
    };

    const selectQuery = {
      eq: vi.fn(),
      maybeSingle: vi.fn(async () => ({ data: { metadata }, error: null })),
    };
    selectQuery.eq.mockImplementation(() => selectQuery);

    const updateSecondEq = vi.fn(async () => ({ error: null }));
    const updateFirstEq = { eq: updateSecondEq };
    const updateQuery = {
      eq: vi.fn(() => updateFirstEq),
    };

    const fromMock = vi.fn((table: string) => {
      if (table !== "characters") {
        throw new Error(`Unexpected table access: ${table}`);
      }
      return {
        select: vi.fn(() => selectQuery),
        update: vi.fn(() => updateQuery),
      };
    });

    ensureSupabaseClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { user: { id: "user-1" } } },
          error: null,
        })),
      },
      from: fromMock,
    } as unknown as ReturnType<typeof ensureSupabaseClient>);

    const result = await deleteCharacterManagerCharacterSheetPreset({
      characterId: "char-1",
      presetId: "2",
      nextTabOrder: ["1"],
      nextActivePresetId: "1",
    });

    expect(result.tabOrder).toEqual(["1"]);
    expect(result.presets["2"].portrait).toBeNull();
    expect(fromMock).toHaveBeenCalledWith("characters");
    expect(fromMock.mock.calls).toHaveLength(2);
  });

  it("persists preset-scoped tab descriptions without touching legacy character description", async () => {
    const metadata = {
      character_sheet_presets_v1: {
        active_preset_id: "2",
        tab_order: ["1", "2"],
        tab_labels: { "1": "1", "2": "Look 2" },
        tab_descriptions: { "1": "Legacy", "2": "Old tab description" },
        presets: {
          "1": { portrait: null, close_up: null, front_shot: null, back_shot: null },
          "2": { portrait: null, close_up: null, front_shot: null, back_shot: null },
        },
      },
    };

    const selectQuery = {
      eq: vi.fn(),
      maybeSingle: vi.fn(async () => ({
        data: { metadata, description: "Legacy description" },
        error: null,
      })),
    };
    selectQuery.eq.mockImplementation(() => selectQuery);

    const updateSecondEq = vi.fn(async () => ({ error: null }));
    const updateFirstEq = { eq: updateSecondEq };
    const updateQuery = {
      eq: vi.fn(() => updateFirstEq),
    };

    ensureSupabaseClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { user: { id: "user-1" } } },
          error: null,
        })),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => selectQuery),
        update: vi.fn(() => updateQuery),
      })),
    } as unknown as ReturnType<typeof ensureSupabaseClient>);

    const result = await saveCharacterManagerCharacterSheetPresetTabDescription({
      characterId: "char-1",
      presetId: "2",
      description: "  New tab-specific look  ",
    });

    expect(result.tabDescriptions["2"]).toBe("  New tab-specific look  ");
    expect(result.tabDescriptions["1"]).toBe("Legacy");
    expect(updateSecondEq).toHaveBeenCalledWith("id", "char-1");
  });

  it("clears deleted preset description while preserving others", async () => {
    const metadata = {
      character_sheet_presets_v1: {
        active_preset_id: "2",
        tab_order: ["1", "2"],
        tab_labels: { "1": "1", "2": "Look 2" },
        tab_descriptions: { "1": "Keep me", "2": "Delete me" },
        presets: {
          "1": { portrait: null, close_up: null, front_shot: null, back_shot: null },
          "2": { portrait: null, close_up: null, front_shot: null, back_shot: null },
        },
      },
    };

    const selectQuery = {
      eq: vi.fn(),
      maybeSingle: vi.fn(async () => ({
        data: { metadata, description: "Legacy description" },
        error: null,
      })),
    };
    selectQuery.eq.mockImplementation(() => selectQuery);

    const updateSecondEq = vi.fn(async () => ({ error: null }));
    const updateFirstEq = { eq: updateSecondEq };
    const updateQuery = {
      eq: vi.fn(() => updateFirstEq),
    };

    ensureSupabaseClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { user: { id: "user-1" } } },
          error: null,
        })),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => selectQuery),
        update: vi.fn(() => updateQuery),
      })),
    } as unknown as ReturnType<typeof ensureSupabaseClient>);

    const result = await deleteCharacterManagerCharacterSheetPreset({
      characterId: "char-1",
      presetId: "2",
      nextTabOrder: ["1"],
      nextActivePresetId: "1",
    });

    expect(result.tabDescriptions["1"]).toBe("Keep me");
    expect(result.tabDescriptions["2"]).toBe("");
  });
});
