import { beforeEach, describe, expect, it } from "vitest";
import {
  resolveImageSubmissionSafetyPayload,
  resolveVideoSubmissionSafetyPayload,
} from "../safetyPolicy";

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_AI_STUDIO_GENERATION_SAFETY_LEVEL;
});

describe("resolveImageSubmissionSafetyPayload", () => {
  it("uses moderate restriction defaults for image models that expose enable_safety_checker", () => {
    expect(resolveImageSubmissionSafetyPayload("fal/flux-2")).toEqual({
      enable_safety_checker: true,
    });
    expect(resolveImageSubmissionSafetyPayload("fal-ai/flux-2/klein/9b")).toEqual({
      enable_safety_checker: true,
    });
    expect(resolveImageSubmissionSafetyPayload("fal/flux-2/edit")).toEqual({
      enable_safety_checker: true,
    });
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

  it("uses moderate tolerance where supported by FLUX.2 Pro variants", () => {
    expect(resolveImageSubmissionSafetyPayload("fal/flux-2-pro")).toEqual({
      enable_safety_checker: true,
      safety_tolerance: "3",
    });
    expect(resolveImageSubmissionSafetyPayload("fal/flux-2-pro/edit")).toEqual({
      enable_safety_checker: true,
      safety_tolerance: "3",
    });
  });

  it("returns empty payload for models without explicit safety policy overrides", () => {
    expect(resolveImageSubmissionSafetyPayload("fal-ai/nano-banana")).toEqual({});
    expect(resolveImageSubmissionSafetyPayload("unknown-model")).toEqual({});
  });
});

describe("resolveVideoSubmissionSafetyPayload", () => {
  it("uses moderate restriction for video models that expose enable_safety_checker", () => {
    expect(
      resolveVideoSubmissionSafetyPayload("fal-ai/bytedance/seedance/v1.5/pro/text-to-video")
    ).toEqual({
      enable_safety_checker: true,
    });
    expect(
      resolveVideoSubmissionSafetyPayload("fal-ai/bytedance/seedance/v1.5/pro/image-to-video")
    ).toEqual({
      enable_safety_checker: true,
    });
  });

  it("uses moderate tolerance for Veo variants that support safety_tolerance", () => {
    expect(resolveVideoSubmissionSafetyPayload("fal-ai/veo3.1")).toEqual({
      enable_safety_checker: true,
      safety_tolerance: "3",
    });
    expect(resolveVideoSubmissionSafetyPayload("fal-ai/veo3.1/image-to-video")).toEqual({
      enable_safety_checker: true,
      safety_tolerance: "3",
    });
    expect(resolveVideoSubmissionSafetyPayload("fal-ai/veo3.1/first-last-frame-to-video")).toEqual({
      enable_safety_checker: true,
      safety_tolerance: "3",
    });
  });

  it("returns empty payload for video models without explicit safety policy overrides", () => {
    expect(resolveVideoSubmissionSafetyPayload("fal-ai/kling-video/v3/pro/text-to-video")).toEqual(
      {}
    );
    expect(resolveVideoSubmissionSafetyPayload("fal-ai/sora-2/text-to-video/pro")).toEqual({});
    expect(resolveVideoSubmissionSafetyPayload("unknown-model")).toEqual({});
  });
});
