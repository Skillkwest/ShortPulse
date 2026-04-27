import React from "react";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiStudioPropertiesRail } from "../AiStudioPropertiesRail";

describe("AiStudioPropertiesRail", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("does not render when no active or exiting panel exists", () => {
    const { container } = render(
      <AiStudioPropertiesRail
        selectedTool={null}
        leftColumnRef={{ current: null }}
        panelKey={null}
        panelContent={null}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("keeps the rail mounted briefly while closing so the panel can animate out", () => {
    const { container, rerender } = render(
      <AiStudioPropertiesRail
        selectedTool="create"
        leftColumnRef={{ current: null }}
        panelKey="create"
        panelContent={<div>create panel</div>}
      />
    );

    rerender(
      <AiStudioPropertiesRail
        selectedTool={null}
        leftColumnRef={{ current: null }}
        panelKey={null}
        panelContent={null}
      />
    );

    expect(container.querySelector(".ai-properties")).toBeTruthy();
    expect(container.querySelector(".ai-properties-panel-transition-exit")).toBeTruthy();
    expect(screen.getByText("create panel")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(180);
    });

    expect(container.firstChild).toBeNull();
  });

  it("renders current content and an exiting overlay while swapping panels", () => {
    const { container, rerender } = render(
      <AiStudioPropertiesRail
        selectedTool="create"
        leftColumnRef={{ current: null }}
        panelKey="create"
        panelContent={<div>create panel</div>}
      />
    );

    rerender(
      <AiStudioPropertiesRail
        selectedTool="edit"
        leftColumnRef={{ current: null }}
        panelKey="edit"
        panelContent={<div>edit panel</div>}
      />
    );

    expect(screen.getByText("edit panel")).toBeInTheDocument();
    expect(container.querySelector(".ai-properties-panel-transition-exit")).toBeTruthy();
    expect(screen.getByText("create panel")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(180);
    });

    expect(container.querySelector(".ai-properties-panel-transition-exit")).toBeNull();
    expect(screen.queryByText("create panel")).not.toBeInTheDocument();
  });

  it("blurs focused controls from the previous panel while swapping", () => {
    const { rerender } = render(
      <AiStudioPropertiesRail
        selectedTool="create"
        leftColumnRef={{ current: null }}
        panelKey="create"
        panelContent={<button type="button">create action</button>}
      />
    );

    const focusedButton = screen.getByRole("button", { name: "create action" });
    focusedButton.focus();
    expect(document.activeElement).toBe(focusedButton);

    rerender(
      <AiStudioPropertiesRail
        selectedTool="edit"
        leftColumnRef={{ current: null }}
        panelKey="edit"
        panelContent={<div>edit panel</div>}
      />
    );

    expect(document.activeElement).not.toBe(focusedButton);
  });
});
