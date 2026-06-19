import { describe, expect, it } from "vitest";
import {
  createSeedanceImageReferenceSlot,
  getKieKlingSubmittableSlotElements,
  resolveKieKlingElementProviderEligibility,
  resolveKieKlingElementsValidationMessage,
  resolveAiStudioKlingElementDisplayLabel,
  resolveAiStudioKlingElementLegacyTokens,
  resolveAiStudioKlingElementToken,
  resolveAiStudioKlingElementTokens,
  resolveKieKlingElementToken,
  resolveKieKlingElementTokens,
  resolveLegacyKieKlingElementToken,
  resolveSeedanceElementProviderEligibility,
  type AiStudioKlingElement,
} from "../klingElements";

const makeKlingElement = (overrides: Partial<AiStudioKlingElement>): AiStudioKlingElement => ({
  id: "element-1",
  slotIndex: 0,
  sourceKind: "element",
  sourceElementId: "element-1",
  sourceCharacterId: null,
  sourceCharacterLookId: null,
  sourceCharacterLookLabel: null,
  name: "Beach Ball",
  alias: "beachball",
  description: "",
  profileImageUrl: null,
  profileImageTransform: null,
  frontalImageUrl: "",
  referenceImageUrls: "",
  videoUrl: "",
  ...overrides,
});

describe("klingElements token resolution", () => {
  it("renames a colliding element token to name_element when a character shares the same alias", () => {
    const elements = [
      { sourceKind: "character" as const, name: "Taylor", alias: "taylor" },
      { sourceKind: "element" as const, name: "Taylor", alias: "taylor" },
    ];

    expect(resolveAiStudioKlingElementTokens(elements)).toEqual(["taylor", "taylor_element"]);
    expect(resolveAiStudioKlingElementToken(elements[0], 0, elements)).toBe("taylor");
    expect(resolveAiStudioKlingElementToken(elements[1], 1, elements)).toBe("taylor_element");
  });

  it("keeps non-colliding aliases unchanged", () => {
    const elements = [
      { sourceKind: "character" as const, name: "Taylor", alias: "taylor" },
      { sourceKind: "element" as const, name: "Lantern", alias: "lantern" },
    ];

    expect(resolveAiStudioKlingElementTokens(elements)).toEqual(["taylor", "lantern"]);
  });

  it("uses the element name as the canonical workflow token even when a legacy alias differs", () => {
    const elements = [{ sourceKind: "element" as const, name: "Red Lantern", alias: "legacylamp" }];

    expect(resolveAiStudioKlingElementTokens(elements)).toEqual(["redlantern"]);
    expect(resolveAiStudioKlingElementToken(elements[0], 0, elements)).toBe("redlantern");
  });

  it("resolves canonical provider tokens from stable slot positions", () => {
    const elements = [
      { slotIndex: 0, sourceKind: "character" as const, name: "Taylor", alias: "taylor" },
      { slotIndex: 2, sourceKind: "element" as const, name: "Taylor", alias: "taylor" },
    ];

    expect(resolveKieKlingElementTokens(elements)).toEqual(["element1", "element3"]);
    expect(resolveKieKlingElementToken(elements[0], 0, elements)).toBe("element1");
    expect(resolveKieKlingElementToken(elements[1], 1, elements)).toBe("element3");
  });

  it("keeps the legacy provider token resolver available for prompt migration", () => {
    const elements = [
      { slotIndex: 0, sourceKind: "character" as const, name: "Taylor", alias: "taylor" },
      { slotIndex: 1, sourceKind: "element" as const, name: "Taylor", alias: "taylor" },
    ];

    expect(resolveLegacyKieKlingElementToken(elements[1], 1, elements)).toBe(
      "element_taylor_element"
    );
  });

  it("collects deduped legacy compatibility tokens for restored prompt matching", () => {
    const elements = [
      { slotIndex: 0, sourceKind: "element" as const, name: "Red Lantern", alias: "legacylamp" },
    ];

    expect(resolveAiStudioKlingElementLegacyTokens(elements[0], 0, elements)).toEqual([
      "redlantern",
      "element_redlantern",
      "legacylamp",
    ]);
  });

  it("uses the current name as the display label before falling back to compatibility tokens", () => {
    const elements = [
      { slotIndex: 0, sourceKind: "element" as const, name: "Red Lantern", alias: "legacylamp" },
      { slotIndex: 1, sourceKind: "element" as const, name: "", alias: "legacylamp" },
    ];

    expect(resolveAiStudioKlingElementDisplayLabel(elements[0], 0, elements)).toBe("Red Lantern");
    expect(resolveAiStudioKlingElementDisplayLabel(elements[1], 1, elements)).toBe("legacylamp");
  });
});

describe("klingElements provider eligibility", () => {
  it("keeps direct Seedance image slots out of Kling while allowing them for Seedance", () => {
    const directImage = createSeedanceImageReferenceSlot({
      slotIndex: 0,
      imageUrl: "https://example.com/direct.png",
    });

    expect(resolveKieKlingElementProviderEligibility(directImage)).toMatchObject({
      isSubmittable: false,
      reason: null,
      imageUrls: ["https://example.com/direct.png"],
    });
    expect(resolveSeedanceElementProviderEligibility(directImage)).toMatchObject({
      isSubmittable: true,
      imageUrls: ["https://example.com/direct.png"],
    });
  });

  it("rejects one-image saved elements for Kling but keeps them usable for Seedance", () => {
    const oneImage = makeKlingElement({
      frontalImageUrl: "https://example.com/one.png",
    });

    expect(resolveKieKlingElementProviderEligibility(oneImage)).toMatchObject({
      isSubmittable: false,
      mediaKind: "image",
      reason: "Kling element Beach Ball needs at least 2 image references before generating.",
    });
    expect(resolveSeedanceElementProviderEligibility(oneImage)).toMatchObject({
      isSubmittable: true,
      imageUrls: ["https://example.com/one.png"],
    });
  });

  it("accepts Kling image sets, video-only elements, and rejects mixed image/video elements", () => {
    expect(
      resolveKieKlingElementProviderEligibility(
        makeKlingElement({
          frontalImageUrl: "https://example.com/front.png",
          referenceImageUrls: "https://example.com/side.png",
        })
      )
    ).toMatchObject({
      isSubmittable: true,
      mediaKind: "image",
      imageUrls: ["https://example.com/front.png", "https://example.com/side.png"],
    });

    expect(
      resolveKieKlingElementProviderEligibility(
        makeKlingElement({
          frontalImageUrl: "",
          referenceImageUrls: "",
          videoUrl: "https://example.com/reference.mp4",
        })
      )
    ).toMatchObject({
      isSubmittable: true,
      mediaKind: "video",
      videoUrls: ["https://example.com/reference.mp4"],
    });

    expect(
      resolveKieKlingElementProviderEligibility(
        makeKlingElement({
          frontalImageUrl: "https://example.com/front.png",
          videoUrl: "https://example.com/reference.mp4",
        })
      ).reason
    ).toBe(
      "Kling element Beach Ball must use either one video reference or 2-4 image references, not both."
    );
  });

  it("limits Kling's submittable projection to saved elements in the first three slots", () => {
    const directImage = createSeedanceImageReferenceSlot({
      slotIndex: 0,
      imageUrl: "https://example.com/direct.png",
    });
    const slotTwo = makeKlingElement({
      id: "slot-two",
      slotIndex: 1,
      frontalImageUrl: "https://example.com/two-front.png",
      referenceImageUrls: "https://example.com/two-side.png",
    });
    const seedanceOnlySlot = makeKlingElement({
      id: "slot-five",
      slotIndex: 4,
      frontalImageUrl: "https://example.com/five-front.png",
      referenceImageUrls: "https://example.com/five-side.png",
    });

    expect(
      getKieKlingSubmittableSlotElements([directImage, slotTwo, seedanceOnlySlot]).map(
        (element) => element.id
      )
    ).toEqual(["slot-two"]);
    expect(resolveKieKlingElementsValidationMessage([directImage, slotTwo, seedanceOnlySlot])).toBe(
      null
    );
  });
});
