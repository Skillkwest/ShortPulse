import { describe, expect, it } from "vitest";
import {
  resolveImageSubmissionSafetyPayload,
  resolveVideoSubmissionSafetyPayload,
} from "../safetyPolicy";

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

describe("resolveVideoSubmissionSafetyPayload", () => {
  it("uses minimum restriction for video models that expose enable_safety_checker", () => {
    expect(
      resolveVideoSubmissionSafetyPayload("fal-ai/bytedance/seedance/v1.5/pro/text-to-video")
    ).toEqual({
      enable_safety_checker: false,
    });
    expect(
      resolveVideoSubmissionSafetyPayload("fal-ai/bytedance/seedance/v1.5/pro/image-to-video")
    ).toEqual({
      enable_safety_checker: false,
    });
  });

  it("uses maximum tolerance for Veo variants that support safety_tolerance", () => {
    expect(resolveVideoSubmissionSafetyPayload("fal-ai/veo3.1")).toEqual({
      enable_safety_checker: false,
      safety_tolerance: 5,
    });
    expect(resolveVideoSubmissionSafetyPayload("fal-ai/veo3.1/image-to-video")).toEqual({
      enable_safety_checker: false,
      safety_tolerance: 5,
    });
  });

  it("returns empty payload for video models without explicit safety policy overrides", () => {
    expect(resolveVideoSubmissionSafetyPayload("fal-ai/kling-video/v3/pro/text-to-video")).toEqual(
      {}
    );
    expect(resolveVideoSubmissionSafetyPayload("fal-ai/veo3.1/first-last-frame-to-video")).toEqual(
      {}
    );
    expect(resolveVideoSubmissionSafetyPayload("unknown-model")).toEqual({});
  });
});
