import { describe, expect, it } from "vitest";
import { resolveStandardCreatePrimaryActionDecision } from "../standardCreatePrimaryActionPolicy";

describe("standardCreatePrimaryActionPolicy", () => {
  it("generates from the visible Standard chat composer when chat mode is on", () => {
    expect(
      resolveStandardCreatePrimaryActionDecision({
        selectedTool: "create",
        chatModeEnabled: true,
        agentInput: "visible chat draft",
        prompt: "hidden fallback prompt",
        createGenerateCostCredits: 7,
      })
    ).toEqual({
      kind: "generate",
      prompt: "visible chat draft",
      mirrorPromptToVisibleComposer: true,
      options: {
        modeOverride: "image",
        toolOverride: "create",
        costOverrideCredits: 7,
      },
    });
  });

  it("generates from the authored Standard prompt when chat mode is off", () => {
    expect(
      resolveStandardCreatePrimaryActionDecision({
        selectedTool: "text",
        chatModeEnabled: false,
        agentInput: "chat draft",
        prompt: "authored prompt",
        createGenerateCostCredits: 3,
      })
    ).toEqual({
      kind: "generate",
      prompt: "authored prompt",
      mirrorPromptToVisibleComposer: false,
      options: {
        modeOverride: "image",
        toolOverride: "create",
        costOverrideCredits: 3,
      },
    });
  });

  it("returns a provider submit decision for non-Standard-create tools", () => {
    expect(
      resolveStandardCreatePrimaryActionDecision({
        selectedTool: "image",
        chatModeEnabled: false,
        agentInput: "ignored",
        prompt: "edit prompt",
        createGenerateCostCredits: 3,
      })
    ).toEqual({
      kind: "provider_submit",
    });
  });

  it("returns a no-op when the visible Standard composer is empty", () => {
    expect(
      resolveStandardCreatePrimaryActionDecision({
        selectedTool: "create",
        chatModeEnabled: true,
        agentInput: "   ",
        prompt: "hidden fallback prompt",
        createGenerateCostCredits: 3,
      })
    ).toEqual({
      kind: "noop",
      reason: "empty_visible_prompt",
    });
  });

  it("returns a no-op while Standard image attachments are still preparing", () => {
    expect(
      resolveStandardCreatePrimaryActionDecision({
        selectedTool: "create",
        chatModeEnabled: true,
        agentInput: "visible chat draft",
        prompt: "hidden fallback prompt",
        createGenerateCostCredits: 3,
        agentAttachments: [
          {
            id: "image-1",
            kind: "image",
            imageUrl: "data:image/png;base64,preview",
            submissionImageUrl: null,
            text: null,
            deliveryStatus: "preparing",
            deliveryError: null,
          },
        ],
      })
    ).toEqual({
      kind: "noop",
      reason: "image_attachment_preparing",
    });
  });

  it("returns a no-op when an upstream generate guardrail disables submission", () => {
    expect(
      resolveStandardCreatePrimaryActionDecision({
        selectedTool: "create",
        chatModeEnabled: false,
        agentInput: "chat draft",
        prompt: "authored prompt",
        createGenerateCostCredits: 3,
        isGenerateDisabled: true,
      })
    ).toEqual({
      kind: "noop",
      reason: "disabled",
    });
  });
});
