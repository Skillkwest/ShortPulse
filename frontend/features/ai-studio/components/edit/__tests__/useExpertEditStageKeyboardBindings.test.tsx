import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useExpertEditStageKeyboardBindings } from "../useExpertEditStageKeyboardBindings";

describe("useExpertEditStageKeyboardBindings", () => {
  const createPanelRootRef = () => {
    const panelRoot = document.createElement("div");
    document.body.appendChild(panelRoot);
    return {
      panelRoot,
      panelRootRef: { current: panelRoot } as React.RefObject<HTMLElement | null>,
    };
  };

  it("enters and exits space-pan mode from a neutral stage context", async () => {
    const { panelRootRef, panelRoot } = createPanelRootRef();
    const { result } = renderHook(() => {
      const [isMarkupPanSpacePressed, setIsMarkupPanSpacePressed] = React.useState(false);
      useExpertEditStageKeyboardBindings({
        panelRootRef,
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
    panelRoot.remove();
  });

  it("does not arm space-pan while an editable target owns the keyboard event", async () => {
    const { panelRootRef, panelRoot } = createPanelRootRef();
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    try {
      const { result } = renderHook(() => {
        const [isMarkupPanSpacePressed, setIsMarkupPanSpacePressed] = React.useState(false);
        useExpertEditStageKeyboardBindings({
          panelRootRef,
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
      panelRoot.remove();
      input.remove();
    }
  });

  it("does not arm space-pan from focused button controls", async () => {
    const { panelRootRef, panelRoot } = createPanelRootRef();
    const button = document.createElement("button");
    document.body.appendChild(button);
    button.focus();

    try {
      const { result } = renderHook(() => {
        const [isMarkupPanSpacePressed, setIsMarkupPanSpacePressed] = React.useState(false);
        useExpertEditStageKeyboardBindings({
          panelRootRef,
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
      panelRoot.remove();
      button.remove();
    }
  });

  it("treats stage keyboard owners as valid space-pan targets even though they are focusable", async () => {
    const { panelRootRef, panelRoot } = createPanelRootRef();
    const stageOwner = document.createElement("div");
    stageOwner.setAttribute("data-keyboard-pan-owner", "true");
    stageOwner.tabIndex = 0;
    panelRoot.appendChild(stageOwner);
    stageOwner.focus();

    try {
      const { result } = renderHook(() => {
        const [isMarkupPanSpacePressed, setIsMarkupPanSpacePressed] = React.useState(false);
        useExpertEditStageKeyboardBindings({
          panelRootRef,
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
        stageOwner.dispatchEvent(keyDown);
      });

      await waitFor(() => {
        expect(result.current.isMarkupPanSpacePressed).toBe(true);
      });
      expect(keyDown.defaultPrevented).toBe(true);
    } finally {
      panelRoot.remove();
    }
  });

  it("always clears space-pan on keyup even when release lands on an interactive target", async () => {
    const { panelRootRef, panelRoot } = createPanelRootRef();
    const { result } = renderHook(() => {
      const [isMarkupPanSpacePressed, setIsMarkupPanSpacePressed] = React.useState(false);
      useExpertEditStageKeyboardBindings({
        panelRootRef,
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

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: " ",
          code: "Space",
          bubbles: true,
          cancelable: true,
        })
      );
    });

    await waitFor(() => {
      expect(result.current.isMarkupPanSpacePressed).toBe(true);
    });

    const button = document.createElement("button");
    document.body.appendChild(button);
    button.focus();

    try {
      const keyUp = new KeyboardEvent("keyup", {
        key: " ",
        code: "Space",
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        button.dispatchEvent(keyUp);
      });

      await waitFor(() => {
        expect(result.current.isMarkupPanSpacePressed).toBe(false);
      });
      expect(keyUp.defaultPrevented).toBe(false);
    } finally {
      panelRoot.remove();
      button.remove();
    }
  });

  it("handles undo and redo hotkeys anywhere in the mounted edit panel", async () => {
    const { panelRootRef, panelRoot } = createPanelRootRef();
    const panelTarget = document.createElement("button");
    panelRoot.appendChild(panelTarget);
    panelTarget.focus();
    const handleUndoGeneralAction = vi.fn();
    const handleRedoGeneralAction = vi.fn();

    renderHook(() => {
      const [, setIsMarkupPanSpacePressed] = React.useState(false);
      useExpertEditStageKeyboardBindings({
        panelRootRef,
        isMarkupExpandSelected: false,
        isMorePresetsSurfaceOpen: false,
        setIsMarkupPanSpacePressed,
        canUndoGeneralAction: true,
        canRedoGeneralAction: true,
        handleUndoGeneralAction,
        handleRedoGeneralAction,
      });
    });

    act(() => {
      panelTarget.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "z",
          metaKey: true,
          bubbles: true,
          cancelable: true,
        })
      );
    });
    act(() => {
      panelTarget.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Z",
          metaKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        })
      );
    });

    expect(handleUndoGeneralAction).toHaveBeenCalledTimes(1);
    expect(handleRedoGeneralAction).toHaveBeenCalledTimes(1);
    panelRoot.remove();
  });

  it("does not steal undo from editable targets and supports ctrl+y redo elsewhere", async () => {
    const { panelRootRef, panelRoot } = createPanelRootRef();
    const textarea = document.createElement("textarea");
    panelRoot.appendChild(textarea);
    textarea.focus();
    const handleUndoGeneralAction = vi.fn();
    const handleRedoGeneralAction = vi.fn();

    try {
      renderHook(() => {
        const [, setIsMarkupPanSpacePressed] = React.useState(false);
        useExpertEditStageKeyboardBindings({
          panelRootRef,
          isMarkupExpandSelected: false,
          isMorePresetsSurfaceOpen: false,
          setIsMarkupPanSpacePressed,
          canUndoGeneralAction: true,
          canRedoGeneralAction: true,
          handleUndoGeneralAction,
          handleRedoGeneralAction,
        });
      });

      act(() => {
        textarea.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "z",
            metaKey: true,
            bubbles: true,
            cancelable: true,
          })
        );
      });
      act(() => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "y",
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          })
        );
      });

      expect(handleUndoGeneralAction).not.toHaveBeenCalled();
      expect(handleRedoGeneralAction).toHaveBeenCalledTimes(1);
    } finally {
      panelRoot.remove();
    }
  });

  it("ignores undo and redo hotkeys that originate outside the edit panel root", async () => {
    const { panelRootRef, panelRoot } = createPanelRootRef();
    const outsideButton = document.createElement("button");
    document.body.appendChild(outsideButton);
    outsideButton.focus();
    const handleUndoGeneralAction = vi.fn();
    const handleRedoGeneralAction = vi.fn();

    try {
      renderHook(() => {
        const [, setIsMarkupPanSpacePressed] = React.useState(false);
        useExpertEditStageKeyboardBindings({
          panelRootRef,
          isMarkupExpandSelected: false,
          isMorePresetsSurfaceOpen: false,
          setIsMarkupPanSpacePressed,
          canUndoGeneralAction: true,
          canRedoGeneralAction: true,
          handleUndoGeneralAction,
          handleRedoGeneralAction,
        });
      });

      act(() => {
        outsideButton.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "z",
            metaKey: true,
            bubbles: true,
            cancelable: true,
          })
        );
      });
      act(() => {
        outsideButton.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Z",
            metaKey: true,
            shiftKey: true,
            bubbles: true,
            cancelable: true,
          })
        );
      });

      expect(handleUndoGeneralAction).not.toHaveBeenCalled();
      expect(handleRedoGeneralAction).not.toHaveBeenCalled();
    } finally {
      outsideButton.remove();
      panelRoot.remove();
    }
  });
});
