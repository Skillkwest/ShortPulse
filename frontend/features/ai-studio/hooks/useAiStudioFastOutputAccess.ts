/**
 * AI Studio fast output-access helpers.
 * Bridges collection state into callback-based lookup/update functions for downstream lifecycle hooks.
 */
import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { StudioOutput } from "../types";
import type { StudioOutputCollectionState } from "../reference-domain";

type UseAiStudioFastOutputAccessParams = {
  activeOutputByIdRef: MutableRefObject<Record<string, StudioOutput>>;
  setActiveOutputState: Dispatch<SetStateAction<StudioOutputCollectionState>>;
};

/**
 * Returns fast-path helpers for active output lookup and mutation by id.
 */
export const useAiStudioFastOutputAccess = ({
  activeOutputByIdRef,
  setActiveOutputState,
}: UseAiStudioFastOutputAccessParams) => {
  const findActiveOutputById = useCallback(
    (id: string) => {
      return activeOutputByIdRef.current[id] ?? null;
    },
    [activeOutputByIdRef]
  );

  const updateActiveOutputById = useCallback(
    (id: string, updater: (item: StudioOutput) => StudioOutput) => {
      setActiveOutputState((prevState) => {
        const current = prevState.byId[id];
        if (!current) return prevState;
        const nextItem = updater(current);
        if (nextItem === current) return prevState;
        return {
          order: prevState.order,
          byId: {
            ...prevState.byId,
            [id]: nextItem,
          },
        };
      });
    },
    [setActiveOutputState]
  );

  return {
    findActiveOutputById,
    updateActiveOutputById,
  };
};
