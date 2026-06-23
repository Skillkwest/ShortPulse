import { describe, expect, it } from "vitest";
import { resolveAiStudioErrorPresentation } from "../errorPresentation";
import type { StudioOutput } from "../../types";
import { AI_STUDIO_ERROR_SCENARIOS } from "../../testing/errorScenarioFixtures";

const createFailedOutput = (overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id: "out-error",
  prompt: "Make a cinematic product shot",
  mode: "image",
  aspect: "1:1",
  model: "Fal FLUX",
  status: "ready",
  timestamp: "Failed",
  taskState: "fail",
  ...overrides,
});

describe("resolveAiStudioErrorPresentation", () => {
  it.each(AI_STUDIO_ERROR_SCENARIOS)(
    "normalizes $label across card, banner, and detail surfaces",
    (scenario) => {
      const presentation = resolveAiStudioErrorPresentation(scenario.output);

      expect(presentation.category).toBe(scenario.expectedCategory);
      expect(presentation.compactMessage).toContain(
        scenario.expectedCompactText ?? scenario.expectedCardText
      );
      expect(presentation.bannerMessage).toContain(scenario.expectedBannerText);
      expect(presentation.technicalDetail).toContain(scenario.expectedDetailText);
      expect(presentation.rawPayload).toEqual(scenario.output.errorPayload ?? null);
      for (const hiddenProbe of scenario.hiddenCardProbes) {
        expect(presentation.compactMessage).not.toContain(hiddenProbe);
      }
    }
  );

  it("uses compact copy for grid surfaces while preserving full technical detail", () => {
    const providerPayload = {
      error: {
        message:
          "Provider rejected image_urls[0]: signed URL expired while downloading the source file.",
        request_id: "req_provider_123",
      },
    };

    const presentation = resolveAiStudioErrorPresentation(
      createFailedOutput({
        errorMessage: "Generation failed",
        errorMessageShort: "Generation failed",
        errorDetail:
          "Provider rejected image_urls[0]: signed URL expired while downloading the source file. Re-select the reference and retry.",
        errorPayload: providerPayload,
      })
    );

    expect(presentation.compactMessage).not.toContain("request_id");
    expect(presentation.technicalDetail).toContain("signed URL expired");
    expect(presentation.rawPayload).toEqual(providerPayload);
  });

  it("normalizes safety failures consistently", () => {
    const presentation = resolveAiStudioErrorPresentation(
      createFailedOutput({
        errorMessage: "Your request was blocked by the safety system.",
        errorDetail: "Your request was blocked by the safety system. Reason: explicit.",
      })
    );

    expect(presentation.category).toBe("content_policy");
    expect(presentation.compactMessage).toBe("Content not allowed");
    expect(presentation.bannerMessage).toContain("explicit or unsafe content");
  });

  it("uses short neutral card copy for provider API key failures", () => {
    const presentation = resolveAiStudioErrorPresentation(
      createFailedOutput({
        model: "GPT Image 2 (Kie)",
        modelId: "kie-ai/gpt-image-2-text-to-image",
        errorMessage: "Generation failed",
        errorMessageShort: "Unauthorized - Authentication failed. Please verify your API key.",
        errorDetail: "Unauthorized - Authentication failed. Please verify your API key.",
      })
    );

    expect(presentation.compactMessage).toBe("Missing API key.");
    expect(presentation.bannerMessage).toBe("Missing API key.");
    expect(presentation.compactMessage).not.toMatch(
      /Kie|Authentication failed|verify your API key/i
    );
  });
});
