/**
 * Project-owned Pulse chat thread types and normalization helpers.
 * Keeps saved Pulse thread history isolated from Standard mode and stable inside project workspace snapshots.
 */
import type { AgentPulseWorkflowSession } from "../../../prefabs/agent";
import type { AiStudioSessionAgentV1 } from "../logic/sessionSnapshot";
import type { CreateRuntimeAgentHydrationPayload } from "../createRuntime/sessionAgentHydrationBoundary";
import { buildHydratedAgentRuntime } from "../logic/sessionSnapshotHydrator";
import { normalizePulseChatTitle, resolvePulseChatThreadTitle } from "./pulseChatTitles";

export const PULSE_CHAT_THREAD_KIND = "pulse_chat_v1" as const;
export const PULSE_CHAT_THREAD_SCHEMA_VERSION = 1 as const;
export const PULSE_CHAT_PROJECT_STATE_SCHEMA_VERSION = 1 as const;
export const MAX_PULSE_CHAT_SAVED_MESSAGES = 200;

export type PulseChatThreadSnapshot = {
  kind: typeof PULSE_CHAT_THREAD_KIND;
  schemaVersion: typeof PULSE_CHAT_THREAD_SCHEMA_VERSION;
  workspace: {
    expertCreateMode: "pulse";
    activePulsePresetId: string;
    pulseSessionInstanceId: string;
    pulsePrompt: string;
  };
  runtime: AiStudioSessionAgentV1;
  meta: {
    presetLabel: string | null;
    updatedAt: string;
  };
};

export type PulseChatThreadListItem = {
  threadId: string;
  title: string;
  titleSource: "auto" | "manual";
  presetId: string;
  presetLabel: string | null;
  updatedAt: string;
};

export type PulseChatProjectThreadRecord = PulseChatThreadListItem & {
  snapshot: PulseChatThreadSnapshot;
};

export type PulseChatProjectState = {
  schemaVersion: typeof PULSE_CHAT_PROJECT_STATE_SCHEMA_VERSION;
  activeThreadId: string | null;
  threads: PulseChatProjectThreadRecord[];
};

export type PulseChatHydrationPayload = CreateRuntimeAgentHydrationPayload;

const normalizeText = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : null;
};

const normalizeIsoTimestamp = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
};

const isAgentRuntime = (value: unknown): value is AiStudioSessionAgentV1 => {
  if (!value || typeof value !== "object") return false;
  const typed = value as Partial<AiStudioSessionAgentV1>;
  return (
    Array.isArray(typed.messages) &&
    typeof typed.input === "string" &&
    (typed.latestAgentPrompt === null || typeof typed.latestAgentPrompt === "string") &&
    (typed.promptOrigin === "manual" ||
      typed.promptOrigin === "agent" ||
      typed.promptOrigin === "reference") &&
    typeof typed.chatModeEnabled === "boolean"
  );
};

const isPulseWorkflowSession = (value: unknown): value is AgentPulseWorkflowSession | null => {
  if (value == null) return true;
  if (!value || typeof value !== "object") return false;
  const typed = value as Partial<AgentPulseWorkflowSession>;
  return typeof typed.status === "string";
};

const resolvePulseChatMessageSignature = (
  message: AiStudioSessionAgentV1["messages"][number]
): string =>
  JSON.stringify({
    id: message.id ?? null,
    role: message.role,
    content: message.content,
    outputPrompt: message.outputPrompt ?? null,
    canUseAsPrompt: message.canUseAsPrompt ?? null,
    outcomeClass: message.outcomeClass ?? null,
    reasonCode: message.reasonCode ?? null,
    decision: message.decision ?? null,
    attachments: Array.isArray(message.attachments)
      ? message.attachments.map((attachment) => ({
          id: attachment.id,
          kind: attachment.kind,
          referenceId: attachment.referenceId ?? null,
          mediaId: attachment.mediaId ?? null,
          text: attachment.text ?? null,
          previewStoragePath: attachment.previewStoragePath ?? null,
          fullStoragePath: attachment.fullStoragePath ?? null,
          referenceUrl: attachment.referenceUrl ?? null,
          referenceRenderUrl: attachment.referenceRenderUrl ?? null,
          imageUrl: attachment.imageUrl ?? null,
        }))
      : [],
  });

export const resolvePulseChatRuntimeSignature = ({
  presetId,
  pulseSessionInstanceId,
  pulsePrompt,
  runtime,
}: {
  presetId: string;
  pulseSessionInstanceId: string;
  pulsePrompt: string;
  runtime: AiStudioSessionAgentV1;
}): string =>
  JSON.stringify({
    presetId,
    pulseSessionInstanceId,
    pulsePrompt,
    input: runtime.input,
    latestAgentPrompt: runtime.latestAgentPrompt ?? null,
    promptOrigin: runtime.promptOrigin,
    chatModeEnabled: true,
    pulseWorkflowSession: runtime.pulseWorkflowSession ?? null,
    messages: runtime.messages.map(resolvePulseChatMessageSignature),
  });

const mergePulseChatMessages = (
  previousMessages: AiStudioSessionAgentV1["messages"],
  currentMessages: AiStudioSessionAgentV1["messages"]
): AiStudioSessionAgentV1["messages"] => {
  if (previousMessages.length === 0) return currentMessages;
  if (currentMessages.length === 0) return previousMessages;

  const previousSignatures = previousMessages.map(resolvePulseChatMessageSignature);
  const currentSignatures = currentMessages.map(resolvePulseChatMessageSignature);
  const maxOverlap = Math.min(previousMessages.length, currentMessages.length);
  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    let matches = true;
    for (let index = 0; index < overlap; index += 1) {
      const previousSignature = previousSignatures[previousMessages.length - overlap + index];
      const currentSignature = currentSignatures[index];
      if (!previousSignature || !currentSignature) {
        matches = false;
        break;
      }
      if (previousSignature !== currentSignature) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return [...previousMessages, ...currentMessages.slice(overlap)];
    }
  }

  return currentMessages;
};

export const mergePulseChatThreadRuntime = ({
  existingSnapshot,
  runtime,
}: {
  existingSnapshot: PulseChatThreadSnapshot | null;
  runtime: AiStudioSessionAgentV1;
}): AiStudioSessionAgentV1 => ({
  ...runtime,
  messages: mergePulseChatMessages(
    existingSnapshot?.runtime.messages ?? [],
    runtime.messages
  ).slice(-MAX_PULSE_CHAT_SAVED_MESSAGES),
  chatModeEnabled: true,
  pulseWorkflowSession: runtime.pulseWorkflowSession ?? null,
});

export const buildPulseChatThreadSnapshot = ({
  presetId,
  presetLabel,
  pulseSessionInstanceId,
  pulsePrompt,
  runtime,
  updatedAt = new Date().toISOString(),
}: {
  presetId: string;
  presetLabel?: string | null;
  pulseSessionInstanceId: string;
  pulsePrompt: string;
  runtime: AiStudioSessionAgentV1;
  updatedAt?: string;
}): PulseChatThreadSnapshot => ({
  kind: PULSE_CHAT_THREAD_KIND,
  schemaVersion: PULSE_CHAT_THREAD_SCHEMA_VERSION,
  workspace: {
    expertCreateMode: "pulse",
    activePulsePresetId: presetId,
    pulseSessionInstanceId,
    pulsePrompt,
  },
  runtime: {
    ...runtime,
    chatModeEnabled: true,
  },
  meta: {
    presetLabel: normalizeText(presetLabel) ?? null,
    updatedAt,
  },
});

export const parsePulseChatThreadSnapshot = (value: unknown): PulseChatThreadSnapshot | null => {
  if (!value || typeof value !== "object") return null;
  const typed = value as Partial<PulseChatThreadSnapshot>;
  const workspace = typed.workspace as Partial<PulseChatThreadSnapshot["workspace"]> | undefined;
  const meta = typed.meta as Partial<PulseChatThreadSnapshot["meta"]> | undefined;
  const activePulsePresetId = normalizeText(workspace?.activePulsePresetId);
  const pulseSessionInstanceId = normalizeText(workspace?.pulseSessionInstanceId);
  if (
    typed.kind !== PULSE_CHAT_THREAD_KIND ||
    typed.schemaVersion !== PULSE_CHAT_THREAD_SCHEMA_VERSION ||
    !workspace ||
    workspace.expertCreateMode !== "pulse" ||
    !activePulsePresetId ||
    !pulseSessionInstanceId ||
    typeof workspace.pulsePrompt !== "string" ||
    !isAgentRuntime(typed.runtime) ||
    !meta ||
    (meta.presetLabel != null && typeof meta.presetLabel !== "string") ||
    typeof meta.updatedAt !== "string" ||
    Number.isNaN(Date.parse(meta.updatedAt)) ||
    !isPulseWorkflowSession(typed.runtime.pulseWorkflowSession ?? null)
  ) {
    return null;
  }
  return {
    kind: PULSE_CHAT_THREAD_KIND,
    schemaVersion: PULSE_CHAT_THREAD_SCHEMA_VERSION,
    workspace: {
      expertCreateMode: "pulse",
      activePulsePresetId,
      pulseSessionInstanceId,
      pulsePrompt: workspace.pulsePrompt,
    },
    runtime: {
      ...typed.runtime,
      chatModeEnabled: true,
      pulseWorkflowSession: typed.runtime.pulseWorkflowSession ?? null,
    },
    meta: {
      presetLabel: normalizeText(meta.presetLabel) ?? null,
      updatedAt: new Date(meta.updatedAt).toISOString(),
    },
  };
};

export const buildPulseChatThreadListItem = ({
  threadId,
  title,
  titleSource,
  snapshot,
  updatedAt,
}: {
  threadId: string;
  title?: string | null;
  titleSource?: "auto" | "manual" | null;
  snapshot: PulseChatThreadSnapshot;
  updatedAt?: string;
}): PulseChatThreadListItem => {
  const manualTitle = titleSource === "manual" ? normalizePulseChatTitle(title) : null;
  return {
    threadId,
    title: manualTitle ?? resolvePulseChatThreadTitle(snapshot),
    titleSource: manualTitle ? "manual" : "auto",
    presetId: snapshot.workspace.activePulsePresetId,
    presetLabel: snapshot.meta.presetLabel,
    updatedAt: updatedAt ?? snapshot.meta.updatedAt,
  };
};

const sortProjectThreads = (
  threads: readonly PulseChatProjectThreadRecord[]
): PulseChatProjectThreadRecord[] =>
  [...threads].sort((left, right) => {
    const leftMs = Date.parse(left.updatedAt);
    const rightMs = Date.parse(right.updatedAt);
    if (leftMs !== rightMs) return rightMs - leftMs;
    return right.threadId.localeCompare(left.threadId);
  });

const resolveProjectThreadRuntimeKey = (thread: PulseChatProjectThreadRecord): string =>
  `${thread.snapshot.workspace.activePulsePresetId}\u0000${thread.snapshot.workspace.pulseSessionInstanceId}`;

const compareProjectThreadPreference = (
  left: PulseChatProjectThreadRecord,
  right: PulseChatProjectThreadRecord,
  preferredThreadId: string | null
): PulseChatProjectThreadRecord => {
  if (right.threadId === preferredThreadId && left.threadId !== preferredThreadId) return right;
  if (left.threadId === preferredThreadId && right.threadId !== preferredThreadId) return left;
  const leftMs = Date.parse(left.updatedAt);
  const rightMs = Date.parse(right.updatedAt);
  if (leftMs !== rightMs) return rightMs > leftMs ? right : left;
  return right.threadId.localeCompare(left.threadId) > 0 ? right : left;
};

const mergeDuplicateProjectThreads = (
  left: PulseChatProjectThreadRecord,
  right: PulseChatProjectThreadRecord,
  preferredThreadId: string | null
): PulseChatProjectThreadRecord => {
  const primary = compareProjectThreadPreference(left, right, preferredThreadId);
  const manualTitleThread =
    right.titleSource === "manual" && left.titleSource !== "manual"
      ? right
      : left.titleSource === "manual" && right.titleSource !== "manual"
        ? left
        : null;
  return manualTitleThread
    ? {
        ...primary,
        title: manualTitleThread.title,
        titleSource: "manual",
      }
    : primary;
};

const dedupeProjectThreadsByRuntime = (
  threads: readonly PulseChatProjectThreadRecord[],
  preferredThreadId: string | null = null
): PulseChatProjectThreadRecord[] => {
  const threadsByRuntime = new Map<string, PulseChatProjectThreadRecord>();
  for (const thread of threads) {
    const runtimeKey = resolveProjectThreadRuntimeKey(thread);
    const existingThread = threadsByRuntime.get(runtimeKey);
    threadsByRuntime.set(
      runtimeKey,
      existingThread
        ? mergeDuplicateProjectThreads(existingThread, thread, preferredThreadId)
        : thread
    );
  }
  return sortProjectThreads([...threadsByRuntime.values()]);
};

export const createEmptyPulseChatProjectState = (): PulseChatProjectState => ({
  schemaVersion: PULSE_CHAT_PROJECT_STATE_SCHEMA_VERSION,
  activeThreadId: null,
  threads: [],
});

export const buildPulseChatProjectThreadRecord = ({
  threadId,
  snapshot,
  title,
  titleSource,
  updatedAt,
}: {
  threadId: string;
  snapshot: PulseChatThreadSnapshot;
  title?: string | null;
  titleSource?: "auto" | "manual" | null;
  updatedAt?: string;
}): PulseChatProjectThreadRecord => ({
  ...buildPulseChatThreadListItem({
    threadId,
    title,
    titleSource,
    snapshot,
    updatedAt,
  }),
  snapshot,
});

export const upsertPulseChatProjectThread = (
  state: PulseChatProjectState,
  record: PulseChatProjectThreadRecord,
  options?: {
    activeThreadId?: string | null;
  }
): PulseChatProjectState => {
  const nextThreads = dedupeProjectThreadsByRuntime(
    [record, ...state.threads.filter((thread) => thread.threadId !== record.threadId)],
    record.threadId
  );
  const nextActiveThreadId =
    options && "activeThreadId" in options
      ? (options.activeThreadId ?? null)
      : state.activeThreadId;
  return {
    schemaVersion: PULSE_CHAT_PROJECT_STATE_SCHEMA_VERSION,
    activeThreadId:
      nextActiveThreadId && nextThreads.some((thread) => thread.threadId === nextActiveThreadId)
        ? nextActiveThreadId
        : null,
    threads: nextThreads,
  };
};

export const parsePulseChatProjectState = (value: unknown): PulseChatProjectState => {
  if (!value || typeof value !== "object") {
    return createEmptyPulseChatProjectState();
  }
  const typed = value as Partial<PulseChatProjectState>;
  if (typed.schemaVersion !== PULSE_CHAT_PROJECT_STATE_SCHEMA_VERSION) {
    return createEmptyPulseChatProjectState();
  }

  const seen = new Set<string>();
  const parsedThreads = Array.isArray(typed.threads)
    ? typed.threads
        .map((thread) => {
          if (!thread || typeof thread !== "object") return null;
          const row = thread as Partial<PulseChatProjectThreadRecord> & { snapshot?: unknown };
          const threadId = normalizeText(row.threadId);
          const snapshot = parsePulseChatThreadSnapshot(row.snapshot);
          const updatedAt = normalizeIsoTimestamp(row.updatedAt ?? snapshot?.meta.updatedAt);
          if (!threadId || !snapshot || !updatedAt || seen.has(threadId)) {
            return null;
          }
          seen.add(threadId);
          return buildPulseChatProjectThreadRecord({
            threadId,
            snapshot,
            title: typeof row.title === "string" ? row.title : null,
            titleSource: row.titleSource === "manual" ? "manual" : "auto",
            updatedAt,
          });
        })
        .filter((thread): thread is PulseChatProjectThreadRecord => Boolean(thread))
    : [];

  const activeThreadId = normalizeText(typed.activeThreadId);
  const dedupedThreads = dedupeProjectThreadsByRuntime(parsedThreads, activeThreadId);

  return {
    schemaVersion: PULSE_CHAT_PROJECT_STATE_SCHEMA_VERSION,
    activeThreadId:
      activeThreadId && dedupedThreads.some((thread) => thread.threadId === activeThreadId)
        ? activeThreadId
        : null,
    threads: dedupedThreads,
  };
};

export const resolvePulseChatProjectStateSignature = (value: unknown): string => {
  if (!value || typeof value !== "object") {
    return JSON.stringify(createEmptyPulseChatProjectState());
  }
  const typed = value as Partial<PulseChatProjectState>;
  if (typed.schemaVersion !== PULSE_CHAT_PROJECT_STATE_SCHEMA_VERSION) {
    return JSON.stringify(createEmptyPulseChatProjectState());
  }

  const seen = new Set<string>();
  const threads = Array.isArray(typed.threads)
    ? typed.threads
        .map((thread) => {
          if (!thread || typeof thread !== "object") return null;
          const row = thread as Partial<PulseChatProjectThreadRecord> & { snapshot?: unknown };
          const threadId = normalizeText(row.threadId);
          const snapshot = parsePulseChatThreadSnapshot(row.snapshot);
          const updatedAt = normalizeIsoTimestamp(row.updatedAt ?? snapshot?.meta.updatedAt);
          if (!threadId || !snapshot || !updatedAt || seen.has(threadId)) {
            return null;
          }
          seen.add(threadId);
          const lastMessage = snapshot.runtime.messages.at(-1) ?? null;
          return {
            threadId,
            title: normalizeText(row.title) ?? null,
            titleSource: row.titleSource === "manual" ? "manual" : "auto",
            presetId: snapshot.workspace.activePulsePresetId,
            presetLabel: snapshot.meta.presetLabel,
            updatedAt,
            pulseSessionInstanceId: snapshot.workspace.pulseSessionInstanceId,
            pulsePrompt: snapshot.workspace.pulsePrompt,
            input: snapshot.runtime.input,
            latestAgentPrompt: snapshot.runtime.latestAgentPrompt ?? null,
            promptOrigin: snapshot.runtime.promptOrigin,
            pulseWorkflowSession: snapshot.runtime.pulseWorkflowSession ?? null,
            messageCount: snapshot.runtime.messages.length,
            lastMessageSignature: lastMessage
              ? resolvePulseChatMessageSignature(lastMessage)
              : null,
          };
        })
        .filter((thread): thread is NonNullable<typeof thread> => Boolean(thread))
    : [];

  const activeThreadId = normalizeText(typed.activeThreadId);
  const sortedThreads = threads.sort((left, right) => {
    const leftMs = Date.parse(left.updatedAt);
    const rightMs = Date.parse(right.updatedAt);
    if (leftMs !== rightMs) return rightMs - leftMs;
    return right.threadId.localeCompare(left.threadId);
  });

  return JSON.stringify({
    schemaVersion: PULSE_CHAT_PROJECT_STATE_SCHEMA_VERSION,
    activeThreadId:
      activeThreadId && sortedThreads.some((thread) => thread.threadId === activeThreadId)
        ? activeThreadId
        : null,
    threads: sortedThreads,
  });
};

export const buildPulseChatHydrationPayload = (
  snapshot: PulseChatThreadSnapshot
): PulseChatHydrationPayload => ({
  workspace: {
    expertCreateMode: "pulse",
    standardPrompt: "",
    activePulsePresetId: snapshot.workspace.activePulsePresetId,
    pulseSessionInstanceId: snapshot.workspace.pulseSessionInstanceId,
  },
  agent: {
    messages: [],
    input: "",
    latestAgentPrompt: null,
    promptOrigin: "manual",
    chatModeEnabled: true,
    pulseWorkflowSession: null,
  },
  agentRuntimes: {
    standard: {
      messages: [],
      input: "",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: false,
      pulseWorkflowSession: null,
    },
    pulsePresetId: snapshot.workspace.activePulsePresetId,
    pulseSessionInstanceId: snapshot.workspace.pulseSessionInstanceId,
    pulse: {
      ...buildHydratedAgentRuntime(snapshot.runtime),
      chatModeEnabled: true,
      pulseWorkflowSession: snapshot.runtime.pulseWorkflowSession ?? null,
    },
  },
});
