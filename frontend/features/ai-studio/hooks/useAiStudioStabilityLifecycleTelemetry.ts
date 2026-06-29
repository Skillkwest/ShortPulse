/**
 * AI Studio route lifecycle stability telemetry.
 * Emits low-cardinality breadcrumbs for crash forensics without changing route behavior.
 */
import { useEffect, useRef } from "react";
import { reportAiStudioStabilityEvent } from "../logic/aiStudioStabilityTelemetry";

type UseAiStudioStabilityLifecycleTelemetryArgs = {
  projectId: string | null;
  projectRouteRequested: boolean;
};

/**
 * Reports AI Studio session/page lifecycle signals for production crash triage.
 */
export const useAiStudioStabilityLifecycleTelemetry = ({
  projectId,
  projectRouteRequested,
}: UseAiStudioStabilityLifecycleTelemetryArgs): void => {
  const sessionStartedRef = useRef(false);
  const projectIdPresent = Boolean(projectId?.trim());

  useEffect(() => {
    if (sessionStartedRef.current) return;
    sessionStartedRef.current = true;
    reportAiStudioStabilityEvent("session_started", {
      project_id_present: projectIdPresent,
      project_route_requested: projectRouteRequested,
    });
  }, [projectIdPresent, projectRouteRequested]);

  useEffect(() => {
    const metadata = {
      project_id_present: projectIdPresent,
      project_route_requested: projectRouteRequested,
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;
      reportAiStudioStabilityEvent("visibility_hidden", metadata);
    };
    const handlePageHide = () => {
      reportAiStudioStabilityEvent("pagehide", metadata);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [projectIdPresent, projectRouteRequested]);
};
