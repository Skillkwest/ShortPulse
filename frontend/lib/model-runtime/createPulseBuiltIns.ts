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

  if (!presetId || !label || !description || !systemInstructions) {
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
    starterAssistantMessage: starterAssistantMessage || null,
    workflowStageHints,
    artifactTarget:
      artifactTargetRaw === "image_prompt" ||
      artifactTargetRaw === "video_prompt" ||
      artifactTargetRaw === "storyboard" ||
      artifactTargetRaw === "text_artifact"
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
