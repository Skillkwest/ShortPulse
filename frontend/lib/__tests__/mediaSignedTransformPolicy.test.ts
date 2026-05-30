import { describe, expect, it } from "vitest";
import {
  areMediaSignedTransformsEnabled,
  resolvePolicySignedImageTransform,
} from "../mediaSignedTransformPolicy";

describe("mediaSignedTransformPolicy", () => {
  it("keeps signed media transforms disabled even when legacy flags are true", () => {
    expect(
      areMediaSignedTransformsEnabled({
        serverFlag: "true",
        clientFlag: "true",
      })
    ).toBe(false);
    expect(
      areMediaSignedTransformsEnabled({
        serverFlag: "true",
        clientFlag: "false",
      })
    ).toBe(false);
    expect(
      areMediaSignedTransformsEnabled({
        serverFlag: "false",
        clientFlag: "true",
      })
    ).toBe(false);
  });

  it("returns null transform when policy is disabled", () => {
    expect(
      resolvePolicySignedImageTransform("media-library-panel-image-card", "user-1/path/image.jpg", {
        transformsEnabled: false,
      })
    ).toBeNull();
  });

  it("returns null transform even when legacy overrides request enablement", () => {
    expect(
      resolvePolicySignedImageTransform("media-library-panel-image-card", "user-1/path/image.jpg", {
        transformsEnabled: true,
      })
    ).toBeNull();
  });
});
