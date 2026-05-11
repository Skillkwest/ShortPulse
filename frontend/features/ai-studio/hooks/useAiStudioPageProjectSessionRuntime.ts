/**
 * AI Studio page project/session runtime.
 * Owns project-aware session snapshot patching, agent hydration bridging, and project bootstrap restore wiring.
 */
import { useCallback, useEffect, useMemo, type MutableRefObject } from "react";
import {
  createEmptyAiStudioSessionAgentState,
  createEmptyAiStudioSessionSnapshot,
  patchAiStudioSessionSnapshotCanvas,
  patchAiStudioSessionSnapshotExpertEdit,
  patchAiStudioSessionSnapshotWorkspace,
  type AiStudioSessionAgentRuntimesV2,
  type AiStudioSessionSnapshot,
  type AiStudioSessionSnapshotV2,
} from "../logic/sessionSnapshot";
import type { AiStudioSessionHydrationPayload } from "../logic/sessionSnapshotHydrator";
import type { AiStudioSessionCanvasState } from "../logic/sessionSnapshotCanvas";
import type { CreatePageAgentRuntime } from "../createRuntime/contracts";
import type { ExpertEditSessionState } from "../components/edit/expertEditSessionState";
import { isCreateCharacterModeModel } from "../logic/createCharacterModeModelMapping";
import { resolveCreateWorkflowStartupModel } from "../logic/modelSelectionPolicy";
import { getModelConfig } from "../logic/pricing";
import {
  shouldApplySessionAgentHydrationToRuntime,
  type CreateRuntimeAgentHydrationPayload,
} from "../createRuntime/sessionAgentHydrationBoundary";
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
  hydrateCanvasSessionState: (canvas: AiStudioSessionCanvasState | null) => void;
  hydrateFromSessionSnapshot: (
    snapshot: AiStudioSessionSnapshot
  ) => AiStudioSessionHydrationPayload;
  pendingCreateRuntimeAgentHydrationRef: MutableRefObject<CreateRuntimeAgentHydrationPayload | null>;
  persistedAgentRuntime: CreatePageAgentRuntime["persistedAgentRuntime"];
  projectId: string | null;
  projectRouteRequested: boolean;
  pulseWorkflowSession:
    | CreatePageAgentRuntime["persistedAgentRuntime"]["pulseWorkflowSession"]
    | null;
  resetActiveProjectAgentConversation: () => void;
  sessionPersistenceTitleOverride: string | null;
  setCreateSelectedCharacterId: (value: string) => void;
  setCreateSelectedCharacterLookId: (value: string) => void;
  setIsCreateCharacterModeEnabled: (value: boolean) => void;
  setExpertEditSessionState: (value: AiStudioSessionHydrationPayload["expertEdit"]) => void;
  setUiNotice: (message: string | null) => void;
};

export const shouldRestoreCreateCharacterModeFromProjectSnapshot = (
  snapshot: AiStudioSessionSnapshot
): boolean => {
  const selectedTool = snapshot.workspace.selectedTool;
  const mode = snapshot.workspace.mode;
  if (selectedTool !== "create" && selectedTool !== "text") return false;
  if (mode !== "image" && mode !== "text") return false;
  return isCreateCharacterModeModel(snapshot.workspace.model);
};

export const normalizeProjectRestoreSnapshotForCreateCharacterMode = (
  snapshot: AiStudioSessionSnapshot
): AiStudioSessionSnapshot => {
  if (snapshot.schemaVersion < 2) return snapshot;
  if (!shouldRestoreCreateCharacterModeFromProjectSnapshot(snapshot)) return snapshot;

  const resolvedCreateModel = resolveCreateWorkflowStartupModel({
    mode: snapshot.workspace.mode,
    savedModelId: snapshot.workspace.model,
    isCharacterModeEnabled: true,
    getModelConfig,
  });
  if (resolvedCreateModel === snapshot.workspace.model) {
    return snapshot;
  }

  return patchAiStudioSessionSnapshotWorkspace(snapshot as AiStudioSessionSnapshotV2, {
    model: resolvedCreateModel,
  });
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
  hydrateCanvasSessionState,
  hydrateFromSessionSnapshot,
  pendingCreateRuntimeAgentHydrationRef,
  persistedAgentRuntime,
  projectId,
  projectRouteRequested,
  pulseWorkflowSession,
  resetActiveProjectAgentConversation,
  sessionPersistenceTitleOverride,
  setCreateSelectedCharacterId,
  setCreateSelectedCharacterLookId,
  setIsCreateCharacterModeEnabled,
  setExpertEditSessionState,
  setUiNotice,
}: UseAiStudioPageProjectSessionRuntimeParams) => {
  const persistedAgentRuntimes = useMemo<AiStudioSessionAgentRuntimesV2>(
    () =>
      activeCreateAgentKind === "pulse"
        ? {
            standard: createEmptyAiStudioSessionAgentState(),
            pulsePresetId: activeCreatePulsePresetId,
            pulseSessionInstanceId: null,
            pulse: persistedAgentRuntime,
          }
        : {
            standard: persistedAgentRuntime,
            pulsePresetId: null,
            pulseSessionInstanceId: null,
            pulse: createEmptyAiStudioSessionAgentState(),
          },
    [activeCreateAgentKind, activeCreatePulsePresetId, persistedAgentRuntime]
  );

  const resetProjectAgentConversation = useCallback(() => {
    resetActiveProjectAgentConversation();
  }, [resetActiveProjectAgentConversation]);

  const hydrateFromSessionAgentSnapshot = useCallback(
    (payload: CreateRuntimeAgentHydrationPayload) => {
      if (!shouldApplySessionAgentHydrationToRuntime(payload, activeCreateAgentKind)) {
        pendingCreateRuntimeAgentHydrationRef.current = payload;
        return;
      }
      pendingCreateRuntimeAgentHydrationRef.current = null;
      hydrateActiveFromSessionAgentSnapshot(payload);
    },
    [
      activeCreateAgentKind,
      hydrateActiveFromSessionAgentSnapshot,
      pendingCreateRuntimeAgentHydrationRef,
    ]
  );

  useEffect(() => {
    const pendingPayload = pendingCreateRuntimeAgentHydrationRef.current;
    if (!pendingPayload) return;
    if (!shouldApplySessionAgentHydrationToRuntime(pendingPayload, activeCreateAgentKind)) {
      return;
    }
    pendingCreateRuntimeAgentHydrationRef.current = null;
    hydrateActiveFromSessionAgentSnapshot(pendingPayload);
  }, [
    activeCreateAgentKind,
    hydrateActiveFromSessionAgentSnapshot,
    pendingCreateRuntimeAgentHydrationRef,
  ]);

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
      const normalizedSnapshot = normalizeProjectRestoreSnapshotForCreateCharacterMode(snapshot);
      const payload = hydrateFromSessionSnapshot(normalizedSnapshot);
      setCreateSelectedCharacterId(payload.workspace.selectedCharacterId ?? "");
      setCreateSelectedCharacterLookId(payload.workspace.selectedCharacterLookId ?? "");
      setIsCreateCharacterModeEnabled(
        shouldRestoreCreateCharacterModeFromProjectSnapshot(normalizedSnapshot)
      );
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
    setExpertEditSessionState(payload.expertEdit);
    hydrateCanvasSessionState(payload.canvas);
  }, [
    hydrateCanvasSessionState,
    hydrateProjectAwareSessionSnapshot,
    resetProjectAgentConversation,
    setExpertEditSessionState,
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
    return {
      standard: persistedAgentRuntimes.standard,
      pulsePresetId: null,
      pulseSessionInstanceId: null,
      pulse: createEmptyAiStudioSessionAgentState(),
    };
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
          },
    [expertCreateMode, sessionAgentRuntime, sessionAgentRuntimes]
  );

  const readLatestExpertEditSessionState = useCallback(
    () => getExpertEditSessionState(),
    [getExpertEditSessionState]
  );

  const patchProjectAwareSessionSnapshot = useMemo(
    () => (snapshot: AiStudioSessionSnapshot) => {
      void expertEditSessionRevision;
      if (snapshot.schemaVersion < 2) return snapshot;
      return patchAiStudioSessionSnapshotExpertEdit(
        snapshot as AiStudioSessionSnapshotV2,
        readLatestExpertEditSessionState()
      );
    },
    [expertEditSessionRevision, readLatestExpertEditSessionState]
  );

  return useAiStudioPageSessionPersistence({
    projectId,
    projectRouteRequested,
    sessionId: activeSessionPersistenceSessionId,
    sessionTitleOverride: sessionPersistenceTitleOverride,
    buildBaseSessionSnapshot: buildProjectAwareBaseSessionSnapshot,
    patchSessionSnapshot: patchProjectAwareSessionSnapshot,
    createPersistenceRuntime,
    hydrateFromSessionSnapshot: hydrateProjectAwareSessionSnapshot,
    hydrateFromSessionAgentSnapshot,
    hydrateFromSessionCanvasSnapshot: hydrateCanvasSessionState,
    hydrateFromSessionExpertEditSnapshot: setExpertEditSessionState,
    applyEmptyProjectState,
    resetProjectAgentConversation,
    setUiNotice,
  });
};
