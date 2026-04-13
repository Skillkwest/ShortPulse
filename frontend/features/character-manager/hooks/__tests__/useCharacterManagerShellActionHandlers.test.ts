import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCharacterManagerShellActionHandlers } from "../useCharacterManagerShellActionHandlers";

const DEFAULT_PROFILE_IMAGE_TRANSFORM = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
} as const;

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
    const profileInput = createInputRef();
    const simpleInput = createInputRef();
    const nameInput = createInputRef();
    const clearAllMessages = vi.fn();
    const setError = vi.fn();
    const appendQuickSwapFiles = vi.fn().mockResolvedValue(true);
    const setPendingCharacterSheetUploadZoneKey = vi.fn();
    const setProfileAdjustDraft = vi.fn();
    const setIsProfileAdjusterVisible = vi.fn();
    const setProfileImageFile = vi.fn().mockResolvedValue(true);
    const clearProfileImage = vi.fn().mockResolvedValue(true);
    const createCharacter = vi.fn().mockResolvedValue(true);
    const setActiveTab = vi.fn();
    const saveProfileImageTransform = vi.fn().mockResolvedValue(true);

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
      profileFileInputRef: profileInput as { current: HTMLInputElement | null },
      simpleFileInputRef: simpleInput as { current: HTMLInputElement | null },
      profileImageUrl: null as string | null,
      isProfileAdjusterVisible: false,
      profileImageTransform: { ...DEFAULT_PROFILE_IMAGE_TRANSFORM },
      setProfileAdjustDraft,
      setIsProfileAdjusterVisible,
      setProfileImageFile,
      clearProfileImage,
      createCharacter,
      setActiveTab,
      characterNameInputRef: nameInput as { current: HTMLInputElement | null },
      profileImageVisibleTransform: { zoom: 1.2, offsetX: 4, offsetY: -3 },
      saveProfileImageTransform,
      defaultProfileImageTransform: { ...DEFAULT_PROFILE_IMAGE_TRANSFORM },
      ...overrides,
    };

    const hook = renderHook(() => useCharacterManagerShellActionHandlers(params));

    return {
      ...hook,
      params,
      characterSheetInput,
      profileInput,
      simpleInput,
      nameInput,
      clearAllMessages,
      setError,
      appendQuickSwapFiles,
      setPendingCharacterSheetUploadZoneKey,
      setProfileAdjustDraft,
      setIsProfileAdjusterVisible,
      setProfileImageFile,
      clearProfileImage,
      createCharacter,
      setActiveTab,
      saveProfileImageTransform,
    };
  };

  it("opens profile adjust mode when an existing photo is present", () => {
    const { result, setProfileAdjustDraft, setIsProfileAdjusterVisible, profileInput } = setup({
      profileImageUrl: "https://example.com/profile.png",
      profileImageTransform: { zoom: 1.4, offsetX: 5, offsetY: -2 },
    });

    act(() => {
      result.current.openProfilePicker();
    });

    expect(setProfileAdjustDraft).toHaveBeenCalledWith({ zoom: 1.4, offsetX: 5, offsetY: -2 });
    expect(setIsProfileAdjusterVisible).toHaveBeenCalledWith(true);
    expect(profileInput.click).not.toHaveBeenCalled();
  });

  it("opens the hidden profile file input when no photo exists", () => {
    const { result, clearAllMessages, profileInput } = setup();

    act(() => {
      result.current.openProfilePicker();
    });

    expect(clearAllMessages).toHaveBeenCalledTimes(1);
    expect(profileInput.click).toHaveBeenCalledTimes(1);
  });

  it("handles profile file selection by resetting draft state and opening the adjuster", () => {
    const { result, setProfileImageFile, setProfileAdjustDraft, setIsProfileAdjusterVisible } =
      setup();
    const file = new File(["image"], "profile.png", { type: "image/png" });
    const event = {
      target: {
        files: [file],
        value: "existing",
      },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    act(() => {
      result.current.handleProfileSelection(event);
    });

    expect(event.target.value).toBe("");
    expect(setProfileImageFile).toHaveBeenCalledWith(file);
    expect(setProfileAdjustDraft).toHaveBeenCalledWith(DEFAULT_PROFILE_IMAGE_TRANSFORM);
    expect(setIsProfileAdjusterVisible).toHaveBeenCalledWith(true);
  });

  it("clears the profile preview and resets the file input", () => {
    const {
      result,
      clearProfileImage,
      setProfileAdjustDraft,
      setIsProfileAdjusterVisible,
      profileInput,
    } = setup();
    (profileInput.current as HTMLInputElement).value = "has-value";

    act(() => {
      result.current.clearProfilePreview();
    });

    expect(clearProfileImage).toHaveBeenCalledTimes(1);
    expect(setProfileAdjustDraft).toHaveBeenCalledWith(null);
    expect(setIsProfileAdjusterVisible).toHaveBeenCalledWith(false);
    expect((profileInput.current as HTMLInputElement).value).toBe("");
  });

  it("saves profile adjustments and closes the adjuster on success", async () => {
    const {
      result,
      saveProfileImageTransform,
      setProfileAdjustDraft,
      setIsProfileAdjusterVisible,
    } = setup({
      profileImageUrl: "https://example.com/profile.png",
      profileImageVisibleTransform: { zoom: 1.3, offsetX: 6, offsetY: -4 },
    });

    await act(async () => {
      await result.current.saveProfileAdjustments();
    });

    expect(saveProfileImageTransform).toHaveBeenCalledWith({
      zoom: 1.3,
      offsetX: 6,
      offsetY: -4,
    });
    expect(setProfileAdjustDraft).toHaveBeenCalledWith(null);
    expect(setIsProfileAdjusterVisible).toHaveBeenCalledWith(false);
  });

  it("creates a new character and restores focus after the async action settles", async () => {
    const raf = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 1;
      });
    const {
      result,
      createCharacter,
      setActiveTab,
      setProfileAdjustDraft,
      setIsProfileAdjusterVisible,
      nameInput,
    } = setup();

    act(() => {
      result.current.handleCreateNewCharacter();
    });

    expect(setActiveTab).toHaveBeenCalledWith("create");
    expect(setProfileAdjustDraft).toHaveBeenCalledWith(null);
    expect(setIsProfileAdjusterVisible).toHaveBeenCalledWith(false);

    await act(async () => {
      await Promise.resolve();
    });

    expect(createCharacter).toHaveBeenCalledTimes(1);
    expect(raf).toHaveBeenCalled();
    expect(nameInput.focus).toHaveBeenCalledTimes(1);
  });
});
