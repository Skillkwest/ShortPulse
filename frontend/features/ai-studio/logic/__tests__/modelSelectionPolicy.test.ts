/**
 * Regression coverage for shared AI Studio model-selection policy behavior.
 */
import { describe, expect, it } from "vitest";
import type { ModelOption } from "../../constants";
import {
  CREATE_DEFAULT_MODEL_ID,
  resolveAiStudioAllowedModelOptions,
  resolveCreateWorkflowStartupModel,
} from "../modelSelectionPolicy";

const createImageOptions: ModelOption[] = [
  { value: "fal-ai/flux-2/klein/9b", label: "FLUX.2 Lite", mediaType: "image" },
  { value: "fal-ai/nano-banana-pro", label: "Nano Banana Pro", mediaType: "image" },
  { value: "fal-ai/nano-banana-pro/edit", label: "Nano Banana Pro Edit", mediaType: "image" },
  { value: CREATE_DEFAULT_MODEL_ID, label: "Seedream 4.5", mediaType: "image" },
  {
    value: "fal-ai/bytedance/seedream/v4.5/edit",
    label: "Seedream 4.5 Edit",
    mediaType: "image",
  },
  { value: "fal/flux-2-pro", label: "FLUX.2 Pro", mediaType: "image" },
];

const getModelConfig = (id: string) => {
  if (
    id === "fal-ai/flux-2/klein/9b" ||
    id === "fal-ai/nano-banana-pro" ||
    id === CREATE_DEFAULT_MODEL_ID ||
    id === "fal/flux-2-pro"
  ) {
    return {
      supportsTextToImage: true,
      supportsImageToImage: false,
    };
  }
  if (id === "fal-ai/nano-banana-pro/edit" || id === "fal-ai/bytedance/seedream/v4.5/edit") {
    return {
      supportsTextToImage: false,
      supportsImageToImage: true,
    };
  }

  return null;
};

describe("modelSelectionPolicy", () => {
  it("keeps FLUX.2 Lite available for create/image when character mode is off", () => {
    const values = new Set(
      resolveAiStudioAllowedModelOptions({
        selectedTool: "create",
        mode: "image",
        videoReferenceMode: "standard",
        isCharacterModeEnabled: false,
        options: createImageOptions,
        getModelConfig,
      }).map((option) => option.value)
    );

    expect(values.has("fal-ai/flux-2/klein/9b")).toBe(true);
    expect(values.has("fal/flux-2-pro")).toBe(false);
  });

  it("hides FLUX.2 Lite for create/image while character mode is enabled", () => {
    const values = resolveAiStudioAllowedModelOptions({
      selectedTool: "create",
      mode: "image",
      videoReferenceMode: "standard",
      isCharacterModeEnabled: true,
      options: createImageOptions,
      getModelConfig,
    }).map((option) => option.value);

    expect(values).toEqual(["fal-ai/nano-banana-pro/edit", "fal-ai/bytedance/seedream/v4.5/edit"]);
  });

  it("keeps create startup fallback model precedence unchanged", () => {
    const model = resolveCreateWorkflowStartupModel({
      mode: "image",
      savedModelId: "non-existent-model",
      getModelConfig,
    });

    expect(model).toBe(CREATE_DEFAULT_MODEL_ID);
  });
});
