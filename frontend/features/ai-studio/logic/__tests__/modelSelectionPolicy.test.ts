/**
 * Regression coverage for shared AI Studio model-selection policy behavior.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_15_PRO_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../../lib/model-runtime/providerModelIds";
import type { ModelOption } from "../../constants";
import {
  CREATE_DEFAULT_MODEL_ID,
  EDIT_DEFAULT_MODEL_ID,
  resolveAiStudioAllowedModelOptions,
  resolveCreateWorkflowStartupModel,
  resolveEditWorkflowStartupModel,
} from "../modelSelectionPolicy";

const createImageOptions: ModelOption[] = [
  { value: "fal-ai/flux-2/klein/9b", label: "FLUX.2 Lite", mediaType: "image" },
  { value: "fal-ai/nano-banana-2", label: "Nano Banana 2", mediaType: "image" },
  { value: "fal-ai/nano-banana-2/edit", label: "Nano Banana 2 Edit", mediaType: "image" },
  { value: "fal-ai/nano-banana-pro", label: "Nano Banana Pro", mediaType: "image" },
  { value: "fal-ai/nano-banana-pro/edit", label: "Nano Banana Pro Edit", mediaType: "image" },
  {
    value: "fal-ai/bytedance/seedream/v5/lite/text-to-image",
    label: "Seedream 5 Lite",
    mediaType: "image",
  },
  {
    value: "fal-ai/bytedance/seedream/v5/lite/edit",
    label: "Seedream 5 Lite Edit",
    mediaType: "image",
  },
  { value: CREATE_DEFAULT_MODEL_ID, label: "Seedream 4.5", mediaType: "image" },
  {
    value: "fal-ai/bytedance/seedream/v4.5/edit",
    label: "Seedream 4.5 Edit",
    mediaType: "image",
  },
  { value: "fal/flux-2-pro", label: "FLUX.2 Pro", mediaType: "image" },
  {
    value: KIE_VEO_31_FAST_I2V_MODEL_ID,
    label: "Veo 3.1 Fast I2V (Kie)",
    mediaType: "image-to-video",
  },
];

const videoReferenceOptions: ModelOption[] = [
  {
    value: "fal-ai/kling-video/v3/pro/text-to-video",
    label: "Kling 3.0",
    mediaType: "video",
  },
  {
    value: "fal-ai/veo3.1/first-last-frame-to-video",
    label: "Google Veo 3.1 (First/Last Frame)",
    mediaType: "image-to-video",
  },
  {
    value: "fal-ai/veo3.1/image-to-video",
    label: "Google Veo 3.1",
    mediaType: "image-to-video",
  },
  {
    value: "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
    label: "Seedance 1.5 Pro",
    mediaType: "image-to-video",
  },
  {
    value: "fal-ai/kling-video/v3/pro/image-to-video",
    label: "Kling 3.0",
    mediaType: "image-to-video",
  },
  {
    value: "fal-ai/bytedance/seedance/v1.5/pro/text-to-video",
    label: "Seedance 1.5 Pro",
    mediaType: "video",
  },
  {
    value: "fal-ai/veo3.1",
    label: "Google Veo 3.1",
    mediaType: "video",
  },
  {
    value: KIE_VEO_31_FAST_I2V_MODEL_ID,
    label: "Veo 3.1 Fast I2V (Kie)",
    mediaType: "image-to-video",
  },
  {
    value: KIE_KLING_30_MODEL_ID,
    label: "Kling 3.0 (Kie)",
    mediaType: "image-to-video",
  },
  {
    value: KIE_SEEDANCE_15_PRO_MODEL_ID,
    label: "Seedance 1.5 Pro (Kie)",
    mediaType: "image-to-video",
  },
  {
    value: KIE_SEEDANCE_2_MODEL_ID,
    label: "Seedance 2.0 (Kie)",
    mediaType: "image-to-video",
  },
  {
    value: KIE_SEEDANCE_2_FAST_MODEL_ID,
    label: "Seedance 2.0 Fast (Kie)",
    mediaType: "image-to-video",
  },
];

const getModelConfig = (id: string) => {
  if (
    id === "fal-ai/flux-2/klein/9b" ||
    id === "fal-ai/nano-banana-2" ||
    id === "fal-ai/nano-banana-pro" ||
    id === "fal-ai/bytedance/seedream/v5/lite/text-to-image" ||
    id === CREATE_DEFAULT_MODEL_ID ||
    id === "fal/flux-2-pro"
  ) {
    return {
      provider: "fal",
      supportsTextToImage: true,
      supportsImageToImage: false,
    };
  }
  if (
    id === "fal-ai/nano-banana-2/edit" ||
    id === "fal-ai/nano-banana-pro/edit" ||
    id === "fal-ai/bytedance/seedream/v5/lite/edit" ||
    id === "fal-ai/bytedance/seedream/v4.5/edit"
  ) {
    return {
      provider: "fal",
      supportsTextToImage: false,
      supportsImageToImage: true,
    };
  }
  if (
    id === KIE_VEO_31_FAST_I2V_MODEL_ID ||
    id === KIE_KLING_30_MODEL_ID ||
    id === KIE_SEEDANCE_15_PRO_MODEL_ID ||
    id === KIE_SEEDANCE_2_MODEL_ID ||
    id === KIE_SEEDANCE_2_FAST_MODEL_ID
  ) {
    return {
      provider: "kie",
      supportsTextToImage: false,
      supportsImageToImage: false,
    };
  }

  return null;
};

describe("modelSelectionPolicy", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

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

  it("uses create/image filtering in create/text mode instead of returning the full catalog", () => {
    const values = new Set(
      resolveAiStudioAllowedModelOptions({
        selectedTool: "create",
        mode: "text",
        videoReferenceMode: "standard",
        options: createImageOptions,
        getModelConfig,
      }).map((option) => option.value)
    );

    expect(values.has("fal-ai/flux-2/klein/9b")).toBe(true);
    expect(values.has(CREATE_DEFAULT_MODEL_ID)).toBe(true);
    expect(values.has("fal-ai/nano-banana-2/edit")).toBe(false);
    expect(values.has(KIE_VEO_31_FAST_I2V_MODEL_ID)).toBe(false);
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

    expect(values).toEqual([
      "fal-ai/nano-banana-2/edit",
      "fal-ai/nano-banana-pro/edit",
      "fal-ai/bytedance/seedream/v5/lite/edit",
      "fal-ai/bytedance/seedream/v4.5/edit",
    ]);
  });

  it("keeps create startup fallback model precedence unchanged", () => {
    const model = resolveCreateWorkflowStartupModel({
      mode: "image",
      savedModelId: "non-existent-model",
      getModelConfig,
    });

    expect(model).toBe(CREATE_DEFAULT_MODEL_ID);
  });

  it("quarantines Seedance 2.x from standard video lane model selection by default", () => {
    const values = new Set(
      resolveAiStudioAllowedModelOptions({
        selectedTool: "video",
        mode: "video",
        videoReferenceMode: "standard",
        resolvedVideoLane: "text",
        options: videoReferenceOptions,
        getModelConfig,
      }).map((option) => option.value)
    );

    expect(values.has(KIE_SEEDANCE_15_PRO_MODEL_ID)).toBe(true);
    expect(values.has(KIE_SEEDANCE_2_MODEL_ID)).toBe(false);
    expect(values.has(KIE_SEEDANCE_2_FAST_MODEL_ID)).toBe(false);
  });

  it("defaults create startup to Seedream in text mode when saved model is missing", () => {
    const model = resolveCreateWorkflowStartupModel({
      mode: "text",
      savedModelId: "non-existent-model",
      getModelConfig,
    });

    expect(model).toBe(CREATE_DEFAULT_MODEL_ID);
  });

  it("excludes image-to-video Kie options from create/image model selection", () => {
    const values = new Set(
      resolveAiStudioAllowedModelOptions({
        selectedTool: "create",
        mode: "image",
        videoReferenceMode: "standard",
        options: createImageOptions,
        getModelConfig,
      }).map((option) => option.value)
    );

    expect(values.has(KIE_VEO_31_FAST_I2V_MODEL_ID)).toBe(false);
  });

  it("ignores saved kie model ids for startup fallback selection", () => {
    const model = resolveCreateWorkflowStartupModel({
      mode: "image",
      savedModelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
      getModelConfig,
    });

    expect(model).toBe(CREATE_DEFAULT_MODEL_ID);
  });

  it("keeps standard video selection Kie-only", () => {
    const values = resolveAiStudioAllowedModelOptions({
      selectedTool: "video",
      mode: "video",
      videoReferenceMode: "standard",
      options: videoReferenceOptions,
      getModelConfig,
    }).map((option) => option.value);

    expect(values).toEqual([
      KIE_VEO_31_FAST_I2V_MODEL_ID,
      KIE_KLING_30_MODEL_ID,
      KIE_SEEDANCE_15_PRO_MODEL_ID,
    ]);
  });

  it("narrows standard video selection to text-capable models when the resolved lane is text", () => {
    const values = resolveAiStudioAllowedModelOptions({
      selectedTool: "video",
      mode: "video",
      videoReferenceMode: "standard",
      resolvedVideoLane: "text",
      options: videoReferenceOptions,
      getModelConfig,
    }).map((option) => option.value);

    expect(values).toEqual([
      KIE_VEO_31_FAST_I2V_MODEL_ID,
      KIE_KLING_30_MODEL_ID,
      KIE_SEEDANCE_15_PRO_MODEL_ID,
    ]);
  });

  it("narrows standard video selection to single-image models when the resolved lane is single-image", () => {
    const values = resolveAiStudioAllowedModelOptions({
      selectedTool: "video",
      mode: "video",
      videoReferenceMode: "standard",
      resolvedVideoLane: "single-image",
      options: videoReferenceOptions,
      getModelConfig,
    }).map((option) => option.value);

    expect(values).toEqual([
      KIE_VEO_31_FAST_I2V_MODEL_ID,
      KIE_KLING_30_MODEL_ID,
      KIE_SEEDANCE_15_PRO_MODEL_ID,
    ]);
  });

  it("keeps first-last video selection on Kie-only compatible models", () => {
    const values = resolveAiStudioAllowedModelOptions({
      selectedTool: "video",
      mode: "video",
      videoReferenceMode: "standard",
      resolvedVideoLane: "first-last",
      options: videoReferenceOptions,
      getModelConfig,
    }).map((option) => option.value);

    expect(values).toEqual([
      KIE_VEO_31_FAST_I2V_MODEL_ID,
      KIE_KLING_30_MODEL_ID,
      KIE_SEEDANCE_15_PRO_MODEL_ID,
    ]);
  });

  it("keeps keyframes mode restricted to Kie Veo", () => {
    const values = resolveAiStudioAllowedModelOptions({
      selectedTool: "video",
      mode: "video",
      videoReferenceMode: "keyframes",
      options: videoReferenceOptions,
      getModelConfig,
    }).map((option) => option.value);

    expect(values).toEqual([KIE_VEO_31_FAST_I2V_MODEL_ID]);
  });

  it("locks motion mode to Kie Kling", () => {
    const values = resolveAiStudioAllowedModelOptions({
      selectedTool: "video",
      mode: "video",
      videoReferenceMode: "motion",
      options: videoReferenceOptions,
      getModelConfig,
    }).map((option) => option.value);

    expect(values).toEqual([KIE_KLING_30_MODEL_ID]);
  });

  it("keeps edit startup fallback model precedence unchanged", () => {
    const model = resolveEditWorkflowStartupModel({
      savedModelId: "non-existent-edit-model",
      getModelConfig,
    });

    expect(model).toBe(EDIT_DEFAULT_MODEL_ID);
  });

  it("preserves valid edit saved model on startup", () => {
    const model = resolveEditWorkflowStartupModel({
      savedModelId: "fal-ai/bytedance/seedream/v5/lite/edit",
      getModelConfig,
    });

    expect(model).toBe("fal-ai/bytedance/seedream/v5/lite/edit");
  });
});
