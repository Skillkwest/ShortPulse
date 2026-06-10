import React from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { RailTool } from "../expertEditPanelViewContract";
import { useExpertEditStageChrome } from "../useExpertEditStageChrome";

describe("useExpertEditStageChrome", () => {
  it("captures inline pan gestures that begin over nested stage content", () => {
    const beginMarkupPanGesture = vi.fn(() => true);
    const stage = document.createElement("div");
    const nestedImage = document.createElement("div");
    const stopPropagation = vi.fn();
    stage.tabIndex = 0;
    stage.appendChild(nestedImage);
    document.body.appendChild(stage);

    try {
      const { result } = renderHook(() =>
        useExpertEditStageChrome({
          hasPrimaryCompositePreview: true,
          isMarkupExpandSelected: false,
          isMorePresetsSurfaceOpen: false,
          isMoveToolSelected: true,
          selectedRailTool: "move",
          shouldOpenMarkupModalFromCollapsedTools: false,
          beginMarkupPanGesture,
          continueMarkupPanGesture: vi.fn(() => false),
          endMarkupPanGesture: vi.fn(() => false),
          handleRecenterMoveAction: vi.fn(),
          handleResetGeneralAction: vi.fn(),
          handleRemoveSelectedLayerImage: vi.fn(),
          setSelectedRailTool: vi.fn(),
          setIsMarkupExpandSelected: vi.fn(),
          setIsInpaintCollapsed: vi.fn(),
          setIsInpaintCollapsing: vi.fn(),
          primaryInputRef: { current: null },
          stageContextMenuRef: { current: null },
          markupModalRef: { current: null },
          inpaintCollapseTimerRef: { current: null },
        })
      );

      act(() => {
        result.current.handleInlineStagePointerDownCapture({
          target: nestedImage,
          currentTarget: stage,
          stopPropagation,
        } as unknown as React.PointerEvent<HTMLDivElement>);
      });

      expect(beginMarkupPanGesture).toHaveBeenCalledTimes(1);
      expect(stopPropagation).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(stage);
    } finally {
      stage.remove();
    }
  });

  it("does not silently switch the active rail tool back to move when closing the modal", () => {
    const { result } = renderHook(() => {
      const [selectedRailTool, setSelectedRailTool] = React.useState<RailTool>("markup");
      const [isMarkupExpandSelected, setIsMarkupExpandSelected] = React.useState(true);
      const [isInpaintCollapsed, setIsInpaintCollapsed] = React.useState(false);
      const [isInpaintCollapsing, setIsInpaintCollapsing] = React.useState(false);

      const chrome = useExpertEditStageChrome({
        hasPrimaryCompositePreview: true,
        isMarkupExpandSelected,
        isMorePresetsSurfaceOpen: false,
        isMoveToolSelected: false,
        selectedRailTool,
        shouldOpenMarkupModalFromCollapsedTools: true,
        beginMarkupPanGesture: vi.fn(() => false),
        continueMarkupPanGesture: vi.fn(() => false),
        endMarkupPanGesture: vi.fn(() => false),
        handleRecenterMoveAction: vi.fn(),
        handleResetGeneralAction: vi.fn(),
        handleRemoveSelectedLayerImage: vi.fn(),
        setSelectedRailTool,
        setIsMarkupExpandSelected,
        setIsInpaintCollapsed,
        setIsInpaintCollapsing,
        primaryInputRef: { current: null },
        stageContextMenuRef: { current: null },
        markupModalRef: { current: null },
        inpaintCollapseTimerRef: { current: null },
      });

      return {
        chrome,
        isInpaintCollapsed,
        isInpaintCollapsing,
        isMarkupExpandSelected,
        selectedRailTool,
      };
    });

    act(() => {
      result.current.chrome.closeMarkupModal();
    });

    expect(result.current.isMarkupExpandSelected).toBe(false);
    expect(result.current.selectedRailTool).toBe("markup");
    expect(result.current.isInpaintCollapsed).toBe(true);
    expect(result.current.isInpaintCollapsing).toBe(false);
  });
});
