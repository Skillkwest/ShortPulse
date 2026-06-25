/**
 * Regression coverage for shared AI Studio model-selection policy behavior.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FAL_OMNIHUMAN_V15_MODEL_ID,
  FAL_FLUX_2_KLEIN_9B_MODEL_ID,
  FAL_NANO_BANANA_2_EDIT_MODEL_ID,
  FAL_NANO_BANANA_2_MODEL_ID,
  FAL_NANO_BANANA_PRO_EDIT_MODEL_ID,
  FAL_NANO_BANANA_PRO_MODEL_ID,
  FAL_SEEDREAM_45_EDIT_MODEL_ID,
  FAL_SEEDREAM_5_LITE_EDIT_MODEL_ID,
  FAL_SEEDREAM_5_LITE_TEXT_MODEL_ID,
} from "../../../../lib/model-runtime/falModelIds";
import {
  KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../../lib/model-runtime/providerModelIds";
import { OPENAI_GPT_IMAGE_2_MODEL_ID } from "../../../../lib/model-runtime/openAiImage2";
import type { GenerationWorkflowLane } from "../../../../lib/model-runtime/modelCatalog";
import type { ModelOption } from "../../constants";
import {
  CREATE_DEFAULT_MODEL_ID,
  EDIT_DEFAULT_MODEL_ID,
  resolveAiStudioAllowedModelOptions,
  resolveCreateWorkflowStartupModel,
  resolveEditWorkflowStartupModel,
} from "../modelSelectionPolicy";

const createImageOptions: ModelOption[] = [
  { value: FAL_FLUX_2_KLEIN_9B_MODEL_ID, label: "FLUX.2 Lite", mediaType: "image" },
  { value: OPENAI_GPT_IMAGE_2_MODEL_ID, label: "GPT Image 2", mediaType: "image" },
  { value: FAL_NANO_BANANA_2_MODEL_ID, label: "Nano Banana 2", mediaType: "image" },
  { value: FAL_NANO_BANANA_2_EDIT_MODEL_ID, label: "Nano Banana 2 Edit", mediaType: "image" },
  { value: FAL_NANO_BANANA_PRO_MODEL_ID, label: "Nano Banana Pro", mediaType: "image" },
  { value: FAL_NANO_BANANA_PRO_EDIT_MODEL_ID, label: "Nano Banana Pro Edit", mediaType: "image" },
  {
    value: FAL_SEEDREAM_5_LITE_TEXT_MODEL_ID,
    label: "Seedream 5 Lite",
    mediaType: "image",
  },
  {
    value: FAL_SEEDREAM_5_LITE_EDIT_MODEL_ID,
    label: "Seedream 5 Lite Edit",
    mediaType: "image",
  },
  { value: CREATE_DEFAULT_MODEL_ID, label: "Seedream 4.5", mediaType: "image" },
  {
    value: FAL_SEEDREAM_45_EDIT_MODEL_ID,
    label: "Seedream 4.5 Edit",
    mediaType: "image",
  },
  {
    value: KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
    label: "GPT Image 2 Edit (Kie)",
    mediaType: "image",
  },
  {
    value: KIE_VEO_31_FAST_I2V_MODEL_ID,
    label: "Veo 3.1 Fast",
    mediaType: "image-to-video",
  },
];

const videoReferenceOptions: ModelOption[] = [
  {
    value: KIE_VEO_31_FAST_I2V_MODEL_ID,
    label: "Veo 3.1 Fast",
    mediaType: "image-to-video",
  },
  {
    value: KIE_KLING_30_MODEL_ID,
    label: "Kling 3.0",
    mediaType: "image-to-video",
  },
  {
    value: KIE_SEEDANCE_2_MODEL_ID,
    label: "Seedance 2",
    mediaType: "image-to-video",
  },
  {
    value: KIE_SEEDANCE_2_FAST_MODEL_ID,
    label: "Seedance 2 Fast",
    mediaType: "image-to-video",
  },
  {
    value: FAL_OMNIHUMAN_V15_MODEL_ID,
    label: "Internal Lip Sync",
    mediaType: "image-to-video",
  },
];

const textAndImageVideoLanes: GenerationWorkflowLane[] = ["text-to-video", "image-to-video"];
const imageVideoLanes: GenerationWorkflowLane[] = ["image-to-video"];
const lipSyncLanes: GenerationWorkflowLane[] = ["lip-sync"];

const getModelConfig = (id: string) => {
  if (
    id === OPENAI_GPT_IMAGE_2_MODEL_ID ||
    id === FAL_FLUX_2_KLEIN_9B_MODEL_ID ||
    id === FAL_NANO_BANANA_2_MODEL_ID ||
    id === FAL_NANO_BANANA_PRO_MODEL_ID ||
    id === FAL_SEEDREAM_5_LITE_TEXT_MODEL_ID ||
    id === CREATE_DEFAULT_MODEL_ID
  ) {
    return {
      provider: id === OPENAI_GPT_IMAGE_2_MODEL_ID ? "openai" : "fal",
      supportsTextToImage: true,
      supportsImageToImage: id === OPENAI_GPT_IMAGE_2_MODEL_ID,
    };
  }
  if (
    id === FAL_NANO_BANANA_2_EDIT_MODEL_ID ||
    id === FAL_NANO_BANANA_PRO_EDIT_MODEL_ID ||
    id === FAL_SEEDREAM_5_LITE_EDIT_MODEL_ID ||
    id === FAL_SEEDREAM_45_EDIT_MODEL_ID ||
    id === KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID
  ) {
    return {
      provider: id === KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID ? "kie" : "fal",
      supportsTextToImage: false,
      supportsImageToImage: true,
    };
  }
  if (
    id === KIE_VEO_31_FAST_I2V_MODEL_ID ||
    id === KIE_SEEDANCE_2_MODEL_ID ||
    id === KIE_SEEDANCE_2_FAST_MODEL_ID
  ) {
    return {
      provider: "kie",
      supportsTextToImage: false,
      supportsImageToImage: false,
      generationLanes: textAndImageVideoLanes,
    };
  }
  if (id === KIE_KLING_30_MODEL_ID) {
    return {
      provider: "kie",
      supportsTextToImage: false,
      supportsImageToImage: false,
      generationLanes: imageVideoLanes,
    };
  }
  if (id === FAL_OMNIHUMAN_V15_MODEL_ID) {
    return {
      provider: "fal",
      supportsTextToImage: false,
      supportsImageToImage: false,
      generationLanes: lipSyncLanes,
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

    expect(values.has(FAL_FLUX_2_KLEIN_9B_MODEL_ID)).toBe(true);
    expect(values.has(CREATE_DEFAULT_MODEL_ID)).toBe(true);
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

    expect(values.has(FAL_FLUX_2_KLEIN_9B_MODEL_ID)).toBe(true);
    expect(values.has(CREATE_DEFAULT_MODEL_ID)).toBe(true);
    expect(values.has(FAL_NANO_BANANA_2_EDIT_MODEL_ID)).toBe(false);
    expect(values.has(KIE_VEO_31_FAST_I2V_MODEL_ID)).toBe(false);
  });

  it("keeps direct GPT Image 2 in standard Edit while Character Mode uses Kie GPT Image 2 Edit", () => {
    const standardEditValues = new Set(
      resolveAiStudioAllowedModelOptions({
        selectedTool: "edit",
        mode: "image",
        videoReferenceMode: "standard",
        options: createImageOptions,
        getModelConfig,
      }).map((option) => option.value)
    );
    const characterModeValues = new Set(
      resolveAiStudioAllowedModelOptions({
        selectedTool: "create",
        mode: "image",
        videoReferenceMode: "standard",
        isCharacterModeEnabled: true,
        options: createImageOptions,
        getModelConfig,
      }).map((option) => option.value)
    );

    expect(standardEditValues.has(OPENAI_GPT_IMAGE_2_MODEL_ID)).toBe(true);
    expect(standardEditValues.has(KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID)).toBe(true);
    expect(characterModeValues.has(OPENAI_GPT_IMAGE_2_MODEL_ID)).toBe(false);
    expect(characterModeValues.has(KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID)).toBe(true);
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
      FAL_NANO_BANANA_2_EDIT_MODEL_ID,
      FAL_NANO_BANANA_PRO_EDIT_MODEL_ID,
      FAL_SEEDREAM_5_LITE_EDIT_MODEL_ID,
      FAL_SEEDREAM_45_EDIT_MODEL_ID,
      KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
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

  it("keeps saved character-mode edit models during create startup resolution", () => {
    const model = resolveCreateWorkflowStartupModel({
      mode: "image",
      savedModelId: FAL_SEEDREAM_45_EDIT_MODEL_ID,
      isCharacterModeEnabled: true,
      getModelConfig,
    });

    expect(model).toBe(FAL_SEEDREAM_45_EDIT_MODEL_ID);
  });

  it("defaults create startup to the character-mode edit default when enabled", () => {
    const model = resolveCreateWorkflowStartupModel({
      mode: "image",
      savedModelId: null,
      isCharacterModeEnabled: true,
      getModelConfig,
    });

    expect(model).toBe(EDIT_DEFAULT_MODEL_ID);
  });

  it("includes Seedance 2.x in standard video lane model selection by default", () => {
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

    expect(values.has(KIE_SEEDANCE_2_MODEL_ID)).toBe(true);
    expect(values.has(KIE_SEEDANCE_2_FAST_MODEL_ID)).toBe(true);
  });

  it("keeps Seedance 2.x visible when the retired rollout flag is disabled", () => {
    vi.stubEnv("NEXT_PUBLIC_AI_STUDIO_SEEDANCE_2_ENABLED", "false");
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

    expect(values.has(KIE_SEEDANCE_2_MODEL_ID)).toBe(true);
    expect(values.has(KIE_SEEDANCE_2_FAST_MODEL_ID)).toBe(true);
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

  it("includes image-to-video Kie options in create/video model selection", () => {
    const values = new Set(
      resolveAiStudioAllowedModelOptions({
        selectedTool: "create",
        mode: "video",
        videoReferenceMode: "standard",
        options: videoReferenceOptions,
        getModelConfig,
      }).map((option) => option.value)
    );

    expect(values.has(KIE_VEO_31_FAST_I2V_MODEL_ID)).toBe(true);
    expect(values.has(KIE_KLING_30_MODEL_ID)).toBe(true);
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
      KIE_SEEDANCE_2_MODEL_ID,
      KIE_SEEDANCE_2_FAST_MODEL_ID,
    ]);
  });

  it("keeps manually selectable Kling in standard video text-lane selection", () => {
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
      KIE_SEEDANCE_2_MODEL_ID,
      KIE_SEEDANCE_2_FAST_MODEL_ID,
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
      KIE_SEEDANCE_2_MODEL_ID,
      KIE_SEEDANCE_2_FAST_MODEL_ID,
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
      KIE_SEEDANCE_2_MODEL_ID,
      KIE_SEEDANCE_2_FAST_MODEL_ID,
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

  it("allows the hidden Lip Sync model only in Lip Sync mode", () => {
    const standardValues = resolveAiStudioAllowedModelOptions({
      selectedTool: "video",
      mode: "video",
      videoReferenceMode: "standard",
      options: videoReferenceOptions,
      getModelConfig,
    }).map((option) => option.value);
    const motionValues = resolveAiStudioAllowedModelOptions({
      selectedTool: "video",
      mode: "video",
      videoReferenceMode: "motion",
      options: videoReferenceOptions,
      getModelConfig,
    }).map((option) => option.value);
    const lipSyncValues = resolveAiStudioAllowedModelOptions({
      selectedTool: "video",
      mode: "video",
      videoReferenceMode: "lip-sync",
      options: videoReferenceOptions,
      getModelConfig,
    }).map((option) => option.value);

    expect(standardValues).not.toContain(FAL_OMNIHUMAN_V15_MODEL_ID);
    expect(motionValues).not.toContain(FAL_OMNIHUMAN_V15_MODEL_ID);
    expect(lipSyncValues).toEqual([FAL_OMNIHUMAN_V15_MODEL_ID]);
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
      savedModelId: FAL_SEEDREAM_5_LITE_EDIT_MODEL_ID,
      getModelConfig,
    });

    expect(model).toBe(FAL_SEEDREAM_5_LITE_EDIT_MODEL_ID);
  });
});
