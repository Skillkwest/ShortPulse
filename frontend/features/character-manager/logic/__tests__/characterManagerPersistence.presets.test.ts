import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveCharacterManagerActiveCharacterSheetPreset } from "../characterManagerPersistence";
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

  it("returns hydrated preview urls after preset-tab switch persistence", async () => {
    const metadata = {
      character_sheet_presets_v1: {
        active_preset_id: "1",
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

    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([
        ["user/chars/presets/portrait.png", "https://signed.test/portrait.png"],
        ["user/chars/presets/alt-portrait.png", "https://signed.test/alt-portrait.png"],
      ])
    );

    const result = await saveCharacterManagerActiveCharacterSheetPreset({
      characterId: "char-1",
      presetId: "2",
    });

    expect(result.activePresetId).toBe("2");
    expect(result.presets["1"].portrait?.previewUrl).toBe("https://signed.test/portrait.png");
    expect(result.presets["2"].portrait?.previewUrl).toBe("https://signed.test/alt-portrait.png");
    expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledWith({
      bucket: "media_library",
      storagePaths: ["user/chars/presets/portrait.png", "user/chars/presets/alt-portrait.png"],
    });
  });
});
