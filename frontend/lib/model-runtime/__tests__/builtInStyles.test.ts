import { describe, expect, it } from "vitest";
import {
  SEEDED_BUILT_IN_STYLE_DEFINITIONS,
  normalizeBuiltInStyleDefinitions,
  resolveBuiltInStyleDefinitions,
} from "../builtInStyles";

describe("built-in Styles domain", () => {
  it("seeds the shipped built-in Styles catalog", () => {
    expect(resolveBuiltInStyleDefinitions().map((style) => style.styleId)).toEqual([
      "photorealistic",
      "cinematic",
      "cell-phone-snapshot",
      "anime",
    ]);
    expect(SEEDED_BUILT_IN_STYLE_DEFINITIONS[0]).toMatchObject({
      title: "Photorealistic",
      previewImageUrl: "/Styles/Photoreal.png",
      schemaVersion: 1,
    });
  });

  it("normalizes valid unique style definitions and drops invalid or duplicate entries", () => {
    expect(
      normalizeBuiltInStyleDefinitions([
        {
          styleId: "cinematic",
          title: "Cinematic",
          stylePrompt: "cinematic prompt",
          previewImageUrl: "/Styles/Cinematic.png",
          referenceImageName: "Cinema Reference",
          schemaVersion: 999,
        },
        {
          styleId: "cinematic",
          title: "Duplicate",
          stylePrompt: "duplicate prompt",
          previewImageUrl: "/duplicate.png",
        },
        {
          styleId: "",
          title: "Blank",
          stylePrompt: "prompt",
          previewImageUrl: "/blank.png",
        },
      ])
    ).toEqual([
      {
        styleId: "cinematic",
        title: "Cinematic",
        stylePrompt: "cinematic prompt",
        previewImageUrl: "/Styles/Cinematic.png",
        referenceImageName: "Cinema Reference",
        schemaVersion: 1,
      },
    ]);
  });
});
