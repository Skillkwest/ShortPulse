import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { listModelConfigs } from "../modelRegistry";
import { aspectOptions } from "../../constants";
import {
  getModelApiContract,
  resolveEffectiveAspectForModel,
  listModelApiContracts,
} from "../modelApiContracts";
import { KIE_VEO_31_FAST_I2V_MODEL_ID } from "../../../../lib/model-runtime/providerModelIds";
import { resolveSubmissionHandlerRoute } from "../../hooks/taskSubmission/routing";

describe("model API contracts", () => {
  it("provides a contract entry for every registry model", () => {
    const missing = listModelConfigs()
      .map((config) => config.id)
      .filter((id) => !getModelApiContract(id));

    expect(missing).toEqual([]);
  });

  it("uses the expected catalog audit stamps", () => {
    const contracts = listModelApiContracts();
    expect(contracts.length).toBeGreaterThan(0);
    const verifiedAtValues = new Set(contracts.map((contract) => contract.verifiedAt));
    expect([...verifiedAtValues].sort()).toEqual([
      "2026-04-14",
      "2026-06-04",
      "2026-06-08",
      "2026-06-14",
      "2026-06-16",
      "2026-06-19",
      "2026-06-22",
    ]);
  });

  it("clamps unsupported aspects to model defaults", () => {
    expect(resolveEffectiveAspectForModel(KIE_VEO_31_FAST_I2V_MODEL_ID, "1:1", "16:9")).toBe(
      "16:9"
    );
  });

  it("keeps supported aspects unchanged", () => {
    expect(
      resolveEffectiveAspectForModel("fal-ai/bytedance/seedream/v4.5/text-to-image", "5:4", "1:1")
    ).toBe("5:4");
  });

  it("keeps UI aspect values mapped to at least one model contract", () => {
    const contractAspects = new Set(
      listModelApiContracts().flatMap((contract) => contract.allowedAspects)
    );
    const unsupportedUiAspects = aspectOptions
      .map((option) => option.value)
      .filter((aspect) => !contractAspects.has(aspect));

    expect(unsupportedUiAspects).toEqual([]);
  });

  it("omits deprecated create aspect presets from the global UI options", () => {
    const uiAspects = new Set(aspectOptions.map((option) => option.value));
    ["21:9", "3:4", "2:3", "4:3", "3:2"].forEach((aspect) => {
      expect(uiAspects.has(aspect)).toBe(false);
    });
  });

  it("keeps default-route model exceptions explicit for non-text generation models", () => {
    const knownDefaultRouteModelIds = new Set([
      "fal-ai/bytedance/seedream/v4.5/text-to-image",
      "fal-ai/bytedance/seedream/v5/lite/text-to-image",
      "fal-ai/nano-banana-2",
      "fal-ai/nano-banana-2",
      "fal-ai/nano-banana-pro",
    ]);
    const unexpectedDefaults = listModelConfigs()
      .filter((config) => config.mediaType !== "text" && config.provider === "fal")
      .map((config) => config.id)
      .filter(
        (modelId) =>
          resolveSubmissionHandlerRoute(modelId) === "default" &&
          !knownDefaultRouteModelIds.has(modelId)
      );

    expect(unexpectedDefaults).toEqual([]);
  });

  it("keeps generation-capable catalog models registered with workflow routing metadata", () => {
    const missingWorkflowMetadata = listModelConfigs()
      .filter((config) => config.mediaType !== "text")
      .filter((config) => config.lifecycle === "active")
      .filter(
        (config) =>
          !config.generationLanes?.length ||
          !config.executionMode ||
          !config.submitHandler ||
          typeof config.gridEligible !== "boolean"
      )
      .map((config) => config.id);

    expect(missingWorkflowMetadata).toEqual([]);
  });

  it("keeps queued models wired to explicit unique API route slugs", () => {
    const queuedModels = listModelConfigs().filter((config) => config.executionMode === "queued");
    const missingRouteSlugs = queuedModels
      .filter((config) => !config.apiRouteSlug)
      .map((config) => config.id);
    const routeSlugs = queuedModels
      .map((config) => config.apiRouteSlug)
      .filter((slug): slug is string => Boolean(slug));

    expect(missingRouteSlugs).toEqual([]);
    expect(new Set(routeSlugs).size).toBe(routeSlugs.length);
  });

  it("keeps queued model route slugs backed by concrete submit and status routes", () => {
    const missingRoutes = listModelConfigs()
      .filter((config) => config.executionMode === "queued")
      .flatMap((config) => {
        const routeSlug = config.apiRouteSlug;
        if (!routeSlug) return [`${config.id}: missing apiRouteSlug`];
        const routeFiles = [
          path.join(process.cwd(), "pages/api/fal", `${routeSlug}-submit.ts`),
          path.join(process.cwd(), "pages/api/fal", `${routeSlug}-status.ts`),
        ];
        return routeFiles
          .filter((routeFile) => !existsSync(routeFile))
          .map((routeFile) => `${config.id}: ${path.relative(process.cwd(), routeFile)}`);
      });

    expect(missingRoutes).toEqual([]);
  });
});
