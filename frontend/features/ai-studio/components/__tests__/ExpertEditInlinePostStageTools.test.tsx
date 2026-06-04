import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ExpertEditInlinePostStageTools } from "../edit/ExpertEditInlinePostStageTools";

function renderInlinePostStageTools(selectedRailTool: "inpaint" | "markup" | "move") {
  const renderInpaintControlsContent = vi.fn(() => <div>Inpaint controls</div>);
  const renderMarkupControlsContent = vi.fn(() => <div>Markup controls</div>);
  const renderMoveControlsContent = vi.fn(() => <div>Move controls</div>);

  render(
    <ExpertEditInlinePostStageTools
      isInpaintCollapsed={false}
      isInpaintCollapsing={false}
      collapsedToolsThemeClass="is-active-inpaint"
      selectedRailTool={selectedRailTool}
      isInpaintToolSelected={selectedRailTool === "inpaint"}
      isMarkupToolSelected={selectedRailTool === "markup"}
      isMoveToolSelected={selectedRailTool === "move"}
      isInpaintLikeToolSelected={selectedRailTool !== "move"}
      isAdvancedEditModesEnabled={true}
      setSelectedRailTool={vi.fn()}
      handleInpaintCollapseToggle={vi.fn()}
      renderInpaintControlsContent={renderInpaintControlsContent}
      renderMarkupControlsContent={renderMarkupControlsContent}
      renderMoveControlsContent={renderMoveControlsContent}
    />
  );

  return {
    renderInpaintControlsContent,
    renderMarkupControlsContent,
    renderMoveControlsContent,
  };
}

describe("ExpertEditInlinePostStageTools", () => {
  it("renders shared inpaint controls when the in-paint rail tool is selected", () => {
    const { renderInpaintControlsContent, renderMarkupControlsContent, renderMoveControlsContent } =
      renderInlinePostStageTools("inpaint");

    expect(screen.getByText("Inpaint controls")).toBeInTheDocument();
    expect(renderInpaintControlsContent).toHaveBeenCalledWith("inline");
    expect(renderMarkupControlsContent).not.toHaveBeenCalled();
    expect(renderMoveControlsContent).not.toHaveBeenCalled();
  });

  it("renders shared markup controls when the markup rail tool is selected", () => {
    const { renderInpaintControlsContent, renderMarkupControlsContent, renderMoveControlsContent } =
      renderInlinePostStageTools("markup");

    expect(screen.getByText("Markup controls")).toBeInTheDocument();
    expect(renderMarkupControlsContent).toHaveBeenCalledWith("inline");
    expect(renderInpaintControlsContent).not.toHaveBeenCalled();
    expect(renderMoveControlsContent).not.toHaveBeenCalled();
  });

  it("marks the move rail tool selected without rendering inline controls", () => {
    const { renderInpaintControlsContent, renderMarkupControlsContent, renderMoveControlsContent } =
      renderInlinePostStageTools("move");

    expect(screen.getByRole("button", { name: "Move" })).toHaveAttribute("aria-pressed", "true");
    expect(renderMoveControlsContent).not.toHaveBeenCalled();
    expect(renderInpaintControlsContent).not.toHaveBeenCalled();
    expect(renderMarkupControlsContent).not.toHaveBeenCalled();
  });
});
