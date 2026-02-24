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
  isPromptGenerating: boolean;
  hasSufficientCreditsForOutputGenerate: boolean;
};

type AgentOutputDisableParams = CreateSelectionParams & {
  mode: StudioMode;
  selectedTool: ToolId | null;
  isGenerateDisabled: boolean;
  isGenerateClickLocked: boolean;
  isPromptGenerating: boolean;
  hasSufficientCreditsForOutputGenerate: boolean;
};

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
  isPromptGenerating,
  hasSufficientCreditsForOutputGenerate,
  modelId,
  characterModeEnabled,
  selectedCharacterId,
}: CreatePanelDisableParams): boolean =>
  mode === "text" ||
  isGenerateDisabled ||
  isPromptGenerating ||
  hasMissingCreateGenerationTarget({
    modelId,
    characterModeEnabled,
    selectedCharacterId,
  }) ||
  !hasSufficientCreditsForOutputGenerate;

/**
 * Page-level disable guard for agent-output generation shortcuts.
 */
export const shouldDisableAgentOutputGenerate = ({
  mode,
  selectedTool,
  isGenerateDisabled,
  isGenerateClickLocked,
  isPromptGenerating,
  hasSufficientCreditsForOutputGenerate,
  modelId,
  characterModeEnabled,
  selectedCharacterId,
}: AgentOutputDisableParams): boolean => {
  const isCreateTool = isCreatePromptTool(selectedTool);
  const isCreatePromptTextMode = isCreateTool && mode === "text";
  const missingGenerationTarget = isCreateTool
    ? hasMissingCreateGenerationTarget({
        modelId,
        characterModeEnabled,
        selectedCharacterId,
      })
    : false;
  return (
    isCreatePromptTextMode ||
    isPromptGenerating ||
    isGenerateDisabled ||
    isGenerateClickLocked ||
    missingGenerationTarget ||
    !hasSufficientCreditsForOutputGenerate
  );
};
