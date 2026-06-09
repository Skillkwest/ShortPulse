import { describe, expect, it } from "vitest";
import {
  extractCustomerFacingProviderError,
  normalizeCustomerFacingProviderError,
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
});
