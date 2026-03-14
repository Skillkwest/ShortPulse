import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AspectOption } from "../../types";
import { useReferencePropertiesDerivedState } from "../useReferencePropertiesDerivedState";

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
  it("hides resolution options for models without declared resolution support", () => {
    const { result } = renderHook(() =>
      useReferencePropertiesDerivedState({
        ...baseArgs,
        modelId: "fal-ai/kling-video/v3/pro/image-to-video",
      })
    );

    expect(result.current.resolutionOptions).toEqual([]);
  });

  it("returns declared resolution options for models that provide them", () => {
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
});
