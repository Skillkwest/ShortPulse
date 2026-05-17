import { describe, expect, it } from "vitest";
import {
  CHARACTER_LOADING_GENERATION_GUARDRAIL,
  hasMissingCreateGenerationTarget,
  isCreatePromptTool,
  shouldDisableGenerateWhileCharacterLoading,
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

  it("keeps create-panel output generate available when only create selectors are incomplete", () => {
    expect(
      shouldDisableCreatePanelOutputGenerate({
        mode: "image",
        isGenerateDisabled: false,
        hasSufficientCreditsForOutputGenerate: true,
        modelId: "fal-ai/bytedance/seedream/v4.5/edit",
        characterModeEnabled: true,
        selectedCharacterId: "",
      })
    ).toBe(false);
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
    expect(
      shouldDisableCreatePanelOutputGenerate({
        mode: "text",
        isGenerateDisabled: false,
        hasSufficientCreditsForOutputGenerate: true,
        modelId: "fal-ai/bytedance/seedream/v4.5/edit",
        characterModeEnabled: false,
        selectedCharacterId: "",
      })
    ).toBe(false);
  });

  it("keeps agent-output generate available when only create selectors are incomplete", () => {
    expect(
      shouldDisableAgentOutputGenerate({
        mode: "image",
        selectedTool: "create",
        isGenerateDisabled: false,
        hasSufficientCreditsForOutputGenerate: true,
        modelId: null,
        characterModeEnabled: false,
        selectedCharacterId: "",
      })
    ).toBe(false);
    expect(
      shouldDisableAgentOutputGenerate({
        mode: "image",
        selectedTool: "edit",
        isGenerateDisabled: false,
        hasSufficientCreditsForOutputGenerate: true,
        modelId: null,
        characterModeEnabled: false,
        selectedCharacterId: "",
      })
    ).toBe(false);
    expect(
      shouldDisableAgentOutputGenerate({
        mode: "text",
        selectedTool: "create",
        isGenerateDisabled: false,
        hasSufficientCreditsForOutputGenerate: true,
        modelId: "fal-ai/bytedance/seedream/v4.5/edit",
        characterModeEnabled: false,
        selectedCharacterId: "",
      })
    ).toBe(false);
  });

  it("keeps agent-output generate disabled while other disable state is active", () => {
    expect(
      shouldDisableAgentOutputGenerate({
        mode: "image",
        selectedTool: "create",
        isGenerateDisabled: true,
        hasSufficientCreditsForOutputGenerate: true,
        modelId: "fal-ai/bytedance/seedream/v4.5/edit",
        characterModeEnabled: false,
        selectedCharacterId: "",
      })
    ).toBe(true);
  });

  it("blocks create/text generation while character bundle is still loading", () => {
    expect(
      shouldDisableGenerateWhileCharacterLoading({
        selectedTool: "create",
        characterModeEnabled: true,
        selectedCharacterId: "char-1",
        isCharacterBundleLoading: true,
        hasUsableCharacterBundle: false,
      })
    ).toBe(true);
    expect(
      shouldDisableGenerateWhileCharacterLoading({
        selectedTool: "text",
        characterModeEnabled: true,
        selectedCharacterId: "char-1",
        isCharacterBundleLoading: true,
        hasUsableCharacterBundle: false,
      })
    ).toBe(true);
    expect(
      shouldDisableGenerateWhileCharacterLoading({
        selectedTool: "edit",
        characterModeEnabled: true,
        selectedCharacterId: "char-1",
        isCharacterBundleLoading: true,
        hasUsableCharacterBundle: false,
      })
    ).toBe(false);
    expect(
      shouldDisableGenerateWhileCharacterLoading({
        selectedTool: "create",
        characterModeEnabled: true,
        selectedCharacterId: "char-1",
        isCharacterBundleLoading: false,
        hasUsableCharacterBundle: false,
      })
    ).toBe(false);
    expect(
      shouldDisableGenerateWhileCharacterLoading({
        selectedTool: "create",
        characterModeEnabled: true,
        selectedCharacterId: "char-1",
        isCharacterBundleLoading: true,
        hasUsableCharacterBundle: true,
      })
    ).toBe(false);
    expect(CHARACTER_LOADING_GENERATION_GUARDRAIL).toContain("still loading");
  });
});
