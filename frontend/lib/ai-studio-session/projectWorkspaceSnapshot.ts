import { STANDARD_CREATE_DEFAULT_CHAT_MODE_ENABLED } from "../../features/ai-studio/logic/chatModeDefaults";

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

const hasProjectRestorableOutputPayload = (output: Record<string, unknown>): boolean =>
  hasText(output.previewText) ||
  hasText(output.previewUrl) ||
  hasText(output.previewPosterUrl) ||
  hasStringEntries(output.resultUrls);

const hasProjectDurableOutputAuthority = (output: Record<string, unknown>): boolean =>
  hasText(output.previewPosterStoragePath) ||
  hasText(output.previewStoragePath) ||
  hasText(output.fullStoragePath) ||
  hasStringEntries(output.savedMediaIds);

const hasProjectPersistedOutputPreviewAuthority = (output: Record<string, unknown>): boolean =>
  hasText(output.previewPosterStoragePath) ||
  hasText(output.previewStoragePath) ||
  hasText(output.fullStoragePath) ||
  hasText(output.companionArtStoragePath);

const hasProjectRecoverableRuntimeIdentity = (output: Record<string, unknown>): boolean =>
  hasText(output.generationId) || hasText(output.sourceRef) || hasText(output.taskId);

const isInFlightProjectOutput = (output: Record<string, unknown>): boolean => {
  const taskState =
    typeof output.taskState === "string" ? output.taskState.trim().toLowerCase() : "";
  return taskState === "pending" || taskState === "running";
};

const shouldTrimGeneratedOutputPayload = (output: Record<string, unknown>): boolean =>
  hasText(output.generationId) && !isInFlightProjectOutput(output);

const trimGeneratedProjectWorkspaceOutput = (
  output: Record<string, unknown>
): Record<string, unknown> => {
  if (!shouldTrimGeneratedOutputPayload(output)) return output;

  const trimmedOutput = {
    ...output,
  };

  delete trimmedOutput.prompt;
  delete trimmedOutput.transcriptText;
  delete trimmedOutput.errorMessage;
  delete trimmedOutput.errorMessageShort;
  delete trimmedOutput.errorDetail;
  delete trimmedOutput.generationReplay;
  delete trimmedOutput.characterContext;
  delete trimmedOutput.styleContext;

  if (hasProjectPersistedOutputPreviewAuthority(output)) {
    delete trimmedOutput.resultUrls;
    delete trimmedOutput.previewUrl;
    delete trimmedOutput.previewPosterUrl;
    delete trimmedOutput.companionArtUrl;
  }

  return trimmedOutput;
};

const shouldPersistOutputInProjectWorkspaceSnapshot = (
  output: Record<string, unknown>
): boolean => {
  if (output.taskState === "fail") return false;
  return (
    hasProjectRestorableOutputPayload(output) ||
    hasProjectDurableOutputAuthority(output) ||
    hasProjectRecoverableRuntimeIdentity(output)
  );
};

const filterProjectWorkspaceOutputIds = (
  value: unknown,
  persistedOutputIds: Set<string>
): string[] =>
  Array.isArray(value)
    ? value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0 && persistedOutputIds.has(entry))
    : [];

const stripFailedOutputsFromProjectWorkspaceOutputs = (
  outputs: unknown
): Record<string, unknown> => {
  const outputsRecord = asRecord(outputs);
  const persistedActiveOutputs = (Array.isArray(outputsRecord.active) ? outputsRecord.active : [])
    .map((output) => asRecord(output))
    .filter(shouldPersistOutputInProjectWorkspaceSnapshot);
  const persistedArchivedOutputs = (
    Array.isArray(outputsRecord.archived) ? outputsRecord.archived : []
  )
    .map((output) => asRecord(output))
    .filter(shouldPersistOutputInProjectWorkspaceSnapshot);
  const normalizedActiveOutputs = persistedActiveOutputs.map(trimGeneratedProjectWorkspaceOutput);
  const normalizedArchivedOutputs = persistedArchivedOutputs.map(
    trimGeneratedProjectWorkspaceOutput
  );
  const persistedOutputIds = new Set<string>([
    ...normalizedActiveOutputs
      .map((output) => (typeof output.id === "string" ? output.id.trim() : ""))
      .filter((id) => id.length > 0),
    ...normalizedArchivedOutputs
      .map((output) => (typeof output.id === "string" ? output.id.trim() : ""))
      .filter((id) => id.length > 0),
  ]);
  const candidateActiveOutputId =
    typeof outputsRecord.activeOutputId === "string" ? outputsRecord.activeOutputId.trim() : "";
  const activeOutputId =
    candidateActiveOutputId.length > 0 && persistedOutputIds.has(candidateActiveOutputId)
      ? candidateActiveOutputId
      : null;

  return {
    ...outputsRecord,
    active: normalizedActiveOutputs,
    archived: normalizedArchivedOutputs,
    activeOutputId,
    curatedReferenceIds: filterProjectWorkspaceOutputIds(
      outputsRecord.curatedReferenceIds,
      persistedOutputIds
    ),
    removedFromAllRefsIds: filterProjectWorkspaceOutputIds(
      outputsRecord.removedFromAllRefsIds,
      persistedOutputIds
    ),
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
  snapshot: TSnapshot
): TSnapshot => {
  const emptyAgentRuntime = createEmptyAiStudioSessionAgentState();
  if (snapshot.schemaVersion >= 2) {
    const baseSnapshot = {
      ...snapshot,
    } as MinimalAiStudioSessionSnapshot;
    delete baseSnapshot.meta;
    const baseWorkspace = asRecord(baseSnapshot.workspace);
    const normalizedSnapshot = {
      ...baseSnapshot,
      workspace: {
        ...baseWorkspace,
        editReferenceText: "",
        videoReferenceText: "",
      },
      outputs: stripFailedOutputsFromProjectWorkspaceOutputs(baseSnapshot.outputs),
      agent: emptyAgentRuntime,
      agentRuntimes: trimProjectWorkspaceAgentRuntimes(baseSnapshot.agentRuntimes, baseWorkspace),
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
    workspace: {
      ...asRecord(snapshot.workspace),
      editReferenceText: "",
      videoReferenceText: "",
    },
    outputs: stripFailedOutputsFromProjectWorkspaceOutputs(snapshot.outputs),
    agent: emptyAgentRuntime,
  } as unknown as TSnapshot;
};
