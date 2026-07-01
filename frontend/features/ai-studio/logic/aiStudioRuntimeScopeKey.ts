/**
 * Resolves the React remount boundary for AI Studio runtime-owned state.
 */
export type AiStudioRuntimeProjectStatus = "idle" | "loading" | "ready" | "error";

export const STANDALONE_RUNTIME_SCOPE_KEY = "standalone";
export const PENDING_PROJECT_RUNTIME_SCOPE_KEY = "project:__pending__";

const isResolvedProjectScopeKey = (value: string | null | undefined): value is string =>
  typeof value === "string" &&
  value.startsWith("project:") &&
  value !== PENDING_PROJECT_RUNTIME_SCOPE_KEY;

/**
 * Keeps the already-mounted project runtime stable while project identity is
 * briefly revalidating, without preventing true project/route changes from
 * remounting runtime-owned state.
 */
export const resolveAiStudioRuntimeScopeKey = ({
  previousScopeKey,
  projectId,
  projectRouteRequested,
  projectStatus,
  requestedProjectId,
}: {
  previousScopeKey: string | null;
  projectId: string | null;
  projectRouteRequested: boolean;
  projectStatus: AiStudioRuntimeProjectStatus;
  requestedProjectId: string | null;
}): string => {
  if (!projectRouteRequested) return STANDALONE_RUNTIME_SCOPE_KEY;
  if (projectId) return `project:${projectId}`;
  const requestedProjectScopeKey = requestedProjectId ? `project:${requestedProjectId}` : null;
  if (
    projectStatus === "loading" &&
    isResolvedProjectScopeKey(previousScopeKey) &&
    previousScopeKey === requestedProjectScopeKey
  ) {
    return previousScopeKey;
  }
  return PENDING_PROJECT_RUNTIME_SCOPE_KEY;
};
