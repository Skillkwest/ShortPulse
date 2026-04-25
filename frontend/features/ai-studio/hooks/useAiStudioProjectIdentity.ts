/**
 * AI Studio project-identity hook.
 * Resolves the active `projectId` query to an owned project record and exposes project-backed title updates.
 */
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";

type AiStudioProjectRouteRecord = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type AiStudioProjectRoutePayload = {
  project?: AiStudioProjectRouteRecord;
  error?: string;
  details?: string;
};

export type AiStudioProjectIdentityRecord = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type AiStudioProjectIdentityStatus = "idle" | "loading" | "ready" | "error";

type UseAiStudioProjectIdentityResult = {
  projectId: string | null;
  projectRouteRequested: boolean;
  project: AiStudioProjectIdentityRecord | null;
  status: AiStudioProjectIdentityStatus;
  error: string | null;
  refreshProject: () => void;
  updateProjectTitle: (title: string) => Promise<AiStudioProjectIdentityRecord | null>;
};

const parseProjectIdQuery = (value: string | string[] | null | undefined): string | null => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return null;
  const normalized = raw.trim();
  return normalized.length > 0 ? normalized : null;
};

const readRequestedProjectIdFromWindowSearch = (): string | null => {
  if (typeof window === "undefined") return null;
  return parseProjectIdQuery(new URLSearchParams(window.location.search).get("projectId"));
};

const toProjectIdentityRecord = (
  value: AiStudioProjectRouteRecord | null | undefined
): AiStudioProjectIdentityRecord | null => {
  if (!value?.id) return null;
  return {
    id: value.id,
    title: value.title,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
};

const resolveProjectLoadErrorMessage = (
  status: number,
  payload: AiStudioProjectRoutePayload | null
): string => {
  if (status === 401) {
    return "Session expired. Retry project load.";
  }
  if (status === 400 || status === 403 || status === 404) {
    return "Project not found.";
  }
  return payload?.error?.trim() || payload?.details?.trim() || "Failed to load project.";
};

const resolveProjectUpdateErrorMessage = (
  status: number,
  payload: AiStudioProjectRoutePayload | null
): string => {
  if (status === 401) {
    return "Session expired. Retry project load.";
  }
  if (status === 400 || status === 403 || status === 404) {
    return "Project not found.";
  }
  return payload?.error?.trim() || payload?.details?.trim() || "Failed to update project title.";
};

/**
 * Resolves the current owned project from the `projectId` query and exposes project-backed title updates.
 */
export const useAiStudioProjectIdentity = (): UseAiStudioProjectIdentityResult => {
  const router = useRouter();
  const routeProjectId = useMemo(
    () => parseProjectIdQuery(router.query?.projectId),
    [router.query?.projectId]
  );
  const requestedProjectId = routeProjectId ?? readRequestedProjectIdFromWindowSearch();
  const projectRouteRequested = Boolean(requestedProjectId);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const requestKey = routeProjectId ? `${routeProjectId}:${refreshNonce}` : null;
  const [requestState, setRequestState] = useState<{
    key: string | null;
    project: AiStudioProjectIdentityRecord | null;
    status: "ready" | "error";
    error: string | null;
  }>({
    key: null,
    project: null,
    status: "ready",
    error: null,
  });
  const effectiveProject =
    requestKey && requestState.key === requestKey ? requestState.project : null;
  const effectiveStatus: AiStudioProjectIdentityStatus = !requestKey
    ? projectRouteRequested
      ? "loading"
      : "idle"
    : requestState.key === requestKey
      ? requestState.status
      : "loading";
  const effectiveError = requestKey && requestState.key === requestKey ? requestState.error : null;

  const refreshProject = useCallback(() => {
    setRefreshNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    if (!routeProjectId || !requestKey) return;

    let cancelled = false;

    void fetchWithAuth(`/api/projects/${encodeURIComponent(routeProjectId)}`, {
      method: "GET",
      shortpulseAuthTimeoutMs: 5000,
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as AiStudioProjectRoutePayload;
        if (!response.ok) {
          throw new Error(resolveProjectLoadErrorMessage(response.status, payload));
        }
        const nextProject = toProjectIdentityRecord(payload.project);
        if (!nextProject) {
          throw new Error("Project not found.");
        }
        if (cancelled) return;
        setRequestState({
          key: requestKey,
          project: nextProject,
          status: "ready",
          error: null,
        });
      })
      .catch((loadError) => {
        if (cancelled) return;
        setRequestState({
          key: requestKey,
          project: null,
          status: "error",
          error: loadError instanceof Error ? loadError.message : "Failed to load project.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [routeProjectId, requestKey, router.isReady]);

  const updateProjectTitle = useCallback(
    async (title: string): Promise<AiStudioProjectIdentityRecord | null> => {
      if (!routeProjectId) return null;
      const response = await fetchWithAuth(`/api/projects/${encodeURIComponent(routeProjectId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title }),
        shortpulseAuthTimeoutMs: 5000,
      });
      const payload = (await response.json().catch(() => ({}))) as AiStudioProjectRoutePayload;
      if (!response.ok) {
        throw new Error(resolveProjectUpdateErrorMessage(response.status, payload));
      }
      const nextProject = toProjectIdentityRecord(payload.project);
      if (!nextProject) {
        throw new Error("Project not found.");
      }
      setRequestState({
        key: requestKey,
        project: nextProject,
        status: "ready",
        error: null,
      });
      return nextProject;
    },
    [routeProjectId, requestKey]
  );

  return {
    projectId: routeProjectId,
    projectRouteRequested,
    project: effectiveProject,
    status: effectiveStatus,
    error: effectiveError,
    refreshProject,
    updateProjectTitle,
  };
};
