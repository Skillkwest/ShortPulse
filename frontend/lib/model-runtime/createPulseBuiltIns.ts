/**
 * Server/admin Create Pulse built-in catalog surface.
 * Keeps hidden built-in instructions out of the general AI Studio client path.
 */
import { CREATE_PULSE_SEEDED_BUILT_IN_METADATA } from "./createPulseBuiltInMetadata";
import {
  MULTI_SEQUENCE_VIDEO_PROMPT_SYSTEM_INSTRUCTIONS,
  STORY_BUILDER_SYSTEM_INSTRUCTIONS,
  VIDEO_PROMPT_MAGIC_SYSTEM_INSTRUCTIONS,
} from "./createPulseBuiltInInstructions";
import {
  CREATE_PULSE_CUSTOM_AUTHORING_ACTIVATION_MODE,
  CREATE_PULSE_CUSTOM_AUTHORING_KIND,
  CREATE_PULSE_CUSTOM_AUTHORING_OUTPUT_MODE,
  CREATE_PULSE_CUSTOM_AUTHORING_RUNTIME_MODE,
  CREATE_PULSE_GUIDED_AUTHORING_KIND,
  CREATE_PULSE_SCHEMA_VERSION,
  isCreatePulseRetiredPresetId,
  normalizeCreatePulseWorkflowStageHints,
  type CreatePulseActivationMode,
  type CreatePulseArtifactTarget,
  type CreatePulseBuiltInPresetId,
  type CreatePulseBuiltInPresetDefinition as CreatePulseBuiltInPresetMetadata,
  type CreatePulseMemoryPolicy,
  type CreatePulseOutputMode,
  type CreatePulsePresetKind,
  type CreatePulseRetiredPresetId,
  type CreatePulseRuntimeMode,
  type CreatePulseWorkflowStageHints,
} from "./createPulsePresetDomain";

export type CreatePulseBuiltInPresetDefinition = CreatePulseBuiltInPresetMetadata & {
  systemInstructions: string;
};

const CREATE_PULSE_DEFAULT_MEMORY_POLICY = "session" as const satisfies CreatePulseMemoryPolicy;
const CREATE_PULSE_DEFAULT_ARTIFACT_TARGET =
  "text_artifact" as const satisfies CreatePulseArtifactTarget;
export const CREATE_PULSE_BUILT_IN_PRESET_ID_REQUIREMENT =
  "Preset ID must be 1-64 lowercase letters, numbers, underscores, or hyphens, and must not contain spaces or colons.";
const CREATE_PULSE_BUILT_IN_PRESET_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export const isValidCreatePulseBuiltInPresetId = (value: string): boolean =>
  CREATE_PULSE_BUILT_IN_PRESET_ID_PATTERN.test(value.trim());

const isCreatePulsePresetKind = (value: string): value is CreatePulsePresetKind =>
  value === "guided_workflow" || value === "custom_gpt";

const isCreatePulseRuntimeMode = (value: string): value is CreatePulseRuntimeMode =>
  value === "workflow_gpt" || value === "custom_gpt";

const isCreatePulseActivationMode = (value: string): value is CreatePulseActivationMode =>
  value === "activate_and_start" || value === "activate_only";

const isCreatePulseOutputMode = (value: string): value is CreatePulseOutputMode =>
  value === "chat_reply" || value === "apply_prompt";

const isCreatePulseArtifactTarget = (value: string): value is CreatePulseArtifactTarget =>
  value === "image_prompt" ||
  value === "video_prompt" ||
  value === "storyboard" ||
  value === "text_artifact";

const createBuiltInPulseDefinition = ({
  presetId,
  label,
  description,
  systemInstructions,
  pulseKind = CREATE_PULSE_GUIDED_AUTHORING_KIND,
  runtimeMode = "workflow_gpt",
  activationMode = "activate_and_start",
  outputMode = "chat_reply",
  starterAssistantMessage = null,
  workflowStageHints = null,
  artifactTarget,
}: {
  presetId: string;
  label: string;
  description: string;
  systemInstructions: string;
  pulseKind?: CreatePulsePresetKind;
  runtimeMode?: CreatePulseRuntimeMode;
  activationMode?: CreatePulseActivationMode;
  outputMode?: CreatePulseOutputMode;
  starterAssistantMessage?: string | null;
  workflowStageHints?: readonly string[] | null;
  artifactTarget: CreatePulseArtifactTarget;
}): CreatePulseBuiltInPresetDefinition => ({
  presetId,
  label,
  description,
  systemInstructions,
  pulseKind,
  runtimeMode,
  activationMode,
  outputMode,
  memoryPolicy: CREATE_PULSE_DEFAULT_MEMORY_POLICY,
  starterAssistantMessage,
  workflowStageHints:
    workflowStageHints?.map((entry) => entry.trim()).filter((entry) => entry.length > 0) ?? null,
  artifactTarget,
  schemaVersion: CREATE_PULSE_SCHEMA_VERSION,
});

export const CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS = [
  createBuiltInPulseDefinition({
    ...CREATE_PULSE_SEEDED_BUILT_IN_METADATA[0],
    systemInstructions: VIDEO_PROMPT_MAGIC_SYSTEM_INSTRUCTIONS,
  }),
  createBuiltInPulseDefinition({
    ...CREATE_PULSE_SEEDED_BUILT_IN_METADATA[1],
    systemInstructions: MULTI_SEQUENCE_VIDEO_PROMPT_SYSTEM_INSTRUCTIONS,
  }),
  createBuiltInPulseDefinition({
    ...CREATE_PULSE_SEEDED_BUILT_IN_METADATA[2],
    systemInstructions: STORY_BUILDER_SYSTEM_INSTRUCTIONS,
  }),
] as const satisfies readonly CreatePulseBuiltInPresetDefinition[];

const normalizeCreatePulseBuiltInPresetDefinitionRecord = (
  value: unknown
): CreatePulseBuiltInPresetDefinition | null => {
  if (!value || typeof value !== "object") return null;
  const presetId =
    typeof (value as { presetId?: unknown }).presetId === "string"
      ? (value as { presetId: string }).presetId.trim()
      : "";
  const label =
    typeof (value as { label?: unknown }).label === "string"
      ? (value as { label: string }).label.trim()
      : "";
  const description =
    typeof (value as { description?: unknown }).description === "string"
      ? (value as { description: string }).description.trim()
      : "";
  const systemInstructions =
    typeof (value as { systemInstructions?: unknown }).systemInstructions === "string"
      ? (value as { systemInstructions: string }).systemInstructions.trim()
      : "";
  const starterAssistantMessage =
    typeof (value as { starterAssistantMessage?: unknown }).starterAssistantMessage === "string"
      ? (value as { starterAssistantMessage: string }).starterAssistantMessage.trim()
      : "";
  const workflowStageHints = normalizeCreatePulseWorkflowStageHints(
    (value as { workflowStageHints?: unknown }).workflowStageHints
  );
  const artifactTargetRaw =
    typeof (value as { artifactTarget?: unknown }).artifactTarget === "string"
      ? (value as { artifactTarget: string }).artifactTarget.trim()
      : "";
  const pulseKindRaw =
    typeof (value as { pulseKind?: unknown }).pulseKind === "string"
      ? (value as { pulseKind: string }).pulseKind.trim()
      : "";
  const runtimeModeRaw =
    typeof (value as { runtimeMode?: unknown }).runtimeMode === "string"
      ? (value as { runtimeMode: string }).runtimeMode.trim()
      : "";
  const activationModeRaw =
    typeof (value as { activationMode?: unknown }).activationMode === "string"
      ? (value as { activationMode: string }).activationMode.trim()
      : "";
  const outputModeRaw =
    typeof (value as { outputMode?: unknown }).outputMode === "string"
      ? (value as { outputMode: string }).outputMode.trim()
      : "";
  const pulseKind = isCreatePulsePresetKind(pulseKindRaw)
    ? pulseKindRaw
    : CREATE_PULSE_GUIDED_AUTHORING_KIND;
  const runtimeMode = isCreatePulseRuntimeMode(runtimeModeRaw)
    ? runtimeModeRaw
    : pulseKind === "guided_workflow"
      ? "workflow_gpt"
      : "custom_gpt";

  if (
    !presetId ||
    !isValidCreatePulseBuiltInPresetId(presetId) ||
    !label ||
    !description ||
    !systemInstructions
  ) {
    return null;
  }
  if (isCreatePulseRetiredPresetId(presetId)) {
    return null;
  }

  return createBuiltInPulseDefinition({
    presetId,
    label,
    description,
    systemInstructions,
    pulseKind,
    runtimeMode,
    activationMode: isCreatePulseActivationMode(activationModeRaw)
      ? activationModeRaw
      : "activate_and_start",
    outputMode: isCreatePulseOutputMode(outputModeRaw) ? outputModeRaw : "chat_reply",
    starterAssistantMessage: starterAssistantMessage || null,
    workflowStageHints,
    artifactTarget: isCreatePulseArtifactTarget(artifactTargetRaw)
      ? artifactTargetRaw
      : CREATE_PULSE_DEFAULT_ARTIFACT_TARGET,
  });
};

export const normalizeCreatePulseBuiltInPresetDefinitions = (
  value: unknown
): CreatePulseBuiltInPresetDefinition[] => {
  if (!Array.isArray(value)) return [];
  const seenPresetIds = new Set<string>();
  const normalized: CreatePulseBuiltInPresetDefinition[] = [];
  value.forEach((entry) => {
    const normalizedEntry = normalizeCreatePulseBuiltInPresetDefinitionRecord(entry);
    if (!normalizedEntry || seenPresetIds.has(normalizedEntry.presetId)) return;
    seenPresetIds.add(normalizedEntry.presetId);
    normalized.push(normalizedEntry);
  });
  return normalized;
};

export const resolveCreatePulseBuiltInPresetDefinitions = (
  builtInDefinitions?: readonly CreatePulseBuiltInPresetDefinition[] | null
): CreatePulseBuiltInPresetDefinition[] =>
  Array.isArray(builtInDefinitions)
    ? normalizeCreatePulseBuiltInPresetDefinitions(builtInDefinitions)
    : [...CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS];

export {
  CREATE_PULSE_CUSTOM_AUTHORING_ACTIVATION_MODE,
  CREATE_PULSE_CUSTOM_AUTHORING_KIND,
  CREATE_PULSE_CUSTOM_AUTHORING_OUTPUT_MODE,
  CREATE_PULSE_CUSTOM_AUTHORING_RUNTIME_MODE,
  CREATE_PULSE_GUIDED_AUTHORING_KIND,
  CREATE_PULSE_SCHEMA_VERSION,
  isCreatePulseRetiredPresetId,
  normalizeCreatePulseWorkflowStageHints,
};

export type {
  CreatePulseActivationMode,
  CreatePulseArtifactTarget,
  CreatePulseBuiltInPresetId,
  CreatePulseMemoryPolicy,
  CreatePulseOutputMode,
  CreatePulsePresetKind,
  CreatePulseRetiredPresetId,
  CreatePulseRuntimeMode,
  CreatePulseWorkflowStageHints,
};
