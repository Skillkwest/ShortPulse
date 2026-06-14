import { describe, expect, it } from "vitest";
import { resolveAiStudioErrorPresentation } from "../errorPresentation";
import type { StudioOutput } from "../../types";

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
});
