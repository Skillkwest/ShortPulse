import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_15_PRO_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../../lib/model-runtime/providerModelIds";
import { useAiStudioAllowedModelOptions } from "../useAiStudioAllowedModelOptions";

describe("useAiStudioAllowedModelOptions", () => {
  it("limits create image options to paired edit models when character mode is enabled", () => {
    const { result } = renderHook(() =>
      useAiStudioAllowedModelOptions({
        selectedTool: "create",
        mode: "image",
        videoReferenceMode: "standard",
        isCharacterModeEnabled: true,
      })
    );

    const values = result.current.map((option) => option.value);
    expect(values).toEqual([
      "fal-ai/nano-banana-2/edit",
      "fal-ai/nano-banana-pro/edit",
      "fal-ai/bytedance/seedream/v5/lite/edit",
      "fal-ai/bytedance/seedream/v4.5/edit",
    ]);
  });

  it("keeps text-to-image create options when character mode is disabled", () => {
    const { result } = renderHook(() =>
      useAiStudioAllowedModelOptions({
        selectedTool: "create",
        mode: "image",
        videoReferenceMode: "standard",
        isCharacterModeEnabled: false,
      })
    );

    const values = new Set(result.current.map((option) => option.value));
    expect(values.has("fal-ai/bytedance/seedream/v4.5/text-to-image")).toBe(true);
    expect(values.has("fal-ai/bytedance/seedream/v4.5/edit")).toBe(false);
  });

  it("keeps standard video options text-lane compatible when no frame images are present", () => {
    const { result } = renderHook(() =>
      useAiStudioAllowedModelOptions({
        selectedTool: "video",
        mode: "video",
        videoReferenceMode: "standard",
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
      })
    );

    const values = new Set(result.current.map((option) => option.value));
    expect(values.has("fal-ai/veo3.1")).toBe(false);
    expect(values.has("fal-ai/veo3.1/image-to-video")).toBe(false);
    expect(values.has("fal-ai/kling-video/v3/pro/text-to-video")).toBe(false);
    expect(values.has("fal-ai/bytedance/seedance/v1.5/pro/text-to-video")).toBe(false);
    expect(values.has(KIE_VEO_31_FAST_I2V_MODEL_ID)).toBe(true);
    expect(values.has(KIE_KLING_30_MODEL_ID)).toBe(false);
    expect(values.has(KIE_SEEDANCE_15_PRO_MODEL_ID)).toBe(true);
  });

  it("narrows video options to first-last-capable models when two frame images are present", () => {
    const { result } = renderHook(() =>
      useAiStudioAllowedModelOptions({
        selectedTool: "video",
        mode: "video",
        videoReferenceMode: "standard",
        referenceImageUrl: "https://example.com/first.png",
        extraImageUrls: ["https://example.com/last.png", null, null],
      })
    );

    const values = new Set(result.current.map((option) => option.value));
    expect(values).toEqual(
      new Set([
        KIE_VEO_31_FAST_I2V_MODEL_ID,
        KIE_KLING_30_MODEL_ID,
        KIE_SEEDANCE_15_PRO_MODEL_ID,
        KIE_SEEDANCE_2_MODEL_ID,
        KIE_SEEDANCE_2_FAST_MODEL_ID,
      ])
    );
  });
});
