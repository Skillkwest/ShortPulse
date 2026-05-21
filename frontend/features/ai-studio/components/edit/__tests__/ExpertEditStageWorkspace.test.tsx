import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ExpertEditStageWorkspace } from "../ExpertEditStageWorkspace";

const noopPointerHandler = vi.fn();
const noopMouseHandler = vi.fn();
const noopWheelHandler = vi.fn();
const noopDragHandler = vi.fn();

describe("ExpertEditStageWorkspace", () => {
  it("keeps the inline stage delete button on the stage overlay class only", () => {
    const onDeleteSelectedLayer = vi.fn();

    render(
      <ExpertEditStageWorkspace
        sidebar={null}
        hasPrimaryCompositePreview
        selectedLayerName="Layer 1"
        onDeleteSelectedLayer={onDeleteSelectedLayer}
        isPrimaryStageBusy={false}
        onInlineStagePointerDownCapture={noopPointerHandler}
        onInlineStagePointerMoveCapture={noopPointerHandler}
        onInlineStagePointerUpCapture={noopPointerHandler}
        onInlineStagePointerCancelCapture={noopPointerHandler}
        inlineViewportStyle={{}}
        inlineStageRef={React.createRef<HTMLDivElement>()}
        frameStackRef={React.createRef<HTMLDivElement>()}
        isPrimaryDragActive={false}
        frameStyle={{}}
        onPrimaryDrop={noopDragHandler}
        onPrimaryDragEnter={noopDragHandler}
        onPrimaryDragOver={noopDragHandler}
        onPrimaryDragLeave={noopDragHandler}
        primarySurfaceRef={React.createRef<HTMLDivElement>()}
        isMorePresetsSurfaceOpen={false}
        primarySurfaceStyle={{}}
        emptyPrimarySurfaceStyle={{}}
        shouldRenderInlineInteractiveStage={false}
        inlineBackdropPanHandlers={{
          onPointerDown: noopPointerHandler,
          onPointerMove: noopPointerHandler,
          onPointerUp: noopPointerHandler,
          onPointerCancel: noopPointerHandler,
          onPointerLeave: noopPointerHandler,
        }}
        inlineInteractionHandlers={{
          onPointerDown: noopPointerHandler,
          onPointerMove: noopPointerHandler,
          onPointerUp: noopPointerHandler,
          onPointerCancel: noopPointerHandler,
          onPointerLeave: noopPointerHandler,
        }}
        onStageMouseDown={noopMouseHandler}
        onStageAuxClick={noopMouseHandler}
        onStageContextMenu={noopMouseHandler}
        onStageClick={noopMouseHandler}
        onStageDoubleClick={noopMouseHandler}
        onInlineStageWheel={noopWheelHandler}
        inlineSceneContent={null}
        inlineTransformOverlay={null}
        inlinePostStageTools={null}
        promptAndSelectors={null}
        shouldBlurPromptUnderlay={false}
        statusToast={null}
        modalSurface={{
          isOpen: false,
          modalRef: React.createRef<HTMLDivElement>(),
          controlsColumnRef: React.createRef<HTMLDivElement>(),
          stageRef: React.createRef<HTMLDivElement>(),
          stageStyle: {},
          generalPanel: null,
          movePanel: null,
          inpaintPanel: null,
          markupPanel: null,
          viewportStyle: {},
          sceneContent: null,
          transformOverlay: null,
          layersPanel: null,
          onClose: vi.fn(),
          onDragShield: noopDragHandler,
          interactionHandlers: {
            onPointerDown: noopPointerHandler,
            onPointerMove: noopPointerHandler,
            onPointerUp: noopPointerHandler,
            onPointerCancel: noopPointerHandler,
            onPointerLeave: noopPointerHandler,
          },
          onStageWheel: noopWheelHandler,
        }}
        contextMenu={{
          isOpen: false,
          menuRef: React.createRef<HTMLDivElement>(),
          x: 0,
          y: 0,
          isMarkupExpandSelected: false,
          hasSelectedLayerImage: true,
          onResetView: vi.fn(),
          onExpand: vi.fn(),
          onAddImage: vi.fn(),
          onReset: vi.fn(),
          onRemoveImage: vi.fn(),
        }}
      />
    );

    const deleteButton = screen.getByRole("button", { name: "Delete selected layer (Layer 1)" });
    expect(deleteButton).toHaveClass("edit-expert-stage-delete-btn");
    expect(deleteButton).not.toHaveClass("edit-expert-layer-delete-btn");

    fireEvent.click(deleteButton);
    expect(onDeleteSelectedLayer).toHaveBeenCalledTimes(1);
  });
});
