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

const shouldPersistOutputInProjectWorkspaceSnapshot = (output: Record<string, unknown>): boolean =>
  output.taskState !== "fail";

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
  const persistedOutputIds = new Set<string>([
    ...persistedActiveOutputs
      .map((output) => (typeof output.id === "string" ? output.id.trim() : ""))
      .filter((id) => id.length > 0),
    ...persistedArchivedOutputs
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
    active: persistedActiveOutputs,
    archived: persistedArchivedOutputs,
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
    delete baseSnapshot.agentRuntimes;
    const baseWorkspace = asRecord(baseSnapshot.workspace);
    const normalizedSnapshot = {
      ...baseSnapshot,
      workspace: {
        ...baseWorkspace,
        prompt: "",
        standardPrompt: "",
        pulsePrompt: "",
        editReferenceText: "",
        videoReferenceText: "",
        selectedTool: "create",
        expertCreateMode: "standard",
        activePulsePresetId: null,
        pulseSessionInstanceId: null,
      },
      outputs: stripFailedOutputsFromProjectWorkspaceOutputs(baseSnapshot.outputs),
      agent: emptyAgentRuntime,
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
      prompt: "",
      standardPrompt: "",
      pulsePrompt: "",
      editReferenceText: "",
      videoReferenceText: "",
      selectedTool: "create",
      expertCreateMode: "standard",
      activePulsePresetId: null,
      pulseSessionInstanceId: null,
    },
    outputs: stripFailedOutputsFromProjectWorkspaceOutputs(snapshot.outputs),
    agent: emptyAgentRuntime,
  } as unknown as TSnapshot;
};
