import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ExpertEditInlineHistoryControls,
  ExpertEditMarkupModalGeneralPanel,
  ExpertEditMoveControlsContent,
} from "../ExpertEditStageControls";

describe("ExpertEditMarkupModalGeneralPanel", () => {
  it("labels the destructive general reset action explicitly", () => {
    render(
      <ExpertEditMarkupModalGeneralPanel
        aspect="9:16"
        aspectOptionsForModel={[]}
        canUndoGeneralAction
        canRedoGeneralAction
        isGeneralResetDisabled={false}
        onAspectChange={vi.fn()}
        handleUndoGeneralAction={vi.fn()}
        handleRedoGeneralAction={vi.fn()}
        handleResetGeneralAction={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", {
        name: "Reset all edit work",
      })
    ).toHaveTextContent("Reset All");
  });
});

describe("ExpertEditMoveControlsContent", () => {
  it("does not render inline move controls under the stage", () => {
    render(
      <ExpertEditMoveControlsContent
        scope="inline"
        isMoveToolSelected
        moveStageZoomSliderValue={1}
        canUndoGeneralAction
        canRedoGeneralAction
        setSelectedRailTool={vi.fn()}
        handleRecenterMoveAction={vi.fn()}
        handleMoveZoomSliderChange={vi.fn()}
        handleUndoGeneralAction={vi.fn()}
        handleRedoGeneralAction={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: /^adjust$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /center move action/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: /zoom stage/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /undo move action/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /redo move action/i })).not.toBeInTheDocument();
  });
});

describe("ExpertEditInlineHistoryControls", () => {
  it("renders undo and redo buttons for the stage header", () => {
    render(
      <ExpertEditInlineHistoryControls
        canUndoGeneralAction
        canRedoGeneralAction
        canFlipSelectedLayer
        handleUndoGeneralAction={vi.fn()}
        handleRedoGeneralAction={vi.fn()}
        handleFlipLayerHorizontalAction={vi.fn()}
        handleFlipLayerVerticalAction={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /flip layer horizontally/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /flip layer vertically/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /undo move action/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /redo move action/i })).toBeInTheDocument();
  });

  it("disables flip buttons without a selected image layer", () => {
    render(
      <ExpertEditInlineHistoryControls
        canUndoGeneralAction={false}
        canRedoGeneralAction={false}
        canFlipSelectedLayer={false}
        handleUndoGeneralAction={vi.fn()}
        handleRedoGeneralAction={vi.fn()}
        handleFlipLayerHorizontalAction={vi.fn()}
        handleFlipLayerVerticalAction={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /flip layer horizontally/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /flip layer vertically/i })).toBeDisabled();
  });

  it("routes flip button clicks to the provided layer actions", () => {
    const handleFlipLayerHorizontalAction = vi.fn();
    const handleFlipLayerVerticalAction = vi.fn();

    render(
      <ExpertEditInlineHistoryControls
        canUndoGeneralAction={false}
        canRedoGeneralAction={false}
        canFlipSelectedLayer
        handleUndoGeneralAction={vi.fn()}
        handleRedoGeneralAction={vi.fn()}
        handleFlipLayerHorizontalAction={handleFlipLayerHorizontalAction}
        handleFlipLayerVerticalAction={handleFlipLayerVerticalAction}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /flip layer horizontally/i }));
    fireEvent.click(screen.getByRole("button", { name: /flip layer vertically/i }));

    expect(handleFlipLayerHorizontalAction).toHaveBeenCalledTimes(1);
    expect(handleFlipLayerVerticalAction).toHaveBeenCalledTimes(1);
  });
});
