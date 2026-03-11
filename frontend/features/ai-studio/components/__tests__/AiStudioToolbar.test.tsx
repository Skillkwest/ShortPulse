/**
 * AiStudioToolbar primary-tool tests.
 * Verifies primary/shortcut actions render and route toolbar selection callbacks.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
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
  it("hides beginner toggle controls when `showBeginnerModeToggle` is false", () => {
    render(
      <AiStudioToolbar
        selectedTool={null}
        showCreateTools={false}
        beginnerMode={false}
        showBeginnerModeToggle={false}
        onSelectTool={vi.fn()}
        onToggleCreateTools={vi.fn()}
        onToggleBeginnerMode={vi.fn()}
      />
    );

    expect(
      screen.queryByRole("button", {
        name: /Disable beginner mode|Enable beginner mode/i,
      })
    ).not.toBeInTheDocument();
  });

  it("renders a functional beginner toggle when `showBeginnerModeToggle` is true", () => {
    const onToggleBeginnerMode = vi.fn();
    render(
      <AiStudioToolbar
        selectedTool={null}
        showCreateTools={false}
        beginnerMode={true}
        showBeginnerModeToggle={true}
        onSelectTool={vi.fn()}
        onToggleCreateTools={vi.fn()}
        onToggleBeginnerMode={onToggleBeginnerMode}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Disable beginner mode/i }));
    expect(onToggleBeginnerMode).toHaveBeenCalledWith(false);
  });

  it.each([
    { button: "Create", expected: "create" as const },
    { button: "Edit", expected: "edit" as const },
    { button: "Video", expected: "video" as const },
    { button: "Sound", expected: "sound" as const },
    { button: "Canvas", expected: "canvas" as const },
    { button: "Characters", expected: "character" as const },
    { button: "Presets", expected: "presets" as const },
    { button: "Styles", expected: "styles" as const },
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

  it("shows Media as the first Libraries button with secondary styling", () => {
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

    const librariesSection = screen.getByText("Libraries").closest(".toolbar-lower");
    expect(librariesSection).not.toBeNull();
    const libraryButtons = within(librariesSection as HTMLElement).getAllByRole("button");
    expect(libraryButtons.map((button) => button.textContent?.trim())).toEqual([
      "Media",
      "Characters",
      "Presets",
      "Styles",
    ]);
    expect(
      within(librariesSection as HTMLElement).getByRole("button", { name: "Media" })
    ).toHaveClass("toolbar-item-secondary");
  });

  it("renders Templates in the Shortcuts section", () => {
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

    const shortcutsSection = screen.getByText("Shortcuts").closest(".toolbar-lower");
    expect(shortcutsSection).not.toBeNull();
    const shortcutButtons = within(shortcutsSection as HTMLElement).getAllByRole("button");
    expect(shortcutButtons.map((button) => button.textContent?.trim())).toEqual(["Templates"]);
  });

  it("routes Media to tool selection and closes create tools", () => {
    const onSelectTool = vi.fn();
    const onToggleCreateTools = vi.fn();

    render(
      <AiStudioToolbar
        selectedTool={null}
        showCreateTools={false}
        beginnerMode={false}
        onSelectTool={onSelectTool}
        onToggleCreateTools={onToggleCreateTools}
        onToggleBeginnerMode={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Media" }));

    expect(onToggleCreateTools).toHaveBeenCalledWith(false);
    expect(onSelectTool).toHaveBeenCalledWith("media-library");
  });

  it("routes Characters clicks to canonical character selection and closes create tools", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Characters" }));

    expect(onToggleCreateTools).toHaveBeenCalledWith(false);
    expect(onSelectTool).toHaveBeenCalledWith("character");
  });

  it("toggles Characters off when it is already active", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Characters" }));

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
    { selectedTool: "sound" as const, button: "Sound" },
    { selectedTool: "character" as const, button: "Characters" },
    { selectedTool: "canvas" as const, button: "Canvas" },
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
