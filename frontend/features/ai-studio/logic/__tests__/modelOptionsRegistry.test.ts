import { listModelConfigs } from "../modelRegistry";
import { modelOptions } from "../../constants";

describe("model options vs registry", () => {
  it("every model option exists in the registry", () => {
    const registryIds = new Set(listModelConfigs().map((cfg) => cfg.id));
    const missing: string[] = [];
    modelOptions.forEach((opt) => {
      if (!registryIds.has(opt.value)) {
        missing.push(opt.value);
      }
    });
    if (missing.length) {
      throw new Error(`Model options missing in registry: ${missing.join(", ")}`);
    }
  });

  it("model options exclude retired-provider model ids", () => {
    const retiredProviderOptions = modelOptions.filter((option) =>
      option.value.toLowerCase().startsWith("kei/")
    );
    expect(retiredProviderOptions).toEqual([]);
  });

  it("Kie model options, when present, map only to Kie provider configs", () => {
    const registryById = new Map(listModelConfigs().map((cfg) => [cfg.id, cfg]));
    const kieOptions = modelOptions.filter((option) => {
      const cfg = registryById.get(option.value);
      return cfg?.provider === "kie";
    });
    kieOptions.forEach((option) => {
      const cfg = registryById.get(option.value);
      expect(cfg?.provider).toBe("kie");
    });
  });

  it("excludes legacy Fal Kling 3.0 option ids from AI Studio constants", () => {
    const optionIds = new Set(modelOptions.map((option) => option.value));
    expect(optionIds.has("fal-ai/kling-video/v3/pro/text-to-video")).toBe(false);
    expect(optionIds.has("fal-ai/kling-video/v3/pro/image-to-video")).toBe(false);
  });

  it("excludes legacy Fal Veo 3.1 option ids from AI Studio constants", () => {
    const optionIds = new Set(modelOptions.map((option) => option.value));
    expect(optionIds.has("fal-ai/veo3.1")).toBe(false);
    expect(optionIds.has("fal-ai/veo3.1/image-to-video")).toBe(false);
    expect(optionIds.has("fal-ai/veo3.1/first-last-frame-to-video")).toBe(false);
  });

  it("excludes non-Kie Fal video option ids from AI Studio constants", () => {
    const optionIds = new Set(modelOptions.map((option) => option.value));
    expect(optionIds.has("fal-ai/bytedance/seedance/v1.5/pro/text-to-video")).toBe(false);
    expect(optionIds.has("fal-ai/bytedance/seedance/v1.5/pro/image-to-video")).toBe(false);
  });
});
