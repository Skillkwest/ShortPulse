import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AiStudioPropertiesRail } from "../AiStudioPropertiesRail";

describe("AiStudioPropertiesRail", () => {
  it("does not render when no active panel exists", () => {
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

  it("unmounts immediately when closing the active panel", () => {
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

    expect(container.firstChild).toBeNull();
  });

  it("swaps panels immediately without rendering transition content", () => {
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

    expect(screen.queryByText("create panel")).not.toBeInTheDocument();
    expect(screen.getByText("edit panel")).toBeInTheDocument();
    expect(container.querySelector(".ai-properties--panel-enter")).not.toBeNull();
    expect(container.querySelector(".ai-properties-panel-transition-exit")).toBeNull();
  });
});
