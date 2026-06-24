import { describe, expect, it } from "vitest";
import {
  createShortErrorMessage,
  isProviderSafetyBlockedOutput,
  isProviderSafetyBlockMessage,
  resolveProviderTerminalFailureCopy,
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

  it("condenses explicit-content failures to the shared short copy", () => {
    expect(
      createShortErrorMessage(
        "This request was blocked for explicit or unsafe content. Try revising the prompt or references."
      )
    ).toBe("Content not allowed");
  });

  it("condenses non-JSON status responses for compact cards", () => {
    expect(createShortErrorMessage("Seedance 2 returned non-JSON status response")).toBe(
      "Status check failed."
    );
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

  it("extracts nested provider failure reasons from raw terminal polling payloads", () => {
    expect(
      resolveProviderTerminalFailureCopy(
        {
          status: "failed",
          message: "failed",
          data: {
            status: "failed",
            failMsg: "Reference file is not reachable",
          },
        },
        "failed"
      )
    ).toEqual({
      message: "Reference file is not reachable",
      detail: "Reference file is not reachable",
      shortMessage: "Reference file is not reachable",
    });
  });
});
