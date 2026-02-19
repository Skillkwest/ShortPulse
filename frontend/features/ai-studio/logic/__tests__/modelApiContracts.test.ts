import { describe, expect, it } from "vitest";
import { listModelConfigs } from "../modelRegistry";
import { aspectOptions } from "../../constants";
import {
  getModelApiContract,
  resolveEffectiveAspectForModel,
  listModelApiContracts,
} from "../modelApiContracts";
import { resolveSubmissionHandlerRoute } from "../../hooks/taskSubmission/routing";

describe("model API contracts", () => {
  it("provides a contract entry for every registry model", () => {
    const missing = listModelConfigs()
      .map((config) => config.id)
      .filter((id) => !getModelApiContract(id));

    expect(missing).toEqual([]);
  });

  it("is version-stamped with the current audit date", () => {
    const contracts = listModelApiContracts();
    expect(contracts.length).toBeGreaterThan(0);
    contracts.forEach((contract) => {
      expect(contract.verifiedAt).toBe("2026-02-17");
    });
  });

  it("clamps unsupported aspects to model defaults", () => {
    expect(resolveEffectiveAspectForModel("fal-ai/veo3.1", "1:1", "16:9")).toBe("16:9");
  });

  it("keeps supported aspects unchanged", () => {
    expect(
      resolveEffectiveAspectForModel("fal-ai/bytedance/seedream/v4.5/text-to-image", "5:4", "1:1")
    ).toBe("5:4");
  });

  it("keeps contract aspect values visible in global UI aspect options", () => {
    const uiAspects = new Set(aspectOptions.map((option) => option.value));
    const missing = listModelApiContracts()
      .flatMap((contract) => contract.allowedAspects)
      .filter((aspect, index, all) => all.indexOf(aspect) === index)
      .filter((aspect) => !uiAspects.has(aspect));

    expect(missing).toEqual([]);
  });

  it("keeps default-route model exceptions explicit for non-text generation models", () => {
    const knownDefaultRouteModelIds = new Set([
      "fal-ai/bytedance/seedream/v4.5/text-to-image",
      "fal-ai/nano-banana",
      "fal-ai/nano-banana-pro",
    ]);
    const unexpectedDefaults = listModelConfigs()
      .filter((config) => config.mediaType !== "text")
      .map((config) => config.id)
      .filter(
        (modelId) =>
          resolveSubmissionHandlerRoute(modelId) === "default" &&
          !knownDefaultRouteModelIds.has(modelId)
      );

    expect(unexpectedDefaults).toEqual([]);
  });
});
