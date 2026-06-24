import { describe, expect, it } from "vitest";
import {
  groupVisibleFailuresForAlertStack,
  resolveCustomerFacingAiStudioUiError,
  resolveAiStudioAlertAutoDismissMs,
} from "../AiStudioPageContent";
import { AI_STUDIO_ERROR_SCENARIOS } from "../../testing/errorScenarioFixtures";

describe("resolveAiStudioAlertAutoDismissMs", () => {
  it("keeps short alerts readable while capping long alerts", () => {
    expect(resolveAiStudioAlertAutoDismissMs("Short failure.")).toBe(9000);
    expect(resolveAiStudioAlertAutoDismissMs("x".repeat(500))).toBe(16000);
  });
});

describe("resolveCustomerFacingAiStudioUiError", () => {
  it("normalizes standalone opaque service errors for customer-facing banners", () => {
    const message = resolveCustomerFacingAiStudioUiError("Internal Error, Please try again later.");

    expect(message).toBe(
      "This generation had a temporary service issue. No ShortPulse credits are charged for service failures; any temporary hold is released automatically. Please try again later."
    );
    expect(message).not.toMatch(/provider|upstream|internal error/i);
  });

  it("shortens standalone API key failures", () => {
    expect(
      resolveCustomerFacingAiStudioUiError(
        "Unauthorized - Authentication failed. Please verify your API key."
      )
    ).toBe("Missing API key.");
  });
});

describe("groupVisibleFailuresForAlertStack", () => {
  it.each(AI_STUDIO_ERROR_SCENARIOS)("uses normalized banner copy for $label", (scenario) => {
    const grouped = groupVisibleFailuresForAlertStack([scenario.output]);

    expect(grouped).toEqual([
      expect.objectContaining({
        ids: [scenario.output.id],
        failureMessage: expect.stringContaining(scenario.expectedBannerText),
        count: 1,
      }),
    ]);
  });

  it("groups repeated failures with the same model label and message", () => {
    const grouped = groupVisibleFailuresForAlertStack([
      {
        id: "out-1",
        model: "ElevenLabs Music",
        modelId: "music_v1",
        prompt: "first",
        errorMessage: "text must be 2000 characters or fewer.",
        errorMessageShort: "text must be 2000 characters or fewer.",
        errorDetail: "text must be 2000 characters or fewer.",
      },
      {
        id: "out-2",
        model: "ElevenLabs Music",
        modelId: "music_v1",
        prompt: "second",
        errorMessage: "text must be 2000 characters or fewer.",
        errorMessageShort: "text must be 2000 characters or fewer.",
        errorDetail: "text must be 2000 characters or fewer.",
      },
    ]);

    expect(grouped).toEqual([
      {
        ids: ["out-1", "out-2"],
        modelLabel: "Music",
        failureMessage: "text must be 2000 characters or fewer.",
        count: 2,
      },
    ]);
  });

  it("keeps distinct service messages in separate groups", () => {
    const grouped = groupVisibleFailuresForAlertStack([
      {
        id: "out-1",
        model: "ElevenLabs Music",
        modelId: "music_v1",
        prompt: "first",
        errorMessage: "text must be 2000 characters or fewer.",
        errorMessageShort: "text must be 2000 characters or fewer.",
        errorDetail: "text must be 2000 characters or fewer.",
      },
      {
        id: "out-2",
        model: "ElevenLabs Music",
        modelId: "music_v1",
        prompt: "second",
        errorMessage: "Provider unavailable",
        errorMessageShort: "Provider unavailable",
        errorDetail: "Provider unavailable",
      },
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped[0]?.count).toBe(1);
    expect(grouped[1]?.count).toBe(1);
  });

  it("normalizes raw JSON validation detail before grouping failure alerts", () => {
    const grouped = groupVisibleFailuresForAlertStack([
      {
        id: "out-1",
        model: "Seedream 4.5 Edit",
        modelId: "fal-ai/bytedance/seedream/v4.5/edit",
        prompt: "first",
        errorMessage: "Invalid request",
        errorMessageShort: "Generation failed",
        errorDetail: '{"detail":[{"loc":["prompt"],"msg":"Field required","type":"missing"}]}',
      },
    ]);

    expect(grouped).toEqual([
      {
        ids: ["out-1"],
        modelLabel: "Seedream 4.5 Edit",
        failureMessage: "Prompt is required.",
        count: 1,
      },
    ]);
  });

  it("labels opaque service failures with customer-facing credit-release guidance", () => {
    const grouped = groupVisibleFailuresForAlertStack([
      {
        id: "out-1",
        model: "Kie Kling 3.0",
        modelId: "kie-ai/kling-3.0",
        prompt: "first",
        errorMessage: "Internal Error, Please try again later.",
        errorMessageShort: "Generation failed",
        errorDetail: "Internal Error, Please try again later.",
      },
    ]);

    expect(grouped).toEqual([
      {
        ids: ["out-1"],
        modelLabel: "Kling 3.0",
        failureMessage:
          "Kling 3.0 generation had a temporary service issue. No ShortPulse credits are charged for service failures; any temporary hold is released automatically. Please try again later.",
        count: 1,
      },
    ]);
  });

  it("de-brands legacy Kie model labels before grouping failure alerts", () => {
    const grouped = groupVisibleFailuresForAlertStack([
      {
        id: "out-1",
        model: "Kie Kling 3.0",
        modelId: "legacy-kie-kling",
        prompt: "first",
        errorMessage: "Generation failed",
        errorMessageShort: "Generation failed",
        errorDetail: "Kie Kling 3.0 submit requires at least one image URL.",
      },
    ]);

    expect(grouped).toEqual([
      {
        ids: ["out-1"],
        modelLabel: "Kling 3.0",
        failureMessage: "Kling 3.0 needs an image reference. Add an image and try again.",
        count: 1,
      },
    ]);
  });

  it("de-brands legacy Veo provider labels and I2V suffixes before grouping failure alerts", () => {
    const grouped = groupVisibleFailuresForAlertStack([
      {
        id: "out-1",
        model: "Kie VEO 3.1 Fast I2V",
        modelId: "legacy-kie-veo",
        prompt: "first",
        errorMessage: "Generation failed",
        errorMessageShort: "Generation failed",
        errorDetail: "Kie VEO 3.1 Fast I2V submit requires an image URL.",
      },
    ]);

    expect(grouped).toEqual([
      {
        ids: ["out-1"],
        modelLabel: "Veo 3.1 Fast",
        failureMessage: "Veo 3.1 Fast needs an image reference. Add an image and try again.",
        count: 1,
      },
    ]);
  });
});
