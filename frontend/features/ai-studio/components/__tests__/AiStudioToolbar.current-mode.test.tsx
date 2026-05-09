import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AiStudioToolbar } from "../AiStudioToolbar";

vi.mock("next/image", () => ({
  default: ({ priority: _priority, ...props }: Record<string, unknown>) => (
    <div data-testid="mock-next-image" {...props} />
  ),
}));

vi.mock("../../../../components/DashboardNavPrefab", () => ({
  DashboardNavPrefab: () => <span>Dashboard</span>,
}));

describe("AiStudioToolbar current mode", () => {
  it("does not render retired mode-toggle chrome", () => {
    const { container } = render(
      <AiStudioToolbar
        selectedTool="create"
        showCreateTools={true}
        onOpenProjects={vi.fn()}
        onSelectTool={vi.fn()}
        onToggleCreateTools={vi.fn()}
      />
    );

    expect(container.querySelector(".toolbar-footer--toggle-hidden")).not.toBeNull();
  });

  it("routes the primary Create action directly to the create workflow", () => {
    const onSelectTool = vi.fn();
    const onToggleCreateTools = vi.fn();

    render(
      <AiStudioToolbar
        selectedTool={null}
        showCreateTools={false}
        onOpenProjects={vi.fn()}
        onSelectTool={onSelectTool}
        onToggleCreateTools={onToggleCreateTools}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(onToggleCreateTools).toHaveBeenCalledWith(false);
    expect(onSelectTool).toHaveBeenCalledWith("create");
  });
});
