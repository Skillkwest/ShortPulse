import { describe, expect, it } from "vitest";
import { resolveSeedreamImageSize } from "../seedreamSizing";

describe("resolveSeedreamImageSize", () => {
  const parseAspect = (aspect: string): number => {
    const [widthToken, heightToken] = aspect.split(":");
    return Number(widthToken) / Number(heightToken);
  };

  it("returns native enum for native aspect ratios", () => {
    expect(resolveSeedreamImageSize("1:1", "model_default")).toBe("square");
    expect(resolveSeedreamImageSize("16:9", "model_default")).toBe("landscape_16_9");
    expect(resolveSeedreamImageSize("9:16", "model_default")).toBe("portrait_16_9");
  });

  it("returns exact custom dimensions for non-native supported aspects", () => {
    expect(resolveSeedreamImageSize("5:4", "model_default")).toEqual({ width: 2400, height: 1920 });
    expect(resolveSeedreamImageSize("4:5", "model_default")).toEqual({ width: 1920, height: 2400 });
    expect(resolveSeedreamImageSize("3:2", "model_default")).toEqual({ width: 2880, height: 1920 });
    expect(resolveSeedreamImageSize("2:3", "model_default")).toEqual({ width: 1920, height: 2880 });
  });

  it("resolves aspect-locked dimensions for Seedream auto resolutions", () => {
    const seedreamAspects = [
      "1:1",
      "2:3",
      "3:2",
      "3:4",
      "4:3",
      "4:5",
      "5:4",
      "9:16",
      "16:9",
      "21:9",
    ];
    for (const aspect of seedreamAspects) {
      for (const resolution of ["auto_2K", "auto_4K"] as const) {
        const imageSize = resolveSeedreamImageSize(aspect, resolution);
        expect(typeof imageSize).toBe("object");
        if (typeof imageSize === "string") continue;

        expect(imageSize.width).toBeGreaterThanOrEqual(256);
        expect(imageSize.width).toBeLessThanOrEqual(4096);
        expect(imageSize.height).toBeGreaterThanOrEqual(256);
        expect(imageSize.height).toBeLessThanOrEqual(4096);
        expect(imageSize.width % 2).toBe(0);
        expect(imageSize.height % 2).toBe(0);

        const expectedRatio = parseAspect(aspect);
        const observedRatio = imageSize.width / imageSize.height;
        expect(Math.abs(observedRatio - expectedRatio)).toBeLessThanOrEqual(0.02);
      }
    }
  });

  it("falls back to square for unknown values", () => {
    expect(resolveSeedreamImageSize("unknown", "model_default")).toBe("square");
  });
});
