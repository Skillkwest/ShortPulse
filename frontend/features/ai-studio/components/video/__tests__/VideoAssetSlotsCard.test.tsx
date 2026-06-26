import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createInternalMediaRef } from "../../../../../lib/media/internalMediaRefs";
import { getSignedMediaUrlsBatch } from "../../../../../lib/mediaSignedUrlCache";
import { registerInternalMediaRefForUrl } from "../../../logic/referenceInputInternalMediaRegistry";
import { VideoAssetSlotsCard } from "../VideoAssetSlotsCard";

vi.mock("../../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrlsBatch: vi.fn(),
}));

const baseProps: React.ComponentProps<typeof VideoAssetSlotsCard> = {
  isSeedance2FamilyModelSelected: true,
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
  removeSelectedElement: vi.fn(),
  elementPickerError: null,
};

describe("VideoAssetSlotsCard", () => {
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
});
