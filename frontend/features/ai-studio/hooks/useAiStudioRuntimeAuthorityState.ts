/**
 * AI Studio runtime authority state composition.
 * Owns workspace authority keys, output collections, reference projection state, and
 * the shared right-rail authority handoff used by Standard and Pulse Create modes.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createEmptyReferenceProjectionState,
  type ReferenceProjectionState,
} from "../reference-projections";
import { useAiStudioOutputCollectionState } from "./useAiStudioOutputCollectionState";
import { useAiStudioRuntimeAuthorityUiState } from "./useAiStudioRuntimeAuthorityUiState";

type UseAiStudioRuntimeAuthorityStateParams = {
  expertCreateMode: "standard" | "pulse";
  projectId: string | null;
  projectRouteRequested: boolean;
  sessionId: string | null;
};

/**
 * Returns the authority-scoped state owned by the AI Studio workspace shell.
 */
export const useAiStudioRuntimeAuthorityState = ({
  expertCreateMode,
  projectId,
  projectRouteRequested,
  sessionId,
}: UseAiStudioRuntimeAuthorityStateParams) => {
  const baseRuntimeAuthorityKey =
    projectRouteRequested && !projectId
      ? "project:pending"
      : projectId
        ? `project:${projectId}`
        : sessionId
          ? `session:${sessionId}`
          : "session:pending";
  const runtimeAuthorityKey = baseRuntimeAuthorityKey;
  const createModeRuntimeAuthorityKey = `${baseRuntimeAuthorityKey}:create:${expertCreateMode}`;
  const workspaceRuntimeKey = !projectId && sessionId ? `session:${sessionId}` : null;

  const {
    activeOutputState,
    setActiveOutputState,
    archivedOutputState,
    setArchivedOutputState,
    activeOutputByIdRef,
    outputs,
    archivedOutputs,
    activeOutputById,
    setOutputsState,
    setArchivedOutputs,
    setOutputCollectionsForAuthority,
  } = useAiStudioOutputCollectionState({
    authorityKey: runtimeAuthorityKey,
  });
  const [activeOutputId, setActiveOutputId] = useState<string | null>(null);
  const [referenceProjectionState, setReferenceProjectionState] =
    useState<ReferenceProjectionState>(createEmptyReferenceProjectionState);
  const referenceProjectionStateRef = useRef<ReferenceProjectionState>(referenceProjectionState);
  const curatedReferenceIds = referenceProjectionState.quickSlotIds;
  const removedFromAllRefsIds = referenceProjectionState.removedFromAllRefsIds;
  const [saved, setSaved] = useState(false);
  const pendingAutoSavesRef = useRef<Record<string, unknown>>({});
  const pendingFinalizeRemovalIdsRef = useRef<Set<string>>(new Set());
  const sessionHydrationSigningRevisionRef = useRef(0);
  const [manualWorkflowReloadRevision, setManualWorkflowReloadRevision] = useState(0);
  const beginManualWorkflowReload = useCallback(() => {
    setManualWorkflowReloadRevision((revision) => revision + 1);
  }, []);
  const { setOutputCollectionsForCreateMode, setRuntimeUiStateForCreateMode } =
    useAiStudioRuntimeAuthorityUiState({
      activeOutputId,
      baseRuntimeAuthorityKey,
      referenceProjectionState,
      runtimeAuthorityKey,
      saved,
      sessionHydrationSigningRevisionRef,
      setActiveOutputId,
      setOutputCollectionsForAuthority,
      setReferenceProjectionState,
      setSaved,
    });

  useEffect(() => {
    pendingAutoSavesRef.current = {};
    pendingFinalizeRemovalIdsRef.current = new Set();
  }, [runtimeAuthorityKey]);

  return {
    activeOutputById,
    activeOutputByIdRef,
    activeOutputId,
    activeOutputState,
    archivedOutputState,
    archivedOutputs,
    baseRuntimeAuthorityKey,
    beginManualWorkflowReload,
    createModeRuntimeAuthorityKey,
    curatedReferenceIds,
    manualWorkflowReloadRevision,
    outputs,
    pendingAutoSavesRef,
    pendingFinalizeRemovalIdsRef,
    referenceProjectionState,
    referenceProjectionStateRef,
    removedFromAllRefsIds,
    runtimeAuthorityKey,
    saved,
    sessionHydrationSigningRevisionRef,
    setActiveOutputId,
    setActiveOutputState,
    setArchivedOutputState,
    setArchivedOutputs,
    setOutputCollectionsForCreateMode,
    setOutputsState,
    setReferenceProjectionState,
    setRuntimeUiStateForCreateMode,
    setSaved,
    workspaceRuntimeKey,
  };
};
