import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CharacterEmbeddedMediaLibraryPanel } from "../CharacterEmbeddedMediaLibraryPanel";

const embeddedMediaLibraryPanelSpy = vi.fn();

vi.mock("../../../ai-studio/components/EmbeddedMediaLibraryPanel", () => ({
  EmbeddedMediaLibraryPanel: (props: Record<string, unknown>) => {
    embeddedMediaLibraryPanelSpy(props);
    return <div data-testid="character-embedded-media-library-panel" />;
  },
}));

describe("CharacterEmbeddedMediaLibraryPanel", () => {
  it("routes the character shell through the canonical embedded media panel with character identity", () => {
    const resolveInternalDropItem = vi.fn();

    render(
      <CharacterEmbeddedMediaLibraryPanel
        projectId="project-123"
        mediaCardInteractionMode="assignment"
        fixedVisualAspectRatio={null}
        resolveInternalDropItem={resolveInternalDropItem}
      />
    );

    expect(embeddedMediaLibraryPanelSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        surface: "character-media-panel",
        ariaLabel: "Character media library panel",
        errorTelemetrySource: "client.character_manager.media_library_error",
        deleteConfirmActivityId: "character-media-library-delete-confirm",
        unresolvedWarningPrefix: "[character-media-library]",
        panelClassName: "character-embedded-media-library-panel",
        contentClassName: "character-embedded-media-library-content",
        projectId: "project-123",
        mediaCardInteractionMode: "assignment",
        fixedVisualAspectRatio: null,
        resolveInternalDropItem,
      })
    );
  });
});
