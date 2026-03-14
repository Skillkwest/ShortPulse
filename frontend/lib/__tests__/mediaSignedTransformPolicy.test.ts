import { describe, expect, it } from "vitest";
import {
  areMediaSignedTransformsEnabled,
  resolvePolicySignedImageTransform,
} from "../mediaSignedTransformPolicy";

describe("mediaSignedTransformPolicy", () => {
  it("enables transforms only when both flags are true", () => {
    expect(
      areMediaSignedTransformsEnabled({
        serverFlag: "true",
        clientFlag: "true",
      })
    ).toBe(true);
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

  it("returns transform when policy is enabled and path is image-like", () => {
    expect(
      resolvePolicySignedImageTransform("media-library-panel-image-card", "user-1/path/image.jpg", {
        transformsEnabled: true,
      })
    ).toEqual({
      width: 512,
      quality: 50,
      resize: "contain",
    });
  });
});
