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
  parsePulseChatProjectState,
  upsertPulseChatProjectThread,
  type PulseChatProjectState,
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
  restartCurrentPulse: () => Promise<boolean>;
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
  restartCurrentPulse,
  setUiNotice,
}: UsePulseChatThreadsParams) => {
  const [error, setError] = useState<string | null>(null);
  const [openingThreadId, setOpeningThreadId] = useState<string | null>(null);
  const [creatingNewChat, setCreatingNewChat] = useState(false);
  const lastRuntimeSignatureRef = useRef<string | null>(null);
  const pendingNewThreadIdRef = useRef<string | null>(null);

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
    setCreatingNewChat(false);
    lastRuntimeSignatureRef.current = null;
    pendingNewThreadIdRef.current = null;
  }, [enabled]);

  useEffect(() => {
    if (!enabled || expertCreateMode !== "pulse" || !activePresetId || !pulseSessionInstanceId) {
      lastRuntimeSignatureRef.current = null;
      return;
    }

    const runtimeSignature = JSON.stringify({
      presetId: activePresetId,
      pulseSessionInstanceId,
      pulsePrompt,
      runtime: persistedAgentRuntime,
    });
    if (lastRuntimeSignatureRef.current === runtimeSignature) {
      return;
    }
    lastRuntimeSignatureRef.current = runtimeSignature;
    const pendingNewThreadId = pendingNewThreadIdRef.current;

    setProjectPulseChatState((current) => {
      const normalized = parsePulseChatProjectState(current);
      const activeThread =
        normalized.activeThreadId != null
          ? (normalized.threads.find((thread) => thread.threadId === normalized.activeThreadId) ??
            null)
          : null;
      const shouldReuseActiveThread =
        !pendingNewThreadId &&
        activeThread?.snapshot.workspace.activePulsePresetId === activePresetId &&
        activeThread.snapshot.workspace.pulseSessionInstanceId === pulseSessionInstanceId;
      const threadId =
        pendingNewThreadId ?? (shouldReuseActiveThread ? activeThread.threadId : createThreadId());
      const existingThreadSnapshot =
        normalized.threads.find((thread) => thread.threadId === threadId)?.snapshot ?? null;
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
      });
      return upsertPulseChatProjectThread(normalized, record, {
        activeThreadId: threadId,
      });
    });
    pendingNewThreadIdRef.current = null;
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
      pendingNewThreadIdRef.current = null;
      const normalizedState = parsePulseChatProjectState(projectPulseChatState);
      const thread = normalizedState.threads.find((entry) => entry.threadId === threadId);
      if (!thread) {
        reportError("Saved Pulse chat is unavailable.");
        return;
      }
      setOpeningThreadId(threadId);
      setError(null);
      try {
        await openThreadSnapshot({
          threadId,
          snapshot: thread.snapshot,
        });
        setProjectPulseChatState((current) =>
          upsertPulseChatProjectThread(parsePulseChatProjectState(current), thread, {
            activeThreadId: threadId,
          })
        );
      } catch (errorValue) {
        reportError(
          errorValue instanceof Error ? errorValue.message : "Failed to open Pulse chat."
        );
      } finally {
        setOpeningThreadId(null);
      }
    },
    [openThreadSnapshot, projectPulseChatState, reportError, setProjectPulseChatState]
  );

  const createNewChat = useCallback(async () => {
    setCreatingNewChat(true);
    setError(null);
    try {
      pendingNewThreadIdRef.current = createThreadId();
      const restarted = await restartCurrentPulse();
      if (!restarted) {
        pendingNewThreadIdRef.current = null;
        return;
      }
      lastRuntimeSignatureRef.current = null;
    } catch (errorValue) {
      pendingNewThreadIdRef.current = null;
      reportError(errorValue instanceof Error ? errorValue.message : "Failed to start a new chat.");
    } finally {
      setCreatingNewChat(false);
    }
  }, [reportError, restartCurrentPulse]);

  const normalizedState = useMemo(
    () => parsePulseChatProjectState(projectPulseChatState),
    [projectPulseChatState]
  );

  return useMemo(
    () => ({
      threads: normalizedState.threads,
      activeThreadId: normalizedState.activeThreadId,
      loading: false,
      error,
      openingThreadId,
      creatingNewChat,
      openThread,
      createNewChat,
    }),
    [creatingNewChat, error, normalizedState, openThread, openingThreadId, createNewChat]
  );
};
