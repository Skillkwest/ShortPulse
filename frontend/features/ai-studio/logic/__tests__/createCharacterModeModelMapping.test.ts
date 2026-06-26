import { describe, expect, it } from "vitest";
import {
  KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
  KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID,
} from "../../../../lib/model-runtime/providerModelIds";
import {
  CREATE_CHARACTER_MODE_ALLOWED_MODEL_IDS,
  CREATE_CHARACTER_MODE_DEFAULT_MODEL_ID,
  CREATE_DEFAULT_MODEL_ID,
  getCreateCharacterModeAllowedModels,
  isCreateCharacterModeModel,
  mapCreateModelOnCharacterModeToggle,
  resolveCreateCharacterModeSubmitModel,
} from "../createCharacterModeModelMapping";

describe("createCharacterModeModelMapping", () => {
  it("returns the expected create character-mode allowed model list", () => {
    expect(getCreateCharacterModeAllowedModels()).toEqual(CREATE_CHARACTER_MODE_ALLOWED_MODEL_IDS);
  });

  it("detects create character-mode models", () => {
    expect(isCreateCharacterModeModel("removed-openai-image-model")).toBe(false);
    expect(isCreateCharacterModeModel(KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID)).toBe(true);
    expect(isCreateCharacterModeModel("fal-ai/bytedance/seedream/v4.5/edit")).toBe(true);
    expect(isCreateCharacterModeModel("fal-ai/bytedance/seedream/v5/lite/edit")).toBe(true);
    expect(isCreateCharacterModeModel("fal-ai/nano-banana-2/edit")).toBe(true);
    expect(isCreateCharacterModeModel("fal-ai/nano-banana-pro/edit")).toBe(true);
    expect(isCreateCharacterModeModel("fal-ai/bytedance/seedream/v4.5/text-to-image")).toBe(false);
  });

  it("maps paired models when character mode toggles on", () => {
    expect(
      mapCreateModelOnCharacterModeToggle({
        currentModelId: "fal-ai/bytedance/seedream/v4.5/text-to-image",
        isCharacterModeEnabled: true,
      })
    ).toBe("fal-ai/bytedance/seedream/v4.5/edit");
    expect(
      mapCreateModelOnCharacterModeToggle({
        currentModelId: "fal-ai/bytedance/seedream/v5/lite/text-to-image",
        isCharacterModeEnabled: true,
      })
    ).toBe("fal-ai/bytedance/seedream/v5/lite/edit");
    expect(
      mapCreateModelOnCharacterModeToggle({
        currentModelId: "fal-ai/nano-banana-2",
        isCharacterModeEnabled: true,
      })
    ).toBe("fal-ai/nano-banana-2/edit");
    expect(
      mapCreateModelOnCharacterModeToggle({
        currentModelId: "fal-ai/nano-banana-pro",
        isCharacterModeEnabled: true,
      })
    ).toBe("fal-ai/nano-banana-pro/edit");
    expect(
      mapCreateModelOnCharacterModeToggle({
        currentModelId: "removed-openai-image-model",
        isCharacterModeEnabled: true,
      })
    ).toBe(CREATE_CHARACTER_MODE_DEFAULT_MODEL_ID);
    expect(
      mapCreateModelOnCharacterModeToggle({
        currentModelId: "legacy/removed-model",
        isCharacterModeEnabled: true,
      })
    ).toBe("fal-ai/bytedance/seedream/v4.5/edit");
  });

  it("maps paired models when character mode toggles off", () => {
    expect(
      mapCreateModelOnCharacterModeToggle({
        currentModelId: "fal-ai/bytedance/seedream/v4.5/edit",
        isCharacterModeEnabled: false,
      })
    ).toBe("fal-ai/bytedance/seedream/v4.5/text-to-image");
    expect(
      mapCreateModelOnCharacterModeToggle({
        currentModelId: "fal-ai/bytedance/seedream/v5/lite/edit",
        isCharacterModeEnabled: false,
      })
    ).toBe("fal-ai/bytedance/seedream/v5/lite/text-to-image");
    expect(
      mapCreateModelOnCharacterModeToggle({
        currentModelId: "fal-ai/nano-banana-2/edit",
        isCharacterModeEnabled: false,
      })
    ).toBe("fal-ai/nano-banana-2");
    expect(
      mapCreateModelOnCharacterModeToggle({
        currentModelId: "fal-ai/nano-banana-pro/edit",
        isCharacterModeEnabled: false,
      })
    ).toBe("fal-ai/nano-banana-pro");
    expect(
      mapCreateModelOnCharacterModeToggle({
        currentModelId: "removed-openai-image-model",
        isCharacterModeEnabled: false,
      })
    ).toBe(CREATE_DEFAULT_MODEL_ID);
    expect(
      mapCreateModelOnCharacterModeToggle({
        currentModelId: KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
        isCharacterModeEnabled: false,
      })
    ).toBe(KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID);
    expect(
      mapCreateModelOnCharacterModeToggle({
        currentModelId: "legacy/removed-model/edit",
        isCharacterModeEnabled: false,
      })
    ).toBe(CREATE_DEFAULT_MODEL_ID);
  });

  it("coerces create submit model to paired edit model while character mode is enabled", () => {
    expect(
      resolveCreateCharacterModeSubmitModel({
        currentModelId: "fal-ai/nano-banana-2",
        isCharacterModeEnabled: true,
      })
    ).toBe("fal-ai/nano-banana-2/edit");
    expect(
      resolveCreateCharacterModeSubmitModel({
        currentModelId: "fal-ai/nano-banana-pro",
        isCharacterModeEnabled: true,
      })
    ).toBe("fal-ai/nano-banana-pro/edit");
    expect(
      resolveCreateCharacterModeSubmitModel({
        currentModelId: "fal-ai/bytedance/seedream/v4.5/edit",
        isCharacterModeEnabled: true,
      })
    ).toBe("fal-ai/bytedance/seedream/v4.5/edit");
    expect(
      resolveCreateCharacterModeSubmitModel({
        currentModelId: "fal-ai/bytedance/seedream/v5/lite/text-to-image",
        isCharacterModeEnabled: true,
      })
    ).toBe("fal-ai/bytedance/seedream/v5/lite/edit");
    expect(
      resolveCreateCharacterModeSubmitModel({
        currentModelId: "removed-openai-image-model",
        isCharacterModeEnabled: true,
      })
    ).toBe(CREATE_CHARACTER_MODE_DEFAULT_MODEL_ID);
    expect(
      resolveCreateCharacterModeSubmitModel({
        currentModelId: "legacy/removed-model",
        isCharacterModeEnabled: true,
      })
    ).toBe("fal-ai/bytedance/seedream/v4.5/edit");
    expect(
      resolveCreateCharacterModeSubmitModel({
        currentModelId: null,
        isCharacterModeEnabled: true,
      })
    ).toBe("fal-ai/bytedance/seedream/v4.5/edit");
  });

  it("keeps submit model unchanged while character mode is disabled", () => {
    expect(
      resolveCreateCharacterModeSubmitModel({
        currentModelId: "fal-ai/nano-banana-pro",
        isCharacterModeEnabled: false,
      })
    ).toBe("fal-ai/nano-banana-pro");
  });
});
