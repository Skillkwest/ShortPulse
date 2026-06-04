import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createDefaultCharacterSheetPresetState } from "../../../character-manager/constants";
import { useAiStudioCreateCharacterLookState } from "../useAiStudioCreateCharacterLookState";
import type { CharacterModeInjectionBundle } from "../useAiStudioCharacterModeController";

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

const createBundle = (
  overrides: Partial<CharacterModeInjectionBundle> = {}
): CharacterModeInjectionBundle => ({
  characterId: "char-1",
  characterDescription: "Look 2 description",
  characterLookId: "2",
  characterLookName: "Hero Close-Up",
  characterProfileImageUrl: null,
  sheetReferenceStoragePaths: [],
  sheetReferenceUrls: [],
  loadedAtMs: Date.now(),
  ...overrides,
});

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
      expect(loadCharacterSnapshot).toHaveBeenCalledWith("char-1", undefined);
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
      expect(loadCharacterSnapshot).toHaveBeenCalledWith("char-1", undefined);
    });

    expect(setCreateSelectedCharacterLookId).not.toHaveBeenCalledWith("2");
  });

  it("keeps following the refreshed default look when the hook auto-hydrated the selection", async () => {
    const setCreateSelectedCharacterId = vi.fn();
    const setCreateSelectedCharacterLookId = vi.fn();
    const loadCharacterSnapshot = vi.fn().mockResolvedValue(createSnapshot());

    const { rerender } = renderHook(
      ({
        createSelectedCharacterLookId,
        createCharacterModeInjectionBundle,
      }: {
        createSelectedCharacterLookId: string;
        createCharacterModeInjectionBundle: CharacterModeInjectionBundle | null;
      }) =>
        useAiStudioCreateCharacterLookState({
          createSelectedCharacterId: "char-1",
          setCreateSelectedCharacterId,
          createSelectedCharacterLookId,
          setCreateSelectedCharacterLookId,
          createCharacterModeInjectionBundle,
          loadCharacterSnapshot,
        }),
      {
        initialProps: {
          createSelectedCharacterLookId: "",
          createCharacterModeInjectionBundle: null as CharacterModeInjectionBundle | null,
        },
      }
    );

    await waitFor(() => {
      expect(setCreateSelectedCharacterLookId).toHaveBeenCalledWith("2");
    });

    rerender({
      createSelectedCharacterLookId: "2",
      createCharacterModeInjectionBundle: createBundle({
        characterLookId: "1",
        characterLookName: "Look 1",
      }),
    });

    await waitFor(() => {
      expect(setCreateSelectedCharacterLookId).toHaveBeenCalledWith("1");
    });
  });

  it("does not overwrite an explicit look choice when the bundle refreshes with a different default", async () => {
    const setCreateSelectedCharacterId = vi.fn();
    const setCreateSelectedCharacterLookId = vi.fn();
    const loadCharacterSnapshot = vi.fn().mockResolvedValue(createSnapshot());

    renderHook(() =>
      useAiStudioCreateCharacterLookState({
        createSelectedCharacterId: "char-1",
        setCreateSelectedCharacterId,
        createSelectedCharacterLookId: "1",
        setCreateSelectedCharacterLookId,
        createCharacterModeInjectionBundle: createBundle({
          characterLookId: "2",
          characterLookName: "Hero Close-Up",
        }),
        loadCharacterSnapshot,
      })
    );

    await waitFor(() => {
      expect(loadCharacterSnapshot).toHaveBeenCalledWith("char-1", undefined);
    });

    expect(setCreateSelectedCharacterLookId).not.toHaveBeenCalledWith("2");
  });

  it("refreshes cached look options after a same-character bundle refresh and clears removed explicit looks", async () => {
    const setCreateSelectedCharacterId = vi.fn();
    const setCreateSelectedCharacterLookId = vi.fn();
    const loadCharacterSnapshot = vi
      .fn()
      .mockResolvedValueOnce(createSnapshot())
      .mockResolvedValueOnce({
        ...createSnapshot(),
        activeCharacterSheetPresetId: "1",
        visibleCharacterSheetPresetIds: ["1"],
        characterSheetPresetLabels: {
          ...createDefaultCharacterSheetPresetState().tabLabels,
          "1": "Look 1",
        },
        characterSheetPresetDescriptions: {
          ...createDefaultCharacterSheetPresetState().tabDescriptions,
          "1": "Look 1 description",
        },
      });

    const { rerender } = renderHook(
      ({
        createSelectedCharacterLookId,
        createCharacterModeInjectionBundle,
      }: {
        createSelectedCharacterLookId: string;
        createCharacterModeInjectionBundle: CharacterModeInjectionBundle | null;
      }) =>
        useAiStudioCreateCharacterLookState({
          createSelectedCharacterId: "char-1",
          setCreateSelectedCharacterId,
          createSelectedCharacterLookId,
          setCreateSelectedCharacterLookId,
          createCharacterModeInjectionBundle,
          loadCharacterSnapshot,
        }),
      {
        initialProps: {
          createSelectedCharacterLookId: "2",
          createCharacterModeInjectionBundle: null as CharacterModeInjectionBundle | null,
        },
      }
    );

    await waitFor(() => {
      expect(loadCharacterSnapshot).toHaveBeenCalledWith("char-1", undefined);
    });

    rerender({
      createSelectedCharacterLookId: "2",
      createCharacterModeInjectionBundle: createBundle({
        characterLookId: "1",
        characterLookName: "Look 1",
      }),
    });

    await waitFor(() => {
      expect(loadCharacterSnapshot).toHaveBeenCalledWith("char-1", {
        forceRefresh: true,
      });
      expect(setCreateSelectedCharacterLookId).toHaveBeenCalledWith("1");
    });
  });

  it("treats externally restored look ids as explicit choices instead of auto-following defaults", async () => {
    const setCreateSelectedCharacterId = vi.fn();
    const setCreateSelectedCharacterLookId = vi.fn();
    const loadCharacterSnapshot = vi.fn().mockResolvedValue(createSnapshot());

    const { rerender } = renderHook(
      ({
        createSelectedCharacterLookId,
        createCharacterModeInjectionBundle,
      }: {
        createSelectedCharacterLookId: string;
        createCharacterModeInjectionBundle: CharacterModeInjectionBundle | null;
      }) =>
        useAiStudioCreateCharacterLookState({
          createSelectedCharacterId: "char-1",
          setCreateSelectedCharacterId,
          createSelectedCharacterLookId,
          setCreateSelectedCharacterLookId,
          createCharacterModeInjectionBundle,
          loadCharacterSnapshot,
        }),
      {
        initialProps: {
          createSelectedCharacterLookId: "",
          createCharacterModeInjectionBundle: null as CharacterModeInjectionBundle | null,
        },
      }
    );

    await waitFor(() => {
      expect(setCreateSelectedCharacterLookId).toHaveBeenCalledWith("2");
    });
    setCreateSelectedCharacterLookId.mockClear();

    rerender({
      createSelectedCharacterLookId: "1",
      createCharacterModeInjectionBundle: createBundle({
        characterLookId: "2",
        characterLookName: "Hero Close-Up",
      }),
    });

    expect(setCreateSelectedCharacterLookId).not.toHaveBeenCalledWith("2");
  });
});
