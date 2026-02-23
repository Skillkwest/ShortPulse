/**
 * Autoplay budget controller for Reference Grid.
 * Encapsulates responsive/device/network budget policy and constrained-profile clamping behavior.
 */
import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

type NavigatorWithConnection = Navigator & {
  deviceMemory?: number;
  connection?: {
    saveData?: boolean;
    effectiveType?: string;
  };
};

type UseReferenceGridAutoplayBudgetControllerArgs = {
  smallScreenQuery: string;
  autoplayMaxDesktop: number;
  autoplayMaxSmallScreen: number;
  autoplayMaxConstrained: number;
  desiredVideoAttachBudgetRef: MutableRefObject<number>;
  autoplayEnabledIdsStateRef: MutableRefObject<string[]>;
  recomputeAutoplayBudgetRef: MutableRefObject<() => void>;
  setDesiredVideoAttachBudget: Dispatch<SetStateAction<number>>;
  setAutoplayEnabledIds: Dispatch<SetStateAction<string[]>>;
  runNonUrgentUpdate: (updater: () => void) => void;
};

/**
 * Installs viewport/network/device listeners and keeps autoplay attach budget in sync.
 */
export const useReferenceGridAutoplayBudgetController = ({
  smallScreenQuery,
  autoplayMaxDesktop,
  autoplayMaxSmallScreen,
  autoplayMaxConstrained,
  desiredVideoAttachBudgetRef,
  autoplayEnabledIdsStateRef,
  recomputeAutoplayBudgetRef,
  setDesiredVideoAttachBudget,
  setAutoplayEnabledIds,
  runNonUrgentUpdate,
}: UseReferenceGridAutoplayBudgetControllerArgs): void => {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const nav = navigator as NavigatorWithConnection;
    const connection = nav.connection as
      | {
          addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
          removeEventListener?: (
            type: string,
            listener: EventListenerOrEventListenerObject
          ) => void;
        }
      | undefined;
    const refreshBudget = () => {
      const isSmallScreen = window.matchMedia(smallScreenQuery).matches;
      const saveData = nav.connection?.saveData === true;
      const effectiveType = (nav.connection?.effectiveType ?? "").toLowerCase();
      const isSlowNetwork = effectiveType.includes("2g");
      const isLowMemory = typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4;
      const isConstrained = saveData || isSlowNetwork || isLowMemory;
      const nextBudget = isConstrained
        ? autoplayMaxConstrained
        : isSmallScreen
          ? autoplayMaxSmallScreen
          : autoplayMaxDesktop;
      if (desiredVideoAttachBudgetRef.current !== nextBudget) {
        desiredVideoAttachBudgetRef.current = nextBudget;
        setDesiredVideoAttachBudget(nextBudget);
      }
      if (isConstrained && autoplayEnabledIdsStateRef.current.length > autoplayMaxConstrained) {
        runNonUrgentUpdate(() => {
          setAutoplayEnabledIds((prev) =>
            prev.length <= autoplayMaxConstrained ? prev : prev.slice(0, autoplayMaxConstrained)
          );
        });
      }
      recomputeAutoplayBudgetRef.current();
    };
    refreshBudget();
    window.addEventListener("resize", refreshBudget);
    connection?.addEventListener?.("change", refreshBudget);
    return () => {
      window.removeEventListener("resize", refreshBudget);
      connection?.removeEventListener?.("change", refreshBudget);
    };
  }, [
    autoplayMaxConstrained,
    autoplayMaxDesktop,
    autoplayMaxSmallScreen,
    autoplayEnabledIdsStateRef,
    desiredVideoAttachBudgetRef,
    recomputeAutoplayBudgetRef,
    runNonUrgentUpdate,
    setAutoplayEnabledIds,
    setDesiredVideoAttachBudget,
    smallScreenQuery,
  ]);
};
