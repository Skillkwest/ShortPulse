import { STANDARD_CREATE_DEFAULT_CHAT_MODE_ENABLED } from "../../features/ai-studio/logic/chatModeDefaults";

type MinimalAiStudioSessionSnapshot = {
  schemaVersion: number;
  updatedAt: string;
  workspace?: Record<string, unknown>;
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
        selectedTool: "create",
        expertCreateMode: "standard",
        activePulsePresetId: null,
        pulseSessionInstanceId: null,
      },
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
      selectedTool: "create",
      expertCreateMode: "standard",
      activePulsePresetId: null,
      pulseSessionInstanceId: null,
    },
    agent: emptyAgentRuntime,
  } as unknown as TSnapshot;
};
