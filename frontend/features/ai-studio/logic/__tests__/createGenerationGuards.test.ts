import { describe, expect, it } from "vitest";
import {
  hasMissingCreateGenerationTarget,
  isCreatePromptTool,
  shouldDisableAgentOutputGenerate,
  shouldDisableCreatePanelOutputGenerate,
} from "../createGenerationGuards";

describe("createGenerationGuards", () => {
  it("detects create/text workflow tools", () => {
    expect(isCreatePromptTool("create")).toBe(true);
    expect(isCreatePromptTool("text")).toBe(true);
    expect(isCreatePromptTool("edit")).toBe(false);
    expect(isCreatePromptTool("video")).toBe(false);
    expect(isCreatePromptTool(null)).toBe(false);
  });

  it("requires model selection even when character mode is disabled", () => {
    expect(
      hasMissingCreateGenerationTarget({
        modelId: null,
        characterModeEnabled: false,
        selectedCharacterId: "",
      })
    ).toBe(true);
  });

  it("requires character selection only while character mode is enabled", () => {
    expect(
      hasMissingCreateGenerationTarget({
        modelId: "fal-ai/bytedance/seedream/v4.5/edit",
        characterModeEnabled: true,
        selectedCharacterId: "",
      })
    ).toBe(true);
    expect(
      hasMissingCreateGenerationTarget({
        modelId: "fal-ai/bytedance/seedream/v4.5/edit",
        characterModeEnabled: false,
        selectedCharacterId: "",
      })
    ).toBe(false);
  });

  it("disables create-panel output generate when selectors are incomplete", () => {
    expect(
      shouldDisableCreatePanelOutputGenerate({
        mode: "image",
        isGenerateDisabled: false,
        hasSufficientCreditsForOutputGenerate: true,
        modelId: "fal-ai/bytedance/seedream/v4.5/edit",
        characterModeEnabled: true,
        selectedCharacterId: "",
      })
    ).toBe(true);
    expect(
      shouldDisableCreatePanelOutputGenerate({
        mode: "image",
        isGenerateDisabled: false,
        hasSufficientCreditsForOutputGenerate: true,
        modelId: "fal-ai/bytedance/seedream/v4.5/edit",
        characterModeEnabled: true,
        selectedCharacterId: "char-1",
      })
    ).toBe(false);
  });

  it("disables agent-output generate only for create/text when create selectors are incomplete", () => {
    expect(
      shouldDisableAgentOutputGenerate({
        mode: "image",
        selectedTool: "create",
        isGenerateDisabled: false,
        isGenerateClickLocked: false,
        hasSufficientCreditsForOutputGenerate: true,
        modelId: null,
        characterModeEnabled: false,
        selectedCharacterId: "",
      })
    ).toBe(true);
    expect(
      shouldDisableAgentOutputGenerate({
        mode: "image",
        selectedTool: "edit",
        isGenerateDisabled: false,
        isGenerateClickLocked: false,
        hasSufficientCreditsForOutputGenerate: true,
        modelId: null,
        characterModeEnabled: false,
        selectedCharacterId: "",
      })
    ).toBe(false);
  });

  it("keeps agent-output generate disabled while click lock is active", () => {
    expect(
      shouldDisableAgentOutputGenerate({
        mode: "image",
        selectedTool: "create",
        isGenerateDisabled: false,
        isGenerateClickLocked: true,
        hasSufficientCreditsForOutputGenerate: true,
        modelId: "fal-ai/bytedance/seedream/v4.5/edit",
        characterModeEnabled: false,
        selectedCharacterId: "",
      })
    ).toBe(true);
  });
});
