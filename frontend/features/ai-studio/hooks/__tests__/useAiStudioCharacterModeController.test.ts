import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import {
  useAiStudioCharacterModeController,
  type CharacterModeInjectionBundle,
} from "../useAiStudioCharacterModeController";
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

const createSnapshotWithPresetReference = (
  input: {
    description?: string;
    storagePath?: string;
    previewUrl?: string;
  } = {}
) =>
  ({
    characterId: "char-1",
    characterSheetId: "sheet-1",
    characterName: "Hero",
    characterDescription: input.description ?? "Hero description",
    characterSheetAssignments: {
      portrait: null,
      close_up: null,
      front_shot: null,
      back_shot: null,
    },
    activeCharacterSheetPresetId: "1",
    characterSheetPresets: {
      "1": {
        portrait: {
          mediaFileId: "media-portrait",
          storagePath: input.storagePath ?? "user/chars/ref.png",
          previewUrl: input.previewUrl ?? "https://example.com/ref-stale.png",
        },
        close_up: null,
        front_shot: null,
        back_shot: null,
      },
      "2": { portrait: null, close_up: null, front_shot: null, back_shot: null },
      "3": { portrait: null, close_up: null, front_shot: null, back_shot: null },
      "4": { portrait: null, close_up: null, front_shot: null, back_shot: null },
    },
    characterSheetPresetAssignments: {
      portrait: {
        mediaFileId: "media-portrait",
        storagePath: input.storagePath ?? "user/chars/ref.png",
        previewUrl: input.previewUrl ?? "https://example.com/ref-stale.png",
      },
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
  }) as Awaited<ReturnType<typeof loadCharacterManagerDraftByCharacterId>>;

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

  it("reloads snapshot before submit and refreshes signed urls", async () => {
    const setCharacterModeInjectionBundle = vi.fn();
    loadCharacterManagerDraftByCharacterIdMock.mockResolvedValue(
      createSnapshotWithPresetReference({
        description: "Base description",
        storagePath: "user/chars/ref.png",
        previewUrl: "https://example.com/ref-stale-db.png",
      })
    );
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
    });
    const { result } = renderHook(() => useAiStudioCharacterModeController(params));

    const refreshed =
      await result.current.refreshCharacterModeInjectionBundleForSubmission("create");

    expect(refreshed).toEqual(
      expect.objectContaining({
        characterId: "char-1",
        characterDescription: "Base description",
        sheetReferenceStoragePaths: ["user/chars/ref.png"],
        sheetReferenceUrls: ["https://example.com/ref-fresh.png"],
      })
    );
    expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledWith({
      bucket: "media_library",
      storagePaths: ["user/chars/ref.png"],
      forceRefresh: true,
    });
    expect(loadCharacterManagerDraftByCharacterIdMock).toHaveBeenCalledWith("char-1");
    expect(setCharacterModeInjectionBundle).toHaveBeenCalledTimes(1);
  });

  it("refreshes a stale bundle and updates injection state", async () => {
    const setCharacterModeInjectionBundle = vi.fn();
    const setIsCharacterBundleLoading = vi.fn();
    loadCharacterManagerDraftByCharacterIdMock.mockResolvedValue(
      createSnapshotWithPresetReference({
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

    expect(loadCharacterManagerDraftByCharacterIdMock).toHaveBeenCalledWith("char-1");
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

  it("falls back to description-only injection when forced signing returns no usable URLs", async () => {
    const trackCharacterModeEvent = vi.fn();
    const setCharacterModeInjectionBundle = vi.fn();
    getSignedMediaUrlsBatchMock.mockResolvedValue(new Map());
    loadCharacterManagerDraftByCharacterIdMock.mockResolvedValue(
      createSnapshotWithPresetReference({
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
        loadedAtMs: Date.now(),
      },
      trackCharacterModeEvent,
      setCharacterModeInjectionBundle: asDispatch<CharacterModeInjectionBundle | null>(
        setCharacterModeInjectionBundle
      ),
    });
    const { result } = renderHook(() => useAiStudioCharacterModeController(params));

    const refreshed =
      await result.current.refreshCharacterModeInjectionBundleForSubmission("create");

    expect(refreshed).toEqual(
      expect.objectContaining({
        characterId: "char-1",
        characterDescription: "Base description",
        sheetReferenceUrls: [],
      })
    );
    expect(setCharacterModeInjectionBundle).toHaveBeenCalledWith(
      expect.objectContaining({
        characterId: "char-1",
        sheetReferenceUrls: [],
      })
    );
    expect(trackCharacterModeEvent).toHaveBeenCalledWith(
      "character_mode_reference_refresh_empty",
      expect.objectContaining({
        selected_character_id: "char-1",
        storage_path_count: 1,
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
        }),
      })
    );
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
});
