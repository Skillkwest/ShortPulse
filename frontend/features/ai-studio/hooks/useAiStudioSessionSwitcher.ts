/**
 * AI Studio session switcher controller.
 * Orchestrates recent-session listing and deterministic save -> hydrate -> sid switch flow.
 */
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AI_STUDIO_SESSION_QUERY_KEY } from "../logic/sessionIdentity";
import {
  listAiStudioSessionsViaApi,
  type AiStudioSessionListApiItem,
} from "../logic/sessionApiClient";
import { persistAiStudioSessionShadow } from "../logic/sessionShadowPersistence";
import { loadAiStudioSessionRestoreCandidate } from "../logic/sessionRestoreCandidate";
import type { AiStudioSessionSnapshot } from "../logic/sessionSnapshot";
import type { AiStudioSessionHydrationPayload } from "../logic/sessionSnapshotHydrator";
import { resolveAiStudioSessionSnapshotTitle } from "../logic/sessionSnapshotTitle";
import { readAiStudioSessionPersistencePolicy } from "../logic/sessionPersistencePolicy";

const DEFAULT_SESSIONS_PAGE_SIZE = 20;

type UseAiStudioSessionSwitcherParams = {
  sessionId: string | null;
  sessionSnapshot: AiStudioSessionSnapshot | null;
  hydrateFromSessionSnapshot: (
    snapshot: AiStudioSessionSnapshot
  ) => AiStudioSessionHydrationPayload;
  hydrateFromSessionAgentSnapshot: (agent: AiStudioSessionHydrationPayload["agent"]) => void;
  setSkipRestoreApplyForSessionId: (sessionId: string | null) => void;
};

/**
 * Returns modal/list/switch handlers for the AI Studio session picker.
 */
export const useAiStudioSessionSwitcher = ({
  sessionId,
  sessionSnapshot,
  hydrateFromSessionSnapshot,
  hydrateFromSessionAgentSnapshot,
  setSkipRestoreApplyForSessionId,
}: UseAiStudioSessionSwitcherParams) => {
  const { persistenceEnabled, remoteShadowEnabled } = readAiStudioSessionPersistencePolicy();
  const router = useRouter();
  const [isSessionsModalOpen, setIsSessionsModalOpen] = useState(false);
  const [sessions, setSessions] = useState<AiStudioSessionListApiItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingMoreSessions, setIsLoadingMoreSessions] = useState(false);
  const [sessionsLoadError, setSessionsLoadError] = useState<string | null>(null);
  const [pendingSessionSwitch, setPendingSessionSwitch] =
    useState<AiStudioSessionListApiItem | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [isSwitchingSession, setIsSwitchingSession] = useState(false);
  const sessionListRequestSeqRef = useRef(0);
  const switchInFlightRef = useRef(false);

  const loadInitialSessions = useCallback(async () => {
    if (!persistenceEnabled || !remoteShadowEnabled) {
      setSessions([]);
      setNextCursor(null);
      setSessionsLoadError("Session persistence is disabled.");
      return;
    }
    setIsLoadingSessions(true);
    setSessionsLoadError(null);
    const requestSeq = sessionListRequestSeqRef.current + 1;
    sessionListRequestSeqRef.current = requestSeq;
    try {
      const payload = await listAiStudioSessionsViaApi({
        limit: DEFAULT_SESSIONS_PAGE_SIZE,
      });
      if (sessionListRequestSeqRef.current !== requestSeq) return;
      setSessions(payload.sessions);
      setNextCursor(payload.nextCursor);
    } catch (error) {
      if (sessionListRequestSeqRef.current !== requestSeq) return;
      const message = error instanceof Error ? error.message : "Unable to load AI Studio sessions.";
      setSessionsLoadError(message);
    } finally {
      if (sessionListRequestSeqRef.current === requestSeq) {
        setIsLoadingSessions(false);
      }
    }
  }, [persistenceEnabled, remoteShadowEnabled]);

  const loadMoreSessions = useCallback(async () => {
    if (!persistenceEnabled || !remoteShadowEnabled) return;
    if (!nextCursor || isLoadingSessions || isLoadingMoreSessions) return;
    setIsLoadingMoreSessions(true);
    setSessionsLoadError(null);
    try {
      const payload = await listAiStudioSessionsViaApi({
        limit: DEFAULT_SESSIONS_PAGE_SIZE,
        cursor: nextCursor,
      });
      setSessions((prev) => {
        const next = [...prev];
        payload.sessions.forEach((item) => {
          if (next.some((existing) => existing.sessionId === item.sessionId)) return;
          next.push(item);
        });
        return next;
      });
      setNextCursor(payload.nextCursor);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load more sessions.";
      setSessionsLoadError(message);
    } finally {
      setIsLoadingMoreSessions(false);
    }
  }, [
    isLoadingMoreSessions,
    isLoadingSessions,
    nextCursor,
    persistenceEnabled,
    remoteShadowEnabled,
  ]);

  const handleOpenSessionsModal = useCallback(() => {
    if (!persistenceEnabled || !remoteShadowEnabled) return;
    setIsSessionsModalOpen(true);
  }, [persistenceEnabled, remoteShadowEnabled]);

  const handleCloseSessionsModal = useCallback(() => {
    if (isSwitchingSession) return;
    setIsSessionsModalOpen(false);
    setPendingSessionSwitch(null);
    setSwitchError(null);
  }, [isSwitchingSession]);

  const handleRequestSessionSwitch = useCallback(
    (item: AiStudioSessionListApiItem) => {
      if (!sessionId || item.sessionId === sessionId) return;
      if (isSwitchingSession) return;
      setPendingSessionSwitch(item);
      setSwitchError(null);
    },
    [isSwitchingSession, sessionId]
  );

  const handleCancelSessionSwitch = useCallback(() => {
    if (isSwitchingSession) return;
    setPendingSessionSwitch(null);
    setSwitchError(null);
  }, [isSwitchingSession]);

  const handleConfirmSessionSwitch = useCallback(async () => {
    if (!pendingSessionSwitch || isSwitchingSession || switchInFlightRef.current) return;
    if (!persistenceEnabled || !remoteShadowEnabled) {
      setSwitchError("Session persistence is disabled.");
      return;
    }
    if (!sessionId || !sessionSnapshot) {
      setSwitchError("Current session is still initializing. Try again in a moment.");
      return;
    }

    switchInFlightRef.current = true;
    setIsSwitchingSession(true);
    setSwitchError(null);

    try {
      await persistAiStudioSessionShadow(sessionId, sessionSnapshot, {
        title: resolveAiStudioSessionSnapshotTitle(sessionSnapshot),
      });
      const targetSessionId = pendingSessionSwitch.sessionId;
      const candidate = await loadAiStudioSessionRestoreCandidate({
        sessionId: targetSessionId,
        remoteEnabled: remoteShadowEnabled,
      });
      const snapshot = candidate.snapshot;
      if (!snapshot) {
        throw new Error("Selected session is unavailable or has expired.");
      }

      const payload = hydrateFromSessionSnapshot(snapshot);
      hydrateFromSessionAgentSnapshot(payload.agent);
      setSkipRestoreApplyForSessionId(targetSessionId);

      await router.replace(
        {
          pathname: router.pathname,
          query: {
            ...router.query,
            [AI_STUDIO_SESSION_QUERY_KEY]: targetSessionId,
          },
        },
        undefined,
        { shallow: true, scroll: false }
      );

      setPendingSessionSwitch(null);
      setSwitchError(null);
      setIsSessionsModalOpen(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to switch AI Studio session.";
      setSwitchError(message);
    } finally {
      switchInFlightRef.current = false;
      setIsSwitchingSession(false);
    }
  }, [
    hydrateFromSessionAgentSnapshot,
    hydrateFromSessionSnapshot,
    isSwitchingSession,
    pendingSessionSwitch,
    router,
    sessionId,
    sessionSnapshot,
    setSkipRestoreApplyForSessionId,
    persistenceEnabled,
    remoteShadowEnabled,
  ]);

  useEffect(() => {
    if (!isSessionsModalOpen) return;
    void loadInitialSessions();
  }, [isSessionsModalOpen, loadInitialSessions]);

  return {
    isSessionsModalOpen,
    sessions,
    nextCursor,
    isLoadingSessions,
    isLoadingMoreSessions,
    sessionsLoadError,
    pendingSessionSwitch,
    switchError,
    isSwitchingSession,
    handleOpenSessionsModal,
    handleCloseSessionsModal,
    handleReloadSessions: loadInitialSessions,
    handleLoadMoreSessions: loadMoreSessions,
    handleRequestSessionSwitch,
    handleCancelSessionSwitch,
    handleConfirmSessionSwitch,
  };
};
