import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AspectOption } from "../../types";
import { useReferencePropertiesDerivedState } from "../useReferencePropertiesDerivedState";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../../lib/model-runtime/providerModelIds";

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
        modelId: KIE_KLING_30_MODEL_ID,
      })
    );

    expect(result.current.resolutionOptions.map((option) => option.value)).toEqual([
      "720p",
      "1080p",
    ]);
  });

  it("returns declared resolution options for Kie Veo", () => {
    const { result } = renderHook(() =>
      useReferencePropertiesDerivedState({
        ...baseArgs,
        modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
      })
    );

    expect(result.current.resolutionOptions.map((option) => option.value)).toEqual([
      "720p",
      "1080p",
    ]);
  });

  it("returns the refreshed Veo duration options from the model contract", () => {
    const { result } = renderHook(() =>
      useReferencePropertiesDerivedState({
        ...baseArgs,
        modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
      })
    );

    expect(result.current.durationOptions).toEqual([4, 6, 8]);
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

  it("does not count Seedance-only direct image references as KIE Kling assets", () => {
    const { result } = renderHook(() =>
      useReferencePropertiesDerivedState({
        ...baseArgs,
        modelId: KIE_KLING_30_MODEL_ID,
        klingElements: [
          {
            id: "image-ref-01",
            sourceKind: "reference-image",
            frontalImageUrl: "https://example.com/direct-image.png",
            referenceImageUrls: "",
            videoUrl: "",
          },
        ],
      })
    );

    expect(result.current.klingAssetsSummary).toBe("No elements · Prompt tokens ready");
  });

  it("does not render Kling-specific UI state outside the active Kie Kling mode", () => {
    const { result } = renderHook(() =>
      useReferencePropertiesDerivedState({
        ...baseArgs,
        videoReferenceMode: "kling3",
        modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
      })
    );

    expect(result.current.isKling3Mode).toBe(false);
    expect(result.current.klingAdvancedOrder).toBeUndefined();
    expect(result.current.klingAssetsSummary).toBe("No elements · No voices");
  });

  it("treats Seedance 2 as a Kling-pattern video workspace with Seedance-specific copy", () => {
    const { result } = renderHook(() =>
      useReferencePropertiesDerivedState({
        ...baseArgs,
        modelId: KIE_SEEDANCE_2_MODEL_ID,
        klingElements: [
          {
            id: "element-01",
            frontalImageUrl: "",
            referenceImageUrls: "",
            videoUrl: "",
          },
        ],
      })
    );

    expect(result.current.isKlingPatternMode).toBe(true);
    expect(result.current.isSeedance2FamilyModel).toBe(true);
    expect(result.current.referenceStepTitle).toBe("Add Seedance 2.0 Frames");
    expect(result.current.durationOptions).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    expect(result.current.klingAssetsSummary).toBe("1 element · Prompt tokens ready");
    expect(result.current.klingGuidanceSummary).toBe("Storyboard + linked refs");
  });
});
