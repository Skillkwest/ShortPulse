import { describe, expect, it } from "vitest";
import { resolveSeedreamImageSize } from "../seedreamSizing";

describe("resolveSeedreamImageSize", () => {
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

  it("passes through Seedream auto resolution values", () => {
    expect(resolveSeedreamImageSize("5:4", "auto_2K")).toBe("auto_2K");
    expect(resolveSeedreamImageSize("5:4", "auto_4K")).toBe("auto_4K");
  });

  it("falls back to square for unknown values", () => {
    expect(resolveSeedreamImageSize("unknown", "model_default")).toBe("square");
  });
});
