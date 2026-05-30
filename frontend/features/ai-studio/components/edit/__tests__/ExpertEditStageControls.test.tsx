import { render, screen } from "@testing-library/react";
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
        handleUndoGeneralAction={vi.fn()}
        handleRedoGeneralAction={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /undo move action/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /redo move action/i })).toBeInTheDocument();
  });
});
