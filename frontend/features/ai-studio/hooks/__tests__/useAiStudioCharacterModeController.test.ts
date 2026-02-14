import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import {
  useAiStudioCharacterModeController,
  type CharacterModeInjectionBundle,
} from "../useAiStudioCharacterModeController";
import { loadCharacterManagerDraftByCharacterId } from "../../../character-manager/logic/characterManagerPersistence";

vi.mock("../../../character-manager/logic/characterManagerPersistence", () => ({
  loadCharacterManagerDraftByCharacterId: vi.fn(),
}));

const loadCharacterManagerDraftByCharacterIdMock = vi.mocked(
  loadCharacterManagerDraftByCharacterId
);

const asDispatch = <T>(fn: (...args: unknown[]) => unknown): Dispatch<SetStateAction<T>> =>
  fn as unknown as Dispatch<SetStateAction<T>>;

const createParams = (
  overrides: Partial<Parameters<typeof useAiStudioCharacterModeController>[0]> = {}
): Parameters<typeof useAiStudioCharacterModeController>[0] => ({
  isCharacterModeEnabled: true,
  selectedCharacterId: "",
  characterModeInjectionBundle: null,
  isCharacterBundleLoading: false,
  characterOptions: [],
  setCharacterModeInjectionBundle: asDispatch<CharacterModeInjectionBundle | null>(vi.fn()),
  setIsCharacterBundleLoading: asDispatch<boolean>(vi.fn()),
  trackCharacterModeEvent: vi.fn(),
  bundleStaleAfterMs: 45 * 60 * 1000,
  ...overrides,
});

describe("useAiStudioCharacterModeController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves no-character-selected fallback and tracks fallback telemetry", () => {
    const trackCharacterModeEvent = vi.fn();
    const params = createParams({ trackCharacterModeEvent });
    const { result } = renderHook(() => useAiStudioCharacterModeController(params));

    const overrides = result.current.resolveCharacterModeSubmissionOverrides(
      "Draw a scene",
      "create"
    );

    expect(overrides?.fallbackCode).toBe("no_character_selected");
    expect(overrides?.notice).toContain("no character selected");
    expect(overrides?.submissionPromptOverride).toBe("Draw a scene");

    act(() => {
      result.current.trackCharacterModeFallback(overrides, "create");
    });

    expect(trackCharacterModeEvent).toHaveBeenCalledWith(
      "character_mode_injection_fallback",
      expect.objectContaining({
        fallback_code: "no_character_selected",
        selected_character_id: null,
        tool: "create",
      })
    );
  });

  it("returns existing fresh bundle without triggering a refresh call", async () => {
    const currentBundle: CharacterModeInjectionBundle = {
      characterId: "char-1",
      characterDescription: "Base description",
      sheetReferenceUrls: ["https://example.com/ref.png"],
      loadedAtMs: Date.now(),
    };
    const params = createParams({
      selectedCharacterId: "char-1",
      characterModeInjectionBundle: currentBundle,
      bundleStaleAfterMs: 60 * 60 * 1000,
    });
    const { result } = renderHook(() => useAiStudioCharacterModeController(params));

    const refreshed =
      await result.current.refreshCharacterModeInjectionBundleForSubmission("create");

    expect(refreshed).toEqual(currentBundle);
    expect(loadCharacterManagerDraftByCharacterIdMock).not.toHaveBeenCalled();
  });

  it("refreshes a stale bundle and updates injection state", async () => {
    const setCharacterModeInjectionBundle = vi.fn();
    const setIsCharacterBundleLoading = vi.fn();
    loadCharacterManagerDraftByCharacterIdMock.mockResolvedValue({
      characterId: "char-1",
      characterSheetId: "sheet-1",
      characterName: "Hero",
      characterDescription: "Hero description",
      characterSheetAssignments: {
        portrait: "slot-1",
        close_up: null,
        front_shot: null,
        back_shot: null,
      },
      profileImageUrl: null,
      profileImageTransform: {
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      },
      slots: {
        "slot-1": {
          previewUrl: "https://example.com/portrait.png",
        },
      },
    } as unknown as Awaited<ReturnType<typeof loadCharacterManagerDraftByCharacterId>>);
    const params = createParams({
      selectedCharacterId: "char-1",
      characterModeInjectionBundle: {
        characterId: "char-1",
        characterDescription: "Old description",
        sheetReferenceUrls: ["https://example.com/old.png"],
        loadedAtMs: Date.now() - 1000 * 60 * 60,
      },
      bundleStaleAfterMs: 100,
      setCharacterModeInjectionBundle: asDispatch<CharacterModeInjectionBundle | null>(
        setCharacterModeInjectionBundle
      ),
      setIsCharacterBundleLoading: asDispatch<boolean>(setIsCharacterBundleLoading),
    });
    const { result } = renderHook(() => useAiStudioCharacterModeController(params));

    const refreshed =
      await result.current.refreshCharacterModeInjectionBundleForSubmission("create");

    expect(loadCharacterManagerDraftByCharacterIdMock).toHaveBeenCalledWith("char-1");
    expect(setIsCharacterBundleLoading).toHaveBeenCalledWith(true);
    expect(setIsCharacterBundleLoading).toHaveBeenCalledWith(false);
    expect(setCharacterModeInjectionBundle).toHaveBeenCalledWith(
      expect.objectContaining({
        characterId: "char-1",
        characterDescription: "Hero description",
        sheetReferenceUrls: ["https://example.com/portrait.png"],
      })
    );
    expect(refreshed).toEqual(
      expect.objectContaining({
        characterId: "char-1",
        characterDescription: "Hero description",
      })
    );
  });
});
