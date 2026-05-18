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

vi.mock("../../../ai-studio/hooks/useReferenceGridHorizontalSplit", () => ({
  useReferenceGridHorizontalSplit: () => ({
    topSectionStyle: { flexBasis: "54%" },
    bottomSectionStyle: { flexBasis: "46%" },
    isAllRefsExpanded: false,
    dividerProps: {
      role: "separator",
      "aria-orientation": "horizontal",
      "aria-label": "Resize character workspace and media library sections",
      tabIndex: 0,
    },
  }),
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
        mediaCardInteractionMode: "assignment",
        projectId: "project-123",
        resolveInternalDropItem: resolveMediaLibraryInternalDropItem,
      })
    );
    expect(workspaceSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        isEmbeddedMediaLibraryMaximized: false,
      })
    );
  });
});
