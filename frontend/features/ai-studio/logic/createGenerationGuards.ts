/**
 * Shared guard helpers for Create/Text generation controls.
 * Keeps page-level and panel-level disable conditions aligned.
 */
import type { StudioMode, ToolId } from "../types";

type CreateSelectionParams = {
  modelId: string | null;
  characterModeEnabled: boolean;
  selectedCharacterId: string;
};

type CreatePanelDisableParams = CreateSelectionParams & {
  mode: StudioMode;
  isGenerateDisabled: boolean;
  hasSufficientCreditsForOutputGenerate: boolean;
};

type AgentOutputDisableParams = CreateSelectionParams & {
  mode: StudioMode;
  selectedTool: ToolId | null;
  isGenerateDisabled: boolean;
  hasSufficientCreditsForOutputGenerate: boolean;
};

type CharacterLoadingDisableParams = {
  selectedTool: ToolId | null;
  characterModeEnabled: boolean;
  selectedCharacterId: string;
  isCharacterBundleLoading: boolean;
  hasUsableCharacterBundle: boolean;
};

export const CHARACTER_LOADING_GENERATION_GUARDRAIL =
  "Character Mode context is still loading. Please wait before generating.";

/**
 * Returns true when tool routing targets create/text workflows.
 */
export const isCreatePromptTool = (tool: ToolId | null): boolean =>
  tool === "create" || tool === "text";

/**
 * Returns true when required Create workflow selectors are incomplete.
 */
export const hasMissingCreateGenerationTarget = ({
  modelId,
  characterModeEnabled,
  selectedCharacterId,
}: CreateSelectionParams): boolean => {
  if (!modelId) {
    return true;
  }
  return characterModeEnabled && !selectedCharacterId;
};

/**
 * Panel-level disable guard for "Generate from this agent output" pills.
 */
export const shouldDisableCreatePanelOutputGenerate = ({
  mode,
  isGenerateDisabled,
  hasSufficientCreditsForOutputGenerate,
  modelId,
  characterModeEnabled,
  selectedCharacterId,
}: CreatePanelDisableParams): boolean => {
  void mode;
  return (
    isGenerateDisabled ||
    hasMissingCreateGenerationTarget({
      modelId,
      characterModeEnabled,
      selectedCharacterId,
    }) ||
    !hasSufficientCreditsForOutputGenerate
  );
};

/**
 * Page-level disable guard for agent-output generation shortcuts.
 */
export const shouldDisableAgentOutputGenerate = ({
  mode,
  selectedTool,
  isGenerateDisabled,
  hasSufficientCreditsForOutputGenerate,
  modelId,
  characterModeEnabled,
  selectedCharacterId,
}: AgentOutputDisableParams): boolean => {
  const isCreateTool = isCreatePromptTool(selectedTool);
  const missingGenerationTarget = isCreateTool
    ? hasMissingCreateGenerationTarget({
        modelId,
        characterModeEnabled,
        selectedCharacterId,
      })
    : false;
  void mode;
  return isGenerateDisabled || missingGenerationTarget || !hasSufficientCreditsForOutputGenerate;
};

/**
 * Returns true when Character Mode generation should be blocked until bundle hydration completes.
 */
export const shouldDisableGenerateWhileCharacterLoading = ({
  selectedTool,
  characterModeEnabled,
  selectedCharacterId,
  isCharacterBundleLoading,
  hasUsableCharacterBundle,
}: CharacterLoadingDisableParams): boolean =>
  isCreatePromptTool(selectedTool) &&
  characterModeEnabled &&
  selectedCharacterId.trim().length > 0 &&
  isCharacterBundleLoading &&
  !hasUsableCharacterBundle;
