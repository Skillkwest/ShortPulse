import { describe, expect, it } from "vitest";
import { resolveImageSubmissionSafetyPayload } from "../safetyPolicy";

describe("resolveImageSubmissionSafetyPayload", () => {
  it("uses minimum restriction for image models that expose enable_safety_checker", () => {
    expect(resolveImageSubmissionSafetyPayload("fal/flux-2")).toEqual({
      enable_safety_checker: false,
    });
    expect(resolveImageSubmissionSafetyPayload("fal-ai/flux-2/klein/9b")).toEqual({
      enable_safety_checker: false,
    });
    expect(resolveImageSubmissionSafetyPayload("fal/flux-2/edit")).toEqual({
      enable_safety_checker: false,
    });
    expect(
      resolveImageSubmissionSafetyPayload("fal-ai/bytedance/seedream/v4.5/text-to-image")
    ).toEqual({
      enable_safety_checker: false,
    });
    expect(resolveImageSubmissionSafetyPayload("fal-ai/bytedance/seedream/v4.5/edit")).toEqual({
      enable_safety_checker: false,
    });
  });

  it("uses minimum tolerance where supported by FLUX.2 Pro variants", () => {
    expect(resolveImageSubmissionSafetyPayload("fal/flux-2-pro")).toEqual({
      enable_safety_checker: false,
      safety_tolerance: "5",
    });
    expect(resolveImageSubmissionSafetyPayload("fal/flux-2-pro/edit")).toEqual({
      enable_safety_checker: false,
      safety_tolerance: "5",
    });
  });

  it("returns empty payload for models without explicit safety policy overrides", () => {
    expect(resolveImageSubmissionSafetyPayload("fal-ai/nano-banana")).toEqual({});
    expect(resolveImageSubmissionSafetyPayload("unknown-model")).toEqual({});
  });
});
