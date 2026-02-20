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
});
