/**
 * Verifies the Create character selector empty-state copy.
 */
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCreateCharacterModeController } from "../useCreateCharacterModeController";

describe("useCreateCharacterModeController", () => {
  it("shows 'No Characters' when character mode is on and the user has no saved characters", () => {
    const { result } = renderHook(() =>
      useCreateCharacterModeController({
        characterModeEnabled: true,
        characterOptions: [],
        selectedCharacterId: "",
        isCharacterOptionsLoading: false,
        onCharacterPickerOpen: vi.fn(),
        onCharacterModeEnabledChange: vi.fn(),
        onStepActionClick: vi.fn(),
      })
    );

    expect(result.current.selectedCharacterName).toBe("No Characters");
    expect(result.current.selectedCharacterDisplayName).toBe("No Characters");
  });
});
