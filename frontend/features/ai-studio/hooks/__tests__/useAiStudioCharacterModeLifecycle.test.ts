import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import { useAiStudioCharacterModeLifecycle } from "../useAiStudioCharacterModeLifecycle";
import {
  listCharacterManagerCharacters,
  loadCharacterManagerDraftByCharacterId,
} from "../../../character-manager/logic/characterManagerPersistence";

vi.mock("../../../character-manager/logic/characterManagerPersistence", () => ({
  listCharacterManagerCharacters: vi.fn(),
  loadCharacterManagerDraftByCharacterId: vi.fn(),
}));

const listCharacterManagerCharactersMock = vi.mocked(listCharacterManagerCharacters);
const loadCharacterManagerDraftByCharacterIdMock = vi.mocked(
  loadCharacterManagerDraftByCharacterId
);

const asDispatch = <T>(fn: (...args: unknown[]) => unknown): Dispatch<SetStateAction<T>> =>
  fn as unknown as Dispatch<SetStateAction<T>>;

const createParams = (
  overrides: Partial<Parameters<typeof useAiStudioCharacterModeLifecycle>[0]> = {}
): Parameters<typeof useAiStudioCharacterModeLifecycle>[0] => ({
  isCharacterModeEnabled: false,
  selectedTool: null,
  model: null,
  setModel: asDispatch<string | null>(vi.fn()),
  setUiError: asDispatch<string | null>(vi.fn()),
  setCharacterModeInjectionBundle: asDispatch(vi.fn()),
  setIsCharacterBundleLoading: asDispatch<boolean>(vi.fn()),
  backgroundModelId: "fal-ai/bytedance/seedream/v4.5/edit",
  ...overrides,
});

const createSnapshotWithPresetReferences = () =>
  ({
    characterId: "char-1",
    characterSheetId: "sheet-1",
    characterName: "Hero",
    characterDescription: "Hero description",
    characterSheetAssignments: {
      portrait: "portrait_close",
      close_up: "front_full",
      front_shot: null,
      back_shot: null,
    },
    activeCharacterSheetPresetId: "1",
    characterSheetPresets: {
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
      "2": { portrait: null, close_up: null, front_shot: null, back_shot: null },
      "3": { portrait: null, close_up: null, front_shot: null, back_shot: null },
      "4": { portrait: null, close_up: null, front_shot: null, back_shot: null },
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
  }) as unknown as Awaited<ReturnType<typeof loadCharacterManagerDraftByCharacterId>>;

describe("useAiStudioCharacterModeLifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.characterOptions).toEqual([
      {
        id: "char-1",
        name: "Hero",
        profileImageUrl: "https://example.com/profile.png",
      },
    ]);
    expect(result.current.isCharacterOptionsLoading).toBe(false);
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

  it("enforces create model and clears selection when character mode toggles off", async () => {
    const setModel = vi.fn();
    listCharacterManagerCharactersMock.mockResolvedValue([]);
    const base = createParams({
      setModel: asDispatch<string | null>(setModel),
      selectedTool: "create",
    });
    const { rerender } = renderHook(
      (props: Parameters<typeof useAiStudioCharacterModeLifecycle>[0]) =>
        useAiStudioCharacterModeLifecycle(props),
      {
        initialProps: {
          ...base,
          isCharacterModeEnabled: true,
          model: "fal-ai/other-model",
        },
      }
    );

    await act(async () => {
      await Promise.resolve();
    });

    rerender({
      ...base,
      isCharacterModeEnabled: false,
      model: "fal-ai/bytedance/seedream/v4.5/edit",
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(setModel).toHaveBeenNthCalledWith(1, "fal-ai/bytedance/seedream/v4.5/edit");
    expect(setModel).toHaveBeenNthCalledWith(2, null);
  });

  it("does not clear model when character mode is off and a non-forced model is selected", async () => {
    const setModel = vi.fn();
    listCharacterManagerCharactersMock.mockResolvedValue([]);
    const params = createParams({
      setModel: asDispatch<string | null>(setModel),
      selectedTool: "create",
      isCharacterModeEnabled: false,
      model: "fal-ai/other-model",
    });

    renderHook(() => useAiStudioCharacterModeLifecycle(params));

    await act(async () => {
      await Promise.resolve();
    });

    expect(setModel).not.toHaveBeenCalled();
  });

  it("clears create model when character mode is already off after restore", async () => {
    const setModel = vi.fn();
    listCharacterManagerCharactersMock.mockResolvedValue([]);
    const params = createParams({
      setModel: asDispatch<string | null>(setModel),
      selectedTool: "create",
      isCharacterModeEnabled: false,
      model: "fal-ai/bytedance/seedream/v4.5/edit",
    });

    renderHook(() => useAiStudioCharacterModeLifecycle(params));

    await act(async () => {
      await Promise.resolve();
    });

    expect(setModel).toHaveBeenCalledWith(null);
  });
});
