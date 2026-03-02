import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteCharacterManagerCharacterSheetPreset,
  saveCharacterManagerActiveCharacterSheetPreset,
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
});
