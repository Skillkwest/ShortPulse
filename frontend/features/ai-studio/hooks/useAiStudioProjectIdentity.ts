/**
 * AI Studio project-identity hook.
 * Resolves the active `projectId` query to an owned project record and exposes project-backed title updates.
 */
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { normalizeErrorText } from "../../../lib/errorText";
import {
  getAiStudioProjectIdentityViaApi,
  invalidateAiStudioProjectWorkspaceBootstrapCache,
} from "../logic/projectWorkspaceApiClient";

type AiStudioProjectRouteRecord = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type AiStudioProjectRoutePayload = {
  project?: AiStudioProjectRouteRecord;
  error?: unknown;
  details?: unknown;
};

export type AiStudioProjectIdentityRecord = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type AiStudioProjectIdentityStatus = "idle" | "loading" | "ready" | "error";
export type AiStudioProjectIdentityErrorKind =
  | "invalid_id"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "invalid_payload"
  | "server"
  | "network";

type UseAiStudioProjectIdentityResult = {
  requestedProjectId: string | null;
  bootstrapProjectId: string | null;
  projectId: string | null;
  verifiedProjectId: string | null;
  projectRouteRequested: boolean;
  project: AiStudioProjectIdentityRecord | null;
  status: AiStudioProjectIdentityStatus;
  error: string | null;
  errorKind: AiStudioProjectIdentityErrorKind | null;
  refreshProject: () => void;
  updateProjectTitle: (title: string) => Promise<AiStudioProjectIdentityRecord | null>;
};

const PROJECT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class ProjectIdentityError extends Error {
  readonly kind: AiStudioProjectIdentityErrorKind;

  constructor(message: string, kind: AiStudioProjectIdentityErrorKind) {
    super(message);
    this.name = "ProjectIdentityError";
    this.kind = kind;
  }
}

const parseProjectIdQuery = (value: string | string[] | null | undefined): string | null => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return null;
  const normalized = raw.trim();
  return normalized.length > 0 ? normalized : null;
};

const isValidProjectId = (value: string | null): value is string =>
  typeof value === "string" && PROJECT_ID_PATTERN.test(value);

const readRequestedProjectIdFromWindowSearch = (): string | null => {
  if (typeof window === "undefined") return null;
  return parseProjectIdQuery(new URLSearchParams(window.location.search).get("projectId"));
};

const readRequestedProjectIdFromRouteUrl = (url: string): string | null => {
  if (typeof window === "undefined") return null;
  try {
    const parsedUrl = new URL(url, window.location.origin);
    return parseProjectIdQuery(parsedUrl.searchParams.get("projectId"));
  } catch {
    const queryIndex = url.indexOf("?");
    if (queryIndex === -1) return null;
    return parseProjectIdQuery(new URLSearchParams(url.slice(queryIndex)).get("projectId"));
  }
};

const toProjectIdentityRecord = ({
  value,
  expectedProjectId,
}: {
  value: AiStudioProjectRouteRecord | null | undefined;
  expectedProjectId: string;
}): AiStudioProjectIdentityRecord | null => {
  if (!value?.id || !isValidProjectId(value.id)) return null;
  if (value.id.toLowerCase() !== expectedProjectId.toLowerCase()) return null;
  return {
    id: value.id,
    title: value.title,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
};

const resolveProjectUpdateError = (
  status: number,
  payload: AiStudioProjectRoutePayload | null
): { message: string; kind: AiStudioProjectIdentityErrorKind } => {
  if (status === 401) {
    return { message: "Session expired. Retry project load.", kind: "unauthorized" };
  }
  if (status === 400) {
    return { message: "Invalid project link.", kind: "invalid_id" };
  }
  if (status === 403) {
    return { message: "You do not have access to this project.", kind: "forbidden" };
  }
  if (status === 404) {
    return { message: "Project not found.", kind: "not_found" };
  }
  return {
    message:
      normalizeErrorText(payload?.error, { fallback: "" }) ||
      normalizeErrorText(payload?.details, { fallback: "Failed to update project title." }),
    kind: "server",
  };
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
  const [locationProjectId, setLocationProjectId] = useState<string | null>(() =>
    readRequestedProjectIdFromWindowSearch()
  );
  const requestedProjectId = typeof window === "undefined" ? routeProjectId : locationProjectId;
  const bootstrapProjectId = isValidProjectId(requestedProjectId) ? requestedProjectId : null;
  const projectRouteRequested = Boolean(requestedProjectId);
  const invalidRouteProjectId = Boolean(
    router.isReady && requestedProjectId && !isValidProjectId(requestedProjectId)
  );
  const verifiedRouteProjectId = isValidProjectId(requestedProjectId) ? requestedProjectId : null;
  const [refreshNonce, setRefreshNonce] = useState(0);
  const requestKey = verifiedRouteProjectId ? `${verifiedRouteProjectId}:${refreshNonce}` : null;
  const [requestState, setRequestState] = useState<{
    key: string | null;
    project: AiStudioProjectIdentityRecord | null;
    status: "ready" | "error";
    error: string | null;
    errorKind: AiStudioProjectIdentityErrorKind | null;
  }>({
    key: null,
    project: null,
    status: "ready",
    error: null,
    errorKind: null,
  });
  const effectiveProject =
    requestKey && requestState.key === requestKey ? requestState.project : null;
  const effectiveStatus: AiStudioProjectIdentityStatus = invalidRouteProjectId
    ? "error"
    : !requestKey
      ? projectRouteRequested
        ? "loading"
        : "idle"
      : requestState.key === requestKey
        ? requestState.status
        : "loading";
  const effectiveError = invalidRouteProjectId
    ? "Invalid project link."
    : requestKey && requestState.key === requestKey
      ? requestState.error
      : null;
  const effectiveErrorKind: AiStudioProjectIdentityErrorKind | null = invalidRouteProjectId
    ? "invalid_id"
    : requestKey && requestState.key === requestKey
      ? requestState.errorKind
      : null;

  const refreshProject = useCallback(() => {
    setRefreshNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const syncFromWindowLocation = () => {
      setLocationProjectId(readRequestedProjectIdFromWindowSearch());
    };
    const syncFromRouteUrl = (url: string) => {
      setLocationProjectId(readRequestedProjectIdFromRouteUrl(url));
    };
    const syncFromRouteError = () => {
      syncFromWindowLocation();
    };

    syncFromWindowLocation();
    router.events.on("routeChangeStart", syncFromRouteUrl);
    router.events.on("routeChangeComplete", syncFromRouteUrl);
    router.events.on("routeChangeError", syncFromRouteError);
    window.addEventListener("popstate", syncFromWindowLocation);
    return () => {
      router.events.off("routeChangeStart", syncFromRouteUrl);
      router.events.off("routeChangeComplete", syncFromRouteUrl);
      router.events.off("routeChangeError", syncFromRouteError);
      window.removeEventListener("popstate", syncFromWindowLocation);
    };
  }, [router.events]);

  useEffect(() => {
    if (!router.isReady) return;
    if (!verifiedRouteProjectId || !requestKey) return;

    let cancelled = false;

    void getAiStudioProjectIdentityViaApi({
      projectId: verifiedRouteProjectId,
    })
      .then((project) => {
        const nextProject = toProjectIdentityRecord({
          value: project,
          expectedProjectId: verifiedRouteProjectId,
        });
        if (!nextProject) {
          throw new ProjectIdentityError("Project not found.", "invalid_payload");
        }
        if (cancelled) return;
        setRequestState({
          key: requestKey,
          project: nextProject,
          status: "ready",
          error: null,
          errorKind: null,
        });
      })
      .catch((loadError) => {
        if (cancelled) return;
        const normalizedMessage =
          loadError instanceof Error ? loadError.message : "Failed to load project.";
        const errorKind =
          loadError instanceof ProjectIdentityError
            ? loadError.kind
            : normalizedMessage === "Session expired. Retry project load."
              ? "unauthorized"
              : normalizedMessage === "Invalid project link."
                ? "invalid_id"
                : normalizedMessage === "Project not found."
                  ? "not_found"
                  : normalizedMessage === "You do not have access to this project."
                    ? "forbidden"
                    : normalizedMessage === "Failed to load project."
                      ? ("network" as const)
                      : ("server" as const);
        setRequestState({
          key: requestKey,
          project: null,
          status: "error",
          error: normalizedMessage,
          errorKind,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [verifiedRouteProjectId, requestKey, router.isReady]);

  const updateProjectTitle = useCallback(
    async (title: string): Promise<AiStudioProjectIdentityRecord | null> => {
      if (!verifiedRouteProjectId) return null;
      const response = await fetchWithAuth(
        `/api/projects/${encodeURIComponent(verifiedRouteProjectId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ title }),
          shortpulseAuthTimeoutMs: 5000,
        }
      );
      const payload = (await response.json().catch(() => ({}))) as AiStudioProjectRoutePayload;
      if (!response.ok) {
        const resolved = resolveProjectUpdateError(response.status, payload);
        throw new ProjectIdentityError(resolved.message, resolved.kind);
      }
      const nextProject = toProjectIdentityRecord({
        value: payload.project,
        expectedProjectId: verifiedRouteProjectId,
      });
      if (!nextProject) {
        throw new ProjectIdentityError("Project not found.", "invalid_payload");
      }
      invalidateAiStudioProjectWorkspaceBootstrapCache(verifiedRouteProjectId);
      setRequestState({
        key: requestKey,
        project: nextProject,
        status: "ready",
        error: null,
        errorKind: null,
      });
      return nextProject;
    },
    [verifiedRouteProjectId, requestKey]
  );

  return {
    requestedProjectId,
    bootstrapProjectId,
    projectId: requestedProjectId,
    verifiedProjectId: effectiveProject?.id ?? null,
    projectRouteRequested,
    project: effectiveProject,
    status: effectiveStatus,
    error: effectiveError,
    errorKind: effectiveErrorKind,
    refreshProject,
    updateProjectTitle,
  };
};
