import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  StrictMode,
  createElement,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useAiStudioCharacterModeLifecycle } from "../useAiStudioCharacterModeLifecycle";
import { createDefaultCharacterSheetPresetState } from "../../../character-manager/constants";
import {
  listCharacterManagerCharacters,
  loadCharacterManagerDraftByCharacterId,
  type CharacterManagerListItem,
} from "../../../character-manager/logic/characterManagerPersistence";
import { publishCharacterListChanged } from "../../../character-manager/logic/characterListSyncEvents";
import { persistSelectedCharacterId } from "../../../character-manager/logic/selectedCharacterPersistence";
import { readSupabaseUserId } from "../../../../lib/supabaseClient";
import type { ToolId } from "../../types";

vi.mock("../../../character-manager/logic/characterManagerPersistence", () => ({
  listCharacterManagerCharacters: vi.fn(),
  loadCharacterManagerDraftByCharacterId: vi.fn(),
}));

vi.mock("../../../../lib/supabaseClient", async () => {
  const { createSupabaseClientModuleMock } =
    await import("../../../../tests/support/supabaseClientMock");
  return createSupabaseClientModuleMock();
});

const listCharacterManagerCharactersMock = vi.mocked(listCharacterManagerCharacters);
const loadCharacterManagerDraftByCharacterIdMock = vi.mocked(
  loadCharacterManagerDraftByCharacterId
);
const readSupabaseUserIdMock = vi.mocked(readSupabaseUserId);

const asDispatch = <T>(fn: (...args: unknown[]) => unknown): Dispatch<SetStateAction<T>> =>
  fn as unknown as Dispatch<SetStateAction<T>>;

const StrictModeWrapper = ({ children }: { children: ReactNode }) =>
  createElement(StrictMode, null, children);

const createParams = (
  overrides: Partial<Parameters<typeof useAiStudioCharacterModeLifecycle>[0]> = {}
): Parameters<typeof useAiStudioCharacterModeLifecycle>[0] => ({
  selectedTool: null,
  setUiError: asDispatch<string | null>(vi.fn()),
  setCharacterModeInjectionBundle: asDispatch(vi.fn()),
  setIsCharacterBundleLoading: asDispatch<boolean>(vi.fn()),
  ...overrides,
});

const createSnapshotWithPresetReferences = (
  input: { description?: string; legacyDescription?: string } = {}
) =>
  (() => {
    const defaultPresetState = createDefaultCharacterSheetPresetState();
    const activeDescription = input.description ?? "Hero description";
    return {
      characterId: "char-1",
      userId: "user-1",
      characterSheetId: "sheet-1",
      characterName: "Hero",
      legacyCharacterDescription: input.legacyDescription ?? "Legacy hero description",
      characterDescription: activeDescription,
      characterSheetAssignments: {
        portrait: "portrait_close",
        close_up: "front_full",
        front_shot: null,
        back_shot: null,
      },
      activeCharacterSheetPresetId: "1",
      characterSheetPresets: {
        ...defaultPresetState.presets,
        "1": {
          portrait: {
            mediaFileId: "media-portrait",
            storagePath: "user/chars/portrait.png",
            previewUrl: "https://example.com/portrait.png",
          },
          close_up: {
            mediaFileId: "media-closeup",
            storagePath: "user/chars/closeup.png",
            previewUrl: "https://example.com/closeup.png",
          },
          front_shot: null,
          back_shot: null,
        },
      },
      visibleCharacterSheetPresetIds: ["1"],
      characterSheetPresetLabels: defaultPresetState.tabLabels,
      characterSheetPresetDescriptions: {
        ...defaultPresetState.tabDescriptions,
        "1": activeDescription,
      },
      characterSheetPresetAssignments: {
        portrait: {
          mediaFileId: "media-portrait",
          storagePath: "user/chars/portrait.png",
          previewUrl: "https://example.com/portrait.png",
        },
        close_up: {
          mediaFileId: "media-closeup",
          storagePath: "user/chars/closeup.png",
          previewUrl: "https://example.com/closeup.png",
        },
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
        front_full: {
          storagePath: "user/chars/legacy-closeup.png",
          previewUrl: "https://example.com/legacy-closeup.png",
        },
        side_profile: null,
        back_full: null,
        top_down: null,
        front_left_34: null,
        front_right_34: null,
        back_left_34: null,
        back_right_34: null,
        portrait_close: {
          storagePath: "user/chars/legacy-portrait.png",
          previewUrl: "https://example.com/legacy-portrait.png",
        },
        fullbody_wide: null,
      },
    };
  })() as unknown as Awaited<ReturnType<typeof loadCharacterManagerDraftByCharacterId>>;

const createCharacterListItem = (
  overrides: Partial<CharacterManagerListItem> = {}
): CharacterManagerListItem => ({
  characterId: "char-1",
  characterName: "Hero",
  characterStatus: "draft",
  characterSheetId: "sheet-1",
  profileImageUrl: null,
  profileImageTransform: null,
  characterSheetStatus: "ready",
  updatedAt: "2026-03-13T00:00:00.000Z",
  ...overrides,
});

describe("useAiStudioCharacterModeLifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    readSupabaseUserIdMock.mockResolvedValue("user-1");
  });

  it("hydrates selected character id from persisted storage", async () => {
    window.localStorage.setItem(
      "shortpulse.character_manager.selected_character_id.v2:user-1",
      "char-2"
    );
    loadCharacterManagerDraftByCharacterIdMock.mockResolvedValue(
      createSnapshotWithPresetReferences()
    );
    listCharacterManagerCharactersMock.mockResolvedValue([
      {
        characterId: "char-1",
        characterName: "Hero",
        profileImageUrl: null,
      },
      {
        characterId: "char-2",
        characterName: "Ayla",
        profileImageUrl: null,
      },
    ] as Awaited<ReturnType<typeof listCharacterManagerCharacters>>);

    const { result } = renderHook(() => useAiStudioCharacterModeLifecycle(createParams()));

    await waitFor(() => {
      expect(result.current.selectedCharacterId).toBe("char-2");
      expect(result.current.isCharacterOptionsLoading).toBe(false);
    });
  });

  it("loads character options and clears loading state", async () => {
    listCharacterManagerCharactersMock.mockResolvedValue([
      {
        characterId: "char-1",
        characterName: "Hero",
        profileImageUrl: "https://example.com/profile.png",
      },
    ] as Awaited<ReturnType<typeof listCharacterManagerCharacters>>);
    const params = createParams();
    const { result } = renderHook(() => useAiStudioCharacterModeLifecycle(params));

    await waitFor(() => {
      expect(result.current.characterOptions).toEqual([
        {
          id: "char-1",
          name: "Hero",
          profileImageUrl: "https://example.com/profile.png",
        },
      ]);
      expect(result.current.characterOptionsById.get("char-1")?.name).toBe("Hero");
      expect(result.current.resolveCharacterOptionById("char-1")?.name).toBe("Hero");
      expect(typeof result.current.refreshCharacterOptions).toBe("function");
      expect(result.current.isCharacterOptionsLoading).toBe(false);
    });
  });

  it("loads character options inside StrictMode", async () => {
    listCharacterManagerCharactersMock.mockResolvedValue([
      {
        characterId: "char-1",
        characterName: "Hero",
        profileImageUrl: "https://example.com/profile.png",
      },
    ] as Awaited<ReturnType<typeof listCharacterManagerCharacters>>);
    const params = createParams();
    const { result } = renderHook(() => useAiStudioCharacterModeLifecycle(params), {
      wrapper: StrictModeWrapper,
    });

    await waitFor(() => {
      expect(result.current.characterOptions).toEqual([
        {
          id: "char-1",
          name: "Hero",
          profileImageUrl: "https://example.com/profile.png",
        },
      ]);
      expect(result.current.isCharacterOptionsLoading).toBe(false);
    });
  });

  it("surfaces non-session list errors to UI state", async () => {
    const setUiError = vi.fn();
    listCharacterManagerCharactersMock.mockRejectedValue(new Error("Failed to load list."));
    const params = createParams({
      setUiError: asDispatch<string | null>(setUiError),
    });
    renderHook(() => useAiStudioCharacterModeLifecycle(params));

    await act(async () => {
      await Promise.resolve();
    });

    expect(setUiError).toHaveBeenCalledWith("Failed to load list.");
  });

  it("loads selected character bundle and maps ordered reference urls", async () => {
    const setCharacterModeInjectionBundle = vi.fn();
    const setIsCharacterBundleLoading = vi.fn();
    listCharacterManagerCharactersMock.mockResolvedValue([
      {
        characterId: "char-1",
        characterName: "Hero",
        profileImageUrl: null,
      },
    ] as Awaited<ReturnType<typeof listCharacterManagerCharacters>>);
    loadCharacterManagerDraftByCharacterIdMock.mockResolvedValue(
      createSnapshotWithPresetReferences()
    );
    const params = createParams({
      setCharacterModeInjectionBundle: asDispatch(setCharacterModeInjectionBundle),
      setIsCharacterBundleLoading: asDispatch<boolean>(setIsCharacterBundleLoading),
    });
    const { result } = renderHook(() => useAiStudioCharacterModeLifecycle(params));

    act(() => {
      result.current.setSelectedCharacterId("char-1");
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(loadCharacterManagerDraftByCharacterIdMock).toHaveBeenCalledWith("char-1");
    expect(setIsCharacterBundleLoading).toHaveBeenCalledWith(true);
    expect(setIsCharacterBundleLoading).toHaveBeenCalledWith(false);
    expect(setCharacterModeInjectionBundle).toHaveBeenLastCalledWith(
      expect.objectContaining({
        characterId: "char-1",
        characterDescription: "Hero description",
        sheetReferenceStoragePaths: ["user/chars/portrait.png", "user/chars/closeup.png"],
        sheetReferenceUrls: ["https://example.com/portrait.png", "https://example.com/closeup.png"],
      })
    );
  });

  it("syncs selected character when persistence changes from another surface", async () => {
    listCharacterManagerCharactersMock.mockResolvedValue([
      {
        characterId: "char-1",
        characterName: "Hero",
        profileImageUrl: null,
      },
      {
        characterId: "char-2",
        characterName: "Ayla",
        profileImageUrl: null,
      },
    ] as Awaited<ReturnType<typeof listCharacterManagerCharacters>>);
    const { result } = renderHook(() => useAiStudioCharacterModeLifecycle(createParams()));

    await waitFor(() => {
      expect(result.current.isCharacterOptionsLoading).toBe(false);
    });

    act(() => {
      persistSelectedCharacterId("char-2", { userId: "user-1" });
    });

    await waitFor(() => {
      expect(result.current.selectedCharacterId).toBe("char-2");
    });
  });

  it("falls back to legacy description when active preset description is empty", async () => {
    const setCharacterModeInjectionBundle = vi.fn();
    listCharacterManagerCharactersMock.mockResolvedValue([
      {
        characterId: "char-1",
        characterName: "Hero",
        profileImageUrl: null,
      },
    ] as Awaited<ReturnType<typeof listCharacterManagerCharacters>>);
    loadCharacterManagerDraftByCharacterIdMock.mockResolvedValue(
      createSnapshotWithPresetReferences({
        description: "",
        legacyDescription: "Legacy fallback description",
      })
    );
    const params = createParams({
      setCharacterModeInjectionBundle: asDispatch(setCharacterModeInjectionBundle),
    });
    const { result } = renderHook(() => useAiStudioCharacterModeLifecycle(params));

    act(() => {
      result.current.setSelectedCharacterId("char-1");
    });

    await waitFor(() => {
      expect(setCharacterModeInjectionBundle).toHaveBeenLastCalledWith(
        expect.objectContaining({
          characterDescription: "Legacy fallback description",
        })
      );
    });
  });

  it("refreshes character options on window focus to keep avatar URLs current", async () => {
    let avatarUrl: string | null = null;
    listCharacterManagerCharactersMock.mockImplementation(
      async () =>
        [
          {
            characterId: "char-1",
            characterName: "Hero",
            profileImageUrl: avatarUrl,
          },
        ] as Awaited<ReturnType<typeof listCharacterManagerCharacters>>
    );

    const { result } = renderHook(() => useAiStudioCharacterModeLifecycle(createParams()));

    await waitFor(() => {
      expect(result.current.isCharacterOptionsLoading).toBe(false);
    });

    avatarUrl = "https://example.com/profile-refreshed.png";
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    await waitFor(() => {
      expect(result.current.characterOptions[0]?.profileImageUrl).toBe(
        "https://example.com/profile-refreshed.png"
      );
    });
  });

  it("refreshes character options when a Character Manager list-sync event is published", async () => {
    listCharacterManagerCharactersMock.mockResolvedValue([
      {
        characterId: "char-1",
        characterName: "Hero",
        profileImageUrl: null,
      },
    ] as Awaited<ReturnType<typeof listCharacterManagerCharacters>>);
    const { result } = renderHook(() => useAiStudioCharacterModeLifecycle(createParams()));
    await waitFor(() => {
      expect(result.current.characterOptions).toHaveLength(1);
    });

    listCharacterManagerCharactersMock.mockResolvedValue([
      {
        characterId: "char-1",
        characterName: "Hero",
        profileImageUrl: null,
      },
      {
        characterId: "char-2",
        characterName: "Ayla",
        profileImageUrl: null,
      },
    ] as Awaited<ReturnType<typeof listCharacterManagerCharacters>>);
    act(() => {
      publishCharacterListChanged({
        userId: "user-1",
        reason: "create",
      });
    });

    await waitFor(() => {
      expect(result.current.characterOptions.map((item) => item.id)).toEqual(["char-1", "char-2"]);
    });
  });

  it("keeps existing options when a refresh fails", async () => {
    listCharacterManagerCharactersMock.mockResolvedValueOnce([
      {
        characterId: "char-1",
        characterName: "Hero",
        profileImageUrl: null,
      },
    ] as Awaited<ReturnType<typeof listCharacterManagerCharacters>>);
    const { result } = renderHook(() => useAiStudioCharacterModeLifecycle(createParams()));
    await waitFor(() => {
      expect(result.current.characterOptions[0]?.id).toBe("char-1");
    });

    listCharacterManagerCharactersMock.mockRejectedValueOnce(
      new Error("Transient refresh failure")
    );
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    await waitFor(() => {
      expect(result.current.characterOptions[0]?.id).toBe("char-1");
    });
  });

  it("refreshes character options when entering a character-enabled tool", async () => {
    let currentRows: Awaited<ReturnType<typeof listCharacterManagerCharacters>> = [
      createCharacterListItem(),
    ];
    listCharacterManagerCharactersMock.mockImplementation(async () => currentRows);

    const { result, rerender } = renderHook(
      ({ selectedTool }: { selectedTool: ToolId | null }) =>
        useAiStudioCharacterModeLifecycle(createParams({ selectedTool })),
      {
        initialProps: {
          selectedTool: "character",
        },
      }
    );
    await waitFor(() => {
      expect(result.current.characterOptions).toHaveLength(1);
    });
    const refreshCallsBeforeToolSwitch = listCharacterManagerCharactersMock.mock.calls.length;

    currentRows = [
      createCharacterListItem(),
      createCharacterListItem({
        characterId: "char-2",
        characterName: "Ayla",
        characterSheetId: "sheet-2",
      }),
    ];
    rerender({ selectedTool: "create" });
    await waitFor(() => {
      expect(listCharacterManagerCharactersMock.mock.calls.length).toBeGreaterThan(
        refreshCallsBeforeToolSwitch
      );
    });
    await waitFor(() => {
      expect(result.current.characterOptions).toHaveLength(2);
    });
  });
});
