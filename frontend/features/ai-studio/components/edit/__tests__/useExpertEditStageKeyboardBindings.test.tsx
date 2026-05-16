import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useExpertEditStageKeyboardBindings } from "../useExpertEditStageKeyboardBindings";

describe("useExpertEditStageKeyboardBindings", () => {
  it("enters and exits space-pan mode from a neutral stage context", async () => {
    const { result } = renderHook(() => {
      const [isMarkupPanSpacePressed, setIsMarkupPanSpacePressed] = React.useState(false);
      useExpertEditStageKeyboardBindings({
        isMarkupExpandSelected: true,
        isMorePresetsSurfaceOpen: false,
        setIsMarkupPanSpacePressed,
        canUndoGeneralAction: false,
        canRedoGeneralAction: false,
        handleUndoGeneralAction: vi.fn(),
        handleRedoGeneralAction: vi.fn(),
      });
      return { isMarkupPanSpacePressed };
    });

    const keyDown = new KeyboardEvent("keydown", {
      key: " ",
      code: "Space",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      window.dispatchEvent(keyDown);
    });

    await waitFor(() => {
      expect(result.current.isMarkupPanSpacePressed).toBe(true);
    });
    expect(keyDown.defaultPrevented).toBe(true);

    const keyUp = new KeyboardEvent("keyup", {
      key: " ",
      code: "Space",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      window.dispatchEvent(keyUp);
    });

    await waitFor(() => {
      expect(result.current.isMarkupPanSpacePressed).toBe(false);
    });
    expect(keyUp.defaultPrevented).toBe(true);
  });

  it("does not arm space-pan while an editable target owns the keyboard event", async () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    try {
      const { result } = renderHook(() => {
        const [isMarkupPanSpacePressed, setIsMarkupPanSpacePressed] = React.useState(false);
        useExpertEditStageKeyboardBindings({
          isMarkupExpandSelected: true,
          isMorePresetsSurfaceOpen: false,
          setIsMarkupPanSpacePressed,
          canUndoGeneralAction: false,
          canRedoGeneralAction: false,
          handleUndoGeneralAction: vi.fn(),
          handleRedoGeneralAction: vi.fn(),
        });
        return { isMarkupPanSpacePressed };
      });

      const keyDown = new KeyboardEvent("keydown", {
        key: " ",
        code: "Space",
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        input.dispatchEvent(keyDown);
      });
      await Promise.resolve();

      expect(result.current.isMarkupPanSpacePressed).toBe(false);
      expect(keyDown.defaultPrevented).toBe(false);
    } finally {
      input.remove();
    }
  });

  it("does not arm space-pan from focused button controls", async () => {
    const button = document.createElement("button");
    document.body.appendChild(button);
    button.focus();

    try {
      const { result } = renderHook(() => {
        const [isMarkupPanSpacePressed, setIsMarkupPanSpacePressed] = React.useState(false);
        useExpertEditStageKeyboardBindings({
          isMarkupExpandSelected: true,
          isMorePresetsSurfaceOpen: false,
          setIsMarkupPanSpacePressed,
          canUndoGeneralAction: false,
          canRedoGeneralAction: false,
          handleUndoGeneralAction: vi.fn(),
          handleRedoGeneralAction: vi.fn(),
        });
        return { isMarkupPanSpacePressed };
      });

      const keyDown = new KeyboardEvent("keydown", {
        key: " ",
        code: "Space",
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        button.dispatchEvent(keyDown);
      });
      await Promise.resolve();

      expect(result.current.isMarkupPanSpacePressed).toBe(false);
      expect(keyDown.defaultPrevented).toBe(false);
    } finally {
      button.remove();
    }
  });
});
