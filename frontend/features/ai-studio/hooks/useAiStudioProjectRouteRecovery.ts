import { useEffect, useRef } from "react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import type {
  AiStudioProjectIdentityErrorKind,
  AiStudioProjectIdentityStatus,
} from "./useAiStudioProjectIdentity";

type ProjectsListPayload = {
  projects?: Array<{ id: string }>;
  error?: string;
  details?: string;
};

type UseAiStudioProjectRouteRecoveryOptions = {
  requestedProjectId: string | null;
  projectRouteRequested: boolean;
  projectStatus: AiStudioProjectIdentityStatus;
  projectErrorKind: AiStudioProjectIdentityErrorKind | null;
  onClearStaleProjectRoute: () => Promise<boolean> | boolean;
  onOpenProjectsModal: () => void;
};

const RECOVERABLE_PROJECT_ERROR_KINDS = new Set<AiStudioProjectIdentityErrorKind>([
  "invalid_id",
  "not_found",
  "forbidden",
]);

export const useAiStudioProjectRouteRecovery = ({
  requestedProjectId,
  projectRouteRequested,
  projectStatus,
  projectErrorKind,
  onClearStaleProjectRoute,
  onOpenProjectsModal,
}: UseAiStudioProjectRouteRecoveryOptions) => {
  const handledRecoveryKeyRef = useRef<string | null>(null);
  const recoveryKey =
    projectRouteRequested &&
    projectStatus === "error" &&
    requestedProjectId &&
    projectErrorKind &&
    RECOVERABLE_PROJECT_ERROR_KINDS.has(projectErrorKind)
      ? `${requestedProjectId}:${projectErrorKind}`
      : null;

  useEffect(() => {
    if (!recoveryKey) {
      handledRecoveryKeyRef.current = null;
      return;
    }
    if (handledRecoveryKeyRef.current === recoveryKey) return;
    handledRecoveryKeyRef.current = recoveryKey;

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetchWithAuth("/api/projects?limit=all", {
          method: "GET",
          shortpulseAuthTimeoutMs: 5000,
          shortpulseRetryNetworkOnce: true,
        });
        const payload = (await response.json().catch(() => ({}))) as ProjectsListPayload;
        if (!response.ok) {
          throw new Error(
            payload.error?.trim() || payload.details?.trim() || "Failed to load projects."
          );
        }
        if (cancelled) return;

        const projects = Array.isArray(payload.projects) ? payload.projects : [];
        if (projects.length === 0) {
          await onClearStaleProjectRoute();
          if (cancelled) return;
        }
        onOpenProjectsModal();
      } catch {
        if (cancelled) return;
        onOpenProjectsModal();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    onClearStaleProjectRoute,
    onOpenProjectsModal,
    projectErrorKind,
    projectRouteRequested,
    projectStatus,
    recoveryKey,
    requestedProjectId,
  ]);
};
