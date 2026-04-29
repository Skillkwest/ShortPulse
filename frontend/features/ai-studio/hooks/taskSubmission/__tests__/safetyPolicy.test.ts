import { describe, expect, it } from "vitest";
import { resolveImageSubmissionSafetyPayload } from "../safetyPolicy";

describe("resolveImageSubmissionSafetyPayload", () => {
  it("keeps non-Seedream image safety-checker defaults disabled", () => {
    expect(resolveImageSubmissionSafetyPayload("fal-ai/flux-2/klein/9b")).toEqual({
      enable_safety_checker: false,
    });
  });

  it("enables the provider safety checker for Seedream image models", () => {
    expect(
      resolveImageSubmissionSafetyPayload("fal-ai/bytedance/seedream/v4.5/text-to-image")
    ).toEqual({
      enable_safety_checker: true,
    });
    expect(resolveImageSubmissionSafetyPayload("fal-ai/bytedance/seedream/v4.5/edit")).toEqual({
      enable_safety_checker: true,
    });
    expect(
      resolveImageSubmissionSafetyPayload("fal-ai/bytedance/seedream/v5/lite/text-to-image")
    ).toEqual({
      enable_safety_checker: true,
    });
    expect(resolveImageSubmissionSafetyPayload("fal-ai/bytedance/seedream/v5/lite/edit")).toEqual({
      enable_safety_checker: true,
    });
  });

  it("uses maximum tolerance where supported by fill lanes", () => {
    expect(resolveImageSubmissionSafetyPayload("fal-ai/flux-pro/v1/fill")).toEqual({
      safety_tolerance: "5",
    });
  });

  it("returns empty payload for models without explicit safety policy overrides", () => {
    expect(resolveImageSubmissionSafetyPayload("fal-ai/nano-banana")).toEqual({});
    expect(resolveImageSubmissionSafetyPayload("unknown-model")).toEqual({});
  });
});
