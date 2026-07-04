import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import {
  useAiStudioCharacterModeController,
  type CharacterModeInjectionBundle,
} from "../useAiStudioCharacterModeController";
import { createDefaultCharacterSheetPresetState } from "../../../character-manager/constants";
import { loadCharacterManagerDraftByCharacterId } from "../../../character-manager/logic/characterManagerPersistence";
import { getSignedMediaUrlsBatch } from "../../../../lib/mediaSignedUrlCache";
import { reportAppError } from "../../../../lib/appErrorReporter";

vi.mock("../../../character-manager/logic/characterManagerPersistence", () => ({
  loadCharacterManagerDraftByCharacterId: vi.fn(),
}));
vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrlsBatch: vi.fn(),
}));
vi.mock("../../../../lib/appErrorReporter", () => ({
  reportAppError: vi.fn(),
}));

const loadCharacterManagerDraftByCharacterIdMock = vi.mocked(
  loadCharacterManagerDraftByCharacterId
);
const getSignedMediaUrlsBatchMock = vi.mocked(getSignedMediaUrlsBatch);
const reportAppErrorMock = vi.mocked(reportAppError);

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

const createSnapshotWithLookReference = (
  input: {
    description?: string;
    legacyDescription?: string;
    storagePath?: string;
    previewUrl?: string;
    profileImageUrl?: string | null;
  } = {}
) =>
  (() => {
    const defaultPresetState = createDefaultCharacterSheetPresetState();
    return {
      characterId: "char-1",
      userId: "user-1",
      characterSheetId: "sheet-1",
      characterName: "Hero",
      legacyCharacterDescription: input.legacyDescription ?? "Legacy hero description",
      characterDescription: input.description ?? "Hero description",
      characterSheetAssignments: {
        portrait: null,
        close_up: null,
        front_shot: null,
      },
      activeCharacterSheetPresetId: "1",
      characterSheetPresets: {
        ...defaultPresetState.presets,
        "1": {
          portrait: {
            characterMediaId: "media-portrait",
            storagePath: input.storagePath ?? "user/chars/ref.png",
            previewUrl: input.previewUrl ?? "https://example.com/ref-stale.png",
          },
          close_up: null,
          front_shot: null,
        },
      },
      visibleCharacterSheetPresetIds: ["1"],
      characterSheetPresetLabels: defaultPresetState.tabLabels,
      characterSheetPresetDescriptions: {
        ...defaultPresetState.tabDescriptions,
        "1": input.description ?? "Hero description",
      },
      characterSheetPresetAssignments: {
        portrait: {
          characterMediaId: "media-portrait",
          storagePath: input.storagePath ?? "user/chars/ref.png",
          previewUrl: input.previewUrl ?? "https://example.com/ref-stale.png",
        },
        close_up: null,
        front_shot: null,
      },
      profileImageUrl: input.profileImageUrl ?? null,
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
  })() as Awaited<ReturnType<typeof loadCharacterManagerDraftByCharacterId>>;

describe("useAiStudioCharacterModeController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([["user/chars/ref.png", "https://example.com/ref-fresh.png"]])
    );
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
    expect(reportAppErrorMock).not.toHaveBeenCalled();
  });

  it("reuses a fresh matching bundle before submit without refreshing", async () => {
    const setCharacterModeInjectionBundle = vi.fn();
    const setIsCharacterBundleLoading = vi.fn();
    const currentBundle: CharacterModeInjectionBundle = {
      characterId: "char-1",
      characterDescription: "Base description",
      sheetReferenceStoragePaths: ["user/chars/ref.png"],
      sheetReferenceUrls: ["https://example.com/ref-stale.png"],
      loadedAtMs: Date.now(),
    };
    const params = createParams({
      selectedCharacterId: "char-1",
      characterModeInjectionBundle: currentBundle,
      bundleStaleAfterMs: 60 * 60 * 1000,
      setCharacterModeInjectionBundle: asDispatch<CharacterModeInjectionBundle | null>(
        setCharacterModeInjectionBundle
      ),
      setIsCharacterBundleLoading: asDispatch<boolean>(setIsCharacterBundleLoading),
    });
    const { result } = renderHook(() => useAiStudioCharacterModeController(params));

    const refreshed =
      await result.current.refreshCharacterModeInjectionBundleForSubmission("create");

    expect(refreshed).toEqual(currentBundle);
    expect(loadCharacterManagerDraftByCharacterIdMock).not.toHaveBeenCalled();
    expect(getSignedMediaUrlsBatchMock).not.toHaveBeenCalled();
    expect(setCharacterModeInjectionBundle).not.toHaveBeenCalled();
    expect(setIsCharacterBundleLoading).not.toHaveBeenCalled();
  });

  it("refreshes a fresh create bundle before submit when the selected look changed", async () => {
    const defaultPresetState = createDefaultCharacterSheetPresetState();
    const setCharacterModeInjectionBundle = vi.fn();
    const setIsCharacterBundleLoading = vi.fn();
    loadCharacterManagerDraftByCharacterIdMock.mockResolvedValue({
      ...createSnapshotWithLookReference({
        description: "Look 1 description",
        storagePath: "user/chars/look-1.png",
        previewUrl: "https://example.com/look-1.png",
      }),
      activeCharacterSheetPresetId: "1",
      visibleCharacterSheetPresetIds: ["1", "2"],
      characterSheetPresetLabels: {
        ...defaultPresetState.tabLabels,
        "1": "Look 1",
        "2": "Look 2",
      },
      characterSheetPresetDescriptions: {
        ...defaultPresetState.tabDescriptions,
        "1": "Look 1 description",
        "2": "Look 2 description",
      },
      characterSheetPresets: {
        ...defaultPresetState.presets,
        "1": {
          portrait: {
            characterMediaId: "media-look-1",
            storagePath: "user/chars/look-1.png",
            previewUrl: "https://example.com/look-1.png",
          },
          close_up: null,
          front_shot: null,
        },
        "2": {
          portrait: {
            characterMediaId: "media-look-2",
            storagePath: "user/chars/look-2.png",
            previewUrl: "https://example.com/look-2.png",
          },
          close_up: null,
          front_shot: null,
        },
      },
    } as Awaited<ReturnType<typeof loadCharacterManagerDraftByCharacterId>>);
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([["user/chars/look-2.png", "https://example.com/look-2-fresh.png"]])
    );
    const currentBundle: CharacterModeInjectionBundle = {
      characterId: "char-1",
      characterDescription: "Look 1 description",
      characterLookId: "1",
      characterLookName: "Look 1",
      sheetReferenceStoragePaths: ["user/chars/look-1.png"],
      sheetReferenceUrls: ["https://example.com/look-1-stale.png"],
      loadedAtMs: Date.now(),
    };
    const params = createParams({
      selectedCharacterId: "char-1",
      selectedCharacterLookId: "2",
      characterModeInjectionBundle: currentBundle,
      bundleStaleAfterMs: 60 * 60 * 1000,
      setCharacterModeInjectionBundle: asDispatch<CharacterModeInjectionBundle | null>(
        setCharacterModeInjectionBundle
      ),
      setIsCharacterBundleLoading: asDispatch<boolean>(setIsCharacterBundleLoading),
    });
    const { result } = renderHook(() => useAiStudioCharacterModeController(params));

    const refreshed =
      await result.current.refreshCharacterModeInjectionBundleForSubmission("create");

    expect(loadCharacterManagerDraftByCharacterIdMock).toHaveBeenCalledWith("char-1", {
      forceRefresh: true,
    });
    expect(refreshed).toEqual(
      expect.objectContaining({
        characterId: "char-1",
        characterDescription: "Look 2 description",
        characterLookId: "2",
        characterLookName: "Look 2",
        sheetReferenceStoragePaths: ["user/chars/look-2.png"],
        sheetReferenceUrls: ["https://example.com/look-2-fresh.png"],
      })
    );
    expect(setCharacterModeInjectionBundle).toHaveBeenCalledWith(refreshed);
    expect(setIsCharacterBundleLoading).toHaveBeenCalledWith(true);
    expect(setIsCharacterBundleLoading).toHaveBeenCalledWith(false);
  });

  it("uses legacy description fallback when the active look description is empty", async () => {
    loadCharacterManagerDraftByCharacterIdMock.mockResolvedValue(
      createSnapshotWithLookReference({
        description: "",
        legacyDescription: "Legacy fallback description",
        storagePath: "user/chars/ref.png",
      })
    );
    const params = createParams({
      selectedCharacterId: "char-1",
    });
    const { result } = renderHook(() => useAiStudioCharacterModeController(params));

    const refreshed =
      await result.current.refreshCharacterModeInjectionBundleForSubmission("create");

    expect(refreshed?.characterDescription).toBe("Legacy fallback description");
  });

  it("uses the selected create look override instead of the character's active look", async () => {
    const defaultPresetState = createDefaultCharacterSheetPresetState();
    loadCharacterManagerDraftByCharacterIdMock.mockResolvedValue({
      ...createSnapshotWithLookReference({
        description: "Look 1 description",
        storagePath: "user/chars/look-1.png",
        previewUrl: "https://example.com/look-1.png",
        profileImageUrl: "https://example.com/bundle-avatar.png",
      }),
      activeCharacterSheetPresetId: "1",
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
      characterSheetPresets: {
        ...defaultPresetState.presets,
        "1": {
          portrait: {
            characterMediaId: "media-look-1",
            storagePath: "user/chars/look-1.png",
            previewUrl: "https://example.com/look-1.png",
          },
          close_up: null,
          front_shot: null,
        },
        "2": {
          portrait: {
            characterMediaId: "media-look-2",
            storagePath: "user/chars/look-2.png",
            previewUrl: "https://example.com/look-2.png",
          },
          close_up: null,
          front_shot: null,
        },
      },
    } as Awaited<ReturnType<typeof loadCharacterManagerDraftByCharacterId>>);
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([["user/chars/look-2.png", "https://example.com/look-2-fresh.png"]])
    );
    const params = createParams({
      selectedCharacterId: "char-1",
      selectedCharacterLookId: "2",
      characterOptions: [
        { id: "char-1", name: "Hero", profileImageUrl: "https://example.com/list-avatar.png" },
      ],
    });
    const { result } = renderHook(() => useAiStudioCharacterModeController(params));

    const refreshed =
      await result.current.refreshCharacterModeInjectionBundleForSubmission("create");
    const overrides = result.current.resolveCharacterModeSubmissionOverrides(
      "Draw a portrait",
      "create",
      refreshed
    );

    expect(refreshed).toEqual(
      expect.objectContaining({
        characterDescription: "Look 2 description",
        characterLookId: "2",
        characterLookName: "Hero Close-Up",
        sheetReferenceUrls: ["https://example.com/look-2-fresh.png"],
      })
    );
    expect(overrides?.characterContextOverride).toEqual(
      expect.objectContaining({
        characterId: "char-1",
        characterName: "Hero",
        lookId: "2",
        lookName: "Hero Close-Up",
        characterProfileImageUrl: "https://example.com/bundle-avatar.png",
      })
    );
    expect(overrides?.submissionPromptOverride).toContain("Look 2 description");
  });

  it("reports zero Create character references when an empty selected look only has legacy fallback refs", () => {
    const currentBundle: CharacterModeInjectionBundle = {
      characterId: "char-1",
      characterDescription: "Hero description",
      characterLookId: "3",
      characterLookName: "Empty Look",
      directLookReferenceCount: 0,
      usedLegacyReferenceFallback: true,
      sheetReferenceStoragePaths: ["user/chars/legacy-portrait.png"],
      sheetReferenceUrls: ["https://example.com/legacy-portrait.png"],
      loadedAtMs: Date.now(),
    };
    const params = createParams({
      selectedCharacterId: "char-1",
      selectedCharacterLookId: "3",
      characterModeInjectionBundle: currentBundle,
      characterOptions: [{ id: "char-1", name: "Hero", profileImageUrl: null }],
    });
    const { result } = renderHook(() => useAiStudioCharacterModeController(params));

    const overrides = result.current.resolveCharacterModeSubmissionOverrides(
      "Draw a portrait",
      "create"
    );

    expect(overrides).toEqual(
      expect.objectContaining({
        fallbackCode: "no_references",
        characterReferenceCount: 0,
        hasCharacterDescription: true,
      })
    );
  });

  it("refreshes a stale bundle and updates injection state", async () => {
    const setCharacterModeInjectionBundle = vi.fn();
    const setIsCharacterBundleLoading = vi.fn();
    loadCharacterManagerDraftByCharacterIdMock.mockResolvedValue(
      createSnapshotWithLookReference({
        description: "Hero description",
        storagePath: "user/chars/portrait.png",
        previewUrl: "https://example.com/portrait.png",
      })
    );
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([["user/chars/portrait.png", "https://example.com/fresh-portrait.png"]])
    );
    const params = createParams({
      selectedCharacterId: "char-1",
      characterModeInjectionBundle: {
        characterId: "char-1",
        characterDescription: "Old description",
        sheetReferenceStoragePaths: ["user/chars/old.png"],
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

    expect(loadCharacterManagerDraftByCharacterIdMock).toHaveBeenCalledWith("char-1", {
      forceRefresh: true,
    });
    expect(setIsCharacterBundleLoading).toHaveBeenCalledWith(true);
    expect(setIsCharacterBundleLoading).toHaveBeenCalledWith(false);
    expect(setCharacterModeInjectionBundle).toHaveBeenCalledWith(
      expect.objectContaining({
        characterId: "char-1",
        characterDescription: "Hero description",
        sheetReferenceStoragePaths: ["user/chars/portrait.png"],
        sheetReferenceUrls: ["https://example.com/fresh-portrait.png"],
      })
    );
    expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledWith({
      bucket: "media_library",
      storagePaths: ["user/chars/portrait.png"],
      forceRefresh: true,
    });
    expect(refreshed).toEqual(
      expect.objectContaining({
        characterId: "char-1",
        characterDescription: "Hero description",
      })
    );
  });

  it("forces a fresh shared snapshot load before submit when reuse is not allowed", async () => {
    const loadCharacterSnapshot = vi.fn().mockResolvedValue(
      createSnapshotWithLookReference({
        description: "Fresh description",
        storagePath: "user/chars/ref.png",
      })
    );
    const params = createParams({
      selectedCharacterId: "char-1",
      loadCharacterSnapshot,
      characterModeInjectionBundle: {
        characterId: "char-1",
        characterDescription: "Stale description",
        sheetReferenceStoragePaths: ["user/chars/ref.png"],
        sheetReferenceUrls: ["https://example.com/ref-stale.png"],
        loadedAtMs: Date.now() - 2 * 60 * 60 * 1000,
      },
      bundleStaleAfterMs: 100,
    });
    const { result } = renderHook(() => useAiStudioCharacterModeController(params));

    await result.current.refreshCharacterModeInjectionBundleForSubmission("create");

    expect(loadCharacterSnapshot).toHaveBeenCalledWith("char-1", { forceRefresh: true });
  });

  it("blocks submit-time reuse when forced signing returns no usable URLs", async () => {
    const trackCharacterModeEvent = vi.fn();
    const setCharacterModeInjectionBundle = vi.fn();
    getSignedMediaUrlsBatchMock.mockResolvedValue(new Map());
    loadCharacterManagerDraftByCharacterIdMock.mockResolvedValue(
      createSnapshotWithLookReference({
        description: "Base description",
        storagePath: "user/chars/ref.png",
        previewUrl: "https://example.com/ref-stale-db.png",
      })
    );
    const params = createParams({
      selectedCharacterId: "char-1",
      characterModeInjectionBundle: {
        characterId: "char-1",
        characterDescription: "Base description",
        sheetReferenceStoragePaths: ["user/chars/ref.png"],
        sheetReferenceUrls: ["https://example.com/ref-stale.png"],
        loadedAtMs: Date.now() - 1000 * 60 * 60,
      },
      bundleStaleAfterMs: 100,
      trackCharacterModeEvent,
      setCharacterModeInjectionBundle: asDispatch<CharacterModeInjectionBundle | null>(
        setCharacterModeInjectionBundle
      ),
    });
    const { result } = renderHook(() => useAiStudioCharacterModeController(params));

    await expect(
      result.current.refreshCharacterModeInjectionBundleForSubmission("create")
    ).rejects.toThrow("Unable to refresh character references. Reopen the character or try again.");
    expect(setCharacterModeInjectionBundle).not.toHaveBeenCalled();
    expect(trackCharacterModeEvent).toHaveBeenCalledWith(
      "character_mode_reference_refresh_empty",
      expect.objectContaining({
        selected_character_id: "char-1",
        storage_path_count: 1,
        fallback_url_count: 1,
      })
    );
    expect(reportAppErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.character_mode",
        message: "character_mode_reference_refresh_empty",
        metadata: expect.objectContaining({
          telemetry_family: "character_mode",
          selected_character_id: "char-1",
          storage_path_count: 1,
          fallback_url_count: 1,
        }),
      })
    );
  });

  it("blocks submit-time reuse when snapshot refresh fails", async () => {
    const trackCharacterModeEvent = vi.fn();
    const currentBundle: CharacterModeInjectionBundle = {
      characterId: "char-1",
      characterDescription: "Cached description",
      sheetReferenceStoragePaths: ["user/chars/ref.png"],
      sheetReferenceUrls: ["https://example.com/cached.png"],
      loadedAtMs: Date.now() - 1000 * 60 * 60,
    };
    loadCharacterManagerDraftByCharacterIdMock.mockRejectedValueOnce(new Error("session stalled"));
    const params = createParams({
      selectedCharacterId: "char-1",
      characterModeInjectionBundle: currentBundle,
      bundleStaleAfterMs: 100,
      trackCharacterModeEvent,
    });
    const { result } = renderHook(() => useAiStudioCharacterModeController(params));

    await expect(
      result.current.refreshCharacterModeInjectionBundleForSubmission("create")
    ).rejects.toThrow("Unable to refresh character references. Reopen the character or try again.");
    expect(trackCharacterModeEvent).toHaveBeenCalledWith(
      "character_mode_bundle_refresh_failed",
      expect.objectContaining({
        selected_character_id: "char-1",
      })
    );
  });

  it("does not reuse stale bundle when selected character is no longer available", async () => {
    const setCharacterModeInjectionBundle = vi.fn();
    const trackCharacterModeEvent = vi.fn();
    const currentBundle: CharacterModeInjectionBundle = {
      characterId: "char-1",
      characterDescription: "Cached description",
      sheetReferenceStoragePaths: ["user/chars/ref.png"],
      sheetReferenceUrls: ["https://example.com/cached.png"],
      loadedAtMs: Date.now() - 1000 * 60 * 60,
    };
    loadCharacterManagerDraftByCharacterIdMock.mockRejectedValueOnce(
      new Error("Character is no longer available.")
    );
    const params = createParams({
      selectedCharacterId: "char-1",
      characterModeInjectionBundle: currentBundle,
      bundleStaleAfterMs: 100,
      trackCharacterModeEvent,
      setCharacterModeInjectionBundle: asDispatch<CharacterModeInjectionBundle | null>(
        setCharacterModeInjectionBundle
      ),
    });
    const { result } = renderHook(() => useAiStudioCharacterModeController(params));

    const refreshed =
      await result.current.refreshCharacterModeInjectionBundleForSubmission("create");

    expect(refreshed).toBeNull();
    expect(setCharacterModeInjectionBundle).toHaveBeenCalledWith(null);
    expect(trackCharacterModeEvent).toHaveBeenCalledWith(
      "character_mode_bundle_refresh_failed",
      expect.objectContaining({
        selected_character_id: "char-1",
        error: "Character is no longer available.",
      })
    );
  });

  it("does not reuse stale bundle when refreshed snapshot id mismatches selected character", async () => {
    const setCharacterModeInjectionBundle = vi.fn();
    const currentBundle: CharacterModeInjectionBundle = {
      characterId: "char-1",
      characterDescription: "Cached description",
      sheetReferenceStoragePaths: ["user/chars/ref.png"],
      sheetReferenceUrls: ["https://example.com/cached.png"],
      loadedAtMs: Date.now() - 1000 * 60 * 60,
    };
    loadCharacterManagerDraftByCharacterIdMock.mockResolvedValueOnce({
      ...createSnapshotWithLookReference(),
      characterId: "char-2",
    });
    const params = createParams({
      selectedCharacterId: "char-1",
      characterModeInjectionBundle: currentBundle,
      bundleStaleAfterMs: 100,
      setCharacterModeInjectionBundle: asDispatch<CharacterModeInjectionBundle | null>(
        setCharacterModeInjectionBundle
      ),
    });
    const { result } = renderHook(() => useAiStudioCharacterModeController(params));

    const refreshed =
      await result.current.refreshCharacterModeInjectionBundleForSubmission("create");

    expect(refreshed).toBeNull();
    expect(setCharacterModeInjectionBundle).toHaveBeenCalledWith(null);
  });

  it("treats explicit null bundle override as unavailable (does not reuse cached bundle)", () => {
    const params = createParams({
      selectedCharacterId: "char-1",
      characterModeInjectionBundle: {
        characterId: "char-1",
        characterDescription: "Cached description",
        sheetReferenceStoragePaths: ["user/chars/ref.png"],
        sheetReferenceUrls: ["https://example.com/cached.png"],
        loadedAtMs: Date.now(),
      },
    });
    const { result } = renderHook(() => useAiStudioCharacterModeController(params));

    const overrides = result.current.resolveCharacterModeSubmissionOverrides(
      "User visible prompt",
      "create",
      null
    );

    expect(overrides?.fallbackCode).toBe("bundle_unavailable");
    expect(overrides?.referenceInputsOverride).toEqual([]);
    expect(overrides?.submissionPromptOverride).toBe("User visible prompt");
  });

  it("emits first-class telemetry for bundle-unavailable fallback", () => {
    const trackCharacterModeEvent = vi.fn();
    const params = createParams({
      selectedCharacterId: "char-1",
      characterModeInjectionBundle: {
        characterId: "char-1",
        characterDescription: "Cached description",
        sheetReferenceStoragePaths: ["user/chars/ref.png"],
        sheetReferenceUrls: ["https://example.com/cached.png"],
        loadedAtMs: Date.now(),
      },
      trackCharacterModeEvent,
    });
    const { result } = renderHook(() => useAiStudioCharacterModeController(params));

    const overrides = result.current.resolveCharacterModeSubmissionOverrides(
      "User visible prompt",
      "create",
      null
    );

    act(() => {
      result.current.trackCharacterModeFallback(overrides, "create");
    });

    expect(trackCharacterModeEvent).toHaveBeenCalledWith(
      "character_mode_injection_fallback",
      expect.objectContaining({
        fallback_code: "bundle_unavailable",
        selected_character_id: "char-1",
      })
    );
    expect(reportAppErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.character_mode",
        message: "character_mode_injection_fallback.bundle_unavailable",
        metadata: expect.objectContaining({
          telemetry_family: "character_mode",
          fallback_code: "bundle_unavailable",
        }),
      })
    );
  });

  it("applies character injection for edit workflow and keeps user refs first", () => {
    const params = createParams({
      selectedCharacterId: "char-1",
      characterModeInjectionBundle: {
        characterId: "char-1",
        characterDescription: "Character base",
        sheetReferenceStoragePaths: ["user/chars/char.png"],
        sheetReferenceUrls: ["https://example.com/char.png"],
        loadedAtMs: Date.now(),
      },
      characterOptions: [{ id: "char-1", name: "Hero", profileImageUrl: null }],
    });
    const { result } = renderHook(() => useAiStudioCharacterModeController(params));

    const overrides = result.current.resolveCharacterModeSubmissionOverrides(
      "Add cinematic lighting",
      "edit",
      undefined,
      ["https://example.com/user-primary.png", "https://example.com/char.png"]
    );

    expect(overrides?.referenceInputsOverride).toEqual([
      "https://example.com/user-primary.png",
      "https://example.com/char.png",
    ]);
    expect(overrides?.internalMediaRefsOverride).toEqual([
      {
        version: 1,
        kind: "storage_object",
        bucket: "media_library",
        storagePath: "user/chars/char.png",
      },
    ]);
    expect(overrides?.submissionPromptOverride).toContain("Character base");
  });

  it("uses edit-scoped character context instead of create-scoped selection", () => {
    const params = createParams({
      selectedCharacterId: "char-create",
      characterModeInjectionBundle: {
        characterId: "char-create",
        characterDescription: "Create character description",
        sheetReferenceStoragePaths: ["user/chars/create.png"],
        sheetReferenceUrls: ["https://example.com/create.png"],
        loadedAtMs: Date.now(),
      },
      editCharacterModeEnabled: true,
      editSelectedCharacterId: "char-edit",
      editCharacterModeInjectionBundle: {
        characterId: "char-edit",
        characterDescription: "Edit character description",
        sheetReferenceStoragePaths: ["user/chars/edit.png"],
        sheetReferenceUrls: ["https://example.com/edit.png"],
        loadedAtMs: Date.now(),
      },
      characterOptions: [
        { id: "char-create", name: "Create Hero", profileImageUrl: "https://example.com/c.png" },
        { id: "char-edit", name: "Edit Hero", profileImageUrl: "https://example.com/e.png" },
      ],
    });
    const { result } = renderHook(() => useAiStudioCharacterModeController(params));

    const overrides = result.current.resolveCharacterModeSubmissionOverrides(
      "Make the face match the selected edit character",
      "edit",
      undefined,
      ["https://example.com/user-edit-ref.png"]
    );

    expect(overrides?.submissionPromptOverride).toContain("Edit character description");
    expect(overrides?.submissionPromptOverride).not.toContain("Create character description");
    expect(overrides?.characterContextOverride).toEqual(
      expect.objectContaining({
        characterId: "char-edit",
        characterName: "Edit Hero",
        characterProfileImageUrl: "https://example.com/e.png",
      })
    );
    expect(overrides?.referenceInputsOverride).toEqual(["https://example.com/user-edit-ref.png"]);
    expect(overrides?.internalMediaRefsOverride).toEqual([
      {
        version: 1,
        kind: "storage_object",
        bucket: "media_library",
        storagePath: "user/chars/edit.png",
      },
    ]);
  });

  it("refreshes edit-scoped bundle using the edit character selection", async () => {
    const setCreateBundle = vi.fn();
    const setEditBundle = vi.fn();
    const setEditLoading = vi.fn();
    loadCharacterManagerDraftByCharacterIdMock.mockResolvedValue({
      ...createSnapshotWithLookReference({
        description: "Edit scoped description",
        storagePath: "user/chars/edit-scoped.png",
      }),
      characterId: "char-edit",
    });
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([["user/chars/edit-scoped.png", "https://example.com/edit-scoped-fresh.png"]])
    );
    const params = createParams({
      selectedCharacterId: "char-create",
      setCharacterModeInjectionBundle: asDispatch<CharacterModeInjectionBundle | null>(
        setCreateBundle
      ),
      editCharacterModeEnabled: true,
      editSelectedCharacterId: "char-edit",
      setEditCharacterModeInjectionBundle: asDispatch<CharacterModeInjectionBundle | null>(
        setEditBundle
      ),
      setIsEditCharacterBundleLoading: asDispatch<boolean>(setEditLoading),
    });
    const { result } = renderHook(() => useAiStudioCharacterModeController(params));

    await act(async () => {
      await result.current.refreshCharacterModeInjectionBundleForSubmission("edit");
    });

    expect(loadCharacterManagerDraftByCharacterIdMock).toHaveBeenCalledWith("char-edit", {
      forceRefresh: true,
    });
    expect(setEditLoading).toHaveBeenCalledWith(true);
    expect(setEditLoading).toHaveBeenCalledWith(false);
    expect(setEditBundle).toHaveBeenCalledTimes(1);
    expect(setCreateBundle).not.toHaveBeenCalled();
  });

  it("does not apply character injection for non-supported workflow tools", () => {
    const params = createParams({
      selectedCharacterId: "char-1",
      characterModeInjectionBundle: {
        characterId: "char-1",
        characterDescription: "Character base",
        sheetReferenceStoragePaths: ["user/chars/char.png"],
        sheetReferenceUrls: ["https://example.com/char.png"],
        loadedAtMs: Date.now(),
      },
    });
    const { result } = renderHook(() => useAiStudioCharacterModeController(params));

    const overrides = result.current.resolveCharacterModeSubmissionOverrides(
      "Animate this scene",
      "video"
    );

    expect(overrides).toBeNull();
  });

  it("uses look-reference notice copy for reference-only fallback messaging", () => {
    const params = createParams({
      selectedCharacterId: "char-1",
      characterModeInjectionBundle: {
        characterId: "char-1",
        characterDescription: "",
        sheetReferenceStoragePaths: ["user/chars/char.png"],
        sheetReferenceUrls: ["https://example.com/char.png"],
        loadedAtMs: Date.now(),
      },
    });
    const { result } = renderHook(() => useAiStudioCharacterModeController(params));

    const overrides = result.current.resolveCharacterModeSubmissionOverrides(
      "Add a dramatic rim light",
      "create"
    );

    expect(overrides?.fallbackCode).toBe("no_description");
    expect(overrides?.notice).toBe(
      "Selected character has no description. Generated using look references only."
    );
  });
});
