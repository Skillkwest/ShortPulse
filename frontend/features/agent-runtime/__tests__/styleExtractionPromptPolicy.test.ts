import { describe, expect, it } from "vitest";
import {
  enforceLeadingHardStyleClass,
  resolveHardStyleClass,
} from "../styleExtractionPromptPolicy";

describe("styleExtractionPromptPolicy", () => {
  it("classifies anime-style descriptor sets", () => {
    const styleClass = resolveHardStyleClass(
      "digital illustration, anime/manga-inspired, warm golden palette, soft diffusion"
    );
    expect(styleClass).toBe("Anime Style");
  });

  it("classifies candid phone-snapshot descriptors ahead of general photographic matches", () => {
    const styleClass = resolveHardStyleClass(
      "candid snapshot, smartphone perspective, natural daylight, slight motion blur"
    );
    expect(styleClass).toBe("Candid Cell Phone Snapshot");
  });

  it("forces a hard style class as the first descriptor and removes duplicate class descriptors", () => {
    const normalized = enforceLeadingHardStyleClass(
      "anime style, digital illustration, anime/manga-inspired, cinematic lighting, soft gradient shading"
    );
    expect(normalized).toBe(
      "Anime Style, digital illustration, anime/manga-inspired, cinematic lighting, soft gradient shading"
    );
  });

  it("defaults to photographic when no style class signals are present", () => {
    const normalized = enforceLeadingHardStyleClass("golden palette, soft gradient shadows");
    expect(normalized).toBe("Photographic, golden palette, soft gradient shadows");
  });
});
