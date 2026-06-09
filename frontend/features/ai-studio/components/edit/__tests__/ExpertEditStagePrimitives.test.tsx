import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ExpertEditTransformChromeLayer,
  ExpertEditStageContextMenu,
  PrimaryCompositionSurface,
  PrimaryStageShell,
  PrimaryStageRenderClip,
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
    if (!(visibleStage instanceof HTMLElement)) {
      throw new Error("Expected visible stage wrapper to be an HTMLElement.");
    }
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
    if (!(hiddenComposition instanceof HTMLElement)) {
      throw new Error("Expected hidden composition surface to be an HTMLElement.");
    }
    expect(hiddenComposition?.tabIndex).toBe(-1);
    expect(hiddenComposition).not.toHaveAttribute("data-keyboard-pan-owner");
    expect(hiddenComposition).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps transform chrome outside the render clip ancestry", () => {
    render(
      <div className="edit-expert-primary-stage-shell edit-expert-transform-chrome-clip-boundary">
        <PrimaryStageRenderClip>
          <div data-testid="rendered-pixels" />
        </PrimaryStageRenderClip>
        <ExpertEditTransformChromeLayer
          scope="inline"
          viewportStyle={{ transform: "scale(1)" }}
          frameStyle={{ width: 200, height: 300 }}
        >
          <div data-testid="selected-layer-transform" />
        </ExpertEditTransformChromeLayer>
      </div>
    );

    const transformChrome = screen.getByTestId("selected-layer-transform");
    const chromeLayer = screen.getByTestId("edit-expert-transform-chrome-layer-inline");
    const stageShell = transformChrome.closest(".edit-expert-primary-stage-shell");

    expect(transformChrome.closest(".edit-expert-stage-render-clip")).toBeNull();
    expect(transformChrome.closest(".edit-expert-primary-composition-surface")).toBeNull();
    expect(transformChrome.closest(".edit-expert-transform-chrome-layer")).toBe(chromeLayer);
    expect(transformChrome.closest(".edit-expert-stage-camera-layer--chrome")).not.toBeNull();
    expect(stageShell).toHaveClass("edit-expert-transform-chrome-clip-boundary");
    expect(
      screen.getByTestId("rendered-pixels").closest(".edit-expert-stage-render-clip")
    ).not.toBeNull();
  });

  it("supports modal transform chrome without a clipping frame ancestor", () => {
    render(
      <div className="edit-expert-markup-modal-stage">
        <PrimaryStageRenderClip>
          <div data-testid="modal-rendered-pixels" />
        </PrimaryStageRenderClip>
        <ExpertEditTransformChromeLayer
          scope="modal"
          viewportStyle={{ transform: "translate3d(10px, 20px, 0) scale(2)" }}
        >
          <div data-testid="modal-selected-layer-transform" />
        </ExpertEditTransformChromeLayer>
      </div>
    );

    const modalTransformChrome = screen.getByTestId("modal-selected-layer-transform");
    const modalChromeLayer = screen.getByTestId("edit-expert-transform-chrome-layer-modal");

    expect(modalChromeLayer).toContainElement(modalTransformChrome);
    expect(modalTransformChrome.closest(".edit-expert-stage-render-clip")).toBeNull();
    expect(modalTransformChrome.closest(".edit-expert-primary-composition-surface")).toBeNull();
    expect(modalTransformChrome.closest(".edit-expert-stage-camera-layer--chrome")).not.toBeNull();
    expect(
      screen.getByTestId("modal-rendered-pixels").closest(".edit-expert-stage-render-clip")
    ).not.toBeNull();
  });
});
