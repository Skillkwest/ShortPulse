import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCharacterManagerShellActionHandlers } from "../useCharacterManagerShellActionHandlers";

const createInputRef = () => {
  const click = vi.fn();
  const focus = vi.fn();
  return {
    current: {
      click,
      focus,
      value: "",
    } as unknown as HTMLInputElement,
    click,
    focus,
  };
};

describe("useCharacterManagerShellActionHandlers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const setup = (
    overrides?: Partial<Parameters<typeof useCharacterManagerShellActionHandlers>[0]>
  ) => {
    const characterSheetInput = createInputRef();
    const simpleInput = createInputRef();
    const nameInput = createInputRef();
    const clearAllMessages = vi.fn();
    const setError = vi.fn();
    const appendQuickSwapFiles = vi.fn().mockResolvedValue(true);
    const setPendingCharacterSheetUploadZoneKey = vi.fn();
    const createCharacter = vi.fn().mockResolvedValue(true);
    const setActiveTab = vi.fn();

    const params = {
      pageBusy: false,
      hasPersistedCharacter: false,
      quickSwapMutating: false,
      isDropResolutionBusy: false,
      clearAllMessages,
      setError,
      appendQuickSwapFiles,
      setPendingCharacterSheetUploadZoneKey,
      characterSheetFileInputRef: characterSheetInput as { current: HTMLInputElement | null },
      simpleFileInputRef: simpleInput as { current: HTMLInputElement | null },
      createCharacter,
      setActiveTab,
      characterNameInputRef: nameInput as { current: HTMLInputElement | null },
      ...overrides,
    };

    const hook = renderHook(() => useCharacterManagerShellActionHandlers(params));

    return {
      ...hook,
      params,
      characterSheetInput,
      simpleInput,
      nameInput,
      clearAllMessages,
      setError,
      appendQuickSwapFiles,
      setPendingCharacterSheetUploadZoneKey,
      createCharacter,
      setActiveTab,
    };
  };

  it("creates a new character and restores focus after the async action settles", async () => {
    const raf = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 1;
      });
    const { result, createCharacter, setActiveTab, nameInput } = setup();

    act(() => {
      result.current.handleCreateNewCharacter();
    });

    expect(setActiveTab).toHaveBeenCalledWith("create");

    await act(async () => {
      await Promise.resolve();
    });

    expect(createCharacter).toHaveBeenCalledTimes(1);
    expect(raf).toHaveBeenCalled();
    expect(nameInput.focus).toHaveBeenCalledTimes(1);
  });
});
