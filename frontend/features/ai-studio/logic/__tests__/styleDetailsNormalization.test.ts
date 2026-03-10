/**
 * Unit tests for styles-library details normalization and compatibility behavior.
 */
import { describe, expect, it } from "vitest";
import {
  areStyleDetailMapsEqual,
  mergeStyleDetailsMaps,
  normalizeStyleDetails,
  normalizeStyleDetailsMap,
} from "../styleDetailsNormalization";

describe("styleDetailsNormalization", () => {
  it("normalizes legacy style details without metadata", () => {
    const normalized = normalizeStyleDetails({
      style: "  Noir  ",
      title: " Noir ",
      referenceImageName: " Noir ",
      stylePrompt: "  cinematic lighting  ",
      previewImageUrl: "  /Styles/Cinematic.png  ",
    });

    expect(normalized).toEqual({
      style: "Noir",
      title: "Noir",
      referenceImageName: "Noir",
      stylePrompt: "cinematic lighting",
      previewImageUrl: "/Styles/Cinematic.png",
      styleProfile: undefined,
      extractionMeta: undefined,
    });
  });

  it("preserves valid metadata extension fields", () => {
    const normalized = normalizeStyleDetails({
      style: "Noir",
      title: "Noir",
      referenceImageName: "Noir",
      stylePrompt: "cinematic lighting, muted tonal palette",
      previewImageUrl: "/Styles/Cinematic.png",
      styleProfile: {
        version: 1,
        medium: "photography",
        lightingDescriptors: ["cinematic lighting"],
        lensDepthDescriptors: [],
        colorDescriptors: ["muted tonal palette"],
        renderingDescriptors: ["editorial photography style"],
        textureDescriptors: [],
        generalDescriptors: [],
      },
      extractionMeta: {
        version: 1,
        outcome: "success",
        flow: "library_drop",
        extractedAtIso: "2026-03-09T00:00:00.000Z",
        sourceUrlKind: "data",
        extractor: "openai_prompt_style_extract",
      },
    });

    expect(normalized.styleProfile?.version).toBe(1);
    expect(normalized.extractionMeta?.outcome).toBe("success");
  });

  it("drops invalid metadata but keeps core fields", () => {
    const normalized = normalizeStyleDetails({
      style: "Noir",
      title: "Noir",
      referenceImageName: "Noir",
      stylePrompt: "cinematic lighting",
      previewImageUrl: "/Styles/Cinematic.png",
      styleProfile: { version: 2 },
      extractionMeta: { version: 1, outcome: "invalid" },
    });

    expect(normalized.styleProfile).toBeUndefined();
    expect(normalized.extractionMeta).toBeUndefined();
    expect(normalized.style).toBe("Noir");
  });

  it("normalizes style details maps and compares equality with metadata", () => {
    const mapA = normalizeStyleDetailsMap({
      cinematic: {
        style: "Cinematic",
        title: "Cinematic",
        referenceImageName: "Cinematic",
        stylePrompt: "cinematic lighting",
        previewImageUrl: "/Styles/Cinematic.png",
        extractionMeta: {
          version: 1,
          outcome: "success",
          flow: "create_modal",
          extractedAtIso: "2026-03-09T00:00:00.000Z",
          sourceUrlKind: "url",
          extractor: "openai_prompt_style_extract",
        },
      },
    });

    const mapB = normalizeStyleDetailsMap({
      cinematic: {
        style: "Cinematic",
        title: "Cinematic",
        referenceImageName: "Cinematic",
        stylePrompt: "cinematic lighting",
        previewImageUrl: "/Styles/Cinematic.png",
        extractionMeta: {
          version: 1,
          outcome: "success",
          flow: "create_modal",
          extractedAtIso: "2026-03-09T00:00:00.000Z",
          sourceUrlKind: "url",
          extractor: "openai_prompt_style_extract",
        },
      },
    });

    expect(areStyleDetailMapsEqual(mapA, mapB)).toBe(true);

    const merged = mergeStyleDetailsMaps(
      { cinematic: mapA.cinematic },
      {
        cinematic: {
          ...mapA.cinematic,
          stylePrompt: "cinematic lighting, rich contrast",
        },
      }
    );

    expect(merged.cinematic.stylePrompt).toBe("cinematic lighting, rich contrast");
  });
});
