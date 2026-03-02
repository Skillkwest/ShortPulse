import { describe, expect, it } from "vitest";
import {
  CREATE_CHARACTER_MODE_ALLOWED_MODEL_IDS,
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
    expect(isCreateCharacterModeModel("fal-ai/bytedance/seedream/v4.5/edit")).toBe(true);
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
        currentModelId: "fal/flux-2",
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
        currentModelId: "fal/flux-2/edit",
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
        currentModelId: "fal/flux-2",
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
