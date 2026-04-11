/**
 * Generic Fal image route registry sanity checks.
 * Ensures the new active-image cutover routes resolve supported models only.
 */
import { describe, expect, it } from "vitest";
import imageStatusHandler from "../../pages/api/fal/image-status";
import imageSubmitHandler from "../../pages/api/fal/image-submit";
import {
  resolveFalImageStatusHandler,
  resolveFalImageSubmitHandler,
} from "../../lib/server/api/falImageRouteRegistry";

describe("fal image route registry", () => {
  it("default-exports generic image handlers", () => {
    expect(typeof imageSubmitHandler).toBe("function");
    expect(typeof imageStatusHandler).toBe("function");
  });

  it("resolves active Fal image models through the shared registry", () => {
    expect(resolveFalImageSubmitHandler("fal/flux-2")).toEqual(expect.any(Function));
    expect(resolveFalImageStatusHandler("fal-ai/nano-banana-pro/edit")).toEqual(
      expect.any(Function)
    );
    expect(resolveFalImageSubmitHandler("fal-ai/bytedance/seedream/v5/lite/edit")).toEqual(
      expect.any(Function)
    );
  });

  it("rejects non-image or unsupported models", () => {
    expect(resolveFalImageSubmitHandler("fal-ai/veo3.1")).toBeNull();
    expect(resolveFalImageStatusHandler("kie-ai/seedance-2.0")).toBeNull();
    expect(resolveFalImageSubmitHandler("")).toBeNull();
  });
});
