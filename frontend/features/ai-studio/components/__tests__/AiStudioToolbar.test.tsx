/**
 * AiStudioToolbar primary-tool tests.
 * Verifies Character remains visible as a primary action and routes selection callbacks.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AiStudioToolbar } from "../AiStudioToolbar";

vi.mock("next/image", () => ({
  default: (props: { alt?: string } & Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt} />
  ),
}));

vi.mock("../../../../components/DashboardNavPrefab", () => ({
  DashboardNavPrefab: () => <div data-testid="dashboard-nav-prefab" />,
}));

describe("AiStudioToolbar", () => {
  it("shows Character as a primary toolbar button", () => {
    render(
      <AiStudioToolbar
        selectedTool={null}
        showCreateTools={false}
        beginnerMode={false}
        onSelectTool={vi.fn()}
        onToggleCreateTools={vi.fn()}
        onToggleBeginnerMode={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Character" })).toBeInTheDocument();
  });

  it("routes Character clicks to canvas selection and closes create tools", () => {
    const onSelectTool = vi.fn();
    const onToggleCreateTools = vi.fn();

    render(
      <AiStudioToolbar
        selectedTool={null}
        showCreateTools={true}
        beginnerMode={false}
        onSelectTool={onSelectTool}
        onToggleCreateTools={onToggleCreateTools}
        onToggleBeginnerMode={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Character" }));

    expect(onToggleCreateTools).toHaveBeenCalledWith(false);
    expect(onSelectTool).toHaveBeenCalledWith("canvas");
  });
});
