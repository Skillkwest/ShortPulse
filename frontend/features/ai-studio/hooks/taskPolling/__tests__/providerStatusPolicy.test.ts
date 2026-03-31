import { describe, expect, it } from "vitest";
import {
  isProviderSafetyBlockedOutput,
  isProviderSafetyBlockMessage,
} from "../providerStatusPolicy";

describe("providerStatusPolicy safety classification", () => {
  it("detects provider safety block messages from explicit-content wording", () => {
    expect(
      isProviderSafetyBlockMessage(
        "The model did not generate the expected output for this prompt due to unsafe content."
      )
    ).toBe(true);
    expect(isProviderSafetyBlockMessage("NSFW content blocked by moderation.")).toBe(true);
  });

  it("labels failed outputs with provider safety details as NSFW", () => {
    expect(
      isProviderSafetyBlockedOutput({
        taskState: "fail",
        errorMessage: "Generation failed",
        errorMessageShort: "Content not allowed",
        errorDetail:
          "Request rejected for explicit adult content by the provider moderation system.",
      })
    ).toBe(true);
  });

  it("does not label generic provider failures as NSFW", () => {
    expect(
      isProviderSafetyBlockedOutput({
        taskState: "fail",
        errorMessage: "Downstream service error",
        errorMessageShort: "Generation failed",
        errorDetail: "Downstream service error",
      })
    ).toBe(false);
  });
});
