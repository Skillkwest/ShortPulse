import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CharacterPanelSplitHost } from "../CharacterPanelSplitHost";

const embeddedMediaPanelSpy = vi.fn();
const workspaceSpy = vi.fn();
const splitHookSpy = vi.fn();

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

vi.mock("../../../ai-studio/hooks/useReferenceGridHorizontalSplit", () => ({
  useReferenceGridHorizontalSplit: (args: Record<string, unknown>) => {
    splitHookSpy(args);
    return {
      topSectionStyle: { flexBasis: "47%" },
      bottomSectionStyle: { flexBasis: "53%" },
      dividerProps: {
        role: "separator",
        "aria-orientation": "horizontal",
        "aria-label": "Resize character workspace and media library sections",
        tabIndex: 0,
      },
    };
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
    expect(
      screen.getByRole("separator", {
        name: "Resize character workspace and media library sections",
      })
    ).toBeInTheDocument();
    expect(container.querySelector(".character-panel-top-section")).not.toBeNull();
    expect(container.querySelector(".character-panel-bottom-section")).not.toBeNull();
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
    const splitHookArgs = splitHookSpy.mock.calls[0]?.[0];
    expect(splitHookArgs).toEqual(
      expect.objectContaining({
        defaultTopRatio: 0.36,
        minTopSectionHeightPx: 336,
        minBottomSectionHeightPx: 248,
        maxBottomSectionHeightPx: 489,
      })
    );
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
