import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CharacterPanelSplitHost } from "../CharacterPanelSplitHost";

const embeddedMediaPanelSpy = vi.fn();
const workspaceSpy = vi.fn();

vi.mock("../../../ai-studio/components/ElementsEmbeddedMediaLibraryPanel", () => ({
  ElementsEmbeddedMediaLibraryPanel: (props: Record<string, unknown>) => {
    embeddedMediaPanelSpy(props);
    return <div data-testid="character-bottom-media-library" />;
  },
}));

vi.mock("../CharacterPanelWorkspace", () => ({
  CharacterPanelWorkspace: (props: Record<string, unknown>) => {
    workspaceSpy(props);
    return <div data-testid="character-top-workspace" />;
  },
}));

describe("CharacterPanelSplitHost", () => {
  it("renders the Character workspace above the embedded media library", () => {
    const resolveMediaLibraryInternalDropItem = vi.fn();

    const { container } = render(
      <CharacterPanelSplitHost
        projectId="project-123"
        resolveMediaLibraryInternalDropItem={resolveMediaLibraryInternalDropItem}
      />
    );

    expect(screen.getByTestId("character-top-workspace")).toBeInTheDocument();
    expect(screen.getByTestId("character-bottom-media-library")).toBeInTheDocument();
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(container.querySelector(".character-panel-top-section")).not.toBeNull();
    const bottomSection = container.querySelector(
      ".character-panel-bottom-section"
    ) as HTMLDivElement | null;
    expect(bottomSection).not.toBeNull();
    expect(bottomSection).toHaveStyle({
      flexGrow: "0",
      flexShrink: "0",
      flexBasis: "544px",
      height: "544px",
      minHeight: "544px",
      maxHeight: "544px",
      overflow: "hidden",
    });
    const splitHost = container.querySelector(
      ".character-panel-split-host"
    ) as HTMLDivElement | null;
    expect(splitHost).not.toBeNull();
    const topSection = container.querySelector(
      ".character-panel-top-section"
    ) as HTMLDivElement | null;
    expect(topSection).not.toBeNull();
    expect(topSection).toHaveStyle({
      flex: "1 1 auto",
      minHeight: "336px",
    });
    expect(embeddedMediaPanelSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        fixedVisualAspectRatio: null,
        mediaCardInteractionMode: "assignment",
        projectId: "project-123",
        resolveInternalDropItem: resolveMediaLibraryInternalDropItem,
      })
    );
    const workspaceProps = workspaceSpy.mock.calls.at(-1)?.[0];
    expect(workspaceProps).toEqual(expect.any(Object));
    expect(workspaceProps).not.toHaveProperty("isEmbeddedMediaLibraryMaximized");
  });

  it("keeps the embedded media library in assignment mode without click-selection wiring", () => {
    render(<CharacterPanelSplitHost projectId="project-123" />);

    const embeddedPanelProps = embeddedMediaPanelSpy.mock.calls.at(-1)?.[0];
    expect(embeddedPanelProps).toEqual(
      expect.objectContaining({
        mediaCardInteractionMode: "assignment",
        fixedVisualAspectRatio: null,
        projectId: "project-123",
      })
    );
    expect(embeddedPanelProps?.onSelectMedia).toBeUndefined();
  });
});
