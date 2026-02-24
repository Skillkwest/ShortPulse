import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCreateCharacterModeController } from "../useCreateCharacterModeController";

const createArgs = (
  overrides: Partial<Parameters<typeof useCreateCharacterModeController>[0]> = {}
): Parameters<typeof useCreateCharacterModeController>[0] => ({
  beginnerMode: false,
  characterModeEnabled: true,
  characterOptions: [
    { id: "char-1", name: "Avery Pulse", profileImageUrl: "https://cdn.test/a.png" },
  ],
  selectedCharacterId: "char-1",
  isCharacterOptionsLoading: false,
  onCharacterModeEnabledChange: vi.fn(),
  onStepActionClick: vi.fn(),
  ...overrides,
});

describe("useCreateCharacterModeController", () => {
  it("derives selected character display metadata", () => {
    const { result } = renderHook(() => useCreateCharacterModeController(createArgs()));

    expect(result.current.characterSelectDisabled).toBe(false);
    expect(result.current.selectedCharacterName).toBe("Avery Pulse");
    expect(result.current.selectedCharacterProfileImageUrl).toBe("https://cdn.test/a.png");
    expect(result.current.selectedCharacterInitials).toBe("AP");
  });

  it("closes picker and emits toggle callbacks when turning character mode off", () => {
    const onCharacterModeEnabledChange = vi.fn();
    const onStepActionClick = vi.fn();
    const { result } = renderHook(() =>
      useCreateCharacterModeController(
        createArgs({
          onCharacterModeEnabledChange,
          onStepActionClick,
        })
      )
    );

    act(() => {
      result.current.openCharacterPicker();
    });
    expect(result.current.isCharacterPickerOpen).toBe(true);

    act(() => {
      result.current.handleCharacterModeEnabledToggle();
    });
    expect(result.current.isCharacterPickerOpen).toBe(false);
    expect(onCharacterModeEnabledChange).toHaveBeenCalledWith(false);
    expect(onStepActionClick).toHaveBeenCalledWith("character");
  });

  it("closes picker when escape is pressed", () => {
    const { result } = renderHook(() => useCreateCharacterModeController(createArgs()));

    act(() => {
      result.current.openCharacterPicker();
    });
    expect(result.current.isCharacterPickerOpen).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(result.current.isCharacterPickerOpen).toBe(false);
  });
});
