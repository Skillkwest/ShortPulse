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
    });
  });

  it("drops metadata extension fields and keeps core values", () => {
    const normalized = normalizeStyleDetails({
      style: "Noir",
      title: "Noir",
      referenceImageName: "Noir",
      stylePrompt: "cinematic lighting, muted tonal palette",
      previewImageUrl: "/Styles/Cinematic.png",
      styleProfile: { version: 1 },
      extractionMeta: { version: 1, outcome: "success" },
    });

    expect(normalized).toEqual({
      style: "Noir",
      title: "Noir",
      referenceImageName: "Noir",
      stylePrompt: "cinematic lighting, muted tonal palette",
      previewImageUrl: "/Styles/Cinematic.png",
    });
  });

  it("ignores invalid metadata while keeping core fields", () => {
    const normalized = normalizeStyleDetails({
      style: "Noir",
      title: "Noir",
      referenceImageName: "Noir",
      stylePrompt: "cinematic lighting",
      previewImageUrl: "/Styles/Cinematic.png",
      styleProfile: { version: 2 },
      extractionMeta: { version: 1, outcome: "invalid" },
    });

    expect(normalized).toEqual({
      style: "Noir",
      title: "Noir",
      referenceImageName: "Noir",
      stylePrompt: "cinematic lighting",
      previewImageUrl: "/Styles/Cinematic.png",
    });
  });

  it("clamps style prompts to persistence max length", () => {
    const normalized = normalizeStyleDetails({
      style: "Noir",
      title: "Noir",
      referenceImageName: "Noir",
      stylePrompt: "a".repeat(1100),
      previewImageUrl: "/Styles/Cinematic.png",
    });

    expect(normalized.stylePrompt.length).toBe(1000);
  });

  it("normalizes style details maps and compares equality by core fields", () => {
    const mapA = normalizeStyleDetailsMap({
      cinematic: {
        style: "Cinematic",
        title: "Cinematic",
        referenceImageName: "Cinematic",
        stylePrompt: "cinematic lighting",
        previewImageUrl: "/Styles/Cinematic.png",
      },
    });

    const mapB = normalizeStyleDetailsMap({
      cinematic: {
        style: "Cinematic",
        title: "Cinematic",
        referenceImageName: "Cinematic",
        stylePrompt: "cinematic lighting",
        previewImageUrl: "/Styles/Cinematic.png",
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
