/**
 * AI Studio route lifecycle stability telemetry.
 * Emits low-cardinality breadcrumbs for crash forensics without changing route behavior.
 */
import { useCallback, useEffect, useRef } from "react";
import {
  installAiStudioCrashEvidenceHandle,
  reportAiStudioStabilityEvent,
} from "../logic/aiStudioStabilityTelemetry";
import type { AiStudioStabilityEvent } from "../logic/aiStudioStabilityTelemetry";

type UseAiStudioStabilityLifecycleTelemetryArgs = {
  projectId: string | null;
  projectRouteRequested: boolean;
};

type LifecycleDocumentState = {
  currentDocumentId: string;
  createdAtMs: number;
  eventCount: number;
  previousDocumentId: string | null;
};

type LifecycleEventMetadata = Record<string, string | number | boolean | null>;

declare global {
  interface Window {
    __shortpulseAiStudioLifecycleDocumentState?: LifecycleDocumentState;
  }
}

const MAX_LIFECYCLE_EVENTS_PER_DOCUMENT = 24;
const LIFECYCLE_DOCUMENT_STORAGE_KEY = "shortpulse.ai_studio.lifecycle_document_id.v1";

const createLifecycleDocumentId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sp_ai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

const resolveLifecycleDocumentState = (): LifecycleDocumentState | null => {
  if (typeof window === "undefined") return null;

  const existing = window.__shortpulseAiStudioLifecycleDocumentState;
  if (existing) return existing;

  let previousDocumentId: string | null = null;
  try {
    previousDocumentId = window.sessionStorage.getItem(LIFECYCLE_DOCUMENT_STORAGE_KEY);
  } catch {
    previousDocumentId = null;
  }

  const currentDocumentId = createLifecycleDocumentId();
  const state: LifecycleDocumentState = {
    currentDocumentId,
    createdAtMs: Date.now(),
    eventCount: 0,
    previousDocumentId:
      previousDocumentId && previousDocumentId !== currentDocumentId ? previousDocumentId : null,
  };
  window.__shortpulseAiStudioLifecycleDocumentState = state;

  try {
    window.sessionStorage.setItem(LIFECYCLE_DOCUMENT_STORAGE_KEY, currentDocumentId);
  } catch {
    // Diagnostic correlation only.
  }

  return state;
};

const resolveNavigationType = (): string | null => {
  if (typeof performance === "undefined" || typeof performance.getEntriesByType !== "function") {
    return null;
  }
  const navigationEntries = performance.getEntriesByType(
    "navigation"
  ) as PerformanceNavigationTiming[];
  const navigationType = navigationEntries[0]?.type;
  return typeof navigationType === "string" ? navigationType : null;
};

const resolveVisibilityState = (): string | null => {
  if (typeof document === "undefined") return null;
  return typeof document.visibilityState === "string" ? document.visibilityState : null;
};

const resolveDocumentHidden = (): boolean | null => {
  if (typeof document === "undefined") return null;
  return typeof document.hidden === "boolean" ? document.hidden : null;
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

  useEffect(() => installAiStudioCrashEvidenceHandle(), []);

  const emitLifecycleEvent = useCallback(
    (event: AiStudioStabilityEvent, metadata: LifecycleEventMetadata = {}) => {
      const documentState = resolveLifecycleDocumentState();
      if (!documentState || documentState.eventCount >= MAX_LIFECYCLE_EVENTS_PER_DOCUMENT) return;
      documentState.eventCount += 1;

      const nowMs = Date.now();
      reportAiStudioStabilityEvent(event, {
        project_id_present: projectIdPresent,
        project_route_requested: projectRouteRequested,
        lifecycle_document_id: documentState?.currentDocumentId ?? null,
        previous_lifecycle_document_id_present: Boolean(documentState?.previousDocumentId),
        lifecycle_document_replaced: Boolean(
          documentState?.previousDocumentId &&
          documentState.previousDocumentId !== documentState.currentDocumentId
        ),
        lifecycle_event_index: documentState.eventCount,
        lifecycle_document_age_ms: documentState
          ? Math.max(0, nowMs - documentState.createdAtMs)
          : null,
        navigation_type: resolveNavigationType(),
        visibility_state: resolveVisibilityState(),
        document_hidden: resolveDocumentHidden(),
        ...metadata,
      });
    },
    [projectIdPresent, projectRouteRequested]
  );

  useEffect(() => {
    if (sessionStartedRef.current) return;
    sessionStartedRef.current = true;
    emitLifecycleEvent("session_started");
  }, [emitLifecycleEvent]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        emitLifecycleEvent("visibility_hidden");
        return;
      }
      if (document.visibilityState === "visible") {
        emitLifecycleEvent("visibility_visible");
      }
    };
    const handlePageHide = (event: PageTransitionEvent) => {
      emitLifecycleEvent("pagehide", {
        pagehide_persisted: event.persisted,
      });
    };
    const handlePageShow = (event: PageTransitionEvent) => {
      emitLifecycleEvent("pageshow", {
        pageshow_persisted: event.persisted,
      });
    };
    const handleBeforeUnload = () => {
      emitLifecycleEvent("beforeunload");
    };
    const handleUnload = () => {
      emitLifecycleEvent("unload");
    };
    const handleWindowBlur = () => {
      emitLifecycleEvent("window_blur");
    };
    const handleWindowFocus = () => {
      emitLifecycleEvent("window_focus");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("unload", handleUnload);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("unload", handleUnload);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [emitLifecycleEvent]);
};
