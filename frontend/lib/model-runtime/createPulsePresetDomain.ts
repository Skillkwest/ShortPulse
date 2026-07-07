/**
 * Shared Pulse preset catalog and helpers for AI Studio.
 * Merges built-in guided workflows with persisted custom Pulse definitions used by the library and
 * Create rail.
 */
import { CREATE_PULSE_SEEDED_BUILT_IN_METADATA } from "./createPulseBuiltInMetadata";

export const CREATE_PULSE_MORE_LABEL = "More Pulses" as const;
export const CREATE_PULSE_PANEL_MAX = 10;
export const CREATE_PULSE_PRESET_DRAG_MIME =
  "application/x-shortpulse-create-pulse-preset" as const;

export type CreatePulsePresetKind = "guided_workflow" | "custom_gpt";
export type CreatePulseRuntimeMode = "workflow_gpt" | "custom_gpt";
export type CreatePulseActivationMode = "activate_and_start" | "activate_only";
export type CreatePulseOutputMode = "chat_reply" | "apply_prompt";
export type CreatePulseMemoryPolicy = "session";
export type CreatePulseArtifactTarget =
  | "image_prompt"
  | "video_prompt"
  | "storyboard"
  | "text_artifact";
export const CREATE_PULSE_SCHEMA_VERSION = 2 as const;
export type CreatePulsePresetStartFailureReason =
  | "bootstrap_pending"
  | "activation_seed_missing"
  | "panel_full"
  | "preference_save_failed"
  | "scope_discarded"
  | "empty_response"
  | "transport_error";
export type CreatePulsePresetStartResult =
  | {
      status: "started";
      latestAgentPrompt?: string | null;
      starterAssistantMessage?: string | null;
    }
  | {
      status: "blocked_busy";
      message: string;
    }
  | {
      status: "failed";
      reason: CreatePulsePresetStartFailureReason;
      message: string;
    };
export type CreatePulseWorkflowStageHints = string[];
export type CreatePulseBuiltInPresetDefinition = {
  presetId: string;
  label: string;
  description: string;
  pulseKind: CreatePulsePresetKind;
  runtimeMode: CreatePulseRuntimeMode;
  activationMode: CreatePulseActivationMode;
  outputMode: CreatePulseOutputMode;
  memoryPolicy: CreatePulseMemoryPolicy;
  starterAssistantMessage: string | null;
  workflowStageHints: CreatePulseWorkflowStageHints | null;
  artifactTarget: CreatePulseArtifactTarget;
  schemaVersion: number;
};

const CREATE_PULSE_DEFAULT_MEMORY_POLICY = "session" as const satisfies CreatePulseMemoryPolicy;
const CREATE_PULSE_DEFAULT_ARTIFACT_TARGET =
  "text_artifact" as const satisfies CreatePulseArtifactTarget;
export const CREATE_PULSE_CUSTOM_AUTHORING_KIND =
  "custom_gpt" as const satisfies CreatePulsePresetKind;
export const CREATE_PULSE_GUIDED_AUTHORING_KIND =
  "guided_workflow" as const satisfies CreatePulsePresetKind;
export const CREATE_PULSE_CUSTOM_AUTHORING_RUNTIME_MODE =
  "custom_gpt" as const satisfies CreatePulseRuntimeMode;
export const CREATE_PULSE_CUSTOM_AUTHORING_ACTIVATION_MODE =
  "activate_and_start" as const satisfies CreatePulseActivationMode;
export const CREATE_PULSE_CUSTOM_AUTHORING_OUTPUT_MODE =
  "chat_reply" as const satisfies CreatePulseOutputMode;
const CREATE_PULSE_BUILT_IN_KIND = "guided_workflow" as const satisfies CreatePulsePresetKind;
const CREATE_PULSE_BUILT_IN_RUNTIME_MODE = "workflow_gpt" as const satisfies CreatePulseRuntimeMode;
const CREATE_PULSE_BUILT_IN_ACTIVATION_MODE =
  "activate_and_start" as const satisfies CreatePulseActivationMode;
const CREATE_PULSE_BUILT_IN_OUTPUT_MODE = "chat_reply" as const satisfies CreatePulseOutputMode;

const createBuiltInPulseDefinition = ({
  presetId,
  label,
  description,
  pulseKind = CREATE_PULSE_BUILT_IN_KIND,
  runtimeMode = CREATE_PULSE_BUILT_IN_RUNTIME_MODE,
  activationMode = CREATE_PULSE_BUILT_IN_ACTIVATION_MODE,
  outputMode = CREATE_PULSE_BUILT_IN_OUTPUT_MODE,
  starterAssistantMessage = null,
  workflowStageHints = null,
  artifactTarget,
}: {
  presetId: string;
  label: string;
  description: string;
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

export const CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS = CREATE_PULSE_SEEDED_BUILT_IN_METADATA.map(
  (definition) => createBuiltInPulseDefinition(definition)
) as readonly CreatePulseBuiltInPresetDefinition[];

const CREATE_PULSE_RETIRED_PRESET_IDS = [
  "custom_1",
  "custom_2",
  "custom_3",
  "legacy_prompt_modifier",
  "single_shot",
  "ad_hook",
  "product_hero",
  "ugc_style",
  "before_after",
  "lifestyle_scene",
] as const;

export type CreatePulseBuiltInPresetId = string;
export type CreatePulseRetiredPresetId = (typeof CREATE_PULSE_RETIRED_PRESET_IDS)[number];
export type CreatePulsePresetId = string;
export type CreatePulseCustomPresetId = string;

export type CreatePulseSavedPreset = {
  presetId: CreatePulsePresetId;
  label: string;
  description?: string | null;
  systemInstructions: string;
  pulseKind?: CreatePulsePresetKind;
  runtimeMode?: CreatePulseRuntimeMode;
  activationMode?: CreatePulseActivationMode;
  starterAssistantMessage?: string | null;
  workflowStageHints?: CreatePulseWorkflowStageHints | null;
  outputMode?: CreatePulseOutputMode;
  artifactTarget?: CreatePulseArtifactTarget;
  memoryPolicy?: CreatePulseMemoryPolicy;
  createdAt: string | null;
  schemaVersion?: number | null;
  isHidden?: boolean | null;
};

export type CreatePulseResolvedPreset = {
  presetId: CreatePulsePresetId;
  label: string;
  description: string | null;
  systemInstructions: string;
  pulseKind: CreatePulsePresetKind;
  runtimeMode: CreatePulseRuntimeMode;
  activationMode: CreatePulseActivationMode;
  starterAssistantMessage: string | null;
  workflowStageHints: CreatePulseWorkflowStageHints | null;
  outputMode: CreatePulseOutputMode;
  artifactTarget?: CreatePulseArtifactTarget;
  memoryPolicy: CreatePulseMemoryPolicy;
  schemaVersion: number;
  isCustom: boolean;
  isBuiltIn: boolean;
  isEditable: boolean;
  hasUserOverride: boolean;
};

export type CreatePulsePresetDragSource = "surface" | "panel";
export type CreatePulsePresetDragPayload = {
  presetId: CreatePulsePresetId;
  source: CreatePulsePresetDragSource;
};

const CREATE_PULSE_RETIRED_PRESET_ID_SET = new Set<string>(CREATE_PULSE_RETIRED_PRESET_IDS);

let createPulseCustomPresetFallbackCounter = 0;

const isValidCreatePulseDragSource = (value: string): value is CreatePulsePresetDragSource =>
  value === "surface" || value === "panel";

export const resolveCreatePulseRuntimeModeForKind = (
  pulseKind: CreatePulsePresetKind
): CreatePulseRuntimeMode => (pulseKind === "guided_workflow" ? "workflow_gpt" : "custom_gpt");

export const createCreatePulseCustomSavedPreset = ({
  presetId,
  label,
  systemInstructions,
  createdAt,
  description = null,
}: {
  presetId: CreatePulsePresetId;
  label: string;
  systemInstructions: string;
  createdAt: string | null;
  description?: string | null;
}): CreatePulseSavedPreset => ({
  presetId,
  label,
  description,
  systemInstructions,
  pulseKind: CREATE_PULSE_CUSTOM_AUTHORING_KIND,
  createdAt,
  schemaVersion: CREATE_PULSE_SCHEMA_VERSION,
});

const isCreatePulseArtifactTarget = (value: string): value is CreatePulseArtifactTarget =>
  value === "image_prompt" ||
  value === "video_prompt" ||
  value === "storyboard" ||
  value === "text_artifact";

const isCreatePulsePresetKind = (value: string): value is CreatePulsePresetKind =>
  value === "guided_workflow" || value === "custom_gpt";

const isCreatePulseRuntimeMode = (value: string): value is CreatePulseRuntimeMode =>
  value === "workflow_gpt" || value === "custom_gpt";

const isCreatePulseActivationMode = (value: string): value is CreatePulseActivationMode =>
  value === "activate_and_start" || value === "activate_only";

const isCreatePulseOutputMode = (value: string): value is CreatePulseOutputMode =>
  value === "chat_reply" || value === "apply_prompt";

const buildCreatePulseBuiltInPresetIdIndex = (
  builtInDefinitions: readonly CreatePulseBuiltInPresetDefinition[]
) => new Map(builtInDefinitions.map((definition, index) => [definition.presetId, index] as const));

const buildCreatePulseBuiltInPresetById = (
  builtInDefinitions: readonly CreatePulseBuiltInPresetDefinition[]
) => new Map(builtInDefinitions.map((definition) => [definition.presetId, definition] as const));

export const isCreatePulseRetiredPresetId = (value: string): value is CreatePulseRetiredPresetId =>
  CREATE_PULSE_RETIRED_PRESET_ID_SET.has(value);

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
    : CREATE_PULSE_BUILT_IN_KIND;
  const runtimeMode = isCreatePulseRuntimeMode(runtimeModeRaw)
    ? runtimeModeRaw
    : pulseKind === "guided_workflow"
      ? "workflow_gpt"
      : "custom_gpt";

  if (!presetId || !label || !description || !starterAssistantMessage) {
    return null;
  }
  if (isCreatePulseRetiredPresetId(presetId)) {
    return null;
  }

  return createBuiltInPulseDefinition({
    presetId,
    label,
    description,
    pulseKind,
    runtimeMode,
    activationMode: isCreatePulseActivationMode(activationModeRaw)
      ? activationModeRaw
      : CREATE_PULSE_BUILT_IN_ACTIVATION_MODE,
    outputMode: isCreatePulseOutputMode(outputModeRaw)
      ? outputModeRaw
      : CREATE_PULSE_BUILT_IN_OUTPUT_MODE,
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

const normalizeCreatePulseSavedPresetRecord = (
  value: unknown,
  builtInDefinitions?: readonly CreatePulseBuiltInPresetDefinition[] | null
): CreatePulseSavedPreset | null => {
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
      : typeof (value as { prompt?: unknown }).prompt === "string"
        ? (value as { prompt: string }).prompt.trim()
        : "";
  const createdAtRaw = (value as { createdAt?: unknown }).createdAt;
  const createdAt =
    typeof createdAtRaw === "string" && createdAtRaw.trim().length > 0 ? createdAtRaw.trim() : null;
  const schemaVersionRaw = (value as { schemaVersion?: unknown }).schemaVersion;
  const isHidden = (value as { isHidden?: unknown }).isHidden === true;
  if (!presetId || !label) {
    return null;
  }
  const allowsEmptyInstructionsForHiddenBuiltIn =
    isHidden &&
    resolveCreatePulseBuiltInPresetDefinitions(builtInDefinitions).some(
      (preset) => preset.presetId === presetId
    );
  if (!systemInstructions && !allowsEmptyInstructionsForHiddenBuiltIn) {
    return null;
  }
  if (isCreatePulseRetiredPresetId(presetId)) {
    return null;
  }
  const schemaVersion =
    typeof schemaVersionRaw === "number" &&
    Number.isFinite(schemaVersionRaw) &&
    schemaVersionRaw > 0
      ? Math.trunc(schemaVersionRaw)
      : CREATE_PULSE_SCHEMA_VERSION;

  return {
    presetId,
    label,
    description: description || null,
    systemInstructions,
    pulseKind: CREATE_PULSE_CUSTOM_AUTHORING_KIND,
    createdAt,
    schemaVersion,
    ...(isHidden ? { isHidden: true } : {}),
  };
};

const buildCustomPresetOrderIndex = (savedPresets: readonly CreatePulseSavedPreset[]) =>
  new Map(
    savedPresets
      .filter((preset) => !preset.isHidden && !isCreatePulseBuiltInPresetId(preset.presetId))
      .map((preset, index) => [preset.presetId, index] as const)
  );

const resolveCreatePulseHiddenBuiltInPresetIds = (
  savedPresets?: readonly CreatePulseSavedPreset[] | null,
  builtInDefinitions?: readonly CreatePulseBuiltInPresetDefinition[] | null
) => {
  const resolvedBuiltInDefinitions = resolveCreatePulseBuiltInPresetDefinitions(builtInDefinitions);
  const resolvedBuiltInPresetIds = new Set(
    resolvedBuiltInDefinitions.map((definition) => definition.presetId)
  );
  return new Set(
    normalizeCreatePulseSavedPresets(savedPresets, resolvedBuiltInDefinitions)
      .filter((preset) => preset.isHidden === true && resolvedBuiltInPresetIds.has(preset.presetId))
      .map((preset) => preset.presetId)
  );
};

const resolveVisibleCreatePulseBuiltInPresetDefinitions = (
  savedPresets?: readonly CreatePulseSavedPreset[] | null,
  builtInDefinitions?: readonly CreatePulseBuiltInPresetDefinition[] | null
) => {
  const resolvedBuiltInDefinitions = resolveCreatePulseBuiltInPresetDefinitions(builtInDefinitions);
  const hiddenBuiltInPresetIds = resolveCreatePulseHiddenBuiltInPresetIds(
    savedPresets,
    resolvedBuiltInDefinitions
  );
  return resolvedBuiltInDefinitions.filter(
    (definition) => !hiddenBuiltInPresetIds.has(definition.presetId)
  );
};

/**
 * Ordered list of built-in Pulse presets rendered across Create and library surfaces.
 */
export const CREATE_PULSE_SURFACE_PRESET_IDS = CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS.map(
  (definition) => definition.presetId
) as readonly CreatePulseBuiltInPresetId[];

/**
 * Seeded default preset IDs pinned into the Create Pulse rail.
 */
export const CREATE_PULSE_DEFAULT_PANEL_PRESET_IDS = [
  "image",
  "multi_shot",
  "story_builder",
] as const satisfies readonly CreatePulseBuiltInPresetId[];

/**
 * Resolves the default built-in Pulse ids pinned into the Create rail.
 */
export const resolveCreatePulseDefaultPanelPresetIds = (
  builtInDefinitions?: readonly CreatePulseBuiltInPresetDefinition[] | null
): CreatePulseBuiltInPresetId[] => {
  const resolvedBuiltInDefinitions = resolveCreatePulseBuiltInPresetDefinitions(builtInDefinitions);
  const resolvedDefaultPresetIds = resolvedBuiltInDefinitions
    .slice(0, CREATE_PULSE_DEFAULT_PANEL_PRESET_IDS.length)
    .map((definition) => definition.presetId);
  return resolvedDefaultPresetIds.length > 0
    ? resolvedDefaultPresetIds
    : [...CREATE_PULSE_DEFAULT_PANEL_PRESET_IDS];
};

/**
 * Returns true when a value is a known built-in Pulse preset ID.
 */
export const isCreatePulseBuiltInPresetId = (
  value: string,
  builtInDefinitions?: readonly CreatePulseBuiltInPresetDefinition[] | null
): value is CreatePulseBuiltInPresetId =>
  buildCreatePulseBuiltInPresetById(
    resolveCreatePulseBuiltInPresetDefinitions(builtInDefinitions)
  ).has(value as CreatePulseBuiltInPresetId);

/**
 * Returns true when a value is a known Pulse preset ID in the merged catalog.
 */
export const isCreatePulsePresetId = (
  value: string,
  savedPresets?: readonly CreatePulseSavedPreset[] | null,
  builtInDefinitions?: readonly CreatePulseBuiltInPresetDefinition[] | null
): value is CreatePulsePresetId =>
  resolveCreatePulsePresetCatalog(savedPresets, builtInDefinitions).some(
    (preset) => preset.presetId === value
  );

/**
 * Normalizes persisted custom Pulse presets to unique non-empty records.
 */
export const normalizeCreatePulseSavedPresets = (
  value: unknown,
  builtInDefinitions?: readonly CreatePulseBuiltInPresetDefinition[] | null
): CreatePulseSavedPreset[] => {
  if (!Array.isArray(value)) return [];
  const resolvedBuiltInPresetIds = new Set(
    resolveCreatePulseBuiltInPresetDefinitions(builtInDefinitions).map(
      (definition) => definition.presetId
    )
  );
  const seenPresetIds = new Set<string>();
  const normalized: CreatePulseSavedPreset[] = [];
  value.forEach((entry) => {
    const normalizedEntry = normalizeCreatePulseSavedPresetRecord(entry, builtInDefinitions);
    if (
      !normalizedEntry ||
      (resolvedBuiltInPresetIds.has(normalizedEntry.presetId) &&
        normalizedEntry.isHidden !== true) ||
      seenPresetIds.has(normalizedEntry.presetId)
    ) {
      return;
    }
    seenPresetIds.add(normalizedEntry.presetId);
    normalized.push(normalizedEntry);
  });
  return normalized;
};

/**
 * Normalizes persisted workflow stage hints to a trimmed non-empty list.
 */
export function normalizeCreatePulseWorkflowStageHints(
  value: unknown
): CreatePulseWorkflowStageHints | null {
  if (!Array.isArray(value)) return null;
  const normalized = value
    .flatMap((entry) => (typeof entry === "string" ? [entry.trim()] : []))
    .filter((entry) => entry.length > 0);
  return normalized.length > 0 ? normalized : null;
}

/**
 * Builds a unique custom Pulse preset ID for user-authored presets.
 */
export const createCreatePulseCustomPresetId = (): CreatePulseCustomPresetId => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `pulse_${crypto.randomUUID()}`;
  }
  createPulseCustomPresetFallbackCounter += 1;
  return `pulse_${Date.now().toString(36)}_${createPulseCustomPresetFallbackCounter.toString(36)}`;
};

/**
 * Sorts Pulse preset IDs into canonical built-in order followed by persisted custom order.
 */
export const sortCreatePulsePresetIdsByCanonicalOrder = (
  presetIds: readonly string[],
  savedPresets?: readonly CreatePulseSavedPreset[] | null,
  builtInDefinitions?: readonly CreatePulseBuiltInPresetDefinition[] | null
): CreatePulsePresetId[] => {
  const resolvedBuiltInDefinitions = resolveVisibleCreatePulseBuiltInPresetDefinitions(
    savedPresets,
    builtInDefinitions
  );
  const builtInPresetIdIndex = buildCreatePulseBuiltInPresetIdIndex(resolvedBuiltInDefinitions);
  const normalizedSavedPresets = normalizeCreatePulseSavedPresets(
    savedPresets,
    resolvedBuiltInDefinitions
  );
  const customPresetOrderIndex = buildCustomPresetOrderIndex(normalizedSavedPresets);
  const dedupedPresetIds = Array.from(new Set(presetIds)).filter((presetId) =>
    isCreatePulsePresetId(presetId, normalizedSavedPresets, resolvedBuiltInDefinitions)
  );
  dedupedPresetIds.sort((left, right) => {
    const leftBuiltInIndex = builtInPresetIdIndex.get(left as CreatePulseBuiltInPresetId);
    const rightBuiltInIndex = builtInPresetIdIndex.get(right as CreatePulseBuiltInPresetId);
    if (leftBuiltInIndex != null && rightBuiltInIndex != null) {
      return leftBuiltInIndex - rightBuiltInIndex;
    }
    if (leftBuiltInIndex != null) return -1;
    if (rightBuiltInIndex != null) return 1;
    return (
      (customPresetOrderIndex.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (customPresetOrderIndex.get(right) ?? Number.MAX_SAFE_INTEGER)
    );
  });
  return dedupedPresetIds;
};

/**
 * Normalizes Create Pulse rail preset IDs against the merged Pulse catalog.
 */
export const normalizeCreatePulsePanelPresetIds = (
  presetIds: readonly string[],
  savedPresets?: readonly CreatePulseSavedPreset[] | null,
  builtInDefinitions?: readonly CreatePulseBuiltInPresetDefinition[] | null
): CreatePulsePresetId[] =>
  sortCreatePulsePresetIdsByCanonicalOrder(presetIds, savedPresets, builtInDefinitions).slice(
    0,
    CREATE_PULSE_PANEL_MAX
  );

/**
 * Resolves the full merged Pulse preset catalog for the library and Create rail.
 */
export const resolveCreatePulsePresetCatalog = (
  savedPresets?: readonly CreatePulseSavedPreset[] | null,
  builtInDefinitions?: readonly CreatePulseBuiltInPresetDefinition[] | null
): CreatePulseResolvedPreset[] => {
  const resolvedBuiltInDefinitions = resolveCreatePulseBuiltInPresetDefinitions(builtInDefinitions);
  const hiddenBuiltInPresetIds = resolveCreatePulseHiddenBuiltInPresetIds(
    savedPresets,
    resolvedBuiltInDefinitions
  );
  const visibleBuiltInDefinitions = resolvedBuiltInDefinitions.filter(
    (definition) => !hiddenBuiltInPresetIds.has(definition.presetId)
  );
  const normalizedSavedPresets = normalizeCreatePulseSavedPresets(
    savedPresets,
    resolvedBuiltInDefinitions
  );
  return [
    ...visibleBuiltInDefinitions.map((definition) => {
      return {
        presetId: definition.presetId,
        label: definition.label,
        description: definition.description,
        systemInstructions: "",
        pulseKind: definition.pulseKind,
        runtimeMode: definition.runtimeMode,
        activationMode: definition.activationMode,
        starterAssistantMessage: definition.starterAssistantMessage,
        workflowStageHints: definition.workflowStageHints,
        outputMode: definition.outputMode,
        artifactTarget: definition.artifactTarget,
        memoryPolicy: definition.memoryPolicy,
        schemaVersion: definition.schemaVersion,
        isCustom: false,
        isBuiltIn: true,
        isEditable: false,
        hasUserOverride: false,
      };
    }),
    ...normalizedSavedPresets
      .filter(
        (preset) =>
          !preset.isHidden &&
          !isCreatePulseBuiltInPresetId(preset.presetId, resolvedBuiltInDefinitions)
      )
      .map((preset) => ({
        presetId: preset.presetId,
        label: preset.label,
        description: preset.description ?? null,
        systemInstructions: preset.systemInstructions,
        pulseKind: CREATE_PULSE_CUSTOM_AUTHORING_KIND,
        runtimeMode: CREATE_PULSE_CUSTOM_AUTHORING_RUNTIME_MODE,
        activationMode: CREATE_PULSE_CUSTOM_AUTHORING_ACTIVATION_MODE,
        starterAssistantMessage: null,
        workflowStageHints: null,
        outputMode: CREATE_PULSE_CUSTOM_AUTHORING_OUTPUT_MODE,
        memoryPolicy: CREATE_PULSE_DEFAULT_MEMORY_POLICY,
        schemaVersion: preset.schemaVersion ?? CREATE_PULSE_SCHEMA_VERSION,
        isCustom: true,
        isBuiltIn: false,
        isEditable: true,
        hasUserOverride: true,
      })),
  ];
};

/**
 * Resolves a Pulse preset label by ID.
 */
export const resolveCreatePulsePresetLabelById = (
  presetId: CreatePulsePresetId,
  savedPresets?: readonly CreatePulseSavedPreset[] | null,
  builtInDefinitions?: readonly CreatePulseBuiltInPresetDefinition[] | null
): string => {
  const resolvedBuiltInDefinitions = resolveCreatePulseBuiltInPresetDefinitions(builtInDefinitions);
  const resolvedPreset = resolveCreatePulsePresetCatalog(
    savedPresets,
    resolvedBuiltInDefinitions
  ).find((preset) => preset.presetId === presetId);
  return (
    resolvedPreset?.label ??
    buildCreatePulseBuiltInPresetById(resolvedBuiltInDefinitions).get(
      presetId as CreatePulseBuiltInPresetId
    )?.label ??
    presetId
  );
};

/**
 * Resolves a full Pulse preset definition by ID.
 */
export const resolveCreatePulsePresetById = (
  presetId: CreatePulsePresetId,
  savedPresets?: readonly CreatePulseSavedPreset[] | null,
  builtInDefinitions?: readonly CreatePulseBuiltInPresetDefinition[] | null
): CreatePulseResolvedPreset | null =>
  resolveCreatePulsePresetCatalog(savedPresets, builtInDefinitions).find(
    (preset) => preset.presetId === presetId
  ) ?? null;

/**
 * Upserts a persisted Pulse preset record while preserving canonical ordering.
 */
export const upsertCreatePulseSavedPreset = (
  savedPresets: readonly CreatePulseSavedPreset[],
  nextPreset: CreatePulseSavedPreset,
  builtInDefinitions?: readonly CreatePulseBuiltInPresetDefinition[] | null
): CreatePulseSavedPreset[] => {
  const normalizedSavedPresets = normalizeCreatePulseSavedPresets(savedPresets, builtInDefinitions);
  const existingPresetIndex = normalizedSavedPresets.findIndex(
    (preset) => preset.presetId === nextPreset.presetId
  );
  if (existingPresetIndex === -1) {
    return normalizeCreatePulseSavedPresets(
      [...normalizedSavedPresets, nextPreset],
      builtInDefinitions
    );
  }
  return normalizeCreatePulseSavedPresets(
    normalizedSavedPresets.map((preset, index) =>
      index === existingPresetIndex ? { ...preset, ...nextPreset } : preset
    ),
    builtInDefinitions
  );
};

/**
 * Serializes a drag payload for transfer.
 */
export const serializeCreatePulsePresetDragPayload = (
  payload: CreatePulsePresetDragPayload
): string => JSON.stringify(payload);

/**
 * Parses a Create Pulse preset drag payload from drag transfer data.
 */
export const parseCreatePulsePresetDragPayload = (
  transfer: DataTransfer | null | undefined
): CreatePulsePresetDragPayload | null => {
  if (!transfer) return null;
  const rawPayload = transfer.getData(CREATE_PULSE_PRESET_DRAG_MIME);
  if (!rawPayload) return null;
  try {
    const parsedPayload = JSON.parse(rawPayload) as {
      presetId?: unknown;
      source?: unknown;
    };
    if (
      typeof parsedPayload.presetId !== "string" ||
      parsedPayload.presetId.trim().length === 0 ||
      typeof parsedPayload.source !== "string" ||
      !isValidCreatePulseDragSource(parsedPayload.source)
    ) {
      return null;
    }
    return {
      presetId: parsedPayload.presetId.trim(),
      source: parsedPayload.source,
    };
  } catch {
    return null;
  }
};
