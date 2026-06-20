import { describe, expect, it } from "vitest";
import {
  BUILT_IN_STYLE_ID_MAX_LENGTH,
  SEEDED_BUILT_IN_STYLE_DEFINITIONS,
  createBuiltInStyleIdFromTitle,
  normalizeBuiltInStyleId,
  normalizeBuiltInStyleDefinitions,
  resolveUniqueBuiltInStyleId,
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

  it("clamps built-in style prompts to the shared style prompt budget", () => {
    const [definition] = normalizeBuiltInStyleDefinitions([
      {
        styleId: "long-style",
        title: "Long Style",
        stylePrompt: "a".repeat(350),
        previewImageUrl: "/Styles/Long.png",
      },
    ]);

    expect(definition?.stylePrompt).toHaveLength(300);
  });

  it("preserves legacy stored style ids that are non-canonical but within budget", () => {
    expect(
      normalizeBuiltInStyleDefinitions([
        {
          styleId: "Legacy Style ID",
          title: "Legacy Style",
          stylePrompt: "legacy prompt",
          previewImageUrl: "/Styles/Legacy.png",
        },
      ])
    ).toEqual([
      {
        styleId: "Legacy Style ID",
        title: "Legacy Style",
        stylePrompt: "legacy prompt",
        previewImageUrl: "/Styles/Legacy.png",
        referenceImageName: null,
        schemaVersion: 1,
      },
    ]);
  });

  it("derives canonical style ids from admin-entered style names", () => {
    expect(createBuiltInStyleIdFromTitle(" Lo-fi Noir ")).toBe("lo-fi-noir");
    expect(createBuiltInStyleIdFromTitle("Cell phone snapshot")).toBe("cell-phone-snapshot");
    expect(createBuiltInStyleIdFromTitle("Crème Brûlée Look")).toBe("creme-brulee-look");
    expect(createBuiltInStyleIdFromTitle("!!!", "built-in-style-4")).toBe("built-in-style-4");
  });

  it("enforces canonical built-in style id format and length", () => {
    expect(normalizeBuiltInStyleId("lo-fi-noir")).toBe("lo-fi-noir");
    expect(normalizeBuiltInStyleId("Lo Fi Noir")).toBeNull();
    expect(normalizeBuiltInStyleId("lo_fi_noir")).toBeNull();
    expect(normalizeBuiltInStyleId("x".repeat(BUILT_IN_STYLE_ID_MAX_LENGTH + 1))).toBeNull();
    expect(createBuiltInStyleIdFromTitle("A ".repeat(200)).length).toBeLessThanOrEqual(
      BUILT_IN_STYLE_ID_MAX_LENGTH
    );
  });

  it("resolves unique ids without changing existing canonical ids", () => {
    const usedStyleIds = new Set(["lo-fi-noir", "lo-fi-noir-2"]);
    expect(
      resolveUniqueBuiltInStyleId({
        preferredStyleId: "cinematic",
        title: "Editorial Cinematic",
        usedStyleIds,
      })
    ).toBe("cinematic");
    expect(
      resolveUniqueBuiltInStyleId({
        title: "Lo-fi Noir",
        usedStyleIds,
      })
    ).toBe("lo-fi-noir-3");
  });
});
