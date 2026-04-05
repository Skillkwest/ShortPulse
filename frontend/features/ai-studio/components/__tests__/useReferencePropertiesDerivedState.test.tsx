import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AspectOption } from "../../types";
import { useReferencePropertiesDerivedState } from "../useReferencePropertiesDerivedState";
import { KIE_KLING_30_MODEL_ID } from "../../../../lib/model-runtime/providerModelIds";

const aspectOptions: AspectOption[] = [
  {
    value: "16:9",
    ratioLabel: "16:9",
    name: "Landscape",
    orientation: "horizontal",
  },
  {
    value: "9:16",
    ratioLabel: "9:16",
    name: "Portrait",
    orientation: "vertical",
  },
  {
    value: "1:1",
    ratioLabel: "1:1",
    name: "Square",
    orientation: "square",
  },
];

const baseArgs = {
  variant: "video" as const,
  videoReferenceMode: "standard" as const,
  aspectOptions,
  klingMultiPrompts: [],
  klingElements: [],
  klingVoiceIds: ["", ""] as [string, string],
  klingCfgScale: 0.5,
  klingNegativePrompt: "",
  videoDurationSeconds: 8,
  videoResolution: "1080p",
  videoGenerateAudio: true,
};

describe("useReferencePropertiesDerivedState", () => {
  it("returns declared resolution options for Kling image-to-video", () => {
    const { result } = renderHook(() =>
      useReferencePropertiesDerivedState({
        ...baseArgs,
        modelId: "fal-ai/kling-video/v3/pro/image-to-video",
      })
    );

    expect(result.current.resolutionOptions.map((option) => option.value)).toEqual([
      "720p",
      "1080p",
    ]);
  });

  it("falls back to default video resolutions when a model has no declared resolution support", () => {
    const { result } = renderHook(() =>
      useReferencePropertiesDerivedState({
        ...baseArgs,
        modelId: "fal-ai/kling-video/v3/pro/text-to-video",
      })
    );

    expect(result.current.resolutionOptions.map((option) => option.value)).toEqual([
      "720p",
      "1080p",
    ]);
  });

  it("returns declared resolution options for other models that provide them", () => {
    const { result } = renderHook(() =>
      useReferencePropertiesDerivedState({
        ...baseArgs,
        modelId: "fal-ai/veo3.1/image-to-video",
      })
    );

    expect(result.current.resolutionOptions.map((option) => option.value)).toEqual([
      "720p",
      "1080p",
      "4k",
    ]);
  });

  it("summarizes KIE Kling assets with prompt-token readiness instead of voice counts", () => {
    const { result } = renderHook(() =>
      useReferencePropertiesDerivedState({
        ...baseArgs,
        modelId: KIE_KLING_30_MODEL_ID,
        klingElements: [
          {
            id: "element-01",
            frontalImageUrl: "",
            referenceImageUrls: "",
            videoUrl: "",
          },
        ],
        klingVoiceIds: ["voice-1", ""],
      })
    );

    expect(result.current.klingAssetsSummary).toBe("1 element · Prompt tokens ready");
  });

  it("summarizes non-KIE Kling assets with voice counts", () => {
    const { result } = renderHook(() =>
      useReferencePropertiesDerivedState({
        ...baseArgs,
        modelId: "fal-ai/kling-video/v3/pro/image-to-video",
        klingElements: [
          {
            id: "element-01",
            frontalImageUrl: "",
            referenceImageUrls: "",
            videoUrl: "",
          },
        ],
        klingVoiceIds: ["voice-1", ""],
      })
    );

    expect(result.current.klingAssetsSummary).toBe("1 element · 1 voice");
  });
});
