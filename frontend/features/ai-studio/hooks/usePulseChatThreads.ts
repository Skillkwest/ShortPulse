/**
 * Project-owned Pulse chat state controller.
 * Keeps the left-rail `Chats` library local to the current project workspace snapshot instead of
 * using a separate global persistence surface.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { AiStudioSessionAgentV1 } from "../logic/sessionSnapshot";
import {
  buildPulseChatProjectThreadRecord,
  buildPulseChatThreadSnapshot,
  mergePulseChatThreadRuntime,
  resolvePulseChatRuntimeSignature,
  upsertPulseChatProjectThread,
  type PulseChatProjectState,
  type PulseChatProjectThreadRecord,
  type PulseChatThreadSnapshot,
} from "../pulseChats/pulseChatThread";

type UsePulseChatThreadsParams = {
  enabled: boolean;
  projectPulseChatState: PulseChatProjectState;
  setProjectPulseChatState: Dispatch<SetStateAction<PulseChatProjectState>>;
  expertCreateMode: "standard" | "pulse";
  activePresetId: string | null;
  activePresetLabel: string | null;
  pulseSessionInstanceId: string | null;
  pulsePrompt: string;
  persistedAgentRuntime: AiStudioSessionAgentV1;
  openThreadSnapshot: (thread: {
    threadId: string;
    snapshot: PulseChatThreadSnapshot;
  }) => Promise<void>;
  setUiNotice?: (message: string | null) => void;
};

const fallbackUuid = (): string => {
  const template = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
  let seed = Date.now();
  return template.replace(/[xy]/g, (token) => {
    const random = ((seed + Math.random() * 16) % 16) | 0;
    seed = Math.floor(seed / 16);
    const value = token === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
};

const createThreadId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return fallbackUuid();
};

const matchesPulseRuntime = (
  thread: PulseChatProjectThreadRecord | null,
  activePresetId: string,
  pulseSessionInstanceId: string
): thread is PulseChatProjectThreadRecord =>
  thread?.snapshot.workspace.activePulsePresetId === activePresetId &&
  thread.snapshot.workspace.pulseSessionInstanceId === pulseSessionInstanceId;

export const usePulseChatThreads = ({
  enabled,
  projectPulseChatState,
  setProjectPulseChatState,
  expertCreateMode,
  activePresetId,
  activePresetLabel,
  pulseSessionInstanceId,
  pulsePrompt,
  persistedAgentRuntime,
  openThreadSnapshot,
  setUiNotice,
}: UsePulseChatThreadsParams) => {
  const [error, setError] = useState<string | null>(null);
  const [openingThreadId, setOpeningThreadId] = useState<string | null>(null);
  const lastRuntimeSignatureRef = useRef<string | null>(null);
  const openingThreadRef = useRef<PulseChatProjectThreadRecord | null>(null);

  const reportError = useCallback(
    (message: string) => {
      setError(message);
      setUiNotice?.(message);
    },
    [setUiNotice]
  );

  useEffect(() => {
    if (enabled) return;
    setError(null);
    setOpeningThreadId(null);
    lastRuntimeSignatureRef.current = null;
    openingThreadRef.current = null;
  }, [enabled]);

  useEffect(() => {
    if (!enabled || expertCreateMode !== "pulse" || !activePresetId || !pulseSessionInstanceId) {
      lastRuntimeSignatureRef.current = null;
      return;
    }

    const runtimeSignature = resolvePulseChatRuntimeSignature({
      presetId: activePresetId,
      pulseSessionInstanceId,
      pulsePrompt,
      runtime: persistedAgentRuntime,
    });
    if (lastRuntimeSignatureRef.current === runtimeSignature) {
      return;
    }
    lastRuntimeSignatureRef.current = runtimeSignature;

    setProjectPulseChatState((current) => {
      const activeThread =
        current.activeThreadId != null
          ? (current.threads.find((thread) => thread.threadId === current.activeThreadId) ?? null)
          : null;
      const openingThread =
        openingThreadRef.current != null
          ? (current.threads.find(
              (thread) => thread.threadId === openingThreadRef.current?.threadId
            ) ?? openingThreadRef.current)
          : null;
      const reusableThread = matchesPulseRuntime(
        activeThread,
        activePresetId,
        pulseSessionInstanceId
      )
        ? activeThread
        : matchesPulseRuntime(openingThread, activePresetId, pulseSessionInstanceId)
          ? openingThread
          : null;
      const threadId = reusableThread?.threadId ?? createThreadId();
      const existingThreadSnapshot =
        current.threads.find((thread) => thread.threadId === threadId)?.snapshot ?? null;
      const snapshot = buildPulseChatThreadSnapshot({
        presetId: activePresetId,
        presetLabel: activePresetLabel,
        pulseSessionInstanceId,
        pulsePrompt,
        runtime: mergePulseChatThreadRuntime({
          existingSnapshot: existingThreadSnapshot,
          runtime: persistedAgentRuntime,
        }),
      });
      const record = buildPulseChatProjectThreadRecord({
        threadId,
        snapshot,
        title: reusableThread?.title ?? null,
        titleSource: reusableThread?.titleSource ?? "auto",
      });
      return upsertPulseChatProjectThread(current, record, {
        activeThreadId: threadId,
      });
    });
    setError(null);
  }, [
    activePresetId,
    activePresetLabel,
    enabled,
    expertCreateMode,
    persistedAgentRuntime,
    pulsePrompt,
    pulseSessionInstanceId,
    setProjectPulseChatState,
  ]);

  const openThread = useCallback(
    async (threadId: string) => {
      const thread = projectPulseChatState.threads.find((entry) => entry.threadId === threadId);
      if (!thread) {
        reportError("Saved Pulse chat is unavailable.");
        return;
      }
      setOpeningThreadId(threadId);
      setError(null);
      openingThreadRef.current = thread;
      try {
        await openThreadSnapshot({
          threadId,
          snapshot: thread.snapshot,
        });
        setProjectPulseChatState((current) =>
          upsertPulseChatProjectThread(current, thread, {
            activeThreadId: threadId,
          })
        );
      } catch (errorValue) {
        reportError(
          errorValue instanceof Error ? errorValue.message : "Failed to open Pulse chat."
        );
      } finally {
        if (openingThreadRef.current?.threadId === threadId) {
          openingThreadRef.current = null;
        }
        setOpeningThreadId(null);
      }
    },
    [openThreadSnapshot, projectPulseChatState, reportError, setProjectPulseChatState]
  );

  const renameThread = useCallback(
    (threadId: string, title: string) => {
      setProjectPulseChatState((current) => {
        const thread = current.threads.find((entry) => entry.threadId === threadId);
        if (!thread) return current;
        const renamedThread = buildPulseChatProjectThreadRecord({
          threadId: thread.threadId,
          snapshot: thread.snapshot,
          title,
          titleSource: "manual",
          updatedAt: thread.updatedAt,
        });
        return upsertPulseChatProjectThread(current, renamedThread, {
          activeThreadId: current.activeThreadId,
        });
      });
      setError(null);
    },
    [setProjectPulseChatState]
  );

  return useMemo(
    () => ({
      threads: projectPulseChatState.threads,
      activeThreadId: projectPulseChatState.activeThreadId,
      loading: false,
      error,
      openingThreadId,
      openThread,
      renameThread,
    }),
    [error, projectPulseChatState, openThread, openingThreadId, renameThread]
  );
};
