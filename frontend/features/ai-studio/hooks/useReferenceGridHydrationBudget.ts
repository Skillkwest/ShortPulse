/**
 * Adaptive hydration/decode budget hook for the AI Studio reference grid.
 * Provides low-memory/save-data aware caps for in-flight image hydration work.
 */
import { useEffect, useMemo, useState } from "react";

type NavigatorWithConnection = Navigator & {
  deviceMemory?: number;
  connection?: {
    saveData?: boolean;
    effectiveType?: string;
    addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
    removeEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
  };
};

const SMALL_SCREEN_QUERY = "(max-width: 900px)";
const DESKTOP_INFLIGHT_LIMIT = 6;
const CONSTRAINED_INFLIGHT_LIMIT = 2;

type UseReferenceGridHydrationBudgetParams = {
  enabled?: boolean;
  pressureLevel?: 0 | 1 | 2;
};

/**
 * Returns the current hydration budget envelope for the reference-grid image pipeline.
 */
export const useReferenceGridHydrationBudget = ({
  enabled = true,
  pressureLevel = 0,
}: UseReferenceGridHydrationBudgetParams) => {
  const [isConstrainedProfile, setIsConstrainedProfile] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return;
    const nav = navigator as NavigatorWithConnection;
    const connection = nav.connection;
    const mediaQuery = window.matchMedia(SMALL_SCREEN_QUERY);
    const recompute = () => {
      const saveData = connection?.saveData === true;
      const effectiveType = (connection?.effectiveType ?? "").toLowerCase();
      const isSlowNetwork = effectiveType.includes("2g");
      const isLowMemory = typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4;
      const nextConstrainedProfile = saveData || isSlowNetwork || isLowMemory;
      const nextSmallScreen = mediaQuery.matches;
      setIsConstrainedProfile((prev) =>
        prev === nextConstrainedProfile ? prev : nextConstrainedProfile
      );
      setIsSmallScreen((prev) => (prev === nextSmallScreen ? prev : nextSmallScreen));
    };
    recompute();
    mediaQuery.addEventListener?.("change", recompute);
    connection?.addEventListener?.("change", recompute);
    window.addEventListener("resize", recompute);
    return () => {
      mediaQuery.removeEventListener?.("change", recompute);
      connection?.removeEventListener?.("change", recompute);
      window.removeEventListener("resize", recompute);
    };
  }, []);

  return useMemo(() => {
    if (!enabled) {
      return {
        maxInflightHydrations: Number.MAX_SAFE_INTEGER,
        priorityRows: 5,
        constrainedProfile: false,
        smallScreen: false,
      };
    }

    const baseInflight = isConstrainedProfile ? CONSTRAINED_INFLIGHT_LIMIT : DESKTOP_INFLIGHT_LIMIT;
    const pressureAdjustedInflight =
      pressureLevel >= 2
        ? Math.min(baseInflight, 2)
        : pressureLevel >= 1
          ? Math.min(baseInflight, 4)
          : baseInflight;
    const priorityRows = pressureLevel >= 2 ? 1 : pressureLevel >= 1 ? 2 : 3;

    return {
      maxInflightHydrations: Math.max(1, pressureAdjustedInflight),
      priorityRows,
      constrainedProfile: isConstrainedProfile,
      smallScreen: isSmallScreen,
    };
  }, [enabled, isConstrainedProfile, isSmallScreen, pressureLevel]);
};
