import { describe, expect, it } from "vitest";
import {
  extractCustomerFacingProviderError,
  normalizeCustomerFacingProviderError,
  normalizeProviderSideGenerationFailure,
  resolveCustomerFacingModelLabel,
  sanitizeCustomerFacingProviderText,
} from "../customerFacingProviderText";

describe("customerFacingProviderText", () => {
  it("extracts readable field validation copy from structured provider payloads", () => {
    expect(
      extractCustomerFacingProviderError({
        detail: [
          {
            loc: ["prompt"],
            msg: "Field required",
            type: "missing",
          },
        ],
      })
    ).toBe("Prompt is required.");
  });

  it("extracts readable field validation copy from JSON error strings", () => {
    expect(
      normalizeCustomerFacingProviderError(
        '{"detail":[{"loc":["prompt"],"msg":"Field required","type":"missing"}]}',
        "Generation failed."
      )
    ).toBe("Prompt is required.");
  });

  it("humanizes simple provider reason codes", () => {
    expect(
      normalizeCustomerFacingProviderError(
        {
          reason: "bad_input",
        },
        "Generation failed."
      )
    ).toBe("bad input");
  });

  it("extracts provider failure reasons from common nested envelopes", () => {
    expect(
      normalizeCustomerFacingProviderError(
        {
          data: {
            successFlag: 2,
            failMsg: "File type not supported",
            failCode: "501",
          },
        },
        "Generation failed."
      )
    ).toBe("File type not supported");

    expect(
      normalizeCustomerFacingProviderError(
        {
          response: {
            errorMessage: "Prompt must be shorter",
          },
        },
        "Generation failed."
      )
    ).toBe("Prompt must be shorter");

    expect(
      normalizeCustomerFacingProviderError(
        {
          result: {
            error_message: "Reference image expired",
          },
        },
        "Generation failed."
      )
    ).toBe("Reference image expired");
  });

  it("skips status wrapper messages when sibling provider reasons are present", () => {
    expect(
      normalizeCustomerFacingProviderError(
        {
          msg: "error",
          error_message: "Reference file is not reachable",
        },
        "Generation failed."
      )
    ).toBe("Reference file is not reachable");

    expect(
      normalizeCustomerFacingProviderError(
        {
          message: "failed",
          data: {
            failMsg: "Reference file is not reachable",
          },
        },
        "Generation failed."
      )
    ).toBe("Reference file is not reachable");
  });

  it("strips hidden video-provider branding from model labels without mutating unrelated text", () => {
    expect(
      resolveCustomerFacingModelLabel({
        model: "Seedance 2.0 (Kie)",
        modelId: null,
        fallback: "Generation",
      })
    ).toBe("Seedance 2.0");

    expect(
      resolveCustomerFacingModelLabel({
        model: "Kie VEO 3.1 Fast I2V",
        modelId: null,
        fallback: "Generation",
      })
    ).toBe("Veo 3.1 Fast");

    expect(sanitizeCustomerFacingProviderText("Kie AI narrator", "Voice")).toBe("Kie AI narrator");
  });

  it("strips hidden video-provider branding from provider error copy", () => {
    expect(
      normalizeCustomerFacingProviderError(
        "Kie Kling 3.0 submit requires at least one image URL.",
        "Generation failed."
      )
    ).toBe("Kling 3.0 submit requires at least one image URL.");

    expect(
      normalizeCustomerFacingProviderError(
        "Kie VEO 3.1 Fast I2V submit requires an image URL.",
        "Generation failed."
      )
    ).toBe("Veo 3.1 Fast submit requires an image URL.");
  });

  it("removes provider support links, request ids, and provider names from customer copy", () => {
    expect(
      sanitizeCustomerFacingProviderText(
        "Style saved, but your request was rejected by the safety system. If you believe this is an error, contact us at help.openai.com and include the request ID req_3d45ff849f924f518429b524432e4ac1. safety_violations=[sexual].",
        "Generation failed."
      )
    ).toBe("Your request was blocked by the safety system. Reason: sexual.");

    expect(sanitizeCustomerFacingProviderText("OpenAI provider down", "Generation failed.")).toBe(
      "The image service is temporarily unavailable."
    );
  });

  it("preserves normalized audio provider retry guidance", () => {
    expect(
      sanitizeCustomerFacingProviderText(
        "The audio provider is at its concurrency limit right now. Please retry in 12 seconds.",
        "Generation failed."
      )
    ).toBe("The audio provider is at its concurrency limit right now. Please retry in 12 seconds.");
  });

  it("rewrites opaque upstream failures with provider-side credit guidance", () => {
    expect(
      normalizeProviderSideGenerationFailure({
        rawFailure: "Internal Error, Please try again later.",
        normalizedFailure: "Internal Error, Please try again later.",
        modelLabel: "Kling 3.0",
      })
    ).toBe(
      "Kling 3.0 generation failed at the upstream provider. No ShortPulse credits are charged for provider-side failures; any temporary hold is released automatically. Please try again later."
    );
  });

  it("keeps specific validation failures unchanged", () => {
    expect(
      normalizeProviderSideGenerationFailure({
        rawFailure: "Prompt is required.",
        normalizedFailure: "Prompt is required.",
        modelLabel: "Kling 3.0",
      })
    ).toBe("Prompt is required.");
  });

  it("removes style-preview provider and client identifiers from customer copy", () => {
    expect(
      sanitizeCustomerFacingProviderText(
        "Fal FLUX 2 Klein status check failed.",
        "Style preview generation failed."
      )
    ).toBe("the generation service status check failed.");

    expect(
      sanitizeCustomerFacingProviderText(
        "flux2client returned fal-ai/flux-2/klein/9b status check failed.",
        "Style preview generation failed."
      )
    ).toBe("the generation service returned the selected image model status check failed.");
  });
});
