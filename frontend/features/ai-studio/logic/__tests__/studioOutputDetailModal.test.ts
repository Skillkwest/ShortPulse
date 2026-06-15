import { describe, expect, it } from "vitest";
import { createStudioOutputDetailModalItem } from "../studioOutputDetailModal";
import { resolveSharedMediaDetailBladeContent } from "../../components/detail-modal/sharedMediaDetailPresentation";
import type { StudioOutput } from "../../types";
import { AI_STUDIO_ERROR_SCENARIOS } from "../../testing/errorScenarioFixtures";

const createOutput = (overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id: "out-detail",
  prompt: "Prompt",
  mode: "image",
  aspect: "1:1",
  model: "Model",
  status: "ready",
  timestamp: "Failed",
  taskState: "fail",
  ...overrides,
});

describe("createStudioOutputDetailModalItem", () => {
  it.each(AI_STUDIO_ERROR_SCENARIOS)("expands full error details for $label", (scenario) => {
    const item = createStudioOutputDetailModalItem({
      output: scenario.output,
      canSavePrompt: true,
    });
    const bladeContent = resolveSharedMediaDetailBladeContent({ item });

    expect(item.capabilities.canEditPrompt).toBe(false);
    expect(item.capabilities.canSavePrompt).toBe(false);
    expect(item.presentation?.kindLabel).toBe("failed generation");
    expect(item.presentation?.errorContent?.detail).toContain(scenario.expectedDetailText);
    expect(bladeContent.label).toBe("ERROR");
    expect(bladeContent.value).toContain(scenario.expectedDetailText);
    if (scenario.rawPayloadProbe) {
      expect(item.presentation?.errorContent?.rawPayload).toContain(scenario.rawPayloadProbe);
      expect(bladeContent.value).toContain(scenario.rawPayloadProbe);
    }
  });

  it("adds read-only full error content for failed outputs", () => {
    const errorPayload = {
      error: {
        message: "Provider rejected image_urls[0].",
        request_id: "req-provider",
      },
    };

    const item = createStudioOutputDetailModalItem({
      output: createOutput({
        errorMessage: "Generation failed",
        errorMessageShort: "Generation failed",
        errorDetail: "Provider rejected image_urls[0].",
        errorPayload,
      }),
      canSavePrompt: true,
    });

    expect(item.capabilities.canEditPrompt).toBe(false);
    expect(item.capabilities.canSavePrompt).toBe(false);
    expect(item.presentation?.kindLabel).toBe("failed generation");
    expect(item.presentation?.errorContent?.detail).toBe("Provider rejected image_urls[0].");
    expect(item.presentation?.errorContent?.rawPayload).toContain("req-provider");
  });
});
