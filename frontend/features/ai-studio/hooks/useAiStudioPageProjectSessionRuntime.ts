/**
 * AI Studio page project/session runtime.
 * Owns project-aware session snapshot patching, agent hydration bridging, and project bootstrap restore wiring.
 */
import { useCallback, useMemo, type Dispatch, type SetStateAction } from "react";
import {
  createEmptyAiStudioSessionAgentState,
  createEmptyAiStudioSessionSnapshot,
  patchAiStudioSessionSnapshotCanvas,
  type AiStudioSessionAgentRuntimesV2,
  type AiStudioSessionSnapshot,
  type AiStudioSessionSnapshotV2,
} from "../logic/sessionSnapshot";
import type { AiStudioSessionHydrationPayload } from "../logic/sessionSnapshotHydrator";
import {
  createProjectDurableAiStudioSessionCanvasState,
  parseAiStudioSessionCanvasState,
  serializeAiStudioSessionCanvasState,
  type AiStudioSessionCanvasState,
} from "../logic/sessionSnapshotCanvas";
import { createProjectRestoreSnapshot } from "../logic/projectRestoreSnapshot";
import type { CreatePageAgentRuntime } from "../createRuntime/contracts";
import type { ExpertEditSessionState } from "../components/edit/expertEditSessionState";
import { type CreateRuntimeAgentHydrationPayload } from "../createRuntime/sessionAgentHydrationBoundary";
import { useAiStudioPageSessionPersistence } from "./useAiStudioPageSessionPersistence";
import type { PulseChatProjectState } from "../pulseChats/pulseChatThread";
import type { AiStudioRightRailLayoutV1 } from "../logic/rightRailLayout";

type UseAiStudioPageProjectSessionRuntimeParams = {
  activeCreateAgentKind: CreatePageAgentRuntime["kind"];
  activeCreatePulsePresetId: string | null;
  activeSessionPersistenceSessionId: string | null;
  buildProjectWorkspaceSnapshot: (args: {
    sessionId: string;
    updatedAt?: string;
  }) => AiStudioSessionSnapshotV2;
  buildSessionSnapshot: (args: {
    sessionId: string;
    agentRuntime: CreatePageAgentRuntime["persistedAgentRuntime"];
    agentRuntimes?: AiStudioSessionAgentRuntimesV2;
    expertEditSessionState?: ExpertEditSessionState | null;
  }) => AiStudioSessionSnapshotV2;
  canvasSessionState: AiStudioSessionCanvasState | null;
  createSelectedCharacterId: string;
  createSelectedCharacterLookId: string;
  expertCreateMode: "standard" | "pulse";
  expertEditSessionRevision: number;
  getExpertEditSessionState: () => ExpertEditSessionState | null;
  hasActivePulseSession: boolean;
  hydrateActiveFromSessionAgentSnapshot: (payload: CreateRuntimeAgentHydrationPayload) => void;
  hydratePulseFromSessionAgentSnapshot?: (payload: CreateRuntimeAgentHydrationPayload) => void;
  hydrateStandardFromSessionAgentSnapshot?: (payload: CreateRuntimeAgentHydrationPayload) => void;
  hydrateCanvasSessionState: (canvas: AiStudioSessionCanvasState | null) => void;
  hydrateFromSessionSnapshot: (
    snapshot: AiStudioSessionSnapshot
  ) => AiStudioSessionHydrationPayload;
  hydrateRightRailLayout?: (layout: AiStudioRightRailLayoutV1) => void;
  isAutosaveWorkDeferred?: boolean;
  patchProjectWorkspaceSnapshot?: (snapshot: AiStudioSessionSnapshot) => AiStudioSessionSnapshot;
  persistedAgentRuntime: CreatePageAgentRuntime["persistedAgentRuntime"];
  persistedPulseAgentRuntime?: CreatePageAgentRuntime["persistedAgentRuntime"];
  persistedStandardAgentRuntime?: CreatePageAgentRuntime["persistedAgentRuntime"];
  projectBootstrapId?: string | null;
  projectId: string | null;
  projectRouteRequested: boolean;
  setProjectPulseChatState?: Dispatch<SetStateAction<PulseChatProjectState>>;
  pulseSessionInstanceId?: string | null;
  pulseWorkflowSession:
    | CreatePageAgentRuntime["persistedAgentRuntime"]["pulseWorkflowSession"]
    | null;
  resetActiveProjectAgentConversation: () => void;
  resetPulseProjectAgentConversation?: () => void;
  resetStandardProjectAgentConversation?: () => void;
  sessionPersistenceTitleOverride: string | null;
  setCreateSelectedCharacterId: (value: string) => void;
  setCreateSelectedCharacterLookId: (value: string) => void;
  setIsCreateCharacterModeEnabled: (value: boolean) => void;
  setExpertEditSessionState: (value: AiStudioSessionHydrationPayload["expertEdit"]) => void;
  setMusicPromptDraft: (value: string) => void;
  setMusicLyricsDraft: (value: string) => void;
  setSoundEffectsPromptDraft: (value: string) => void;
  setUiNotice: Dispatch<SetStateAction<string | null>>;
  setVoiceDesignPromptDraft: (value: string) => void;
  setVoiceScriptDraft: (value: string) => void;
};

type BuildSessionSnapshotArgs = Parameters<
  UseAiStudioPageProjectSessionRuntimeParams["buildSessionSnapshot"]
>[0];

const resolveProjectDurableCanvasSignature = (
  state: AiStudioSessionCanvasState | null
): string | null => (state ? JSON.stringify(serializeAiStudioSessionCanvasState(state)) : null);

/**
 * Returns page-level project/session persistence runtime for AI Studio.
 */
export const useAiStudioPageProjectSessionRuntime = ({
  activeCreateAgentKind,
  activeCreatePulsePresetId,
  activeSessionPersistenceSessionId,
  buildProjectWorkspaceSnapshot,
  canvasSessionState,
  expertCreateMode,
  expertEditSessionRevision,
  getExpertEditSessionState,
  hasActivePulseSession,
  hydrateActiveFromSessionAgentSnapshot,
  hydratePulseFromSessionAgentSnapshot,
  hydrateStandardFromSessionAgentSnapshot,
  hydrateCanvasSessionState,
  hydrateFromSessionSnapshot,
  hydrateRightRailLayout,
  isAutosaveWorkDeferred = false,
  patchProjectWorkspaceSnapshot,
  persistedAgentRuntime,
  persistedPulseAgentRuntime,
  persistedStandardAgentRuntime,
  projectBootstrapId = null,
  projectId,
  projectRouteRequested,
  setProjectPulseChatState,
  pulseSessionInstanceId = null,
  pulseWorkflowSession,
  resetActiveProjectAgentConversation,
  resetPulseProjectAgentConversation,
  resetStandardProjectAgentConversation,
  sessionPersistenceTitleOverride,
  setCreateSelectedCharacterId,
  setCreateSelectedCharacterLookId,
  setIsCreateCharacterModeEnabled,
  setExpertEditSessionState,
  setMusicPromptDraft,
  setMusicLyricsDraft,
  setSoundEffectsPromptDraft,
  setUiNotice,
  setVoiceDesignPromptDraft,
  setVoiceScriptDraft,
}: UseAiStudioPageProjectSessionRuntimeParams) => {
  void expertEditSessionRevision;
  void getExpertEditSessionState;
  const fallbackHydrateStandardFromSessionAgentSnapshot =
    activeCreateAgentKind === "standard" ? hydrateActiveFromSessionAgentSnapshot : undefined;
  const effectiveProjectBootstrapId = projectBootstrapId ?? projectId;
  const fallbackHydratePulseFromSessionAgentSnapshot =
    activeCreateAgentKind === "pulse" ? hydrateActiveFromSessionAgentSnapshot : undefined;
  const resolvedHydrateStandardFromSessionAgentSnapshot =
    hydrateStandardFromSessionAgentSnapshot ?? fallbackHydrateStandardFromSessionAgentSnapshot;
  const resolvedHydratePulseFromSessionAgentSnapshot =
    hydratePulseFromSessionAgentSnapshot ?? fallbackHydratePulseFromSessionAgentSnapshot;
  const resolvedResetStandardProjectAgentConversation =
    resetStandardProjectAgentConversation ??
    (activeCreateAgentKind === "standard" ? resetActiveProjectAgentConversation : undefined);
  const resolvedResetPulseProjectAgentConversation =
    resetPulseProjectAgentConversation ??
    (activeCreateAgentKind === "pulse" ? resetActiveProjectAgentConversation : undefined);
  const resolvedPersistedStandardAgentRuntime =
    persistedStandardAgentRuntime ??
    (activeCreateAgentKind === "standard"
      ? persistedAgentRuntime
      : createEmptyAiStudioSessionAgentState());
  const resolvedPersistedPulseAgentRuntime =
    persistedPulseAgentRuntime ??
    (activeCreateAgentKind === "pulse"
      ? persistedAgentRuntime
      : createEmptyAiStudioSessionAgentState());
  const hasStoredPulseRuntime =
    Boolean(activeCreatePulsePresetId) && Boolean(pulseSessionInstanceId);
  const projectDurableCanvasPayload = useMemo(() => {
    const durableCanvasState = createProjectDurableAiStudioSessionCanvasState(canvasSessionState);
    return {
      signature: resolveProjectDurableCanvasSignature(durableCanvasState),
      state: durableCanvasState,
    };
  }, [canvasSessionState]);
  const projectDurableCanvasState = useMemo(() => {
    if (!projectDurableCanvasPayload.signature) return null;

    return parseAiStudioSessionCanvasState(JSON.parse(projectDurableCanvasPayload.signature));
  }, [projectDurableCanvasPayload.signature]);

  const persistedAgentRuntimes = useMemo<AiStudioSessionAgentRuntimesV2>(
    () => ({
      standard: resolvedPersistedStandardAgentRuntime,
      pulsePresetId: hasStoredPulseRuntime ? activeCreatePulsePresetId : null,
      pulseSessionInstanceId: hasStoredPulseRuntime ? pulseSessionInstanceId : null,
      pulse: hasStoredPulseRuntime
        ? resolvedPersistedPulseAgentRuntime
        : createEmptyAiStudioSessionAgentState(),
    }),
    [
      activeCreatePulsePresetId,
      hasStoredPulseRuntime,
      pulseSessionInstanceId,
      resolvedPersistedPulseAgentRuntime,
      resolvedPersistedStandardAgentRuntime,
    ]
  );

  const resetProjectAgentConversation = useCallback(() => {
    resolvedResetStandardProjectAgentConversation?.();
    resolvedResetPulseProjectAgentConversation?.();
  }, [resolvedResetPulseProjectAgentConversation, resolvedResetStandardProjectAgentConversation]);

  const hydrateFromSessionAgentSnapshot = useCallback(
    (payload: CreateRuntimeAgentHydrationPayload) => {
      resolvedHydrateStandardFromSessionAgentSnapshot?.(payload);
      resolvedHydratePulseFromSessionAgentSnapshot?.(payload);
    },
    [resolvedHydratePulseFromSessionAgentSnapshot, resolvedHydrateStandardFromSessionAgentSnapshot]
  );

  const buildProjectAwareBaseSessionSnapshot = useCallback(
    (args: BuildSessionSnapshotArgs) =>
      patchAiStudioSessionSnapshotCanvas(
        buildProjectWorkspaceSnapshot({
          sessionId: args.sessionId,
        }),
        projectDurableCanvasState
      ),
    [buildProjectWorkspaceSnapshot, projectDurableCanvasState]
  );

  const hydrateProjectAwareSessionSnapshot = useCallback(
    (snapshot: Parameters<typeof hydrateFromSessionSnapshot>[0]) => {
      const normalizedSnapshot = createProjectRestoreSnapshot(snapshot);
      const payload = hydrateFromSessionSnapshot(normalizedSnapshot);
      setCreateSelectedCharacterId("");
      setCreateSelectedCharacterLookId("");
      setIsCreateCharacterModeEnabled(false);
      setProjectPulseChatState?.({
        ...payload.pulseChats,
        activeThreadId: null,
      });
      hydrateRightRailLayout?.(payload.workspace.rightRailLayout);
      return payload;
    },
    [
      hydrateFromSessionSnapshot,
      hydrateRightRailLayout,
      setCreateSelectedCharacterId,
      setCreateSelectedCharacterLookId,
      setIsCreateCharacterModeEnabled,
      setProjectPulseChatState,
    ]
  );

  const applyEmptyProjectState = useCallback(() => {
    const payload = hydrateProjectAwareSessionSnapshot(createEmptyAiStudioSessionSnapshot());
    resetProjectAgentConversation();
    setMusicPromptDraft("");
    setMusicLyricsDraft("");
    setSoundEffectsPromptDraft("");
    setVoiceDesignPromptDraft("");
    setVoiceScriptDraft("");
    setExpertEditSessionState(payload.expertEdit);
    hydrateCanvasSessionState(payload.canvas);
    setProjectPulseChatState?.({
      ...payload.pulseChats,
      activeThreadId: null,
    });
  }, [
    hydrateCanvasSessionState,
    hydrateProjectAwareSessionSnapshot,
    resetProjectAgentConversation,
    setExpertEditSessionState,
    setMusicLyricsDraft,
    setMusicPromptDraft,
    setProjectPulseChatState,
    setSoundEffectsPromptDraft,
    setVoiceDesignPromptDraft,
    setVoiceScriptDraft,
  ]);

  const sessionAgentRuntimes = useMemo<AiStudioSessionAgentRuntimesV2>(() => {
    if (expertCreateMode === "pulse" && hasActivePulseSession) {
      return {
        ...persistedAgentRuntimes,
        pulsePresetId: activeCreatePulsePresetId,
        pulse: {
          ...persistedAgentRuntimes.pulse,
          pulseWorkflowSession: pulseWorkflowSession ?? null,
        },
      };
    }
    return persistedAgentRuntimes;
  }, [
    activeCreatePulsePresetId,
    expertCreateMode,
    hasActivePulseSession,
    persistedAgentRuntimes,
    pulseWorkflowSession,
  ]);

  const sessionAgentRuntime = useMemo(() => {
    if (expertCreateMode === "pulse") {
      return hasActivePulseSession
        ? sessionAgentRuntimes.pulse
        : createEmptyAiStudioSessionAgentState();
    }
    return sessionAgentRuntimes.standard;
  }, [expertCreateMode, hasActivePulseSession, sessionAgentRuntimes]);

  const createPersistenceRuntime = useMemo(
    () =>
      expertCreateMode === "pulse"
        ? {
            kind: "pulse" as const,
            agentRuntime: sessionAgentRuntime,
            agentRuntimes: sessionAgentRuntimes,
          }
        : {
            kind: "standard" as const,
            agentRuntime: sessionAgentRuntime,
            agentRuntimes: sessionAgentRuntimes,
          },
    [expertCreateMode, sessionAgentRuntime, sessionAgentRuntimes]
  );

  return useAiStudioPageSessionPersistence({
    projectId,
    projectBootstrapId: effectiveProjectBootstrapId,
    projectRouteRequested,
    sessionId: activeSessionPersistenceSessionId,
    sessionTitleOverride: sessionPersistenceTitleOverride,
    buildBaseSessionSnapshot: buildProjectAwareBaseSessionSnapshot,
    patchSessionSnapshot: patchProjectWorkspaceSnapshot,
    createPersistenceRuntime,
    hydrateFromSessionSnapshot: hydrateProjectAwareSessionSnapshot,
    hydrateFromSessionAgentSnapshot,
    hydrateFromSessionCanvasSnapshot: hydrateCanvasSessionState,
    isAutosaveWorkDeferred,
    applyEmptyProjectState,
    resetProjectAgentConversation,
    setUiNotice,
  });
};
