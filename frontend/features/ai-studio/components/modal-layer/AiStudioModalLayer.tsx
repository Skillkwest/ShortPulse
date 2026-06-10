/**
 * Shared AI Studio modal layer primitives.
 * Provides global portal mounting and modal-open activity tracking for background-work coordination.
 */
import React from "react";
import { createPortal } from "react-dom";
import { PERF_FLAG_MODAL_STABILITY_V1 } from "../../logic/perfProfileFlags";

const AI_STUDIO_MODAL_LAYER_ROOT_ID = "ai-studio-modal-layer-root";
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

type AiStudioModalActivityActionsContextValue = {
  setModalOpen: (modalId: string, isOpen: boolean) => void;
};

const AiStudioModalActivityActionsContext =
  React.createContext<AiStudioModalActivityActionsContextValue | null>(null);
const AiStudioModalOpenStateContext = React.createContext<boolean>(false);

const ensureModalLayerRoot = (): HTMLElement | null => {
  if (typeof document === "undefined") return null;
  const existingRoot = document.getElementById(AI_STUDIO_MODAL_LAYER_ROOT_ID);
  if (existingRoot) return existingRoot;
  const nextRoot = document.createElement("div");
  nextRoot.id = AI_STUDIO_MODAL_LAYER_ROOT_ID;
  nextRoot.setAttribute("data-ai-studio-modal-layer-root", "true");
  document.body.appendChild(nextRoot);
  return nextRoot;
};

export const AiStudioModalActivityProvider = ({ children }: { children: React.ReactNode }) => {
  const openModalIdsRef = React.useRef<Set<string>>(new Set<string>());
  const [openModalCount, setOpenModalCount] = React.useState(0);

  const setModalOpen = React.useCallback((modalId: string, isOpen: boolean) => {
    setOpenModalCount((previous) => {
      const nextOpenModalIds = new Set(openModalIdsRef.current);
      if (isOpen) {
        nextOpenModalIds.add(modalId);
      } else {
        nextOpenModalIds.delete(modalId);
      }
      openModalIdsRef.current = nextOpenModalIds;
      const nextCount = nextOpenModalIds.size;
      return previous === nextCount ? previous : nextCount;
    });
  }, []);

  const actionsContextValue = React.useMemo<AiStudioModalActivityActionsContextValue>(
    () => ({
      setModalOpen,
    }),
    [setModalOpen]
  );

  return (
    <AiStudioModalActivityActionsContext.Provider value={actionsContextValue}>
      <AiStudioModalOpenStateContext.Provider value={openModalCount > 0}>
        {children}
      </AiStudioModalOpenStateContext.Provider>
    </AiStudioModalActivityActionsContext.Provider>
  );
};

export const useAiStudioModalActivity = (modalId: string, isOpen: boolean): void => {
  const contextValue = React.useContext(AiStudioModalActivityActionsContext);
  React.useEffect(() => {
    if (!PERF_FLAG_MODAL_STABILITY_V1) return;
    if (!contextValue) return;
    contextValue.setModalOpen(modalId, isOpen);
    return () => {
      contextValue.setModalOpen(modalId, false);
    };
  }, [contextValue, isOpen, modalId]);
};

export const useAiStudioAnyModalOpen = (): boolean => {
  const isAnyModalOpen = React.useContext(AiStudioModalOpenStateContext);
  if (!PERF_FLAG_MODAL_STABILITY_V1) return false;
  return isAnyModalOpen;
};

export const AiStudioModalLayer = ({ children }: { children: React.ReactNode }) => {
  const [layerRoot, setLayerRoot] = React.useState<HTMLElement | null>(null);

  useIsomorphicLayoutEffect(() => {
    setLayerRoot(ensureModalLayerRoot());
  }, []);

  if (!layerRoot) {
    return null;
  }

  return createPortal(children, layerRoot);
};
