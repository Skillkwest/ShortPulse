/**
 * AiStudioToolbar primary-tool tests.
 * Verifies Character remains visible as a primary action and routes selection callbacks.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AiStudioToolbar } from "../AiStudioToolbar";

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: { alt?: string } & Record<string, unknown>) => {
    const imgProps = { ...props };
    delete imgProps.priority;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img {...imgProps} alt={alt} />
    );
  },
}));

vi.mock("../../../../components/DashboardNavPrefab", () => ({
  DashboardNavPrefab: () => <div data-testid="dashboard-nav-prefab" />,
}));

describe("AiStudioToolbar", () => {
  it.each([
    { button: "Create", expected: "create" as const },
    { button: "Edit", expected: "edit" as const },
    { button: "Video", expected: "video" as const },
    { button: "Character", expected: "character" as const },
  ])("routes $button clicks to $expected", ({ button, expected }) => {
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

    fireEvent.click(screen.getByRole("button", { name: button }));

    expect(onToggleCreateTools).toHaveBeenCalledWith(false);
    expect(onSelectTool).toHaveBeenCalledWith(expected);
  });

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

  it("routes Character clicks to canonical character selection and closes create tools", () => {
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
    expect(onSelectTool).toHaveBeenCalledWith("character");
  });

  it("toggles Character off when it is already active", () => {
    const onSelectTool = vi.fn();
    const onToggleCreateTools = vi.fn();

    render(
      <AiStudioToolbar
        selectedTool="character"
        showCreateTools={false}
        beginnerMode={false}
        onSelectTool={onSelectTool}
        onToggleCreateTools={onToggleCreateTools}
        onToggleBeginnerMode={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Character" }));

    expect(onToggleCreateTools).toHaveBeenCalledWith(false);
    expect(onSelectTool).toHaveBeenCalledWith(null);
  });

  it.each([
    { selectedTool: "create" as const, button: "Create" },
    { selectedTool: "text" as const, button: "Create" },
    { selectedTool: "edit" as const, button: "Edit" },
    { selectedTool: "image" as const, button: "Edit" },
    { selectedTool: "video" as const, button: "Video" },
    { selectedTool: "kling" as const, button: "Video" },
    { selectedTool: "character" as const, button: "Character" },
    { selectedTool: "canvas" as const, button: "Character" },
  ])("toggles $button off when selectedTool is $selectedTool", ({ selectedTool, button }) => {
    const onSelectTool = vi.fn();
    const onToggleCreateTools = vi.fn();

    render(
      <AiStudioToolbar
        selectedTool={selectedTool}
        showCreateTools={false}
        beginnerMode={false}
        onSelectTool={onSelectTool}
        onToggleCreateTools={onToggleCreateTools}
        onToggleBeginnerMode={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: button }));

    expect(onToggleCreateTools).toHaveBeenCalledWith(false);
    expect(onSelectTool).toHaveBeenCalledWith(null);
  });
});
