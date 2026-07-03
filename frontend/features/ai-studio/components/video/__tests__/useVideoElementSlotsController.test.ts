/**
 * Regression coverage for Video linked-asset slot normalization and Seedance limit enforcement.
 */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadSavedKlingEntityBySource } from "../../../logic/klingEntityAdapters";
import {
  createSeedanceImageReferenceSlot,
  type AiStudioKlingElement,
} from "../../../logic/klingElements";
import { useVideoElementSlotsController } from "../useVideoElementSlotsController";

vi.mock("../../../logic/klingEntityAdapters", () => ({
  loadSavedKlingEntityBySource: vi.fn(),
}));

const createSavedElement = (
  overrides: Partial<AiStudioKlingElement> = {}
): AiStudioKlingElement => ({
  id: "saved-element",
  slotIndex: 0,
  sourceKind: "element",
  sourceElementId: "element-red-lantern",
  sourceCharacterId: null,
  sourceCharacterLookId: null,
  sourceCharacterLookLabel: null,
  name: "Red Lantern",
  alias: "redlantern",
  description: "Warm lacquered lantern",
  profileImageUrl: "https://example.com/red-lantern-profile.jpg",
  profileImageTransform: null,
  frontalImageUrl: "https://example.com/red-lantern-front.jpg",
  referenceImageUrls: "https://example.com/red-lantern-side.jpg",
  videoUrl: "",
  audioUrl: "",
  ...overrides,
});

describe("useVideoElementSlotsController", () => {
  beforeEach(() => {
    vi.mocked(loadSavedKlingEntityBySource).mockReset();
  });

  it("preserves hidden Seedance-only slots when editing a visible Kling slot", async () => {
    const seedanceOnlySlot = createSeedanceImageReferenceSlot({
      slotIndex: 4,
      imageUrl: "https://example.com/seedance-only.png",
      name: "Seedance-only reference",
    });
    const selectedSavedElement = createSavedElement({ slotIndex: undefined });
    const onKlingElementsChange = vi.fn();
    vi.mocked(loadSavedKlingEntityBySource).mockResolvedValue(selectedSavedElement);

    const { result } = renderHook(() =>
      useVideoElementSlotsController({
        isSeedance2FamilyModelSelected: false,
        klingElements: [seedanceOnlySlot],
        onKlingElementsChange,
      })
    );

    act(() => {
      result.current.openElementPicker(0);
    });
    await act(async () => {
      await result.current.handleElementSelection({
        sourceKind: "element",
        sourceId: "element-red-lantern",
      });
    });

    expect(onKlingElementsChange).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "saved-element",
        slotIndex: 0,
        sourceElementId: "element-red-lantern",
      }),
      expect.objectContaining({
        id: seedanceOnlySlot.id,
        slotIndex: 4,
        sourceKind: "reference-image",
      }),
    ]);
  });

  it("blocks Seedance media slot edits that exceed the provider image reference limit", () => {
    const onKlingElementsChange = vi.fn();
    const existingSlots: AiStudioKlingElement[] = [
      createSavedElement({
        id: "two-image-linked-subject",
        slotIndex: 0,
        frontalImageUrl: "https://example.com/linked-front.png",
        referenceImageUrls: "https://example.com/linked-side.png",
      }),
      ...Array.from({ length: 8 }, (_, index) =>
        createSeedanceImageReferenceSlot({
          slotIndex: index + 1,
          imageUrl: `https://example.com/direct-${index + 1}.png`,
        })
      ),
    ];

    const { result } = renderHook(() =>
      useVideoElementSlotsController({
        isSeedance2FamilyModelSelected: true,
        klingElements: existingSlots,
        onKlingElementsChange,
      })
    );

    act(() => {
      result.current.handleSeedanceElementMediaSlotChange(8, {
        kind: "image",
        url: "https://example.com/replacement.png",
      });
    });

    expect(result.current.seedanceSlotLimitWarning).toBe(
      "Seedance 2 supports up to 9 image references."
    );
    expect(onKlingElementsChange).not.toHaveBeenCalled();
  });
});
