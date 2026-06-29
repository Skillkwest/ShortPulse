import { describe, expect, it } from "vitest";
import { createStudioOutputDetailModalItem } from "../studioOutputDetailModal";
import { resolveSharedMediaDetailBladeContent } from "../../components/detail-modal/sharedMediaDetailPresentation";
import type { StudioOutput } from "../../types";
import { AI_STUDIO_ERROR_SCENARIOS } from "../../testing/errorScenarioFixtures";

const CUSTOMER_DETAIL_LEAK_PATTERN =
  /\{|"loc"|request[_ ]?id|req_|image_urls|non-json|provider status route|upstream provider|provider-side/i;

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
  it.each(AI_STUDIO_ERROR_SCENARIOS)(
    "shows customer-facing error details for $label",
    (scenario) => {
      const item = createStudioOutputDetailModalItem({
        output: scenario.output,
        canSavePrompt: true,
      });
      const bladeContent = resolveSharedMediaDetailBladeContent({ item });

      expect(item.capabilities.canEditPrompt).toBe(false);
      expect(item.capabilities.canSavePrompt).toBe(false);
      expect(item.presentation?.kindLabel).toBe("failed generation");
      expect(item.presentation?.errorContent?.detail).toContain(scenario.expectedDetailText);
      expect(item.presentation?.errorContent?.detail).not.toMatch(CUSTOMER_DETAIL_LEAK_PATTERN);
      expect(item.presentation?.errorContent?.rawPayload).toBeNull();
      expect(bladeContent.label).toBe("ERROR");
      expect(bladeContent.value).toContain(scenario.expectedDetailText);
      expect(bladeContent.value).not.toMatch(CUSTOMER_DETAIL_LEAK_PATTERN);
      if (scenario.rawPayloadProbe) {
        expect(bladeContent.value).not.toContain(scenario.rawPayloadProbe);
      }
    }
  );

  it("adds read-only customer-facing error content for failed outputs", () => {
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
    expect(item.presentation?.errorContent?.detail).toBe(
      "A reference image could not be used. Re-add the reference and try again."
    );
    expect(item.presentation?.errorContent?.detail).not.toMatch(CUSTOMER_DETAIL_LEAK_PATTERN);
    expect(item.presentation?.errorContent?.rawPayload).toBeNull();
  });

  it("deduplicates matching error summary and detail text", () => {
    const item = createStudioOutputDetailModalItem({
      output: createOutput({
        errorMessage: "Not enough credits.",
        errorMessageShort: "Not enough credits.",
        errorDetail: "Not enough credits.",
      }),
      canSavePrompt: true,
    });

    const bladeContent = resolveSharedMediaDetailBladeContent({ item });

    expect(bladeContent.label).toBe("ERROR");
    expect(bladeContent.value).toBe("Insufficient credits.");
  });

  it("shows explicit-content detail once when the detail already includes the summary", () => {
    const item = createStudioOutputDetailModalItem({
      output: createOutput({
        errorMessage: "This request was blocked for explicit or unsafe content.",
        errorMessageShort: "Content not allowed",
        errorDetail:
          "This request was blocked for explicit or unsafe content. Try revising the prompt or references.",
      }),
      canSavePrompt: true,
    });

    const bladeContent = resolveSharedMediaDetailBladeContent({ item });

    expect(bladeContent.label).toBe("ERROR");
    expect(bladeContent.value).toBe(
      "This request was blocked for explicit or unsafe content. Try revising the prompt or references."
    );
  });

  it("preserves generated audio companion art for shared detail rendering", () => {
    const item = createStudioOutputDetailModalItem({
      output: createOutput({
        id: "audio-output-1",
        mode: "audio",
        taskState: "success",
        mediaSource: "generated",
        generationId: "generation-audio-1",
        previewUrl: "https://cdn.shortpulse.test/audio-output-1.mp3",
        companionArtUrl: "https://cdn.shortpulse.test/audio-output-1-cover.webp",
        companionArtStoragePath:
          "user-1/generations/audio/generation-audio-1/companion-art/cover.webp",
      }),
      canSavePrompt: true,
    });

    expect(item.media.kind).toBe("audio");
    expect(item.media.url).toBe("https://cdn.shortpulse.test/audio-output-1.mp3");
    expect(item.media.companionArtUrl).toBe(
      "https://cdn.shortpulse.test/audio-output-1-cover.webp"
    );
    expect(item.media.companionArtStoragePath).toBe(
      "user-1/generations/audio/generation-audio-1/companion-art/cover.webp"
    );
  });
});
