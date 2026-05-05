import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { MediaLibraryPanelRootContent } from "../MediaLibraryPanelRootContent";

const renderRootContent = (
  overrides: Partial<ComponentProps<typeof MediaLibraryPanelRootContent>> = {}
) => {
  const setRootTab = vi.fn();
  const props: ComponentProps<typeof MediaLibraryPanelRootContent> = {
    rootTab: "all",
    setRootTab,
    libraryTotalCount: 0,
    showExpandCollapseButton: false,
    onOpenRootUploadPicker: vi.fn(),
    bulkActions: null,
    selectedVisibleMediaCount: 0,
    itemType: "all",
    isRootFolderDropHover: false,
    rootFolderDropZoneProps: null,
    mediaLoading: false,
    mediaRowsLength: 0,
    promptLoading: false,
    visiblePromptRowsLength: 0,
    visibleImageRowsLength: 0,
    visibleVideoRowsLength: 0,
    visibleAudioRowsLength: 0,
    renderAllItemsGrid: vi.fn(() => null),
    renderImageGrid: vi.fn(() => null),
    renderVideoGrid: vi.fn(() => null),
    renderAudioGrid: vi.fn(() => <div>Audio grid</div>),
    renderPromptsSection: vi.fn(() => null),
    mediaHasMore: false,
    loadMediaPage: vi.fn(async () => undefined),
    ...overrides,
  };
  render(<MediaLibraryPanelRootContent {...props} />);
  return { props, setRootTab };
};

describe("MediaLibraryPanelRootContent", () => {
  it("renders the Audio tab and switches to it", () => {
    const { setRootTab } = renderRootContent();

    fireEvent.click(screen.getByRole("tab", { name: "Audio" }));

    expect(setRootTab).toHaveBeenCalledWith("audio");
  });

  it("renders the audio grid for the Audio tab", () => {
    const renderAudioGrid = vi.fn(() => <div>Audio grid</div>);

    renderRootContent({
      rootTab: "audio",
      itemType: "audio",
      visibleAudioRowsLength: 1,
      mediaRowsLength: 1,
      renderAudioGrid,
    });

    expect(screen.getByText("Audio grid")).toBeInTheDocument();
    expect(renderAudioGrid).toHaveBeenCalledTimes(1);
  });
});
