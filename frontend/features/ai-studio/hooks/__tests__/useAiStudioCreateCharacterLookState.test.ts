import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createDefaultCharacterSheetPresetState } from "../../../character-manager/constants";
import { useAiStudioCreateCharacterLookState } from "../useAiStudioCreateCharacterLookState";

const createSnapshot = () => {
  const defaultPresetState = createDefaultCharacterSheetPresetState();
  return {
    characterId: "char-1",
    userId: "user-1",
    characterSheetId: "sheet-1",
    characterName: "Hero",
    legacyCharacterDescription: "Legacy hero description",
    characterDescription: "Look 1 description",
    characterSheetAssignments: {
      portrait: null,
      close_up: null,
      front_shot: null,
    },
    activeCharacterSheetPresetId: "2",
    characterSheetPresets: defaultPresetState.presets,
    visibleCharacterSheetPresetIds: ["1", "2"],
    characterSheetPresetLabels: {
      ...defaultPresetState.tabLabels,
      "1": "Look 1",
      "2": "Hero Close-Up",
    },
    characterSheetPresetDescriptions: {
      ...defaultPresetState.tabDescriptions,
      "1": "Look 1 description",
      "2": "Look 2 description",
    },
    characterSheetPresetAssignments: {
      portrait: null,
      close_up: null,
      front_shot: null,
    },
    profileImageUrl: null,
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
  };
};

describe("useAiStudioCreateCharacterLookState", () => {
  it("hydrates the selected character to its default look when no explicit look is set", async () => {
    const setCreateSelectedCharacterId = vi.fn();
    const setCreateSelectedCharacterLookId = vi.fn();
    const loadCharacterSnapshot = vi.fn().mockResolvedValue(createSnapshot());

    renderHook(() =>
      useAiStudioCreateCharacterLookState({
        createSelectedCharacterId: "char-1",
        setCreateSelectedCharacterId,
        createSelectedCharacterLookId: "",
        setCreateSelectedCharacterLookId,
        createCharacterModeInjectionBundle: null,
        loadCharacterSnapshot,
      })
    );

    await waitFor(() => {
      expect(loadCharacterSnapshot).toHaveBeenCalledWith("char-1");
    });
    await waitFor(() => {
      expect(setCreateSelectedCharacterLookId).toHaveBeenCalledWith("2");
    });
  });

  it("keeps an explicit look selection instead of replacing it with the default", async () => {
    const setCreateSelectedCharacterId = vi.fn();
    const setCreateSelectedCharacterLookId = vi.fn();
    const loadCharacterSnapshot = vi.fn().mockResolvedValue(createSnapshot());

    renderHook(() =>
      useAiStudioCreateCharacterLookState({
        createSelectedCharacterId: "char-1",
        setCreateSelectedCharacterId,
        createSelectedCharacterLookId: "1",
        setCreateSelectedCharacterLookId,
        createCharacterModeInjectionBundle: null,
        loadCharacterSnapshot,
      })
    );

    await waitFor(() => {
      expect(loadCharacterSnapshot).toHaveBeenCalledWith("char-1");
    });

    expect(setCreateSelectedCharacterLookId).not.toHaveBeenCalledWith("2");
  });
});
