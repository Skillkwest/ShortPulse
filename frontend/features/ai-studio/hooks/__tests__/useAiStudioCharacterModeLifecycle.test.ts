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
    listCharacterManagerCharactersMock.mockResolvedValue([]);
    loadCharacterManagerDraftByCharacterIdMock.mockResolvedValue({
      characterId: "char-1",
      characterSheetId: "sheet-1",
      characterName: "Hero",
      characterDescription: "Hero description",
      characterSheetAssignments: {
        portrait: "slot-1",
        close_up: "slot-2",
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
        "slot-2": {
          previewUrl: "https://example.com/closeup.png",
        },
      },
    } as unknown as Awaited<ReturnType<typeof loadCharacterManagerDraftByCharacterId>>);
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
    expect(setCharacterModeInjectionBundle).toHaveBeenCalledWith(
      expect.objectContaining({
        characterId: "char-1",
        characterDescription: "Hero description",
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
});
