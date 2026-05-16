import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ExpertEditStageContextMenu,
  PrimaryCompositionSurface,
  PrimaryStageShell,
} from "../ExpertEditStagePrimitives";

describe("ExpertEditStageContextMenu", () => {
  it("separates centering from destructive full reset", () => {
    const onResetView = vi.fn();
    const onReset = vi.fn();

    render(
      <ExpertEditStageContextMenu
        menuRef={{ current: null }}
        x={24}
        y={48}
        isMarkupExpandSelected={false}
        hasSelectedLayerImage
        onResetView={onResetView}
        onExpand={vi.fn()}
        onAddImage={vi.fn()}
        onReset={onReset}
        onRemoveImage={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("menuitem", { name: "Center" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Reset All" }));

    expect(onResetView).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("keeps hidden composition surfaces out of the tab order and uses one tabbable owner", () => {
    const { rerender } = render(
      <>
        <PrimaryStageShell
          stageRef={{ current: null }}
          isEmpty={false}
          isBusy={false}
          onPointerDownCapture={vi.fn()}
          onPointerMoveCapture={vi.fn()}
          onPointerUpCapture={vi.fn()}
          onPointerCancelCapture={vi.fn()}
        >
          visible stage
        </PrimaryStageShell>
        <PrimaryCompositionSurface
          surfaceRef={{ current: null }}
          isVisible
          isBusy={false}
          isDragActive={false}
          isPresetsOpen={false}
          style={{}}
        >
          visible composition
        </PrimaryCompositionSurface>
      </>
    );

    const visibleStage = screen.getByText("visible stage").parentElement;
    const visibleComposition = screen.getByLabelText("Primary composition surface");
    expect(visibleStage?.tabIndex).toBe(-1);
    expect(visibleComposition?.tabIndex).toBe(0);
    expect(visibleComposition).toHaveAttribute("data-keyboard-pan-owner", "true");

    rerender(
      <PrimaryCompositionSurface
        surfaceRef={{ current: null }}
        isVisible={false}
        isBusy={false}
        isDragActive={false}
        isPresetsOpen={false}
        style={{}}
      >
        hidden composition
      </PrimaryCompositionSurface>
    );

    const hiddenComposition = screen
      .getByText("hidden composition")
      .closest(".edit-expert-primary-composition-surface");
    expect(hiddenComposition?.tabIndex).toBe(-1);
    expect(hiddenComposition).not.toHaveAttribute("data-keyboard-pan-owner");
    expect(hiddenComposition).toHaveAttribute("aria-hidden", "true");
  });
});
