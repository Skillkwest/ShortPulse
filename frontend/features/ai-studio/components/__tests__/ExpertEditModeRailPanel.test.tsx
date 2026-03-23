import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExpertEditModeRailPanel } from "../edit/ExpertEditModeRailPanel";

describe("ExpertEditModeRailPanel", () => {
  it("renders the move panel and delegates move controls", () => {
    const renderMoveControlsContent = vi.fn(() => <div>Move controls</div>);
    const renderMarkupControlsContent = vi.fn(() => <div>Markup controls</div>);
    const renderMarkupModalInpaintPanel = vi.fn(() => <div>Inpaint controls</div>);

    render(
      <ExpertEditModeRailPanel
        selectedRailTool="move"
        renderMoveControlsContent={renderMoveControlsContent}
        renderMarkupControlsContent={renderMarkupControlsContent}
        renderMarkupModalInpaintPanel={renderMarkupModalInpaintPanel}
      />
    );

    expect(screen.getByRole("group", { name: "Left rail move panel" })).toBeInTheDocument();
    expect(screen.getByText("Move")).toBeInTheDocument();
    expect(screen.getByText("Move controls")).toBeInTheDocument();
    expect(renderMoveControlsContent).toHaveBeenCalledWith("modal");
    expect(renderMarkupControlsContent).not.toHaveBeenCalled();
    expect(renderMarkupModalInpaintPanel).not.toHaveBeenCalled();
  });

  it("renders the in-paint panel and delegates inpaint controls", () => {
    const renderMoveControlsContent = vi.fn(() => <div>Move controls</div>);
    const renderMarkupControlsContent = vi.fn(() => <div>Markup controls</div>);
    const renderMarkupModalInpaintPanel = vi.fn(() => <div>Inpaint controls</div>);

    render(
      <ExpertEditModeRailPanel
        selectedRailTool="inpaint"
        renderMoveControlsContent={renderMoveControlsContent}
        renderMarkupControlsContent={renderMarkupControlsContent}
        renderMarkupModalInpaintPanel={renderMarkupModalInpaintPanel}
      />
    );

    expect(screen.getByRole("group", { name: "Left rail in-paint panel" })).toBeInTheDocument();
    expect(screen.getByText("In-paint")).toBeInTheDocument();
    expect(screen.getByText("Inpaint controls")).toBeInTheDocument();
    expect(renderMarkupModalInpaintPanel).toHaveBeenCalledWith("rail");
    expect(renderMoveControlsContent).not.toHaveBeenCalled();
    expect(renderMarkupControlsContent).not.toHaveBeenCalled();
  });

  it("renders the markup panel and delegates markup controls", () => {
    const renderMoveControlsContent = vi.fn(() => <div>Move controls</div>);
    const renderMarkupControlsContent = vi.fn(() => <div>Markup controls</div>);
    const renderMarkupModalInpaintPanel = vi.fn(() => <div>Inpaint controls</div>);

    render(
      <ExpertEditModeRailPanel
        selectedRailTool="video"
        renderMoveControlsContent={renderMoveControlsContent}
        renderMarkupControlsContent={renderMarkupControlsContent}
        renderMarkupModalInpaintPanel={renderMarkupModalInpaintPanel}
      />
    );

    expect(screen.getByRole("group", { name: "Left rail markup panel" })).toBeInTheDocument();
    expect(screen.getByText("Markup")).toBeInTheDocument();
    expect(screen.getByText("Markup controls")).toBeInTheDocument();
    expect(renderMarkupControlsContent).toHaveBeenCalledWith("modal");
    expect(renderMoveControlsContent).not.toHaveBeenCalled();
    expect(renderMarkupModalInpaintPanel).not.toHaveBeenCalled();
  });
});
