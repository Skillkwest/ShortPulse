import { describe, expect, it } from "vitest";
import { EXPLICIT_CONTENT_FAILURE_TITLE } from "../../../../../lib/explicitContentFailure";
import type { StudioOutput } from "../../../types";
import { AI_STUDIO_ERROR_SCENARIOS } from "../../../testing/errorScenarioFixtures";
import {
  REFERENCE_GRID_GENERIC_ERROR_TITLE,
  resolveReferenceGridErrorTitle,
} from "../referenceGridErrorCopy";

const createFailedOutput = (overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id: "error-card",
  prompt: "Prompt",
  mode: "image",
  aspect: "1:1",
  model: "Model",
  status: "ready",
  timestamp: "Failed",
  taskState: "fail",
  ...overrides,
});

describe("resolveReferenceGridErrorTitle", () => {
  it.each(AI_STUDIO_ERROR_SCENARIOS)(
    "keeps Reference Grid card error copy concise for $label",
    (scenario) => {
      const title = resolveReferenceGridErrorTitle(scenario.output);

      expect(title.length).toBeLessThanOrEqual(24);
      if (scenario.id === "content_policy") {
        expect(title).toBe(EXPLICIT_CONTENT_FAILURE_TITLE);
      } else {
        expect(title).toBe(REFERENCE_GRID_GENERIC_ERROR_TITLE);
      }
      for (const hiddenProbe of scenario.hiddenCardProbes) {
        expect(title).not.toContain(hiddenProbe);
      }
    }
  );

  it("does not render provider-provided short messages in grid cards", () => {
    const title = resolveReferenceGridErrorTitle(
      createFailedOutput({
        errorMessage: "Invalid request",
        errorMessageShort: "Prompt is required.",
        errorDetail: "The provider rejected image_urls[0] with request_id=req_123.",
      })
    );

    expect(title).toBe(REFERENCE_GRID_GENERIC_ERROR_TITLE);
  });
});
