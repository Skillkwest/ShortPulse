import { STANDARD_CREATE_DEFAULT_CHAT_MODE_ENABLED } from "../../features/ai-studio/logic/chatModeDefaults";
import {
  createProjectDurableAiStudioSessionCanvasState,
  parseAiStudioSessionCanvasState,
  serializeAiStudioSessionCanvasState,
} from "../../features/ai-studio/logic/sessionSnapshotCanvas";
import { createEmptyExpertEditSecondaryImageUrls } from "../../features/ai-studio/logic/expertEditReferenceSlots";
import { sanitizeRightRailLayoutSnapshot } from "../../features/ai-studio/logic/rightRailLayout";

type MinimalAiStudioSessionSnapshot = {
  schemaVersion: number;
  updatedAt: string;
  workspace?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  agent?: unknown;
  meta?: unknown;
  agentRuntimes?: unknown;
};

type MinimalAiStudioSessionAgentState = {
  messages: [];
  input: "";
  latestAgentPrompt: null;
  promptOrigin: "manual";
  chatModeEnabled: false;
  pulseWorkflowSession: null;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const trimProjectWorkspaceRuntimeMessages = (value: unknown): Record<string, unknown> => {
  const runtime = asRecord(value);
  return {
    ...runtime,
    messages: [],
  };
};

const trimProjectWorkspaceAgentRuntimes = (
  value: unknown,
  workspace: Record<string, unknown>
): Record<string, unknown> => {
  const runtimes = asRecord(value);
  const emptyRuntime = createEmptyAiStudioSessionAgentState();
  const workspacePulsePresetId =
    typeof workspace.activePulsePresetId === "string" &&
    workspace.activePulsePresetId.trim().length > 0
      ? workspace.activePulsePresetId.trim()
      : null;
  const workspacePulseSessionInstanceId =
    typeof workspace.pulseSessionInstanceId === "string" &&
    workspace.pulseSessionInstanceId.trim().length > 0
      ? workspace.pulseSessionInstanceId.trim()
      : null;
  const runtimePulsePresetId =
    typeof runtimes.pulsePresetId === "string" && runtimes.pulsePresetId.trim().length > 0
      ? runtimes.pulsePresetId.trim()
      : null;
  const runtimePulseSessionInstanceId =
    typeof runtimes.pulseSessionInstanceId === "string" &&
    runtimes.pulseSessionInstanceId.trim().length > 0
      ? runtimes.pulseSessionInstanceId.trim()
      : null;
  const hasAuthorizedPulseRuntime =
    workspacePulsePresetId !== null &&
    workspacePulseSessionInstanceId !== null &&
    runtimePulsePresetId === workspacePulsePresetId &&
    runtimePulseSessionInstanceId === workspacePulseSessionInstanceId;

  return {
    standard: emptyRuntime,
    pulsePresetId: hasAuthorizedPulseRuntime ? workspacePulsePresetId : null,
    pulseSessionInstanceId: hasAuthorizedPulseRuntime ? workspacePulseSessionInstanceId : null,
    pulse: hasAuthorizedPulseRuntime
      ? trimProjectWorkspaceRuntimeMessages(runtimes.pulse)
      : emptyRuntime,
  };
};

const hasText = (value: unknown): boolean => typeof value === "string" && value.trim().length > 0;

const hasStringEntries = (value: unknown): boolean =>
  Array.isArray(value) && value.some((entry) => hasText(entry));

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const buildCanonicalGeneratedProjectOutputId = (generationId: string | null): string | null =>
  generationId ? `generated:${generationId}` : null;

const addProjectWorkspaceOutputIdAlias = (
  aliases: Map<string, string>,
  alias: string | null,
  canonicalId: string | null
) => {
  if (!alias || !canonicalId || alias === canonicalId || aliases.has(alias)) return;
  aliases.set(alias, canonicalId);
};

const hasProjectRestorableOutputPayload = (output: Record<string, unknown>): boolean =>
  hasText(output.previewText) ||
  hasText(output.previewUrl) ||
  hasText(output.previewPosterUrl) ||
  hasStringEntries(output.resultUrls);

export const hasProjectDurableOutputAuthority = (output: Record<string, unknown>): boolean =>
  hasText(output.previewPosterStoragePath) ||
  hasText(output.previewStoragePath) ||
  hasText(output.fullStoragePath) ||
  hasText(output.companionArtStoragePath) ||
  hasStringEntries(output.savedMediaIds);

const hasProjectPersistedOutputPreviewAuthority = (output: Record<string, unknown>): boolean =>
  hasText(output.previewPosterStoragePath) ||
  hasText(output.previewStoragePath) ||
  hasText(output.fullStoragePath) ||
  hasText(output.companionArtStoragePath);

export const hasProjectRecoverableRuntimeIdentity = (output: Record<string, unknown>): boolean =>
  hasText(output.generationId) || hasText(output.sourceRef) || hasText(output.taskId);

export const isProjectGeneratedWorkspaceOutput = (output: Record<string, unknown>): boolean => {
  const mediaSource =
    typeof output.mediaSource === "string" ? output.mediaSource.trim().toLowerCase() : "";
  return mediaSource === "generated" || hasProjectRecoverableRuntimeIdentity(output);
};

const normalizeProjectOutputTaskState = (output: Record<string, unknown>): string =>
  (asTrimmedString(output.taskState) ?? asTrimmedString(output.status) ?? "").toLowerCase();
const isInFlightProjectOutput = (output: Record<string, unknown>): boolean => {
  const taskState = normalizeProjectOutputTaskState(output);
  return taskState === "pending" || taskState === "running";
};

const isFailedProjectOutput = (output: Record<string, unknown>): boolean =>
  ["fail", "failed"].includes(normalizeProjectOutputTaskState(output));

const isPromptOnlyProjectReference = (output: Record<string, unknown>): boolean => {
  const mode = typeof output.mode === "string" ? output.mode.trim().toLowerCase() : "";
  const mediaSource =
    typeof output.mediaSource === "string" ? output.mediaSource.trim().toLowerCase() : "";
  return (
    hasText(output.previewText) &&
    (mode === "text" || mediaSource === "prompt" || hasText(output.promptId))
  );
};

const shouldTrimGeneratedOutputPayload = (output: Record<string, unknown>): boolean =>
  hasText(output.generationId) && !isInFlightProjectOutput(output);

type GeneratedOutputTrimOptions = {
  trimDeliveryUrls?: boolean;
  trimMetadata?: boolean;
};

const trimGeneratedProjectWorkspaceOutput = (
  output: Record<string, unknown>,
  options: GeneratedOutputTrimOptions = {}
): Record<string, unknown> => {
  const trimmedOutput = {
    ...output,
  };
  const trimDeliveryUrls = options.trimDeliveryUrls !== false;
  const trimMetadata = options.trimMetadata !== false;

  if (trimMetadata && hasText(output.generationId)) {
    delete trimmedOutput.generationReplay;
    delete trimmedOutput.workflowReload;
    delete trimmedOutput.characterContext;
    delete trimmedOutput.styleContext;
  }

  if (!shouldTrimGeneratedOutputPayload(output)) {
    return trimmedOutput;
  }

  if (trimMetadata) {
    delete trimmedOutput.prompt;
    delete trimmedOutput.transcriptText;
    delete trimmedOutput.errorMessage;
    delete trimmedOutput.errorMessageShort;
    delete trimmedOutput.errorDetail;
  }

  if (trimDeliveryUrls && hasProjectPersistedOutputPreviewAuthority(output)) {
    delete trimmedOutput.resultUrls;
    delete trimmedOutput.previewUrl;
    delete trimmedOutput.previewPosterUrl;
    delete trimmedOutput.companionArtUrl;
  }

  return trimmedOutput;
};

const trimPromptOnlyProjectWorkspaceOutput = (
  output: Record<string, unknown>
): Record<string, unknown> => {
  if (!isPromptOnlyProjectReference(output)) return output;
  if (
    !hasText(output.prompt) ||
    typeof output.prompt !== "string" ||
    typeof output.previewText !== "string"
  ) {
    return output;
  }
  if (output.prompt.trim() !== output.previewText.trim()) return output;

  const trimmedOutput = {
    ...output,
  };
  delete trimmedOutput.prompt;
  return trimmedOutput;
};

const shouldPersistOutputInProjectWorkspaceSnapshot = (
  output: Record<string, unknown>
): boolean => {
  if (isFailedProjectOutput(output)) return false;
  return (
    hasProjectRestorableOutputPayload(output) ||
    hasProjectDurableOutputAuthority(output) ||
    hasProjectRecoverableRuntimeIdentity(output)
  );
};

const filterProjectWorkspaceOutputIds = ({
  value,
  persistedOutputIds,
  outputIdAliases,
}: {
  value: unknown;
  persistedOutputIds: Set<string>;
  outputIdAliases: Map<string, string>;
}): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const filtered: string[] = [];
  value.forEach((entry) => {
    const outputId = asTrimmedString(entry);
    if (!outputId) return;
    const resolvedOutputId = outputIdAliases.get(outputId) ?? outputId;
    if (!persistedOutputIds.has(resolvedOutputId) || seen.has(resolvedOutputId)) return;
    seen.add(resolvedOutputId);
    filtered.push(resolvedOutputId);
  });
  return filtered;
};

type CanonicalizedProjectWorkspaceOutputs = {
  outputs: Record<string, unknown>;
  outputIdAliases: Map<string, string>;
  persistedOutputIds: Set<string>;
};

type ProjectWorkspaceSnapshotOptions = {
  trimGeneratedOutputDeliveryUrls?: boolean;
  trimGeneratedOutputMetadata?: boolean;
};

const stripFailedOutputsFromProjectWorkspaceOutputs = (
  outputs: unknown,
  options: ProjectWorkspaceSnapshotOptions = {}
): CanonicalizedProjectWorkspaceOutputs => {
  const outputsRecord = asRecord(outputs);
  const trimGeneratedOutputDeliveryUrls = options.trimGeneratedOutputDeliveryUrls !== false;
  const trimGeneratedOutputMetadata = options.trimGeneratedOutputMetadata !== false;
  const persistedActiveOutputs = (Array.isArray(outputsRecord.active) ? outputsRecord.active : [])
    .map((output) => asRecord(output))
    .filter(shouldPersistOutputInProjectWorkspaceSnapshot);
  const normalizedActiveOutputs = persistedActiveOutputs.map((output) => {
    const generatedNormalizedOutput = trimGeneratedProjectWorkspaceOutput(output, {
      trimDeliveryUrls: trimGeneratedOutputDeliveryUrls,
      trimMetadata: trimGeneratedOutputMetadata,
    });
    return trimPromptOnlyProjectWorkspaceOutput(generatedNormalizedOutput);
  });
  const outputIdAliases = new Map<string, string>();
  const persistedOutputIds = new Set<string>();
  const canonicalActiveOutputs: Record<string, unknown>[] = [];

  normalizedActiveOutputs.forEach((output) => {
    const generationId = asTrimmedString(output.generationId);
    const currentId = asTrimmedString(output.id);
    const canonicalGeneratedId = buildCanonicalGeneratedProjectOutputId(generationId);
    const canonicalId = canonicalGeneratedId ?? currentId;

    addProjectWorkspaceOutputIdAlias(outputIdAliases, currentId, canonicalId);
    addProjectWorkspaceOutputIdAlias(outputIdAliases, canonicalGeneratedId, canonicalId);
    addProjectWorkspaceOutputIdAlias(outputIdAliases, generationId, canonicalId);
    addProjectWorkspaceOutputIdAlias(outputIdAliases, asTrimmedString(output.taskId), canonicalId);
    addProjectWorkspaceOutputIdAlias(
      outputIdAliases,
      asTrimmedString(output.sourceRef),
      canonicalId
    );

    const canonicalOutput =
      canonicalId && canonicalId !== currentId ? { ...output, id: canonicalId } : output;

    if (canonicalId) {
      if (persistedOutputIds.has(canonicalId)) {
        return;
      }
      persistedOutputIds.add(canonicalId);
    }

    canonicalActiveOutputs.push(canonicalOutput);
  });

  const normalizedOutputs = {
    ...outputsRecord,
    active: canonicalActiveOutputs,
    archived: [],
    activeOutputId: null,
    curatedReferenceIds: filterProjectWorkspaceOutputIds({
      value: outputsRecord.curatedReferenceIds,
      persistedOutputIds,
      outputIdAliases,
    }),
    removedFromAllRefsIds: filterProjectWorkspaceOutputIds({
      value: outputsRecord.removedFromAllRefsIds,
      persistedOutputIds,
      outputIdAliases,
    }),
  };

  return {
    outputs: normalizedOutputs,
    outputIdAliases,
    persistedOutputIds,
  };
};

const createEmptyProjectWorkspaceReferenceState = () => ({
  selectedTool: "create",
  showCreateTools: false,
  referenceImageUrl: null,
  extraImageUrls: createEmptyExpertEditSecondaryImageUrls(),
  referenceImageInternalMediaRefs: [],
  motionReferenceVideoUrl: null,
  useReferenceImageIndicator: false,
  detailOutputId: null,
});

const resetProjectWorkspaceFields = (
  workspace: Record<string, unknown>
): Record<string, unknown> => ({
  ...workspace,
  mode: "text",
  selectedTool: "create",
  prompt: "",
  standardPrompt: "",
  pulsePrompt: "",
  model: null,
  aspect: "9:16",
  selectedCharacterId: null,
  selectedCharacterLookId: null,
  expertCreateMode: "standard",
  activePulsePresetId: null,
  pulseSessionInstanceId: null,
  createModeReferenceStates: {
    standard: createEmptyProjectWorkspaceReferenceState(),
    pulse: createEmptyProjectWorkspaceReferenceState(),
  },
  referenceImageUrl: null,
  extraImageUrls: createEmptyExpertEditSecondaryImageUrls(),
  referenceImageInternalMediaRefs: [],
  editReferenceText: "",
  videoReferenceText: "",
  videoReferenceMode: "standard",
  videoDurationSeconds: 6,
  videoResolution: "1080p",
  imageResolution: "model_default",
  videoGenerateAudio: false,
  videoCameraFixed: false,
  videoAutoFix: false,
  klingNegativePrompt: "",
  klingCfgScale: 0.5,
  klingWorkflowMode: "single",
  seedance2InputMode: "text",
  seedance2ReferenceImageUrls: [],
  seedance2ReferenceVideoUrls: [],
  seedance2ReferenceAudioUrls: [],
  seedance2ReturnLastFrame: false,
  seedance2WebSearch: false,
  klingShotType: "customize",
  klingVoiceIds: ["", ""],
  klingMultiPrompts: [],
  klingElements: [],
  motionReferenceVideoUrl: null,
  rightRailLayout: sanitizeRightRailLayoutSnapshot(workspace.rightRailLayout),
});

const normalizeProjectWorkspaceCanvas = (value: unknown, outputIdAliases: Map<string, string>) => {
  const parsed = parseAiStudioSessionCanvasState(value);
  const durable = createProjectDurableAiStudioSessionCanvasState(parsed);
  const serialized = durable ? serializeAiStudioSessionCanvasState(durable) : null;
  if (!serialized) return null;
  if (outputIdAliases.size === 0) return serialized;

  const scene = asRecord(serialized.scene);
  const items = Array.isArray(scene.items) ? scene.items : [];
  const normalizedItems = items.map((item) => {
    const record = asRecord(item);
    const outputId = asTrimmedString(record.outputId);
    if (!outputId) return item;
    const resolvedOutputId = outputIdAliases.get(outputId) ?? outputId;
    if (resolvedOutputId === outputId) return item;
    return {
      ...record,
      outputId: resolvedOutputId,
    };
  });

  return {
    ...serialized,
    scene: {
      ...scene,
      items: normalizedItems,
    },
  };
};

export const createEmptyAiStudioSessionAgentState = (): MinimalAiStudioSessionAgentState => ({
  messages: [],
  input: "",
  latestAgentPrompt: null,
  promptOrigin: "manual",
  chatModeEnabled: STANDARD_CREATE_DEFAULT_CHAT_MODE_ENABLED,
  pulseWorkflowSession: null,
});

export const computeAiStudioSessionChecksum = (value: unknown): string => {
  const serialized = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  const normalized = (hash >>> 0).toString(16).padStart(8, "0");
  return `fnv1a32:${normalized}`;
};

export const createAiStudioProjectWorkspaceSnapshot = <
  TSnapshot extends MinimalAiStudioSessionSnapshot,
>(
  snapshot: TSnapshot,
  options: ProjectWorkspaceSnapshotOptions = {}
): TSnapshot => {
  const emptyAgentRuntime = createEmptyAiStudioSessionAgentState();
  if (snapshot.schemaVersion >= 2) {
    const { meta, expertEdit, canvas, ...baseSnapshot } =
      snapshot as MinimalAiStudioSessionSnapshot & {
        canvas?: unknown;
        expertEdit?: unknown;
      };
    void meta;
    void expertEdit;
    const baseWorkspace = asRecord(baseSnapshot.workspace);
    const normalizedWorkspace = resetProjectWorkspaceFields(baseWorkspace);
    const canonicalizedOutputs = stripFailedOutputsFromProjectWorkspaceOutputs(
      baseSnapshot.outputs,
      options
    );
    const normalizedCanvas = normalizeProjectWorkspaceCanvas(
      canvas,
      canonicalizedOutputs.outputIdAliases
    );
    const normalizedSnapshot = {
      ...baseSnapshot,
      workspace: normalizedWorkspace,
      outputs: canonicalizedOutputs.outputs,
      agent: emptyAgentRuntime,
      agentRuntimes: trimProjectWorkspaceAgentRuntimes(
        baseSnapshot.agentRuntimes,
        normalizedWorkspace
      ),
      ...(normalizedCanvas ? { canvas: normalizedCanvas } : {}),
    };
    return {
      ...normalizedSnapshot,
      meta: {
        generatedAt: snapshot.updatedAt,
        checksum: computeAiStudioSessionChecksum(normalizedSnapshot),
      },
    } as unknown as TSnapshot;
  }

  return {
    ...snapshot,
    workspace: resetProjectWorkspaceFields(asRecord(snapshot.workspace)),
    outputs: stripFailedOutputsFromProjectWorkspaceOutputs(snapshot.outputs, options).outputs,
    agent: emptyAgentRuntime,
  } as unknown as TSnapshot;
};
