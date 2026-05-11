import React from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useExpertEditStageChrome } from "../useExpertEditStageChrome";

describe("useExpertEditStageChrome", () => {
  it("does not silently switch the active rail tool back to move when closing the modal", () => {
    const { result } = renderHook(() => {
      const [selectedRailTool, setSelectedRailTool] = React.useState<"move" | "markup">("markup");
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
