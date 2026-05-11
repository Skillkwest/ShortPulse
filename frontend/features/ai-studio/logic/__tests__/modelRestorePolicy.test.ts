import { beforeEach, describe, expect, it, vi } from "vitest";
import { KIE_SEEDANCE_15_PRO_MODEL_ID } from "../../../../lib/model-runtime/providerModelIds";
import { normalizeAiStudioRestoredModelId } from "../modelRestorePolicy";

describe("modelRestorePolicy", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps active model ids unchanged", () => {
    expect(normalizeAiStudioRestoredModelId("fal-ai/bytedance/seedream/v4.5/text-to-image")).toBe(
      "fal-ai/bytedance/seedream/v4.5/text-to-image"
    );
  });

  it("preserves current Seedance UI fallback behavior", () => {
    vi.stubEnv("NEXT_PUBLIC_AI_STUDIO_SEEDANCE_2_ENABLED", "false");

    expect(normalizeAiStudioRestoredModelId("kie-ai/seedance-2")).toBe(
      KIE_SEEDANCE_15_PRO_MODEL_ID
    );
    expect(normalizeAiStudioRestoredModelId("kie-ai/seedance-2-fast")).toBe(
      KIE_SEEDANCE_15_PRO_MODEL_ID
    );
  });

  it("follows replacementModelId for non-active restored models", async () => {
    vi.resetModules();
    vi.doMock("../../../../lib/model-runtime/modelCatalog", () => ({
      getModelCatalogEntry: (modelId: string) => {
        if (modelId === "legacy-model") {
          return {
            modelId: "legacy-model",
            lifecycle: "deprecated",
          };
        }
        if (modelId === "replacement-model") {
          return {
            modelId: "replacement-model",
            lifecycle: "active",
          };
        }
        return null;
      },
      getReplacementModelId: (modelId: string) =>
        modelId === "legacy-model" ? "replacement-model" : null,
    }));
    vi.doMock("../seedance2Availability", () => ({
      normalizeSeedance2UiModelId: (modelId: string | null | undefined) => modelId,
    }));

    const { normalizeAiStudioRestoredModelId: normalizeWithReplacement } =
      await import("../modelRestorePolicy");

    expect(normalizeWithReplacement("legacy-model")).toBe("replacement-model");

    vi.resetModules();
    vi.doUnmock("../../../../lib/model-runtime/modelCatalog");
    vi.doUnmock("../seedance2Availability");
  });
});
