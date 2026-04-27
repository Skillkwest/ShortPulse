import { describe, expect, it } from "vitest";
import { createDefaultCharacterSheetPresetState } from "../../../character-manager/constants";
import type { CharacterManagerDraftSnapshot } from "../../../character-manager/logic/characterManagerPersistence";
import {
  buildCharacterModeInjectionBundleFromSnapshot,
  buildCharacterModeLookOptions,
  resolveCharacterModeLookSelection,
} from "../characterModeLookSelection";

const createSnapshot = (
  overrides: Partial<CharacterManagerDraftSnapshot> = {}
): CharacterManagerDraftSnapshot => {
  const defaultPresetState = createDefaultCharacterSheetPresetState();
  return {
    userId: "user-1",
    characterId: "char-1",
    characterSheetId: "sheet-1",
    characterName: "Hero",
    legacyCharacterDescription: "Legacy description",
    characterDescription: "Look 2 description",
    characterSheetAssignments: {
      portrait: null,
      close_up: null,
      front_shot: null,
    },
    activeCharacterSheetPresetId: "2",
    characterSheetPresets: {
      ...defaultPresetState.presets,
      "1": {
        portrait: {
          mediaFileId: "media-look-1",
          storagePath: "user/chars/look-1.png",
          previewUrl: "https://example.com/look-1.png",
        },
        close_up: null,
        front_shot: null,
      },
      "2": {
        portrait: {
          mediaFileId: "media-look-2",
          storagePath: "user/chars/look-2.png",
          previewUrl: "https://example.com/look-2.png",
        },
        close_up: null,
        front_shot: null,
      },
    },
    visibleCharacterSheetPresetIds: ["1", "2"],
    characterSheetPresetLabels: {
      ...defaultPresetState.tabLabels,
      "1": "1",
      "2": "2",
    },
    characterSheetPresetDescriptions: {
      ...defaultPresetState.tabDescriptions,
      "1": "Look 1 description",
      "2": "Look 2 description",
    },
    characterSheetPresetAssignments: {
      portrait: {
        mediaFileId: "media-look-2",
        storagePath: "user/chars/look-2.png",
        previewUrl: "https://example.com/look-2.png",
      },
      close_up: null,
      front_shot: null,
    },
    profileImageUrl: "https://example.com/profile.png",
    profileImageTransform: {
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    },
    slots: {
      front_full: null,
      side_profile: null,
      back_full: null,
      top_down: null,
      front_left_34: null,
      front_right_34: null,
      back_left_34: null,
      back_right_34: null,
      portrait_close: null,
      fullbody_wide: null,
    },
    ...overrides,
  };
};

describe("characterModeLookSelection", () => {
  it("preserves exact saved numeric look labels and carries bundle avatar metadata", () => {
    const snapshot = createSnapshot();

    const options = buildCharacterModeLookOptions(snapshot);
    const bundle = buildCharacterModeInjectionBundleFromSnapshot(snapshot, "2");

    expect(options).toEqual([
      { id: "1", label: "1", isDefault: false },
      { id: "2", label: "2", isDefault: true },
    ]);
    expect(bundle).toEqual(
      expect.objectContaining({
        characterLookId: "2",
        characterLookName: "2",
        characterProfileImageUrl: "https://example.com/profile.png",
      })
    );
  });

  it("falls back from a missing requested look to the active visible look, then to the first visible look", () => {
    const activeVisibleSnapshot = createSnapshot({
      activeCharacterSheetPresetId: "2",
      visibleCharacterSheetPresetIds: ["1", "2"],
    });
    const firstVisibleFallbackSnapshot = createSnapshot({
      activeCharacterSheetPresetId: "3",
      visibleCharacterSheetPresetIds: ["1", "2"],
    });

    expect(resolveCharacterModeLookSelection(activeVisibleSnapshot, "9")).toEqual(
      expect.objectContaining({
        lookId: "2",
        lookLabel: "2",
      })
    );
    expect(resolveCharacterModeLookSelection(firstVisibleFallbackSnapshot, "9")).toEqual(
      expect.objectContaining({
        lookId: "1",
        lookLabel: "1",
      })
    );
  });
});
