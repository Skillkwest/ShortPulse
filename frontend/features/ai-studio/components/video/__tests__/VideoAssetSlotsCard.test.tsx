import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInternalMediaRef } from "../../../../../lib/media/internalMediaRefs";
import { getSignedMediaUrlsBatch } from "../../../../../lib/mediaSignedUrlCache";
import { registerInternalMediaRefForUrl } from "../../../logic/referenceInputInternalMediaRegistry";
import { VideoAssetSlotsCard } from "../VideoAssetSlotsCard";

vi.mock("../../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrlsBatch: vi.fn(),
}));

const baseProps: React.ComponentProps<typeof VideoAssetSlotsCard> = {
  isSeedance2FamilyModelSelected: true,
  isMotionMode: false,
  shouldShowShotModeSelector: true,
  visibleShotMode: "single",
  shotModeTabCount: 2,
  handleSetKlingWorkflowMode: vi.fn(),
  seedanceReferenceMode: "elements",
  handleSetSeedanceReferenceMode: vi.fn(),
  referenceMediaStep: null,
  renderPromptTokenPicker: () => null,
  activePromptTarget: "",
  seedanceSlotLimitWarning: null,
  klingElementSlotCount: 3,
  modelVisibleKlingElements: [null, null, null],
  klingElementCanonicalPromptTokens: [],
  seedanceElementImageDragActive: [],
  seedanceElementImageLoading: [],
  seedanceElementImageInputRefs: [],
  seedanceElementSlotRefs: { current: {} },
  handleSeedanceElementMediaDragEnter: () => vi.fn(),
  handleSeedanceElementMediaDragOver: () => vi.fn(),
  handleSeedanceElementMediaDragLeave: () => vi.fn(),
  handleSeedanceElementMediaDrop: () => vi.fn(),
  handleSeedanceElementMediaFileSelection: () => vi.fn(),
  openElementPicker: vi.fn(),
  reorderSelectedElementSlot: vi.fn(),
  removeSelectedElement: vi.fn(),
  elementPickerError: null,
};

describe("VideoAssetSlotsCard", () => {
  beforeEach(() => {
    vi.mocked(getSignedMediaUrlsBatch).mockReset();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows the asset helper only while every visible asset slot is empty", () => {
    const seedanceHelperCopy =
      "Click an empty slot to add an element or drag a reference from the Reference Grid.";
    const klingHelperCopy = "Click an empty slot to add an element.";
    const filledElement = {
      id: "slot-1",
      slotIndex: 0,
      sourceKind: "element" as const,
      name: "Lantern",
      profileImageUrl: "https://example.com/lantern.png",
      profileImageTransform: null,
      frontalImageUrl: "https://example.com/lantern.png",
      referenceImageUrls: "",
      videoUrl: "",
    };

    const { rerender } = render(<VideoAssetSlotsCard {...baseProps} />);

    expect(screen.getByText(seedanceHelperCopy)).toBeInTheDocument();

    rerender(<VideoAssetSlotsCard {...baseProps} isSeedance2FamilyModelSelected={false} />);

    expect(screen.getByText(klingHelperCopy)).toBeInTheDocument();
    expect(screen.queryByText(seedanceHelperCopy)).not.toBeInTheDocument();

    rerender(
      <VideoAssetSlotsCard
        {...baseProps}
        isSeedance2FamilyModelSelected={true}
        isMotionMode={true}
      />
    );

    expect(screen.getByText(klingHelperCopy)).toBeInTheDocument();
    expect(screen.queryByText(seedanceHelperCopy)).not.toBeInTheDocument();

    rerender(
      <VideoAssetSlotsCard
        {...baseProps}
        isSeedance2FamilyModelSelected={false}
        modelVisibleKlingElements={[filledElement, null, null]}
      />
    );

    expect(screen.queryByText(klingHelperCopy)).not.toBeInTheDocument();

    rerender(<VideoAssetSlotsCard {...baseProps} modelVisibleKlingElements={[null, null, null]} />);

    expect(screen.getByText(seedanceHelperCopy)).toBeInTheDocument();
  });

  it("refreshes restored Seedance image slot previews from durable storage refs", async () => {
    const staleSignedUrl = "https://storage.example.com/stale-seedance-slot.png";
    const freshSignedUrl = "https://storage.example.com/fresh-seedance-slot.png";
    const storagePath = "user-1/reference-images/seedance-slot.png";
    registerInternalMediaRefForUrl(
      staleSignedUrl,
      createInternalMediaRef({
        storagePath,
      })
    );
    vi.mocked(getSignedMediaUrlsBatch).mockResolvedValue(new Map([[storagePath, freshSignedUrl]]));

    const { container } = render(
      <VideoAssetSlotsCard
        {...baseProps}
        modelVisibleKlingElements={[
          {
            id: "slot-1",
            slotIndex: 0,
            sourceKind: "reference-image",
            name: "Image reference",
            profileImageUrl: staleSignedUrl,
            profileImageTransform: null,
            frontalImageUrl: staleSignedUrl,
            referenceImageUrls: "",
            videoUrl: "",
          },
          null,
          null,
        ]}
      />
    );

    await waitFor(() => {
      expect(getSignedMediaUrlsBatch).toHaveBeenCalledWith({
        bucket: "media_library",
        storagePaths: [storagePath],
        previewProfile: "none",
        surface: "reference-grid",
      });
    });
    await waitFor(() => {
      expect(
        (container.querySelector(".video-elements-slot-avatar-image") as HTMLElement).style
          .backgroundImage
      ).toContain(freshSignedUrl);
    });
  });

  it("plays audio reference slots from the hover play control without opening the picker", () => {
    const openElementPicker = vi.fn();
    const playMock = vi
      .spyOn(window.HTMLMediaElement.prototype, "play")
      .mockImplementation(() => Promise.resolve());
    vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);

    render(
      <VideoAssetSlotsCard
        {...baseProps}
        openElementPicker={openElementPicker}
        modelVisibleKlingElements={[
          {
            id: "slot-audio",
            slotIndex: 0,
            sourceKind: "reference-audio",
            name: "Audio reference",
            profileImageUrl: null,
            profileImageTransform: null,
            frontalImageUrl: "",
            referenceImageUrls: "",
            videoUrl: "",
            audioUrl: "https://example.com/direct-audio.mp3",
          },
          null,
          null,
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Play audio reference Audio reference" }));

    expect(playMock).toHaveBeenCalledTimes(1);
    expect(openElementPicker).not.toHaveBeenCalled();
  });
});
