/**
 * AI Studio runtime-authority UI state.
 * Owns per-authority save/restore for active output, reference projection, and saved UI flags.
 */
import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { StudioOutput } from "../types";
import {
  createEmptyReferenceProjectionState,
  type ReferenceProjectionState,
} from "../reference-projections";

type AiStudioRuntimeUiState = {
  activeOutputId: string | null;
  referenceProjectionState: ReferenceProjectionState;
  saved: boolean;
};

type UseAiStudioRuntimeAuthorityUiStateParams = {
  activeOutputId: string | null;
  baseRuntimeAuthorityKey: string;
  referenceProjectionState: ReferenceProjectionState;
  runtimeAuthorityKey: string;
  saved: boolean;
  sessionHydrationSigningRevisionRef: MutableRefObject<number>;
  setActiveOutputId: Dispatch<SetStateAction<string | null>>;
  setOutputCollectionsForAuthority: (
    authorityKey: string,
    activeRows: StudioOutput[],
    archivedRows: StudioOutput[]
  ) => void;
  setReferenceProjectionState: Dispatch<SetStateAction<ReferenceProjectionState>>;
  setSaved: Dispatch<SetStateAction<boolean>>;
};

/**
 * Returns create-mode helpers for storing and restoring runtime UI state by authority key.
 */
export const useAiStudioRuntimeAuthorityUiState = ({
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
}: UseAiStudioRuntimeAuthorityUiStateParams) => {
  const activeBaseRuntimeAuthorityKeyRef = useRef(baseRuntimeAuthorityKey);
  const activeRuntimeAuthorityKeyRef = useRef(runtimeAuthorityKey);
  const runtimeUiStateByAuthorityKeyRef = useRef<Record<string, AiStudioRuntimeUiState>>({});

  const getRuntimeAuthorityKeyForCreateMode = useCallback(
    (createMode: "standard" | "pulse") => `${baseRuntimeAuthorityKey}:create:${createMode}`,
    [baseRuntimeAuthorityKey]
  );

  const setRuntimeUiStateForCreateMode = useCallback(
    (createMode: "standard" | "pulse", nextState: AiStudioRuntimeUiState) => {
      const targetAuthorityKey = getRuntimeAuthorityKeyForCreateMode(createMode);
      runtimeUiStateByAuthorityKeyRef.current[targetAuthorityKey] = nextState;
      if (activeRuntimeAuthorityKeyRef.current !== targetAuthorityKey) return;
      setActiveOutputId(nextState.activeOutputId);
      setReferenceProjectionState(nextState.referenceProjectionState);
      setSaved(nextState.saved);
    },
    [getRuntimeAuthorityKeyForCreateMode, setActiveOutputId, setReferenceProjectionState, setSaved]
  );

  const setOutputCollectionsForCreateMode = useCallback(
    (
      createMode: "standard" | "pulse",
      activeRows: StudioOutput[],
      archivedRows: StudioOutput[]
    ) => {
      setOutputCollectionsForAuthority(
        getRuntimeAuthorityKeyForCreateMode(createMode),
        activeRows,
        archivedRows
      );
    },
    [getRuntimeAuthorityKeyForCreateMode, setOutputCollectionsForAuthority]
  );

  useEffect(() => {
    if (activeRuntimeAuthorityKeyRef.current === runtimeAuthorityKey) return;
    const previousRuntimeAuthorityKey = activeRuntimeAuthorityKeyRef.current;
    runtimeUiStateByAuthorityKeyRef.current[previousRuntimeAuthorityKey] = {
      activeOutputId,
      referenceProjectionState,
      saved,
    };
    const baseAuthorityChanged =
      activeBaseRuntimeAuthorityKeyRef.current !== baseRuntimeAuthorityKey;
    if (baseAuthorityChanged) {
      activeBaseRuntimeAuthorityKeyRef.current = baseRuntimeAuthorityKey;
    }
    activeRuntimeAuthorityKeyRef.current = runtimeAuthorityKey;
    const restoredState = baseAuthorityChanged
      ? null
      : (runtimeUiStateByAuthorityKeyRef.current[runtimeAuthorityKey] ?? null);

    setActiveOutputId(restoredState?.activeOutputId ?? null);
    setReferenceProjectionState(
      restoredState?.referenceProjectionState ?? createEmptyReferenceProjectionState()
    );
    sessionHydrationSigningRevisionRef.current += 1;
    setSaved(restoredState?.saved ?? false);
  }, [
    activeOutputId,
    baseRuntimeAuthorityKey,
    referenceProjectionState,
    runtimeAuthorityKey,
    saved,
    sessionHydrationSigningRevisionRef,
    setActiveOutputId,
    setReferenceProjectionState,
    setSaved,
  ]);

  return {
    setOutputCollectionsForCreateMode,
    setRuntimeUiStateForCreateMode,
  };
};
