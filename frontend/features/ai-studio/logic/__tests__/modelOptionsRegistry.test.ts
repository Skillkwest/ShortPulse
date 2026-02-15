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

  it("model options exclude KEI-backed models for MVP", () => {
    const configById = new Map(listModelConfigs().map((cfg) => [cfg.id, cfg]));
    const keiOptions = modelOptions.filter((option) => {
      const config = configById.get(option.value);
      return config?.provider === "kei" || option.value.toLowerCase().startsWith("kei/");
    });
    expect(keiOptions).toEqual([]);
  });
});
