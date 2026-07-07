import { describe, expect, it } from "vitest";
import { resolveAiStudioErrorPresentation } from "../errorPresentation";
import type { StudioOutput } from "../../types";
import { AI_STUDIO_ERROR_SCENARIOS } from "../../testing/errorScenarioFixtures";

const TECHNICAL_DETAIL_LEAK_PATTERN =
  /\{|"loc"|request[_ ]?id|req_|image_urls|non-json|provider status route|upstream provider|provider-side/i;

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
      expect(presentation.compactMessage.length).toBeLessThanOrEqual(35);
      expect(presentation.compactMessage).toContain(
        scenario.expectedCompactText ?? scenario.expectedCardText
      );
      expect(presentation.bannerMessage).toContain(scenario.expectedBannerText);
      expect(presentation.technicalDetail).toContain(scenario.expectedDetailText);
      expect(presentation.technicalDetail).not.toMatch(TECHNICAL_DETAIL_LEAK_PATTERN);
      expect(presentation.rawPayload).toEqual(scenario.output.errorPayload ?? null);
      for (const hiddenProbe of scenario.hiddenCardProbes) {
        expect(presentation.compactMessage).not.toContain(hiddenProbe);
      }
    }
  );

  it("uses compact copy for grid surfaces while preserving customer-facing detail", () => {
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
    expect(presentation.technicalDetail).toBe(
      "The reference file expired. Re-add the reference and try again."
    );
    expect(presentation.technicalDetail).not.toMatch(TECHNICAL_DETAIL_LEAK_PATTERN);
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

  it("classifies max active generation messages as admission-limit warnings", () => {
    const message =
      "You've reached your max active generations. Wait for one to finish, then try again.";
    const presentation = resolveAiStudioErrorPresentation(
      createFailedOutput({
        errorMessage: message,
        errorMessageShort: message,
        errorDetail: message,
      })
    );

    expect(presentation.category).toBe("admission_limit");
    expect(presentation.compactMessage).toBe("Max active generations reached.");
    expect(presentation.bannerMessage).toBe(message);
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

  it("uses concise card copy for non-JSON status responses while preserving plain detail", () => {
    const presentation = resolveAiStudioErrorPresentation(
      createFailedOutput({
        model: "Seedance 2",
        modelId: "kie-ai/seedance-2",
        errorMessage: "Seedance 2 returned non-JSON status response",
        errorMessageShort: "Seedance 2 returned non-JSON status response",
        errorDetail: "Seedance 2 returned non-JSON status response",
      })
    );

    expect(presentation.compactMessage).toBe("Status check failed.");
    expect(presentation.bannerMessage).toBe(
      "The generation status check failed. Please try again."
    );
    expect(presentation.technicalDetail).toBe(
      "The generation status check failed. Please try again."
    );
    expect(presentation.technicalDetail).not.toMatch(TECHNICAL_DETAIL_LEAK_PATTERN);
  });

  it("condenses specific short-message failures for card space while preserving plain detail", () => {
    const presentation = resolveAiStudioErrorPresentation(
      createFailedOutput({
        model: "Seedance 2",
        modelId: "kie-ai/seedance-2",
        errorMessage: "Generation failed",
        errorMessageShort:
          "Seedance 2 returned an upstream service error while checking generation status.",
        errorDetail:
          "Seedance 2 returned an upstream service error while checking generation status. The provider status route returned 502 after the request was accepted.",
      })
    );

    expect(presentation.compactMessage).toBe("Service issue.");
    expect(presentation.compactMessage.length).toBeLessThanOrEqual(35);
    expect(presentation.technicalDetail).toContain("temporary service issue");
    expect(presentation.technicalDetail).not.toMatch(TECHNICAL_DETAIL_LEAK_PATTERN);
  });
});
