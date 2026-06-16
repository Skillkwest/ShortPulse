import { useEffect, useRef } from "react";
import type {
  AiStudioProjectIdentityErrorKind,
  AiStudioProjectIdentityStatus,
} from "./useAiStudioProjectIdentity";

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
        await onClearStaleProjectRoute();
        if (cancelled) return;
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
