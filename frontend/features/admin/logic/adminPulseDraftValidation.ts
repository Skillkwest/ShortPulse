/**
 * Validation helpers for admin-managed Create Pulse built-in preset drafts.
 */
import {
  CREATE_PULSE_BUILT_IN_PRESET_ID_REQUIREMENT,
  isCreatePulseRetiredPresetId,
  isValidCreatePulseBuiltInPresetId,
} from "../../../lib/model-runtime/createPulseBuiltIns";

type PulseDraftValidationInput = {
  presetId: string;
  label: string;
  description: string;
  starterAssistantMessage: string;
  workflowStageHints: string;
  artifactTarget: string;
  systemInstructions: string;
};

export const isPulseDraftBlank = (draft: PulseDraftValidationInput): boolean =>
  draft.presetId.trim().length === 0 &&
  draft.label.trim().length === 0 &&
  draft.description.trim().length === 0 &&
  draft.starterAssistantMessage.trim().length === 0 &&
  draft.workflowStageHints.trim().length === 0 &&
  draft.systemInstructions.trim().length === 0 &&
  draft.artifactTarget === "text_artifact";

export const isPulseDraftPersistable = (draft: PulseDraftValidationInput): boolean =>
  draft.presetId.trim().length > 0 &&
  isValidCreatePulseBuiltInPresetId(draft.presetId) &&
  !isCreatePulseRetiredPresetId(draft.presetId.trim()) &&
  draft.label.trim().length > 0 &&
  draft.description.trim().length > 0 &&
  draft.starterAssistantMessage.trim().length > 0 &&
  draft.systemInstructions.trim().length > 0;

export const resolvePulseDraftValidationIssue = (
  draft: PulseDraftValidationInput
): string | null => {
  if (isPulseDraftBlank(draft)) return null;
  if (!draft.presetId.trim()) return "Preset ID is required.";
  if (!isValidCreatePulseBuiltInPresetId(draft.presetId)) {
    return CREATE_PULSE_BUILT_IN_PRESET_ID_REQUIREMENT;
  }
  if (isCreatePulseRetiredPresetId(draft.presetId.trim())) {
    return "This preset id is retired. Choose a new safe preset id for this built-in Pulse.";
  }
  if (!draft.label.trim()) return "Pulse name is required.";
  if (!draft.description.trim()) return "Description is required.";
  if (!draft.starterAssistantMessage.trim()) {
    return "Starter assistant message is required so the Pulse can always show a kickoff step.";
  }
  if (!draft.systemInstructions.trim()) return "System instructions are required.";
  return null;
};
