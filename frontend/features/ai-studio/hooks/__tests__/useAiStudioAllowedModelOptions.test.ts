import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
});
