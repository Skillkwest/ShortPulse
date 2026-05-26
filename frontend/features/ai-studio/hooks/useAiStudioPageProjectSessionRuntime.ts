/**
 * AI Studio page project/session runtime.
 * Owns project-aware session snapshot patching, agent hydration bridging, and project bootstrap restore wiring.
 */
import { useCallback, useMemo } from "react";
import {
  createEmptyAiStudioSessionAgentState,
  createEmptyAiStudioSessionSnapshot,
  patchAiStudioSessionSnapshotCanvas,
  patchAiStudioSessionSnapshotOutputs,
  patchAiStudioSessionSnapshotWorkspace,
  type AiStudioSessionAgentRuntimesV2,
  type AiStudioSessionSnapshot,
  type AiStudioSessionSnapshotV2,
} from "../logic/sessionSnapshot";
import type { AiStudioSessionHydrationPayload } from "../logic/sessionSnapshotHydrator";
import {
  createProjectDurableAiStudioSessionCanvasState,
  parseAiStudioSessionCanvasState,
  type AiStudioSessionCanvasState,
} from "../logic/sessionSnapshotCanvas";
import type { CreatePageAgentRuntime } from "../createRuntime/contracts";
import type { ExpertEditSessionState } from "../components/edit/expertEditSessionState";
import { type CreateRuntimeAgentHydrationPayload } from "../createRuntime/sessionAgentHydrationBoundary";
import { useAiStudioPageSessionPersistence } from "./useAiStudioPageSessionPersistence";

type UseAiStudioPageProjectSessionRuntimeParams = {
  activeCreateAgentKind: CreatePageAgentRuntime["kind"];
  activeCreatePulsePresetId: string | null;
  activeSessionPersistenceSessionId: string | null;
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
  persistedAgentRuntime: CreatePageAgentRuntime["persistedAgentRuntime"];
  persistedPulseAgentRuntime?: CreatePageAgentRuntime["persistedAgentRuntime"];
  persistedStandardAgentRuntime?: CreatePageAgentRuntime["persistedAgentRuntime"];
  projectId: string | null;
  projectRouteRequested: boolean;
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
  setUiNotice: (message: string | null) => void;
  setVoiceDesignPromptDraft: (value: string) => void;
  setVoiceScriptDraft: (value: string) => void;
};

const normalizeProjectRestoreOutputIds = (
  value: string[] | undefined,
  validOutputIds: Set<string>
): string[] => (value ?? []).filter((id) => validOutputIds.has(id));

export const createProjectRestoreSnapshot = (
  snapshot: AiStudioSessionSnapshot
): AiStudioSessionSnapshotV2 => {
  const emptySnapshot = createEmptyAiStudioSessionSnapshot({
    sessionId: snapshot.sessionId,
    updatedAt: snapshot.updatedAt,
  });
  const activeOutputs = Array.isArray(snapshot.outputs?.active) ? snapshot.outputs.active : [];
  const activeOutputIds = new Set(
    activeOutputs
      .map((output) => (typeof output?.id === "string" ? output.id.trim() : ""))
      .filter((id) => id.length > 0)
  );
  const outputRestoredSnapshot = patchAiStudioSessionSnapshotOutputs(emptySnapshot, {
    active: activeOutputs,
    archived: [],
    activeOutputId: null,
    curatedReferenceIds: normalizeProjectRestoreOutputIds(
      snapshot.outputs?.curatedReferenceIds,
      activeOutputIds
    ),
    removedFromAllRefsIds: normalizeProjectRestoreOutputIds(
      snapshot.outputs?.removedFromAllRefsIds,
      activeOutputIds
    ),
  });
  if (snapshot.schemaVersion < 2) return outputRestoredSnapshot;

  const parsedCanvas = parseAiStudioSessionCanvasState(
    (snapshot as AiStudioSessionSnapshotV2).canvas ?? null
  );
  const durableCanvas = createProjectDurableAiStudioSessionCanvasState(parsedCanvas);
  return durableCanvas
    ? patchAiStudioSessionSnapshotCanvas(outputRestoredSnapshot, durableCanvas)
    : outputRestoredSnapshot;
};

/**
 * Returns page-level project/session persistence runtime for AI Studio.
 */
export const useAiStudioPageProjectSessionRuntime = ({
  activeCreateAgentKind,
  activeCreatePulsePresetId,
  activeSessionPersistenceSessionId,
  buildSessionSnapshot,
  canvasSessionState,
  createSelectedCharacterId,
  createSelectedCharacterLookId,
  expertCreateMode,
  expertEditSessionRevision,
  getExpertEditSessionState,
  hasActivePulseSession,
  hydrateActiveFromSessionAgentSnapshot,
  hydratePulseFromSessionAgentSnapshot,
  hydrateStandardFromSessionAgentSnapshot,
  hydrateCanvasSessionState,
  hydrateFromSessionSnapshot,
  persistedAgentRuntime,
  persistedPulseAgentRuntime,
  persistedStandardAgentRuntime,
  projectId,
  projectRouteRequested,
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
    (args: Parameters<typeof buildSessionSnapshot>[0]) =>
      patchAiStudioSessionSnapshotCanvas(
        patchAiStudioSessionSnapshotWorkspace(
          buildSessionSnapshot({
            ...args,
            expertEditSessionState: null,
          }),
          {
            selectedCharacterId: createSelectedCharacterId || null,
            selectedCharacterLookId: createSelectedCharacterLookId || null,
          }
        ),
        canvasSessionState
      ),
    [
      buildSessionSnapshot,
      canvasSessionState,
      createSelectedCharacterId,
      createSelectedCharacterLookId,
    ]
  );

  const hydrateProjectAwareSessionSnapshot = useCallback(
    (snapshot: Parameters<typeof hydrateFromSessionSnapshot>[0]) => {
      const normalizedSnapshot = createProjectRestoreSnapshot(snapshot);
      const payload = hydrateFromSessionSnapshot(normalizedSnapshot);
      setCreateSelectedCharacterId("");
      setCreateSelectedCharacterLookId("");
      setIsCreateCharacterModeEnabled(false);
      return payload;
    },
    [
      hydrateFromSessionSnapshot,
      setCreateSelectedCharacterId,
      setCreateSelectedCharacterLookId,
      setIsCreateCharacterModeEnabled,
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
  }, [
    hydrateCanvasSessionState,
    hydrateProjectAwareSessionSnapshot,
    resetProjectAgentConversation,
    setExpertEditSessionState,
    setMusicLyricsDraft,
    setMusicPromptDraft,
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
    projectRouteRequested,
    sessionId: activeSessionPersistenceSessionId,
    sessionTitleOverride: sessionPersistenceTitleOverride,
    buildBaseSessionSnapshot: buildProjectAwareBaseSessionSnapshot,
    createPersistenceRuntime,
    hydrateFromSessionSnapshot: hydrateProjectAwareSessionSnapshot,
    hydrateFromSessionAgentSnapshot,
    hydrateFromSessionCanvasSnapshot: hydrateCanvasSessionState,
    applyEmptyProjectState,
    resetProjectAgentConversation,
    setUiNotice,
  });
};
