import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CharacterPanel } from "../CharacterPanel";

const splitHostSpy = vi.fn();

vi.mock("../../../character-manager/components/CharacterPanelSplitHost", () => ({
  CharacterPanelSplitHost: (props: Record<string, unknown>) => {
    splitHostSpy(props);
    return <div data-testid="character-panel-split-host" />;
  },
}));

vi.mock("../../hooks/useCharacterPanelPropertiesScrollLock", () => ({
  useCharacterPanelPropertiesScrollLock: () => undefined,
}));

describe("CharacterPanel", () => {
  it("forwards project-aware media-library props into the split host", () => {
    const resolveMediaLibraryInternalDropItem = vi.fn();
    const resolveCharacterDropReference = vi.fn();

    render(
      <CharacterPanel
        projectId="project-123"
        resolveCharacterDropReference={resolveCharacterDropReference}
        resolveMediaLibraryInternalDropItem={resolveMediaLibraryInternalDropItem}
      />
    );

    expect(splitHostSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project-123",
        resolveCharacterDropReference,
        resolveMediaLibraryInternalDropItem,
      })
    );
  });
});
